import { useState } from 'react'
import { useAppStore, useActiveChapter, useCharacters } from '../store/appStore'
import { useApi } from '../hooks/useApi'
import { VOICES, colorForCharacter } from '../lib/constants'

export default function CharacterPanel() {
  const { book, error } = useAppStore()
  const characters = useCharacters()
  const chapter = useActiveChapter()
  const { assignVoice, setError } = useAppStore()
  const { generateChapter: apiGenerate } = useApi()
  const [previewing, setPreviewing] = useState<string | null>(null)

  if (!book || !chapter) return null

  const handlePreview = async (voiceId: string, name: string) => {
    setPreviewing(voiceId)
    try {
      const url = `/api/tts/preview?text=${encodeURIComponent(`这是${name}的声音，听起来是这样的。`)}&voice=${voiceId}`
      const audio = new Audio(url)
      await audio.play()
      audio.onended = () => setPreviewing(null)
    } catch {
      setPreviewing(null)
    }
  }

  const handleStart = async () => {
    // 构建角色→音色映射
    const assignments: Record<string, string> = {}
    for (const c of characters) {
      if (c.voiceId) assignments[c.id] = c.voiceId
    }
    if (Object.keys(assignments).length === 0) {
      setError('请至少为角色分配音色')
      return
    }
    await apiGenerate(book.id, chapter, assignments)
  }

  return (
    <div className="min-h-screen app-bg noise relative px-6 py-10">
      <div className="relative z-10 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8 fade-in">
          <div>
            <p className="font-latin italic text-ember-400 tracking-[0.25em] text-xs mb-1">CASTING</p>
            <h2 className="font-display text-3xl text-ink-100">为角色选配音色</h2>
          </div>
          <div className="text-right">
            <p className="text-ink-400 text-xs">当前章节</p>
            <p className="text-ink-200 text-sm font-display">{chapter.title}</p>
          </div>
        </div>

        <div className="space-y-3">
          {error && (
            <div className="px-5 py-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-sm fade-in">
              {error}
            </div>
          )}
          {characters.map((c, i) => (
            <div
              key={c.id}
              className="glass rounded-xl p-4 flex items-center gap-4 fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                className="w-1.5 h-12 rounded-full"
                style={{ background: c.id === 'narrator' ? '#5b6878' : colorForCharacter(i) }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-lg text-ink-100">{c.name}</span>
                  <span className="text-ink-400 text-xs">
                    {c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '中性'}
                    {c.id === 'narrator' ? ' · 旁白' : ''}
                  </span>
                </div>
                {c.description && (
                  <p className="text-ink-400 text-xs mt-0.5 truncate">{c.description}</p>
                )}
              </div>

              <select
                value={c.voiceId || ''}
                onChange={(e) => assignVoice(c.id, e.target.value)}
                className="bg-ink-800 border border-ink-600 rounded-lg px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-ember-400 min-w-[160px]"
              >
                {VOICES.map((v) => (
                  <option key={v.shortName} value={v.shortName}>
                    {v.name} · {v.style}
                  </option>
                ))}
              </select>

              <button
                onClick={() => handlePreview(c.voiceId || 'zh-CN-XiaoxiaoNeural', c.name)}
                className="px-3 py-2 rounded-lg border border-ink-600 text-ink-300 hover:border-ember-400 hover:text-ember-400 transition text-sm whitespace-nowrap"
                disabled={previewing === c.voiceId}
              >
                {previewing === c.voiceId ? '试听中…' : '试听'}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between fade-in">
          <p className="text-ink-400 text-sm">
            共 {characters.length} 个角色 · {chapter.segments.length} 个朗读片段
          </p>
          <button
            onClick={handleStart}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-ember-500 to-gold-400 text-ink-950 font-display font-semibold hover:shadow-glow transition-all"
          >
            开始配音
          </button>
        </div>
      </div>
    </div>
  )
}
