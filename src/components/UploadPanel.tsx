import { useRef, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useAppStore } from '../store/appStore'

export default function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const { upload, analyzeAll } = useApi()
  const { analyzeProgress, error } = useAppStore()

  const handleFile = async (file: File) => {
    const book = await upload(file)
    if (book) {
      await analyzeAll(book)
    }
  }

  return (
    <div className="min-h-screen app-bg noise relative flex items-center justify-center px-6">
      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-12 fade-in">
          <p className="font-latin italic text-ember-400 tracking-[0.3em] text-sm mb-4">VOICE NOVEL</p>
          <h1 className="font-display text-5xl md:text-6xl font-semibold text-ink-100 leading-tight">
            声临其境
          </h1>
          <p className="text-ink-300 mt-4 text-lg">
            上传一部读物，让每个角色都拥有自己的声音
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
          onClick={() => inputRef.current?.click()}
          className={`glass rounded-2xl p-14 cursor-pointer transition-all duration-300 fade-in
            ${dragging ? 'border-ember-400 shadow-glow scale-[1.01]' : 'hover:border-ember-400/40'}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.epub,.docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
          <div className="text-center">
            <div className="mx-auto w-16 h-16 mb-6 rounded-full border border-ember-400/40 flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ember-400">
                <path d="M12 16V4M12 4L7 9M12 4L17 9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-ink-100 text-lg font-display">将文件拖入此处，或点击选择</p>
            <p className="text-ink-400 text-sm mt-2">支持 TXT / EPUB / DOCX</p>
          </div>
        </div>

        {error && (
          <div className="mt-6 px-5 py-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-sm fade-in">
            {error}
          </div>
        )}

        {analyzeProgress && (
          <div className="mt-8 fade-in">
            <div className="flex justify-between text-sm text-ink-300 mb-3">
              <span className="font-display">正在理解读物 · {analyzeProgress.title}</span>
              <span>{analyzeProgress.current} / {analyzeProgress.total}</span>
            </div>
            <div className="h-2 rounded-full bg-ink-800 overflow-hidden shimmer">
              <div
                className="h-full bg-gradient-to-r from-ember-500 to-gold-400 transition-all duration-500"
                style={{ width: `${(analyzeProgress.current / analyzeProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-ink-400 text-xs mt-3 flex items-center gap-2">
              <span className="voice-bar">
                <span /><span /><span /><span />
              </span>
              AI 正在识别角色、归属对白与旁白，长章节可能需要数分钟…
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
