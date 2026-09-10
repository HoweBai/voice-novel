import { Router } from 'express'
import { analyzePartial } from '../services/analyzer.js'
import type { Character } from '../../src/types/index.js'

const router = Router()

// 接收 { rawText, priorCharacters? } → 返回 { characters（累计）, segments（本次）}
// priorCharacters: 之前部分已识别的角色，用于保持跨部分角色 ID 稳定
router.post('/', async (req, res) => {
  try {
    const { rawText, priorCharacters } = req.body as {
      rawText?: string
      priorCharacters?: Character[]
    }
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: '缺少 rawText' })
    }
    const result = await analyzePartial(rawText, priorCharacters || [])
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'AI 分析失败' })
  }
})

export default router
