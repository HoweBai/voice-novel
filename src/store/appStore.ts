import { create } from 'zustand'
import type { AppStage, Book, Character, Chapter, Segment, VoiceOption } from '../types'

interface AppState {
  stage: AppStage
  book: Book | null
  voices: VoiceOption[]
  activeChapterId: string | null
  currentSegmentId: string | null
  isPlaying: boolean
  playbackRate: number
  analyzeProgress: { current: number; total: number; title: string } | null
  generateProgress: { current: number; total: number } | null
  error: string | null

  setStage: (s: AppStage) => void
  setVoices: (v: VoiceOption[]) => void
  setBook: (b: Book | null) => void
  setError: (e: string | null) => void
  setAnalyzeProgress: (p: { current: number; total: number; title: string } | null) => void
  setGenerateProgress: (p: { current: number; total: number } | null) => void

  setActiveChapter: (id: string) => void
  setCharacters: (chars: Character[]) => void
  assignVoice: (characterId: string, voiceId: string) => void
  setChapterSegments: (chapterId: string, segments: Segment[]) => void
  updateSegment: (chapterId: string, segmentId: string, patch: Partial<Segment>) => void
  markChapterReady: (chapterId: string, ready: boolean) => void

  setCurrentSegment: (id: string | null) => void
  setIsPlaying: (v: boolean) => void
  setPlaybackRate: (v: number) => void

  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  stage: 'upload',
  book: null,
  voices: [],
  activeChapterId: null,
  currentSegmentId: null,
  isPlaying: false,
  playbackRate: 1,
  analyzeProgress: null,
  generateProgress: null,
  error: null,

  setStage: (s) => set({ stage: s }),
  setVoices: (v) => set({ voices: v }),
  setBook: (b) => set({ book: b, activeChapterId: b?.chapters[0]?.id ?? null }),
  setError: (e) => set({ error: e }),
  setAnalyzeProgress: (p) => set({ analyzeProgress: p }),
  setGenerateProgress: (p) => set({ generateProgress: p }),

  setActiveChapter: (id) => set({ activeChapterId: id, currentSegmentId: null }),
  setCharacters: (chars) =>
    set((st) => (st.book ? { book: { ...st.book, characters: chars } } : {})),
  assignVoice: (characterId, voiceId) =>
    set((st) => {
      if (!st.book) return {}
      const characters = st.book.characters.map((c) =>
        c.id === characterId ? { ...c, voiceId } : c,
      )
      return { book: { ...st.book, characters } }
    }),
  setChapterSegments: (chapterId, segments) =>
    set((st) => {
      if (!st.book) return {}
      const chapters = st.book.chapters.map((ch) =>
        ch.id === chapterId ? { ...ch, segments } : ch,
      )
      return { book: { ...st.book, chapters } }
    }),
  updateSegment: (chapterId, segmentId, patch) =>
    set((st) => {
      if (!st.book) return {}
      const chapters = st.book.chapters.map((ch) =>
        ch.id === chapterId
          ? {
              ...ch,
              segments: ch.segments.map((s) =>
                s.id === segmentId ? { ...s, ...patch } : s,
              ),
            }
          : ch,
      )
      return { book: { ...st.book, chapters } }
    }),
  markChapterReady: (chapterId, ready) =>
    set((st) => {
      if (!st.book) return {}
      const chapters = st.book.chapters.map((ch) =>
        ch.id === chapterId ? { ...ch, audioReady: ready } : ch,
      )
      return { book: { ...st.book, chapters } }
    }),

  setCurrentSegment: (id) => set({ currentSegmentId: id }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setPlaybackRate: (v) => set({ playbackRate: v }),

  reset: () =>
    set({
      stage: 'upload',
      book: null,
      activeChapterId: null,
      currentSegmentId: null,
      isPlaying: false,
      playbackRate: 1,
      analyzeProgress: null,
      generateProgress: null,
      error: null,
    }),
}))

// 便捷选择器
export function useActiveChapter(): Chapter | null {
  return useAppStore((s) => {
    if (!s.book || !s.activeChapterId) return null
    return s.book.chapters.find((c) => c.id === s.activeChapterId) ?? null
  })
}

export function useCharacters(): Character[] {
  return useAppStore((s) => s.book?.characters ?? [])
}
