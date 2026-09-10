import { useEffect, useRef } from 'react'
import { useAppStore, useActiveChapter, useCharacters } from '../store/appStore'
import { EMOTION_LABELS, colorForCharacter } from '../lib/constants'

export default function TranscriptView({ onSeek }: { onSeek: (id: string) => void }) {
  const chapter = useActiveChapter()
  const characters = useCharacters()
  const { currentSegmentId, isPlaying } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentSegmentId])

  if (!chapter) return null
  const charIndex = new Map(characters.map((c, i) => [c.id, i]))

  return (
    <div ref={containerRef} className="h-full overflow-y-auto px-8 py-10">
      <div className="max-w-2xl mx-auto space-y-1">
        {chapter.segments.map((s, i) => {
          const ci = charIndex.get(s.characterId) ?? 0
          const char = characters.find((c) => c.id === s.characterId)
          const active = s.id === currentSegmentId
          const color = s.characterId === 'narrator' ? '#5b6878' : colorForCharacter(ci)
          return (
            <div
              key={s.id}
              ref={active ? activeRef : null}
              onClick={() => onSeek(s.id)}
              className={`group relative rounded-lg px-4 py-3 cursor-pointer transition-all duration-300
                ${active ? 'active-segment' : 'hover:bg-ink-800/50'}`}
              style={{ animationDelay: `${i * 20}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-1 w-20 shrink-0">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: active ? '#e8943a' : color, opacity: active ? 1 : 0.6 }}
                  />
                  <span className="text-xs font-display" style={{ color: active ? '#f0a85c' : '#8593a6' }}>
                    {char?.name || '旁白'}
                  </span>
                  {active && isPlaying && (
                    <span className="voice-bar scale-75">
                      <span /><span /><span /><span />
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`leading-relaxed font-display ${s.type === 'narration' ? 'text-ink-300' : 'text-ink-100'}
                      ${active ? 'text-ember-200' : ''}`}
                  >
                    {s.text}
                  </p>
                  {s.emotion && s.emotion !== 'calm' && (
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-ink-800/60 text-ink-400">
                      {EMOTION_LABELS[s.emotion] || s.emotion}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
