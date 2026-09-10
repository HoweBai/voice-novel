import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.cwd(), 'storage')

// 本地 sherpa-onnx 引擎（kokoro/zipvoice）输出 WAV，Edge 输出 MP3；扩展名必须与实际格式一致，
// 否则 express.static 会按扩展名设置错误的 Content-Type，导致浏览器无法播放
const AUDIO_EXT = process.env.TTS_ENGINE === 'kokoro' || process.env.TTS_ENGINE === 'zipvoice' ? 'wav' : 'mp3'

export function bookDir(bookId: string) {
  const dir = path.join(ROOT, bookId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function audioPath(bookId: string, segmentId: string) {
  return path.join(bookDir(bookId), `${segmentId}.${AUDIO_EXT}`)
}

export function audioRelUrl(bookId: string, segmentId: string) {
  return `/audio/${bookId}/${segmentId}.${AUDIO_EXT}`
}

export function removeBook(bookId: string) {
  const dir = path.join(ROOT, bookId)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

export function ensureRoot() {
  if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true })
}
