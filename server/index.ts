import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureRoot } from './storage.js'
import uploadRouter from './routes/upload.js'
import analyzeRouter from './routes/analyze.js'
import ttsRouter from './routes/tts.js'
import { VOICES } from './voices.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 8787

ensureRoot()

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))

// 音频静态资源
app.use('/audio', express.static(path.resolve(process.cwd(), 'storage')))

// API 路由
app.use('/api/upload', uploadRouter)
app.use('/api/analyze', analyzeRouter)
app.use('/api/tts', ttsRouter)

// 音色目录
app.get('/api/voices', (_req, res) => res.json(VOICES))

// 生产环境托管前端构建产物
if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname, '../dist')
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

const server = app.listen(Number(PORT), () => {
  console.log(`[voice-novel] 后端运行于 http://localhost:${PORT}`)
  if (process.env.OPENAI_API_KEY) {
    console.log(`[voice-novel] AI 模型: ${process.env.OPENAI_MODEL || 'agnes-2.5-flash'}`)
  } else {
    console.warn('[voice-novel] 警告: 未配置 OPENAI_API_KEY，AI 分析将不可用。请复制 .env.example 为 .env 并填写。')
  }
})

// AI 分析可能耗时数分钟，禁用服务端请求超时
server.timeout = 0
server.requestTimeout = 0
server.keepAliveTimeout = 0
