import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useAppStore, useActiveChapter } from '../store/appStore'

const RATES = [0.75, 1, 1.25, 1.5, 2]

export default function PlayerControls() {
  const player = useAudioPlayer()
  const chapter = useActiveChapter()
  const { playbackRate } = useAppStore()

  const total = player.segments.length
  const pos = player.currentIndex < 0 ? 0 : player.currentIndex + 1

  return (
    <div className="glass border-t border-ink-700/50 px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center gap-6">
        {/* 章节进度 */}
        <div className="text-xs text-ink-400 whitespace-nowrap font-display">
          {chapter?.title}
        </div>

        {/* 控制 */}
        <div className="flex items-center gap-3">
          <button
            onClick={player.prev}
            disabled={pos <= 1}
            className="w-9 h-9 rounded-full border border-ink-600 text-ink-200 hover:border-ember-400 hover:text-ember-400 transition disabled:opacity-30"
            aria-label="上一段"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="mx-auto">
              <path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={player.toggle}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-ember-500 to-gold-400 text-ink-950 flex items-center justify-center hover:shadow-glow transition shadow-glow"
            aria-label={player.isPlaying ? '暂停' : '播放'}
          >
            {player.isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={player.next}
            disabled={pos >= total}
            className="w-9 h-9 rounded-full border border-ink-600 text-ink-200 hover:border-ember-400 hover:text-ember-400 transition disabled:opacity-30"
            aria-label="下一段"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="mx-auto">
              <path d="M16 6h2v12h-2zM6 6l8.5 6L6 18z" />
            </svg>
          </button>
        </div>

        {/* 进度 */}
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-ink-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ember-500 to-gold-400 transition-all duration-500"
              style={{ width: total ? `${(pos / total) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-xs text-ink-400 whitespace-nowrap font-mono">
            {pos} / {total}
          </span>
        </div>

        {/* 语速 */}
        <div className="flex items-center gap-1">
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => player.changeRate(r)}
              className={`px-2 py-1 rounded text-xs transition ${
                playbackRate === r
                  ? 'bg-ember-500/20 text-ember-300'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              {r}x
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
