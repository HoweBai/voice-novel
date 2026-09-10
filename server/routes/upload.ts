import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { parseDocument } from '../services/documentParser.js'
import { removeBook, bookDir } from '../storage.js'

const router = Router()

const upload = multer({
  dest: path.join(os.tmpdir(), 'voice-novel-uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
})

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未收到文件' })
    }
    const filePath = req.file.path
    const fileName = req.file.originalname
    const result = await parseDocument(filePath, fileName)
    // 清理临时上传文件
    fs.unlink(filePath, () => {})

    const bookId = `bk-${Date.now().toString(36)}`
    bookDir(bookId) // 预建目录

    // 去掉空内容章
    const chapters = result.chapters.map((c, i) => ({
      id: c.id,
      title: c.title,
      rawText: c.rawText,
      segments: [],
      audioReady: false,
    }))

    res.json({
      bookId,
      title: result.title,
      chapters,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || '文档解析失败' })
  }
})

router.delete('/:bookId', (req, res) => {
  try {
    removeBook(req.params.bookId)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message })
  }
})

export default router
