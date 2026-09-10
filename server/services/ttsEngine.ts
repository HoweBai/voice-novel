import { MsEdgeTTS, OUTPUT_FORMAT, ProsodyOptions } from 'msedge-tts'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { audioPath, audioRelUrl } from '../storage.js'

const require = createRequire(import.meta.url)

const TTS_ENGINE = process.env.TTS_ENGINE || 'edge'

// 情绪 → 速率变化(小数)/音调(Hz) 映射（Edge TTS 用）
const EMOTION_MAP: Record<string, { rate: number; pitch: number }> = {
  calm: { rate: 0, pitch: 0 },
  excited: { rate: 0.15, pitch: 8 },
  happy: { rate: 0.1, pitch: 5 },
  sad: { rate: -0.12, pitch: -6 },
  angry: { rate: 0.18, pitch: 12 },
  serious: { rate: -0.05, pitch: -2 },
  gentle: { rate: -0.05, pitch: 0 },
  fearful: { rate: 0.08, pitch: 10 },
}

// 合成级全局语速系数（用户选择），与情绪语速叠加；clamp 到 TTS 可接受范围
function clampFactor(v: number): number {
  return Math.min(2, Math.max(0.5, v || 1))
}

// 写 16-bit 单声道 PCM WAV（sherpa-onnx 系引擎通用）
function writeWavPcm(outPath: string, samples: Float32Array, sampleRate: number): void {
  const buffer = Buffer.alloc(44 + samples.length * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples.length * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2)
  }
  fs.writeFileSync(outPath, buffer)
}

// 读取 WAV 文件为单声道 Float32Array（按 chunk 扫描解析，兼容 ffmpeg 带 fact/LIST 等额外块的头部）
function readWavMono(filePath: string): { samples: Float32Array; sampleRate: number } {
  const b = fs.readFileSync(filePath)
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`不是合法的 WAV 文件: ${filePath}`)
  }
  let offset = 12
  let sampleRate = 0
  let channels = 1
  let dataOffset = -1
  let dataLen = 0
  while (offset + 8 <= b.length) {
    const id = b.toString('ascii', offset, offset + 4)
    const size = b.readUInt32LE(offset + 4)
    const body = offset + 8
    if (id === 'fmt ') {
      channels = b.readUInt16LE(body + 2)
      sampleRate = b.readUInt32LE(body + 4)
    } else if (id === 'data') {
      dataOffset = body
      dataLen = size
      break
    }
    offset = body + size + (size % 2) // chunk 按偶数字节对齐
  }
  if (dataOffset < 0 || sampleRate === 0) {
    throw new Error(`WAV 缺少 data/fmt 块: ${filePath}`)
  }
  const n = Math.floor(Math.min(dataLen, b.length - dataOffset) / 2 / channels)
  const samples = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    samples[i] = b.readInt16LE(dataOffset + i * channels * 2) / 32768
  }
  return { samples, sampleRate }
}

function prosodyFor(emotion?: string, speedFactor = 1): ProsodyOptions {
  const f = clampFactor(speedFactor)
  const e = (emotion && EMOTION_MAP[emotion]) || EMOTION_MAP.calm
  const rate = (1 + e.rate) * f - 1
  return {
    rate: `${rate >= 0 ? '+' : ''}${Math.round(rate * 100)}%`,
    pitch: `${e.pitch >= 0 ? '+' : ''}${e.pitch}Hz`,
  }
}

// 若配置了代理，则通过 https-proxy-agent 走代理（用于直连 Microsoft 服务受限的网络环境）
function makeAgent() {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY
  if (!proxy) return undefined
  return new HttpsProxyAgent(proxy)
}

const MAX_RETRIES = 3

// 复用已有 TTS 连接合成单段（用于批量合成，减少连接建立开销）
async function synthesizeWithTts(
  tts: MsEdgeTTS,
  text: string,
  voiceShortName: string,
  outPath: string,
  emotion?: string,
  speedFactor = 1,
): Promise<void> {
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await tts.setMetadata(voiceShortName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {})
      const { audioStream } = tts.toStream(text, prosodyFor(emotion, speedFactor))
      await new Promise<void>((resolve, reject) => {
        const ws = fs.createWriteStream(outPath)
        audioStream.pipe(ws)
        ws.on('finish', () => resolve())
        ws.on('error', reject)
        audioStream.on('error', reject)
      })
      return
    } catch (e) {
      lastErr = e
      // 失败后重连再试
      try { tts.close() } catch { /* ignore */ }
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
      }
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(
    `TTS 合成失败（重试 ${MAX_RETRIES} 次仍失败）。原因: ${msg}。` +
      'Edge TTS 需直连 Microsoft 语音服务(wss://speech.platform.bing.com)，若网络受限，请在 .env 中设置 HTTPS_PROXY 走代理。',
  )
}

export async function synthesizeSegment(
  bookId: string,
  segmentId: string,
  text: string,
  voiceShortName: string,
  emotion?: string,
  speedFactor?: number,
): Promise<string> {
  const out = audioPath(bookId, segmentId)
  await synthesize(text, voiceShortName, out, emotion, speedFactor)
  return out
}

// ---- Kokoro TTS 引擎 ----

let kokoroTts: any = null

async function getKokoroTts(): Promise<any> {
  if (kokoroTts) return kokoroTts
  const modelPath = process.env.KOKORO_MODEL_PATH || './models/kokoro'
  console.log('[kokoro] 开始加载模型...')
  const t0 = Date.now()
  // 用 createRequire 加载 CJS 模块，避免 ESM 动态 import 时命名导出挂在 default 上
  const sherpa = require('sherpa-onnx-node')
  console.log('[kokoro] sherpa-onnx-node 已加载，OfflineTts:', typeof sherpa.OfflineTts)
  const config = {
    model: {
      kokoro: {
        model: path.join(modelPath, 'model.onnx'),
        voices: path.join(modelPath, 'voices.bin'),
        tokens: path.join(modelPath, 'tokens.txt'),
        dataDir: path.join(modelPath, 'espeak-ng-data'),
        lexicon: path.join(modelPath, 'lexicon-zh.txt'),
      },
    },
    debug: false,
    numThreads: 1,
    provider: 'cpu',
  }
  kokoroTts = await sherpa.OfflineTts.createAsync(config)
  console.log(`[kokoro] 模型加载完成 (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  return kokoroTts
}

// Kokoro 情绪 → 语速映射
const KOKORO_SPEED: Record<string, number> = {
  calm: 1.0, excited: 1.15, happy: 1.1, sad: 0.88,
  angry: 1.2, serious: 0.95, gentle: 0.92, fearful: 1.08,
}

async function synthesizeWithKokoro(
  text: string,
  voiceId: number,
  outPath: string,
  emotion?: string,
  speedFactor = 1,
): Promise<void> {
  const tts = await getKokoroTts()
  // 情绪语速 × 用户全局语速系数
  const speed = clampFactor((KOKORO_SPEED[emotion || 'calm'] || 1.0) * speedFactor)
  // 使用 generateAsync 避免同步 generate 阻塞 Node.js 事件循环
  const audio = await tts.generateAsync({
    text,
    generationConfig: { sid: voiceId, speed, silenceScale: 0.2 },
  })
  writeWavPcm(outPath, audio.samples as Float32Array, audio.sampleRate as number)
}

// ---- ZipVoice 引擎（sherpa-onnx 零样本声音克隆，需参考音频） ----

let zipvoiceTts: any = null
interface ZipvoiceProfile {
  id: string
  gender: string
  name: string
  style: string
  refWav: string
  refText: string
}
let zipvoiceProfiles: Map<string, ZipvoiceProfile> | null = null
// 参考音频解码结果缓存（每个音色只读盘一次）
const refAudioCache = new Map<string, { samples: Float32Array; sampleRate: number }>()

function getZipvoiceProfiles(): Map<string, ZipvoiceProfile> {
  if (zipvoiceProfiles) return zipvoiceProfiles
  const dir = process.env.ZIPVOICE_VOICES_DIR || './models/zipvoice-voices'
  const file = path.join(dir, 'profiles.json')
  const list = JSON.parse(fs.readFileSync(file, 'utf-8')) as ZipvoiceProfile[]
  zipvoiceProfiles = new Map(list.map((p) => [p.id, p]))
  console.log(`[zipvoice] 已加载 ${zipvoiceProfiles.size} 个参考音色档案 (${dir})`)
  return zipvoiceProfiles
}

async function getZipvoiceTts(): Promise<any> {
  if (zipvoiceTts) return zipvoiceTts
  const modelPath = process.env.ZIPVOICE_MODEL_PATH || './models/sherpa-onnx-zipvoice-distill-int8-zh-en-emilia'
  console.log('[zipvoice] 开始加载模型...')
  const t0 = Date.now()
  const sherpa = require('sherpa-onnx-node')
  const config = {
    model: {
      zipvoice: {
        tokens: path.join(modelPath, 'tokens.txt'),
        encoder: path.join(modelPath, 'encoder.int8.onnx'),
        decoder: path.join(modelPath, 'decoder.int8.onnx'),
        // 模型包不含 vocoder，需单独下载 vocos_24khz.onnx
        vocoder: path.join(modelPath, 'vocos_24khz.onnx'),
        dataDir: path.join(modelPath, 'espeak-ng-data'),
        lexicon: path.join(modelPath, 'lexicon.txt'),
      },
    },
    debug: false,
    numThreads: parseInt(process.env.ZIPVOICE_THREADS || '8', 10),
    provider: 'cpu',
  }
  zipvoiceTts = await sherpa.OfflineTts.createAsync(config)
  console.log(`[zipvoice] 模型加载完成 (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  return zipvoiceTts
}

// 取某音色的参考音频（24k 单声道 float32），带缓存
function getReferenceAudio(profile: ZipvoiceProfile): { samples: Float32Array; sampleRate: number } {
  const cached = refAudioCache.get(profile.id)
  if (cached) return cached
  const dir = process.env.ZIPVOICE_VOICES_DIR || './models/zipvoice-voices'
  const ref = readWavMono(path.join(dir, profile.refWav))
  refAudioCache.set(profile.id, ref)
  return ref
}

// ZipVoice 情绪 → 语速映射（克隆模型无音调参数，仅语速可调）
const ZIPVOICE_SPEED: Record<string, number> = {
  calm: 1.0, excited: 1.15, happy: 1.1, sad: 0.88,
  angry: 1.2, serious: 0.95, gentle: 0.92, fearful: 1.08,
}

async function synthesizeWithZipvoice(
  text: string,
  voiceKey: string,
  outPath: string,
  emotion?: string,
  speedFactor = 1,
): Promise<void> {
  const tts = await getZipvoiceTts()
  const profile = getZipvoiceProfiles().get(voiceKey)
  if (!profile) {
    throw new Error(`ZipVoice 找不到音色档案: ${voiceKey}（检查 ${process.env.ZIPVOICE_VOICES_DIR || './models/zipvoice-voices'}/profiles.json）`)
  }
  const { samples: referenceAudio, sampleRate: referenceSampleRate } = getReferenceAudio(profile)
  // ZipVoice 的 speed 参数实际作用偏激进（1.25 会快约 2.7 倍），
  // 因此把情绪/用户语速的偏移量衰减一半后再夹紧到 [0.85, 1.15] 的安全区间
  const rawSpeed = (ZIPVOICE_SPEED[emotion || 'calm'] || 1.0) * clampFactor(speedFactor)
  const speed = Math.min(1.15, Math.max(0.85, 1 + (rawSpeed - 1) * 0.5))
  const numSteps = parseInt(process.env.ZIPVOICE_NUM_STEPS || '4', 10)
  // 零样本克隆：参考音频 + 参考文本必须精确对应
  const audio = await tts.generateAsync({
    text,
    generationConfig: {
      speed,
      numSteps,
      referenceAudio,
      referenceSampleRate,
      referenceText: profile.refText,
    },
  })
  writeWavPcm(outPath, audio.samples as Float32Array, audio.sampleRate as number)
}

// 统一合成入口：按配置选择引擎
export async function synthesize(
  text: string,
  voiceShortName: string,
  outPath: string,
  emotion?: string,
  speedFactor?: number,
): Promise<void> {
  if (TTS_ENGINE === 'kokoro') {
    // Kokoro 用数字 voiceId，从 voiceShortName 解析
    const voiceId = parseInt(voiceShortName, 10) || 48
    await synthesizeWithKokoro(text, voiceId, outPath, emotion, speedFactor)
    return
  }
  if (TTS_ENGINE === 'zipvoice') {
    // ZipVoice 用参考音色档案 id（如 zv-yunxi）
    await synthesizeWithZipvoice(text, voiceShortName, outPath, emotion, speedFactor)
    return
  }
  // Edge TTS
  const tts = new MsEdgeTTS(makeAgent())
  try {
    await synthesizeWithTts(tts, text, voiceShortName, outPath, emotion, speedFactor)
  } finally {
    tts.close()
  }
}

// 根据文件大小估算时长（秒）
// 本地 sherpa-onnx 引擎 WAV: 24kHz 16-bit mono = 48000 bytes/s（减去 44 字节文件头）
// Edge MP3: 96kbit/s = 12000 bytes/s
function estimateDuration(filePath: string): number {
  const stat = fs.statSync(filePath)
  if (TTS_ENGINE === 'kokoro' || TTS_ENGINE === 'zipvoice') {
    const dataBytes = Math.max(0, stat.size - 44)
    return Math.ceil(dataBytes / 48000)
  }
  return Math.ceil(stat.size / 12000)
}

// 批量合成
export async function synthesizeBatch(
  bookId: string,
  items: { segmentId: string; text: string; voice: string; emotion?: string }[],
  onProgress?: (index: number, segmentId: string, audioUrl: string, durationSec: number) => void,
  onError?: (index: number, segmentId: string, message: string) => void,
  speedFactor?: number,
): Promise<void> {
  if (TTS_ENGINE === 'kokoro' || TTS_ENGINE === 'zipvoice') {
    // 本地 sherpa-onnx 引擎批量合成：每段之间让出事件循环，避免长时间阻塞其它请求
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const outPath = audioPath(bookId, item.segmentId)
      const exists = fs.existsSync(outPath) && fs.statSync(outPath).size > 0
      if (exists) {
        onProgress?.(i, item.segmentId, audioRelUrl(bookId, item.segmentId), estimateDuration(outPath))
        continue
      }
      try {
        // 原生推理偶发瞬时错误，重试 2 次
        let lastErr: any
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await synthesize(item.text, item.voice, outPath, item.emotion, speedFactor)
            lastErr = null
            break
          } catch (e) {
            lastErr = e
            await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
          }
        }
        if (lastErr) throw lastErr
        onProgress?.(i, item.segmentId, audioRelUrl(bookId, item.segmentId), estimateDuration(outPath))
      } catch (e: any) {
        onError?.(i, item.segmentId, e?.message || 'TTS 失败')
      }
      // 让出事件循环，让其它请求得以处理
      await new Promise((r) => setImmediate(r))
    }
    return
  }
  // Edge TTS 批量合成
  const tts = new MsEdgeTTS(makeAgent())
  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const outPath = audioPath(bookId, item.segmentId)
      const exists = fs.existsSync(outPath) && fs.statSync(outPath).size > 0
      if (exists) {
        onProgress?.(i, item.segmentId, audioRelUrl(bookId, item.segmentId), estimateDuration(outPath))
        continue
      }
      try {
        await synthesizeWithTts(tts, item.text, item.voice, outPath, item.emotion, speedFactor)
        onProgress?.(i, item.segmentId, audioRelUrl(bookId, item.segmentId), estimateDuration(outPath))
      } catch (e: any) {
        onError?.(i, item.segmentId, e?.message || 'TTS 失败')
      }
    }
  } finally {
    try { tts.close() } catch { /* ignore */ }
  }
}
