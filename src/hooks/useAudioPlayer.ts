import { useEffect, useRef, useCallback } from 'react'
import { useAppStore, useActiveChapter } from '../store/appStore'
import type { Segment } from '../types'

// 按序播放当前章节的 segments，自动连播 + 字幕同步
export function useAudioPlayer() {
  const chapter = useActiveChapter()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
  }

  const { isPlaying, playbackRate, currentSegmentId, setCurrentSegment, setIsPlaying, setPlaybackRate } =
    useAppStore()

  const segments = chapter?.segments ?? []
  const readySegments = segments.filter((s) => s.audioUrl)
  const currentIndex = readySegments.findIndex((s) => s.id === currentSegmentId)

  const playIndex = useCallback(
    (idx: number) => {
      const audio = audioRef.current
      if (!audio) return
      const seg = readySegments[idx]
      if (!seg || !seg.audioUrl) {
        setIsPlaying(false)
        return
      }
      setCurrentSegment(seg.id)
      audio.src = seg.audioUrl
      audio.playbackRate = playbackRate
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readySegments, playbackRate],
  )

  const play = useCallback(() => {
    if (readySegments.length === 0) return
    const idx = currentIndex < 0 ? 0 : currentIndex
    playIndex(idx)
  }, [readySegments, currentIndex, playIndex, setIsPlaying, setCurrentSegment])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }, [setIsPlaying])

  const toggle = useCallback(() => {
    if (isPlaying) pause()
    else play()
  }, [isPlaying, pause, play])

  const next = useCallback(() => {
    const idx = currentIndex < 0 ? 0 : currentIndex + 1
    if (idx < readySegments.length) playIndex(idx)
  }, [currentIndex, readySegments.length, playIndex])

  const prev = useCallback(() => {
    const idx = currentIndex < 0 ? 0 : currentIndex - 1
    if (idx >= 0) playIndex(idx)
  }, [currentIndex, playIndex])

  const seekTo = useCallback(
    (segId: string) => {
      const idx = readySegments.findIndex((s) => s.id === segId)
      if (idx >= 0) playIndex(idx)
    },
    [readySegments, playIndex],
  )

  const changeRate = useCallback(
    (rate: number) => {
      setPlaybackRate(rate)
      if (audioRef.current) audioRef.current.playbackRate = rate
    },
    [setPlaybackRate],
  )

  // audio 事件：自动进入下一段
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => {
      const cur = useAppStore.getState().currentSegmentId
      const segs = useAppStore.getState().book?.chapters.find((c) => c.id === useAppStore.getState().activeChapterId)?.segments ?? []
      const rdy = segs.filter((s) => s.audioUrl)
      const idx = rdy.findIndex((s) => s.id === cur)
      if (idx >= 0 && idx + 1 < rdy.length) {
        playIndex(idx + 1)
      } else {
        setIsPlaying(false)
      }
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [playIndex, setIsPlaying])

  // 切换章节时停止播放
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.src = ''
    setIsPlaying(false)
    setCurrentSegment(null)
  }, [chapter?.id, setIsPlaying, setCurrentSegment])

  return {
    segments: readySegments as Segment[],
    currentIndex,
    isPlaying,
    playbackRate,
    play,
    pause,
    toggle,
    next,
    prev,
    seekTo,
    changeRate,
  }
}
