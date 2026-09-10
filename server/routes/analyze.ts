import { Router } from 'express'
import { analyzeChapter } from '../services/analyzer.js'

const router = Router()

// 接收 { rawText } → 返回 { characters, segments }
router.post('/', async (req, res) => {
  try {
    const { rawText } = req.body as { rawText?: string }
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: '缺少 rawText' })
    }
    const result = await analyzeChapter(rawText)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'AI 分析失败' })
  }
})

export default router
