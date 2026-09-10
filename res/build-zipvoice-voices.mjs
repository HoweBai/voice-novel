// 生成 ZipVoice 参考音色档案：
// 用 Edge TTS 把一段固定文本（旁白风格、约 10 秒）合成为每个音色的参考音频，
// 再用 ffmpeg 转为 24k 单声道 wav，供 ZipVoice 零样本声音克隆。
// 输出目录 models/zipvoice-voices/：<id>.wav + profiles.json
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('models/zipvoice-voices')
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg'

// 参考文本：自然叙述语气、约 10 秒；合成后 ZipVoice 用它做音色克隆
const REF_TEXT =
  '夜色渐渐深了，窗外的风声也慢慢安静下来。他端起桌上温热的茶杯，轻轻吹开浮动的茶叶，目光越过窗棂，落在远处那盏昏黄的灯火上，久久没有说话。'

// 选用差异明显的 Edge 中文音色作为克隆源（当前通道实测可用的音色）
const VOICES = [
  { id: 'zv-yunxi',   edge: 'zh-CN-YunxiNeural',    gender: 'male',   name: '清朗青年', style: '青年男声 · 清朗' },
  { id: 'zv-yunjian', edge: 'zh-CN-YunjianNeural',  gender: 'male',   name: '磁性男声', style: '成熟男声 · 磁性' },
  { id: 'zv-yunxia',  edge: 'zh-CN-YunxiaNeural',   gender: 'male',   name: '少年男声', style: '少年男声 · 活泼' },
  { id: 'zv-yunyang', edge: 'zh-CN-YunyangNeural',  gender: 'male',   name: '沉稳男声', style: '沉稳男声 · 旁白首选' },
  { id: 'zv-yunjhe',  edge: 'zh-TW-YunJheNeural',   gender: 'male',   name: '醇厚男声', style: '醇厚男声 · 叙述感' },
  { id: 'zv-xiaoyi',  edge: 'zh-CN-XiaoyiNeural',   gender: 'female', name: '清甜少女', style: '清甜女声 · 少女' },
  { id: 'zv-xiaoxiao',edge: 'zh-CN-XiaoxiaoNeural', gender: 'female', name: '温暖女声', style: '温暖女声 · 旁白首选' },
  { id: 'zv-hsiaochen', edge: 'zh-TW-HsiaoChenNeural', gender: 'female', name: '端庄女声', style: '端庄女声 · 知性' },
  { id: 'zv-hsiaoyu', edge: 'zh-TW-HsiaoYuNeural',  gender: 'female', name: '柔和女声', style: '柔和女声 · 亲和' },
]

// 包内自带的真实人声参考音频（新闻播音，附精确文本），克隆质量高；refText 从 prompt.txt 解析
const HUMAN_VOICES = [
  {
    id: 'zv-newsf1', gender: 'female', name: '新闻女声A', style: '清亮女声 · 播报',
    srcWav: 'news-female.wav',
  },
  {
    id: 'zv-newsf2', gender: 'female', name: '新闻女声B', style: '沉稳女声 · 播报',
    srcWav: 'news-female-2.wav',
  },
]

function makeAgent() {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  return proxy ? new HttpsProxyAgent(proxy) : undefined
}

// Edge 合成 → mp3 buffer（失败重试 4 次，间隔递增）
async function synthMp3(voice) {
  let lastErr
  for (let attempt = 0; attempt < 4; attempt++) {
    const tts = new MsEdgeTTS(makeAgent())
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {})
      const { audioStream } = tts.toStream(REF_TEXT, {})
      const chunks = []
      for await (const c of audioStream) chunks.push(c)
      const buf = Buffer.concat(chunks)
      if (buf.length > 20000) return buf
      throw new Error('音频过小，疑似截断')
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
    } finally {
      try { tts.close() } catch {}
    }
  }
  throw lastErr
}

// mp3 buffer → 24k mono pcm s16le wav 文件
function toWav(mp3Buf, wavPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, ['-y', '-i', 'pipe:0', '-ar', '24000', '-ac', '1', '-sample_fmt', 's16', '-f', 'wav', wavPath], {
      stdio: ['pipe', 'ignore', 'pipe'],
    })
    let err = ''
    ff.stderr.on('data', (d) => (err += d))
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg failed: ' + err.slice(-300)))))
    ff.stdin.end(mp3Buf)
  })
}

// wav 文件 → 24k mono wav（统一格式）
function toWavFromFile(srcPath, wavPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, ['-y', '-i', srcPath, '-ar', '24000', '-ac', '1', '-sample_fmt', 's16', '-f', 'wav', wavPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let err = ''
    ff.stderr.on('data', (d) => (err += d))
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg failed: ' + err.slice(-300)))))
  })
}

const TEST_WAV_DIR = path.resolve('models/sherpa-onnx-zipvoice-distill-int8-zh-en-emilia/test_wavs')
// 从 prompt.txt 解析 "文件名 参考文本"
const promptMap = new Map()
for (const line of fs.readFileSync(path.join(TEST_WAV_DIR, 'prompt.txt'), 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^(\S+\.wav)\s*(.+)$/)
  if (m) promptMap.set(m[1], m[2].trim())
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const profiles = []
for (const v of VOICES) {
  const wavPath = path.join(OUT_DIR, `${v.id}.wav`)
  if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 10000) {
    console.log('跳过（已存在）:', v.id)
    profiles.push({ id: v.id, gender: v.gender, name: v.name, style: v.style, refWav: `${v.id}.wav`, refText: REF_TEXT })
    continue
  }
  try {
    process.stdout.write(`合成 ${v.id} (${v.edge}) ... `)
    const mp3 = await synthMp3(v.edge)
    await toWav(mp3, wavPath)
    console.log('OK', (fs.statSync(wavPath).size / 1024).toFixed(0) + 'KB')
    profiles.push({ id: v.id, gender: v.gender, name: v.name, style: v.style, refWav: `${v.id}.wav`, refText: REF_TEXT })
  } catch (e) {
    console.log('失败:', e.message)
  }
}
for (const v of HUMAN_VOICES) {
  const wavPath = path.join(OUT_DIR, `${v.id}.wav`)
  const refText = promptMap.get(v.srcWav)
  if (!refText) { console.log('跳过（prompt.txt 无文本）:', v.id); continue }
  if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 10000) {
    console.log('跳过（已存在）:', v.id)
    profiles.push({ id: v.id, gender: v.gender, name: v.name, style: v.style, refWav: `${v.id}.wav`, refText })
    continue
  }
  try {
    process.stdout.write(`转换 ${v.id} ... `)
    await toWavFromFile(path.join(TEST_WAV_DIR, v.srcWav), wavPath)
    console.log('OK', (fs.statSync(wavPath).size / 1024).toFixed(0) + 'KB')
    profiles.push({ id: v.id, gender: v.gender, name: v.name, style: v.style, refWav: `${v.id}.wav`, refText })
  } catch (e) {
    console.log('失败:', e.message)
  }
}
fs.writeFileSync(path.join(OUT_DIR, 'profiles.json'), JSON.stringify(profiles, null, 2), 'utf-8')
console.log(`\n完成 ${profiles.length}/${VOICES.length + HUMAN_VOICES.length} 个音色 → ${OUT_DIR}`)
