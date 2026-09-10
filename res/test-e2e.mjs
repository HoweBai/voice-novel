import fs from 'node:fs'

async function main() {
  // 1. 上传 epub
  console.log('=== 1. 上传 epub ===')
  const fd = new FormData()
  const buf = fs.readFileSync('d:/Code/voice-novel/res/带上她的眼睛-刘慈欣.epub')
  fd.append('file', new Blob([buf]), '带上她的眼睛-刘慈欣.epub')
  const up = await fetch('http://localhost:8787/api/upload', { method: 'POST', body: fd })
  const book = await up.json()
  console.log('bookId:', book.bookId, '| title:', book.title, '| chapters:', book.chapters.length)
  const ch = book.chapters[0]
  console.log('chapter title:', ch.title, '| 字数:', ch.rawText.length)
  const text = ch.rawText

  // 2. AI 分析
  console.log('\n=== 2. AI 分析（约 2-3 分钟）===')
  const t0 = Date.now()
  const ac = new AbortController()
  const acTimer = setTimeout(() => ac.abort(), 10 * 60 * 1000)
  const an = await fetch('http://localhost:8787/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText: text }),
    signal: ac.signal,
  })
  clearTimeout(acTimer)
  const ar = await an.json()
  if (!an.ok) {
    console.log('分析失败:', ar)
    return
  }
  console.log(`分析完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log('角色:')
  for (const c of ar.characters) {
    console.log(`  - ${c.name} (${c.gender})${c.description ? ' - ' + c.description : ''}`)
  }
  console.log('段落数:', ar.segments.length)
  console.log('前 5 段:')
  for (const s of ar.segments.slice(0, 5)) {
    const char = ar.characters.find((c) => c.id === s.characterId)
    console.log(`  [${s.type}] ${char?.name || s.characterId} | ${s.emotion} | "${s.text.slice(0, 25)}…"`)
  }

  // 3. 生成前 10 段音频（验证 SSE 流程）
  const TEST_COUNT = Math.min(10, ar.segments.length)
  const testSegs = ar.segments.slice(0, TEST_COUNT)
  const assignments = {}
  for (const c of ar.characters) {
    assignments[c.id] = c.gender === 'female' ? 'zh-CN-XiaoyiNeural' : c.gender === 'male' ? 'zh-CN-YunxiNeural' : 'zh-CN-XiaoxiaoNeural'
  }

  console.log(`\n=== 3. 生成前 ${TEST_COUNT} 段音频（SSE）===`)
  const resp = await fetch('http://localhost:8787/api/tts/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookId: book.bookId, segments: testSegs, assignments }),
  })
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let ok = 0
  let fail = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      const line = part.replace(/^data:\s*/, '').trim()
      if (!line) continue
      try {
        const evt = JSON.parse(line)
        if (evt.type === 'progress') {
          ok++
          process.stdout.write(`  ✓ 段 ${evt.index + 1}/${evt.total} -> ${evt.audioUrl} (${evt.durationSec}s)\n`)
        } else if (evt.type === 'error') {
          fail++
          console.log(`  ✗ 段 ${evt.index + 1} 失败: ${evt.message}`)
        } else if (evt.type === 'done') {
          console.log(`  生成完成: 成功 ${ok}, 失败 ${fail}`)
        }
      } catch {
        /* ignore */
      }
    }
  }

  console.log('\n=== 端到端测试完成 ===')
  console.log(`上传 ✅ | AI分析 ✅(${ar.characters.length}角色/${ar.segments.length}段) | TTS生成 成功${ok}/失败${fail}`)
}
main().catch((e) => console.error('Fatal:', e))
