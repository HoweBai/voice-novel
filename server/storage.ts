import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.cwd(), 'storage')

export function bookDir(bookId: string) {
  const dir = path.join(ROOT, bookId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function audioPath(bookId: string, segmentId: string) {
  return path.join(bookDir(bookId), `${segmentId}.mp3`)
}

export function audioRelUrl(bookId: string, segmentId: string) {
  return `/audio/${bookId}/${segmentId}.mp3`
}

export function removeBook(bookId: string) {
  const dir = path.join(ROOT, bookId)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

export function ensureRoot() {
  if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true })
}
