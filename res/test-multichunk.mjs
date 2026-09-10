// 验证问题2：长文本分块后角色一致性
// 构造一段超过 CHUNK_SIZE 的文本，使同一角色在不同块中用不同称呼出现
const makeText = () => {
  // 块1：引入"林晨"（男主）和"小雅"（女主）
  const part1 = `林晨推开木门，屋里很暗。他低声说道："你在这里吗？"
角落里传来响动，小雅慢慢站起身，轻声回答："我在。"
林晨走过去，把外套披在她肩上。`
  // 块2：同一人物用"他""那姑娘"指代，验证是否合并为同一角色
  const part2 = `他看着窗外的雨，没有说话。那姑娘靠着墙，忽然开口："我们要走吗？"
男人点了点头，说："天亮就走。"`
  // 拼接成远超 15000 字的文本（重复填充）
  let text = part1 + '\n' + part2 + '\n'
  while (text.length < 16000) {
    text += part1 + '\n' + part2 + '\n'
  }
  return text
}

const text = makeText()
console.log('文本总长度:', text.length, '字')

fetch('http://localhost:8787/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rawText: text }),
}).then(async r => {
  const j = await r.json()
  console.log('\n=== 角色列表 ===')
  j.characters?.forEach(c => console.log(`- ${c.id} | ${c.name} | ${c.gender} | ${c.description || ''}`))
  console.log('\n角色数量:', j.characters?.length)
  console.log('片段数量:', j.segments?.length)
  // 检查"林晨""他""男人"是否被合并为同一角色；"小雅""那姑娘""她"是否合并
  const names = j.characters?.map(c => c.name) || []
  console.log('\n=== 关键检查 ===')
  console.log('是否包含"林晨":', names.includes('林晨'))
  console.log('是否包含"小雅":', names.includes('小雅'))
  console.log('角色名称列表:', JSON.stringify(names))
}).catch(e => console.log('err:', e.message))
