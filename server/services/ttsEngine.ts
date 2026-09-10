import { MsEdgeTTS, OUTPUT_FORMAT, ProsodyOptions } from 'msedge-tts'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fs from 'node:fs'
import { audioPath, audioRelUrl } from '../storage.js'

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

// 单段合成（内部创建连接）
export async function synthesize(
  text: string,
  voiceShortName: string,
  outPath: string,
  emotion?: string,
): Promise<void> {
  const tts = new MsEdgeTTS(makeAgent())
  try {
    await synthesizeWithTts(tts, text, voiceShortName, outPath, emotion)
  } finally {
    tts.close()
  }
}

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

// 批量合成：复用同一个 WebSocket 连接，减少频繁建连导致的代理不稳定
export async function synthesizeBatch(
  bookId: string,
  items: { segmentId: string; text: string; voice: string; emotion?: string }[],
  onProgress?: (index: number, segmentId: string, audioUrl: string, durationSec: number) => void,
  onError?: (index: number, segmentId: string, message: string) => void,
): Promise<void> {
  const tts = new MsEdgeTTS(makeAgent())
  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const outPath = audioPath(bookId, item.segmentId)
      // 已存在且非空则跳过
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
