import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export interface ParsedChapter {
  id: string
  title: string
  rawText: string
}

export interface ParseResult {
  title: string
  chapters: ParsedChapter[]
}

// 从纯文本中按章节标题切分
const CHAPTER_REGEX = /^\s*(?:第[一二三四五六七八九十百千零\d]+[章节回卷部]|Chapter\s+\d+|第\d+话)\s*[：:．.\-\s]*(.*)$/im

function splitIntoChapters(text: string, fallbackTitle: string): ParsedChapter[] {
  const lines = text.split(/\r?\n/)
  const chapters: ParsedChapter[] = []
  let currentTitle = ''
  let buffer: string[] = []
  let idx = 0

  const flush = () => {
    const body = buffer.join('\n').trim()
    if (body || currentTitle) {
      idx++
      chapters.push({
        id: `ch-${idx}`,
        title: currentTitle || `${fallbackTitle} · ${idx}`,
        rawText: body,
      })
    }
    buffer = []
  }

  for (const line of lines) {
    const m = line.match(CHAPTER_REGEX)
    if (m) {
      flush()
      currentTitle = (m[1] || line).trim()
      if (!currentTitle) currentTitle = line.trim()
    } else {
      buffer.push(line)
    }
  }
  flush()

  // 若没有识别出章节标题，整篇作为单章
  if (chapters.length === 0) {
    chapters.push({ id: 'ch-1', title: fallbackTitle, rawText: text.trim() })
  }
  // 若只有标题无内容的空章合并掉
  const real = chapters.filter((c) => c.rawText.length > 0)
  return real.length > 0 ? real : chapters
}

async function parseTxt(filePath: string, fileName: string): Promise<ParseResult> {
  const raw = await fs.promises.readFile(filePath, 'utf-8')
  const title = fileName.replace(/\.[^.]+$/, '')
  return { title, chapters: splitIntoChapters(raw, title) }
}

async function parseEpub(filePath: string, fileName: string): Promise<ParseResult> {
  const { EPub } = require('epub2')
  // createAsync 返回已解析完毕的 epub 实例
  const epub: any = await EPub.createAsync(filePath)
  let fullText = ''
  for (const item of epub.flow) {
    const html: string = await epub.getChapterAsync(item.id)
    fullText += stripHtml(html) + '\n'
  }
  const title = metaString(epub.metadata?.title) || fileName.replace(/\.[^.]+$/, '')
  return { title, chapters: splitIntoChapters(fullText, title) }
}

async function parseDocx(filePath: string, fileName: string): Promise<ParseResult> {
  const mammoth = require('mammoth')
  const result = await mammoth.extractRawText({ path: filePath })
  const title = fileName.replace(/\.[^.]+$/, '')
  return { title, chapters: splitIntoChapters(result.value, title) }
}

// epub2 v3 的 metadata 字段可能是 { _text } / { '#text' } / 数组等结构，统一转字符串
function metaString(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(metaString).filter(Boolean).join(' ')
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    return metaString(o._text ?? o['#text'] ?? o.text ?? o.value ?? '')
  }
  return String(v)
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function parseDocument(filePath: string, fileName: string): Promise<ParseResult> {
  const ext = path.extname(fileName).toLowerCase()
  if (ext === '.txt') return parseTxt(filePath, fileName)
  if (ext === '.epub') return parseEpub(filePath, fileName)
  if (ext === '.docx') return parseDocx(filePath, fileName)
  // 默认按文本处理
  return parseTxt(filePath, fileName)
}
