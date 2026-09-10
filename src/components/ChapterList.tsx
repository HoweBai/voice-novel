import { useAppStore, useCharacters } from '../store/appStore'
import { useApi } from '../hooks/useApi'
import { colorForCharacter } from '../lib/constants'

export default function ChapterList() {
  const { book, activeChapterId, setActiveChapter, setStage } = useAppStore()
  const characters = useCharacters()
  const { generateChapter: apiGenerate } = useApi()

  if (!book) return null

  const handleChapter = async (chapterId: string) => {
    const ch = book.chapters.find((c) => c.id === chapterId)
    if (!ch) return
    setActiveChapter(chapterId)
    // 已生成音频 → 直接进入播放；否则进入配音分配
    if (ch.audioReady) {
      setStage('playing')
    } else if (ch.segments.length === 0) {
      // 未分析：触发单章分析流程（这里简化为进入 cast，由用户在 CharacterPanel 重新分析）
      // 复用 analyzeAll：取最新 book 状态分析剩余章节
      setStage('cast')
    } else {
      setStage('cast')
    }
  }

  return (
    <aside className="w-72 shrink-0 glass border-r border-ink-700/50 flex flex-col">
      <div className="px-5 py-4 border-b border-ink-700/50">
        <p className="font-latin italic text-ember-400 tracking-[0.2em] text-[10px] mb-1">NOVEL</p>
        <h2 className="font-display text-lg text-ink-100 truncate">{book.title}</h2>
      </div>

      <div className="px-5 py-3 border-b border-ink-700/50">
        <p className="text-ink-400 text-[10px] uppercase tracking-wider mb-2">角色</p>
        <div className="flex flex-wrap gap-1.5">
          {characters.map((c, i) => (
            <span
              key={c.id}
              className="text-[11px] px-2 py-0.5 rounded-full border"
              style={{
                borderColor: c.id === 'narrator' ? '#3a4555' : colorForCharacter(i) + '55',
                color: c.id === 'narrator' ? '#8593a6' : colorForCharacter(i),
              }}
            >
              {c.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <p className="text-ink-400 text-[10px] uppercase tracking-wider mb-2 px-2">章节</p>
        {book.chapters.map((ch, i) => {
          const active = ch.id === activeChapterId
          return (
            <button
              key={ch.id}
              onClick={() => handleChapter(ch.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition flex items-center gap-2
                ${active ? 'bg-ember-500/15 text-ember-200' : 'text-ink-300 hover:bg-ink-800/50'}`}
            >
              <span className={`text-[10px] ${active ? 'text-ember-400' : 'text-ink-500'}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex-1 truncate text-sm font-display">{ch.title}</span>
              {ch.audioReady && (
                <span className="w-1.5 h-1.5 rounded-full bg-ember-400" title="已配音" />
              )}
            </button>
          )
        })}
      </div>
    </aside>
  )
}
