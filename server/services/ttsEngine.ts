import { MsEdgeTTS, OUTPUT_FORMAT, ProsodyOptions } from 'msedge-tts'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fs from 'node:fs'
import path from 'node:path'
import { audioPath, audioRelUrl } from '../storage.js'

const TTS_ENGINE = process.env.TTS_ENGINE || 'edge'

// 情绪 → prosody 速率/音调映射
const EMOTION_MAP: Record<string, ProsodyOptions> = {
  calm: { rate: '+0%', pitch: '+0Hz' },
  excited: { rate: '+15%', pitch: '+8Hz' },
  happy: { rate: '+10%', pitch: '+5Hz' },
  sad: { rate: '-12%', pitch: '-6Hz' },
  angry: { rate: '+18%', pitch: '+12Hz' },
  serious: { rate: '-5%', pitch: '-2Hz' },
  gentle: { rate: '-5%', pitch: '+0Hz' },
  fearful: { rate: '+8%', pitch: '+10Hz' },
}

function prosodyFor(emotion?: string): ProsodyOptions {
  if (!emotion) return {}
  return EMOTION_MAP[emotion] || {}
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
): Promise<void> {
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await tts.setMetadata(voiceShortName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {})
      const { audioStream } = tts.toStream(text, prosodyFor(emotion))
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
): Promise<string> {
  const out = audioPath(bookId, segmentId)
  await synthesize(text, voiceShortName, out, emotion)
  return out
}

// ---- Kokoro TTS 引擎 ----

let kokoroTts: any = null

async function getKokoroTts(): Promise<any> {
  if (kokoroTts) return kokoroTts
  const modelPath = process.env.KOKORO_MODEL_PATH || './models/kokoro'
  const sherpa = await import('sherpa-onnx-node')
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
  return kokoroTts
}

// Kokoro 情绪 → 语速映射
const KOKORO_SPEED: Record<string, number> = {
  calm: 1.0, excited: 1.15, happy: 1.1, sad: 0.88,
  angry: 1.2, serious: 0.95, gentle: 0.92, fearful: 1.08,
}

function synthesizeWithKokoro(
  text: string,
  voiceId: number,
  outPath: string,
  emotion?: string,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const tts = await getKokoroTts()
      const speed = KOKORO_SPEED[emotion || 'calm'] || 1.0
      const audio = tts.generate({
        text,
        generationConfig: { sid: voiceId, speed, silenceScale: 0.2 },
      })
      // sherpa-onnx 输出 WAV，直接写入文件
      const samples = audio.samples as Float32Array
      const sampleRate = audio.sampleRate as number
      // 写 WAV 文件
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
      resolve()
    } catch (e) {
      reject(e)
    }
  })
}

// 统一合成入口：按配置选择引擎
export async function synthesize(
  text: string,
  voiceShortName: string,
  outPath: string,
  emotion?: string,
): Promise<void> {
  if (TTS_ENGINE === 'kokoro') {
    // Kokoro 用数字 voiceId，从 voiceShortName 解析
    const voiceId = parseInt(voiceShortName, 10) || 48
    await synthesizeWithKokoro(text, voiceId, outPath, emotion)
    return
  }
  // Edge TTS
  const tts = new MsEdgeTTS(makeAgent())
  try {
    await synthesizeWithTts(tts, text, voiceShortName, outPath, emotion)
  } finally {
    tts.close()
  }
}

// 批量合成
export async function synthesizeBatch(
  bookId: string,
  items: { segmentId: string; text: string; voice: string; emotion?: string }[],
  onProgress?: (index: number, segmentId: string, audioUrl: string, durationSec: number) => void,
  onError?: (index: number, segmentId: string, message: string) => void,
): Promise<void> {
  if (TTS_ENGINE === 'kokoro') {
    // Kokoro 批量合成
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const outPath = audioPath(bookId, item.segmentId)
      const exists = fs.existsSync(outPath) && fs.statSync(outPath).size > 0
      if (exists) {
        const stat = fs.statSync(outPath)
        onProgress?.(i, item.segmentId, audioRelUrl(bookId, item.segmentId), Math.ceil(stat.size / 4000))
        continue
      }
      try {
        const voiceId = parseInt(item.voice, 10) || 48
        await synthesizeWithKokoro(item.text, voiceId, outPath, item.emotion)
        const stat = fs.statSync(outPath)
        onProgress?.(i, item.segmentId, audioRelUrl(bookId, item.segmentId), Math.ceil(stat.size / 4000))
      } catch (e: any) {
        onError?.(i, item.segmentId, e?.message || 'TTS 失败')
      }
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
        const stat = fs.statSync(outPath)
        onProgress?.(i, item.segmentId, audioRelUrl(bookId, item.segmentId), Math.ceil(stat.size / 4000))
        continue
      }
      try {
        await synthesizeWithTts(tts, item.text, item.voice, outPath, item.emotion)
        const stat = fs.statSync(outPath)
        onProgress?.(i, item.segmentId, audioRelUrl(bookId, item.segmentId), Math.ceil(stat.size / 4000))
      } catch (e: any) {
        onError?.(i, item.segmentId, e?.message || 'TTS 失败')
      }
    }
  } finally {
    try { tts.close() } catch { /* ignore */ }
  }
}
