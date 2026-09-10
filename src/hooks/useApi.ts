import { useCallback } from 'react'
import axios from 'axios'
import type { Chapter, Character, Segment } from '../types'
import { useAppStore } from '../store/appStore'
import { defaultVoiceFor } from '../lib/constants'

const api = axios.create({ baseURL: '' })

export interface UploadResponse {
  bookId: string
  title: string
  chapters: { id: string; title: string; rawText: string }[]
}

export interface AnalyzeResponse {
  characters: Character[]
  segments: Segment[]
}

export function useApi() {
  const {
    setBook,
    setStage,
    setError,
    setAnalyzeProgress,
    setCharacters,
    setChapterSegments,
    setGenerateProgress,
    updateSegment,
    markChapterReady,
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
      return book
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || '上传失败')
      setStage('upload')
      return null
    }
  }, [setBook, setStage, setError])

  // 逐章分析整本书
  const analyzeAll = useCallback(async (book: NonNullable<ReturnType<typeof useAppStore.getState>['book']>) => {
    setError(null)
    const total = book.chapters.length
    let mergedChars: Character[] = []
    const charById = new Map<string, Character>()

    for (let i = 0; i < total; i++) {
      const ch = book.chapters[i]
      setAnalyzeProgress({ current: i + 1, total, title: ch.title })
      try {
        const { data } = await api.post<AnalyzeResponse>('/api/analyze', { rawText: ch.rawText })
        // 合并角色：按名字去重
        for (const c of data.characters) {
          if (!charById.has(c.id) && !Array.from(charById.values()).some((x) => x.name === c.name)) {
            // 给默认音色（除非已是 narrator）
            const voice = c.id === 'narrator' ? 'zh-CN-XiaoxiaoNeural' : defaultVoiceFor(c.gender)
            charById.set(c.id, { ...c, voiceId: voice })
          }
        }
        setChapterSegments(ch.id, data.segments)
      } catch (e: any) {
        setError(e?.response?.data?.error || e?.message || `分析第 ${i + 1} 章失败`)
        setAnalyzeProgress(null)
        setStage('upload')
        return
      }
    }

    mergedChars = Array.from(charById.values())
    setCharacters(mergedChars)
    setAnalyzeProgress(null)
    if (mergedChars.length === 0) {
      setError('AI 未识别到任何角色，请检查读物内容后重试')
      setStage('upload')
      return
    }
    setStage('cast')
  }, [setCharacters, setChapterSegments, setAnalyzeProgress, setStage, setError])

  const fetchVoices = useCallback(async () => {
    try {
      const { data } = await api.get('/api/voices')
      useAppStore.getState().setVoices(data)
    } catch {
      // 忽略，前端内置了目录
    }
  }, [])

  // 为某章生成音频（SSE）
  const generateChapter = useCallback(
    async (bookId: string, chapter: Chapter, assignments: Record<string, string>) => {
      setError(null)
      setStage('generating')
      setGenerateProgress({ current: 0, total: chapter.segments.length })
      return new Promise<void>((resolve) => {
        // EventSource 不支持 POST，改用 fetch + ReadableStream 手动消费 SSE
        fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId, segments: chapter.segments, assignments }),
        })
          .then(async (res) => {
            if (!res.body) {
              resolve()
              return
            }
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
                    updateSegment(chapter.id, evt.segmentId, {
                      audioUrl: evt.audioUrl,
                      durationSec: evt.durationSec,
                      status: 'ready',
                    })
                    setGenerateProgress({ current: evt.index + 1, total: evt.total })
                  } else if (evt.type === 'error') {
                    updateSegment(chapter.id, evt.segmentId, { status: 'error' })
                  } else if (evt.type === 'done' || evt.type === 'fatal') {
                    if (evt.type === 'fatal') setError(evt.message)
                  }
                } catch {
                  /* ignore */
                }
              }
            }
            markChapterReady(chapter.id, true)
            setGenerateProgress(null)
            setStage('playing')
            resolve()
          })
          .catch((e) => {
            setError(e?.message || '生成失败')
            setGenerateProgress(null)
            setStage('cast')
            resolve()
          })
      })
    },
    [setStage, setGenerateProgress, updateSegment, markChapterReady, setError],
  )

  return { upload, analyzeAll, generateChapter, fetchVoices }
}
