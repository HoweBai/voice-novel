import fs from 'node:fs'

async function main() {
  const text = fs.readFileSync('d:/Code/voice-novel/res/test-ai.txt', 'utf-8')
  console.log('=== 1. analyze ===')
  const r1 = await fetch('http://localhost:8787/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText: text }),
  })
  const j1 = await r1.json()
  if (r1.ok) {
    console.log('characters:', JSON.stringify(j1.characters, null, 2))
    console.log('segments count:', j1.segments.length)
    console.log('first 3 segments:')
    for (const s of j1.segments.slice(0, 3)) {
      console.log(`  [${s.type}] ${s.characterId} "${s.text.slice(0, 30)}" emotion=${s.emotion}`)
    }
  } else {
    console.log('ERROR', j1)
  }
}
main().catch((e) => console.error(e))
