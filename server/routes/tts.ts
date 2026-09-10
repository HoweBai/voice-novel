import { Router } from 'express'
import { synthesizeBatch, synthesizeSegment } from '../services/ttsEngine.js'
import type { Segment } from '../../src/types/index.js'

const router = Router()

interface GenerateBody {
  bookId: string
  segments: Segment[]
  assignments: Record<string, string> // characterId -> voiceShortName
}

// 批量生成锁：防止多个 generate 请求并发执行导致 CPU 饱和
let generateLock = false

// POST /api/tts/generate
// 接收 { bookId, segments, assignments }，逐段生成音频，通过 SSE 推送进度
router.post('/generate', async (req, res) => {
  const { bookId, segments, assignments } = req.body as GenerateBody
  if (!bookId || !segments || !assignments) {
    return res.status(400).json({ error: '缺少必要参数 bookId/segments/assignments' })
  }

  if (generateLock) {
    return res.status(409).json({ error: '已有配音任务进行中，请等待完成后再试' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  generateLock = true
  try {
    const total = segments.length
    const items = segments.map((seg) => ({
      segmentId: seg.id,
      text: seg.text,
      voice: assignments[seg.characterId] || '',
      emotion: seg.emotion,
    }))

    await synthesizeBatch(
      bookId,
      items,
      (index, segmentId, audioUrl, durationSec) => {
        send({ type: 'progress', segmentId, index, total, audioUrl, durationSec })
      },
      (index, segmentId, message) => {
        if (!items[index].voice) {
          send({ type: 'error', segmentId, index, message: `角色 ${segments[index].characterId} 未分配音色` })
        } else {
          send({ type: 'error', segmentId, index, message })
        }
      },
    )
    send({ type: 'done', total })
  } catch (err: any) {
    send({ type: 'fatal', message: err?.message || '生成过程异常' })
  } finally {
    generateLock = false
    res.end()
  }
})

// 试听单段：GET /api/tts/preview?text=...&voice=...
router.get('/preview', async (req, res) => {
  try {
    const text = String(req.query.text || '')
    const voice = String(req.query.voice || 'zh-CN-XiaoxiaoNeural')
    if (!text) return res.status(400).json({ error: '缺少 text' })
    const bookId = '_preview'
    const segId = `pv-${Date.now().toString(36)}`
    const outPath = await synthesizeSegment(bookId, segId, text, voice, 'calm')
    res.sendFile(outPath)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || '试听失败' })
  }
})

export default router
