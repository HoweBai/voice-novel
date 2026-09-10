import { useState } from 'react'
import { useAppStore, useActiveChapter, useCharacters } from '../store/appStore'
import { useApi } from '../hooks/useApi'
import { VOICES as FALLBACK_VOICES, colorForCharacter } from '../lib/constants'

const SPEED_OPTIONS = [
  { value: 0.9, label: '慢速' },
  { value: 1.0, label: '标准' },
  { value: 1.12, label: '稍快' },
  { value: 1.25, label: '快速' },
]

export default function CharacterPanel() {
  const { book, error, speedFactor, setSpeedFactor } = useAppStore()
  const characters = useCharacters()
  const chapter = useActiveChapter()
  const storeVoices = useAppStore((s) => s.voices)
  const { assignVoice, setError } = useAppStore()
  const { generateChapter: apiGenerate } = useApi()
  const [previewing, setPreviewing] = useState<string | null>(null)

  if (!book || !chapter) return null

  // 以后端 API 返回的音色列表为准（Kokoro/Edge 引擎切换），未拿到时回退内置目录
  const voices = storeVoices.length > 0 ? storeVoices : FALLBACK_VOICES

  const handlePreview = async (voiceId: string, name: string) => {
    setPreviewing(voiceId)
    try {
      const text = `这是${name}的声音，听起来是这样的。`
      const url = `/api/tts/preview?text=${encodeURIComponent(text)}&voice=${voiceId}&speed=${speedFactor}`
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
    // 已在后台配好音的片段不重复生成
    const missing = chapter.segments.filter((s) => !s.audioUrl)
    await apiGenerate(book.id, { ...chapter, segments: missing }, assignments, speedFactor)
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
                {voices.map((v) => (
                  <option key={v.shortName} value={v.shortName}>
                    {v.name} · {v.style}
                  </option>
                ))}
              </select>

              <button
                onClick={() => handlePreview(c.voiceId || voices[0]?.shortName || '', c.name)}
                className="px-3 py-2 rounded-lg border border-ink-600 text-ink-300 hover:border-ember-400 hover:text-ember-400 transition text-sm whitespace-nowrap"
                disabled={previewing === c.voiceId}
              >
                {previewing === c.voiceId ? '试听中…' : '试听'}
              </button>
            </div>
          ))}
        </div>

        {/* 语速选择：与情绪语速叠加（激动处更快、悲伤处更慢） */}
        <div className="mt-6 glass rounded-xl p-4 flex items-center gap-4 fade-in">
          <span className="text-ink-300 text-sm font-display whitespace-nowrap">整体语速</span>
          <div className="flex items-center gap-1">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSpeedFactor(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  speedFactor === opt.value
                    ? 'bg-ember-500/20 text-ember-300 border border-ember-500/40'
                    : 'text-ink-400 border border-ink-700 hover:text-ink-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="text-ink-500 text-xs">
            配音时会随情境自动变化：激动加快、悲伤放缓
          </span>
        </div>

        <div className="mt-8 flex items-center justify-between fade-in">
          <p className="text-ink-400 text-sm">
            {chapter.segments.length === 0 ? (
              <>该章节正在后台理解中，请稍候片刻…</>
            ) : (
              <>
                共 {characters.length} 个角色 · {chapter.segments.length} 个朗读片段
                <span className="ml-2 text-ink-500 text-xs">（先配开头部分，后续将在您收听时后台自动完成）</span>
              </>
            )}
          </p>
          <button
            onClick={handleStart}
            disabled={chapter.segments.length === 0}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-ember-500 to-gold-400 text-ink-950 font-display font-semibold hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            开始配音
          </button>
        </div>
      </div>
    </div>
  )
}
