import { useCallback } from 'react'
import axios from 'axios'
import type { Chapter, Character, Segment, VoiceOption } from '../types'
import { useAppStore } from '../store/appStore'
import { VOICES as FALLBACK_VOICES } from '../lib/constants'

const api = axios.create({ baseURL: '' })

// 旁白类音色的风格标记（角色选音色时排除，避免与旁白撞音）
const NARRATOR_STYLE_RE = /旁白首选|叙述感|新闻播音/

function pickNarratorVoice(voices: VoiceOption[]): VoiceOption {
  const list = voices.length > 0 ? voices : FALLBACK_VOICES
  return list.find((v) => v.style?.includes('旁白首选')) || list[0]
}

// 角色音色池：同性别、排除旁白类音色，多个同性别角色轮换以区分声线
function pickRoleVoice(voices: VoiceOption[], gender: string, roleIndex: number): VoiceOption {
  const list = voices.length > 0 ? voices : FALLBACK_VOICES
  const pool = list.filter((v) => v.gender === gender && !NARRATOR_STYLE_RE.test(v.style || ''))
  const fallback = list.find((v) => v.gender === gender) || list[0]
  return pool[roleIndex % pool.length] || fallback
}

// 为一批新角色分配默认音色；existing 为已有的 角色id→voiceId，保证轮换序号延续
function assignDefaultVoices(
  chars: Character[],
  voices: VoiceOption[],
  existing?: Record<string, string>,
): Character[] {
  const used: Record<string, number> = { male: 0, female: 0 }
  const list = voices.length > 0 ? voices : FALLBACK_VOICES
  // 统计已存在的角色（排除旁白）各性别用了多少个声线
  if (existing) {
    for (const voiceId of Object.values(existing)) {
      const v = list.find((x) => x.shortName === voiceId)
      if (v && (v.gender === 'male' || v.gender === 'female')) used[v.gender]++
    }
  }
  return chars.map((c) => {
    if (c.id === 'narrator' || c.gender === 'neutral') {
      return { ...c, voiceId: pickNarratorVoice(list).shortName }
    }
    const idx = used[c.gender] ?? 0
    used[c.gender] = idx + 1
    return { ...c, voiceId: pickRoleVoice(list, c.gender, idx).shortName }
  })
}

// 第一部分让用户尽快进入配音/收听（约 5000 字），后续部分在后台静默处理
const FIRST_PART_CHARS = 5000
const PART_CHARS = 10000

function splitParts(text: string, firstLimit = FIRST_PART_CHARS): string[] {
  const parts: string[] = []
  let start = 0
  let limit = firstLimit
  while (start < text.length) {
    let end = Math.min(start + limit, text.length)
    if (end < text.length) {
      const slice = text.slice(start, end)
      // 优先在句末标点/换行处断开，避免割裂对白
      const breaks = ['\n', '。', '！', '？', '…', '”']
      let cut = -1
      for (const mark of breaks) {
        const idx = slice.lastIndexOf(mark)
        if (idx > cut) cut = idx
      }
      if (cut > limit * 0.5) end = start + cut + 1
    }
    parts.push(text.slice(start, end))
    start = end
    limit = PART_CHARS
  }
  return parts
}

export interface UploadResponse {
  bookId: string
  title: string
  chapters: { id: string; title: string; rawText: string }[]
}

export interface AnalyzeResponse {
  characters: Character[]
  segments: Segment[]
}

// 后台待处理的部分（模块级，跨渲染保持）
let pendingParts: { chapterId: string; text: string }[] = []
let pipelineRunning = false

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 消费 SSE 生成流，逐段更新 store；返回成功/失败计数
// 后台任务占用生成锁时返回 409，自动排队等待重试
async function streamGenerate(
  bookId: string,
  chapterId: string,
  segments: Segment[],
  assignments: Record<string, string>,
  speedFactor: number,
  onProgress?: (index: number, total: number) => void,
): Promise<{ ok: number; fail: number }> {
  if (segments.length === 0) return { ok: 0, fail: 0 }

  for (let attempt = 0; attempt < 120; attempt++) {
    const res = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, segments, assignments, speedFactor }),
    }).catch(() => null)

    if (!res) return { ok: 0, fail: segments.length }
    if (res.status === 409) {
      // 有配音任务进行中（后台流水线），等待后重试
      await sleep(5000)
      continue
    }
    if (!res.body || !res.ok) return { ok: 0, fail: segments.length }

    let ok = 0
    let fail = 0
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const part of parts) {
        const line = part.replace(/^data:\s*/, '').trim()
        if (!line) continue
        try {
          const evt = JSON.parse(line)
          if (evt.type === 'progress') {
            ok++
            useAppStore.getState().updateSegment(chapterId, evt.segmentId, {
              audioUrl: evt.audioUrl,
              durationSec: evt.durationSec,
              status: 'ready',
            })
            onProgress?.(evt.index, evt.total)
            const bg = useAppStore.getState().backgroundProgress
            if (bg && bg.phase === 'generating' && bg.chapterId === chapterId) {
              useAppStore.getState().setBackgroundProgress({ ...bg, current: evt.index + 1, total: evt.total })
            }
          } else if (evt.type === 'error') {
            fail++
            useAppStore.getState().updateSegment(chapterId, evt.segmentId, { status: 'error' })
          } else if (evt.type === 'fatal') {
            useAppStore.getState().setError(evt.message)
          }
        } catch {
          /* ignore */
        }
      }
    }
    return { ok, fail }
  }
  return { ok: 0, fail: segments.length }
}

export function useApi() {
  const {
    setBook,
    setStage,
    setError,
    setAnalyzeProgress,
    setCharacters,
    mergeCharacters,
    setChapterSegments,
    appendChapterSegments,
    setGenerateProgress,
    updateSegment,
    markChapterReady,
    setBackgroundProgress,
    setBackgroundDone,
  } = useAppStore()

  const upload = useCallback(async (file: File) => {
    setError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const { data } = await api.post<UploadResponse>('/api/upload', form)
      const book = {
        id: data.bookId,
        title: data.title,
        chapters: data.chapters as Chapter[],
        characters: [] as Character[],
      }
      setBook(book)
      setStage('analyzing')
      // 重置后台流水线状态
      pendingParts = []
      pipelineRunning = false
      setBackgroundDone(false)
      return book
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || '上传失败')
      setStage('upload')
      return null
    }
  }, [setBook, setStage, setError, setBackgroundDone])

  const fetchVoices = useCallback(async () => {
    try {
      const { data } = await api.get('/api/voices')
      useAppStore.getState().setVoices(data)
    } catch {
      // 忽略，前端内置了目录
    }
  }, [])

  // 确保拿到后端音色目录再分配默认音色（避免回退到内置 Edge 目录导致引擎不匹配）
  const ensureVoices = useCallback(async () => {
    if (useAppStore.getState().voices.length === 0) await fetchVoices()
  }, [fetchVoices])

  // 渐进式分析：仅快速分析第一章的第一部分，其余进入后台队列
  const analyzeAll = useCallback(async (book: NonNullable<ReturnType<typeof useAppStore.getState>['book']>) => {
    setError(null)
    await ensureVoices()
    const voices = useAppStore.getState().voices

    // 为每章拆分部分；第一章第一部分立即分析
    const plan: { chapter: Chapter; parts: string[] }[] = book.chapters.map((ch) => ({
      chapter: ch,
      parts: splitParts(ch.rawText),
    }))
    const totalParts = plan.reduce((n, p) => n + p.parts.length, 0)
    pendingParts = []
    for (const p of plan) {
      // 第一部分进入立即处理，其余排队
      p.parts.slice(1).forEach((text) => pendingParts.push({ chapterId: p.chapter.id, text }))
    }
    // 注意：pendingParts 顺序应为"第一章剩余部分 → 后续章节"，上面的写法已按章节顺序

    const first = plan[0]
    setAnalyzeProgress({ current: 1, total: totalParts, title: first.chapter.title })
    try {
      const { data } = await api.post<AnalyzeResponse>('/api/analyze', {
        rawText: first.parts[0],
      })
      // 旁白用旁白音色，同性别角色轮换不同声线，避免角色之间/与旁白撞音
      const assigned = assignDefaultVoices(data.characters, voices)
      setCharacters(assigned)
      setChapterSegments(first.chapter.id, data.segments)
      setAnalyzeProgress(null)
      if (data.characters.length === 0) {
        setError('AI 未识别到任何角色，请检查读物内容后重试')
        setStage('upload')
        return
      }
      setStage('cast')
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || '分析失败')
      setAnalyzeProgress(null)
      setStage('upload')
    }
  }, [ensureVoices, setCharacters, setChapterSegments, setAnalyzeProgress, setStage, setError])

  // 后台流水线：顺序分析 + 配音剩余部分（用户收听时无感进行）
  const runBackgroundPipeline = useCallback(
    async (bookId: string, speedFactor: number) => {
      if (pipelineRunning || pendingParts.length === 0) {
        if (pendingParts.length === 0) setBackgroundDone(true)
        return
      }
      pipelineRunning = true
      const total = pendingParts.length + 1 // +1 表示已完成的第一部分
      try {
        for (let i = 0; i < pendingParts.length; i++) {
          const part = pendingParts[i]
          const store = useAppStore.getState()
          const priorChars = (store.book?.characters ?? []).map((c) => ({
            id: c.id, name: c.name, gender: c.gender, description: c.description,
          }))

          setBackgroundProgress({
            chapterId: part.chapterId, partIndex: i + 1, totalParts: total,
            phase: 'analyzing', current: 0, total: 0,
          })

          // 1) 分析本部分
          let data: AnalyzeResponse
          try {
            const resp = await api.post<AnalyzeResponse>('/api/analyze', {
              rawText: part.text,
              priorCharacters: priorChars,
            })
            data = resp.data
          } catch (e: any) {
            // 单部分分析失败：跳过，避免卡住整个流水线
            continue
          }

          // 2) 合并新角色（延续已有轮换序号自动分配不同音色）
          const voices = useAppStore.getState().voices
          const currentChars = useAppStore.getState().book?.characters ?? []
          const existingIds = new Set(currentChars.map((c) => c.id))
          const existingAssignments: Record<string, string> = {}
          for (const c of currentChars) if (c.voiceId) existingAssignments[c.id] = c.voiceId
          const newChars = assignDefaultVoices(
            data.characters.filter((c) => !existingIds.has(c.id)),
            voices,
            existingAssignments,
          )
          if (newChars.length > 0) mergeCharacters(newChars)
          appendChapterSegments(part.chapterId, data.segments)

          // 3) 为本部分配音
          const assignments: Record<string, string> = {}
          for (const c of useAppStore.getState().book?.characters ?? []) {
            if (c.voiceId) assignments[c.id] = c.voiceId
          }
          setBackgroundProgress({
            chapterId: part.chapterId, partIndex: i + 1, totalParts: total,
            phase: 'generating', current: 0, total: data.segments.length,
          })
          await streamGenerate(bookId, part.chapterId, data.segments, assignments, speedFactor)
          markChapterReady(part.chapterId, true)
        }
        setBackgroundDone(true)
      } finally {
        pipelineRunning = false
        pendingParts = []
        setBackgroundProgress(null)
      }
    },
    [mergeCharacters, appendChapterSegments, markChapterReady, setBackgroundProgress, setBackgroundDone],
  )

  // 为某章生成音频（SSE）
  const generateChapter = useCallback(
    async (bookId: string, chapter: Chapter, assignments: Record<string, string>, speedFactor = 1) => {
      setError(null)
      setStage('generating')
      setGenerateProgress({ current: 0, total: chapter.segments.length })
      const result = await streamGenerate(
        bookId, chapter.id, chapter.segments, assignments, speedFactor,
        (index, total) => setGenerateProgress({ current: index + 1, total }),
      )
      // 更精确的进度：直接用流内计数
      setGenerateProgress(null)
      markChapterReady(chapter.id, true)
      setStage('playing')
      // 第一部分开始播放后，剩余部分后台静默处理
      void runBackgroundPipeline(bookId, speedFactor)
      return result
    },
    [setStage, setGenerateProgress, markChapterReady, runBackgroundPipeline],
  )

  return { upload, analyzeAll, generateChapter, fetchVoices }
}
