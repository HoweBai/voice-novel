const text = `小女孩蹦蹦跳跳地飞奔过来，一边说："你终于回来了"，一边留下激动的眼泪。`
fetch('http://localhost:8787/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rawText: text }),
}).then(async r => {
  const j = await r.json()
  console.log('chars:', j.characters?.length)
  j.segments?.forEach(s => console.log(s.type, '|', s.characterId, '|', s.text, '|', s.emotion))
}).catch(e => console.log('err:', e.message))
