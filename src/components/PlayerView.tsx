import ChapterList from './ChapterList'
import TranscriptView from './TranscriptView'
import PlayerControls from './PlayerControls'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useAppStore } from '../store/appStore'

export default function PlayerView() {
  const player = useAudioPlayer()
  const { generateProgress, backgroundProgress, backgroundDone } = useAppStore()

  return (
    <div className="h-screen app-bg noise relative flex flex-col">
      <div className="flex-1 flex min-h-0 relative z-10">
        <ChapterList />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="px-8 py-5 border-b border-ink-700/50 flex items-center justify-between">
            <div>
              <p className="font-latin italic text-ember-400 tracking-[0.2em] text-[10px]">NOW PLAYING</p>
              <h1 className="font-display text-xl text-ink-100 mt-0.5">
                声临其境 · 朗读中
              </h1>
            </div>
            {player.isPlaying && (
              <div className="flex items-center gap-2 text-ink-400 text-xs">
                <span className="voice-bar">
                  <span /><span /><span /><span />
                </span>
                正在朗读
              </div>
            )}
          </header>

          <div className="flex-1 min-h-0">
            <TranscriptView onSeek={player.seekTo} />
          </div>
        </main>
      </div>

      <PlayerControls />

      {generateProgress && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 glass rounded-xl px-6 py-3 fade-in z-20">
          <div className="flex items-center gap-3 text-sm">
            <span className="voice-bar">
              <span /><span /><span /><span />
            </span>
            <span className="text-ink-200 font-display">正在为角色配音</span>
            <span className="text-ink-400 font-mono">
              {generateProgress.current} / {generateProgress.total}
            </span>
          </div>
        </div>
      )}

      {/* 后台静默处理后续内容的轻提示（不打断收听） */}
      {backgroundProgress && !generateProgress && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 glass rounded-xl px-5 py-2.5 fade-in z-20">
          <div className="flex items-center gap-3 text-xs">
            <span className="voice-bar">
              <span /><span /><span /><span />
            </span>
            <span className="text-ink-300">
              {backgroundProgress.phase === 'analyzing' ? '正在理解后续故事' : '正在为后续内容配音'}
              <span className="text-ink-500 ml-1">（不影响收听）</span>
            </span>
            <span className="text-ink-500 font-mono">
              {backgroundProgress.phase === 'generating'
                ? `${backgroundProgress.current}/${backgroundProgress.total}`
                : `${backgroundProgress.partIndex}/${backgroundProgress.totalParts - 1}`}
            </span>
          </div>
        </div>
      )}
      {backgroundDone && !backgroundProgress && !generateProgress && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 glass rounded-xl px-5 py-2.5 fade-in z-20">
          <span className="text-ember-300 text-xs">后续内容已全部配音完成，可连续收听</span>
        </div>
      )}
    </div>
  )
}
