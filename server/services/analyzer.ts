import { chat } from './aiClient.js'
import type { Character, Segment } from '../../src/types/index.js'

const CHUNK_SIZE = 15000 // 单块上限，常规短篇小说一次调用完成，避免跨块角色分裂

const SYSTEM_PROMPT = `你是一位专业的小说文本分析师。用户会给你一段小说文本，你需要：
1. 识别文本中出现的所有角色（包括"旁白"——即非角色对白的叙述部分）。
2. 【重要】同一人物的不同称呼/指代必须合并为同一个角色。例如"小姑娘""她""领航员"指同一人时，只保留一个角色条目，用最常用的称呼作为 name，并在 description 中说明其他称呼。禁止把同一人物的不同叫法拆成多个角色。
3. 把整段文本按"朗读单元"拆分成有序的片段，每个片段要么是旁白(narration)，要么是某个角色的台词(dialogue)。
4. 台词归属：根据上下文（如"某某道：""某某说："及对话情境）判断每句对白属于哪个角色。引号内的内容是该角色的台词。
5. 不要改写、删减原文文本，片段文本尽量保持原句。
6. 为每段判断一个情绪标签（如 calm/excited/happy/sad/angry/serious/gentle/fearful），旁白多为 calm/serious。
7. 旁白的 characterId 固定为 "narrator"。
8. 【切分规则】当一句话中同时包含叙述和对白时（如"小女孩蹦蹦跳跳地飞奔过来，一边说：'你终于回来了'，一边留下激动的眼泪"），必须在引号边界处拆分为多个片段：
   - 引号外的叙述部分 → narration（旁白）
   - 引号内的对白部分 → dialogue（说话角色）
   - 引号外的后续叙述 → narration（旁白）
   不要把对白和叙述混在同一个片段中。
   示例输入："小女孩蹦蹦跳跳地飞奔过来，一边说：'你终于回来了'，一边留下激动的眼泪"
   示例输出：
   {"type":"narration","characterId":"narrator","text":"小女孩蹦蹦跳跳地飞奔过来，一边说：","emotion":"excited"}
   {"type":"dialogue","characterId":"c1","text":"你终于回来了","emotion":"happy"}
   {"type":"narration","characterId":"narrator","text":"，一边留下激动的眼泪","emotion":"sad"}

只返回一个 JSON 对象，格式如下，不要输出任何其它文字或解释：
{
  "characters": [
    {"id":"narrator","name":"旁白","gender":"neutral","description":"叙述者"},
    {"id":"c1","name":"林晨","gender":"male","description":"男主，沉稳内敛，文中也称'我'"}
  ],
  "segments": [
    {"type":"narration","characterId":"narrator","text":"窗外的雨没有停。","emotion":"calm"},
    {"type":"dialogue","characterId":"c1","text":"你来了。","emotion":"calm"}
  ]
}
性别只有 male/female/neutral 三种。segments 必须按原文顺序排列，覆盖输入的全部文本。`

function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length)
    if (end < text.length) {
      // 尽量在句号/换行处断开
      const slice = text.slice(start, end)
      const lastBreak = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'), slice.lastIndexOf('\n'))
      if (lastBreak > CHUNK_SIZE * 0.5) end = start + lastBreak + 1
    }
    chunks.push(text.slice(start, end))
    start = end
  }
  return chunks
}

// 容错提取 JSON：兼容模型可能包裹 ```json 或附带文字
function extractJson(raw: string): any {
  const trimmed = raw.trim()
  // 直接解析
  try {
    return JSON.parse(trimmed)
  } catch {
    // 提取首个 {...}
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }
  }
  throw new Error('AI 返回内容无法解析为 JSON')
}

interface RawResult {
  characters: { id: string; name: string; gender: string; description?: string }[]
  segments: { type: string; characterId: string; text: string; emotion?: string }[]
}

let segCounter = 0
const nextSegId = () => `seg-${Date.now().toString(36)}-${segCounter++}`

async function analyzeChunk(text: string, index: number, total: number, characterContext?: string): Promise<RawResult> {
  const t0 = Date.now()
  console.log(`[analyze] 块 ${index + 1}/${total} 开始 (${text.length} 字)`)
  const userMessage = characterContext
    ? `${characterContext}\n\n请分析以下文本（保持已有角色 ID 和称呼一致，新角色使用新 ID）：\n\n${text}`
    : `请分析以下文本：\n\n${text}`
  const content = await chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ])
  const parsed = extractJson(content)
  if (!parsed.characters || !parsed.segments) {
    throw new Error('AI 返回结构缺少 characters 或 segments 字段')
  }
  console.log(`[analyze] 块 ${index + 1}/${total} 完成 (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  return parsed
}

// 构建角色上下文摘要，传给后续分析块
function buildCharacterContext(
  allCharacters: Map<string, Character>,
  nameToId: Map<string, string>,
): string {
  const lines: string[] = ['已识别角色（请保持 ID 和称呼一致，不要重复创建已有角色）：']
  for (const [name, id] of nameToId) {
    if (name === '旁白') continue
    const c = allCharacters.get(id)
    if (c) {
      lines.push(`- ${c.name}（id: ${id}, 性别: ${c.gender}）${c.description ? '：' + c.description : ''}`)
    }
  }
  if (lines.length === 1) {
    lines.push('- 旁白（id: narrator）：叙述者')
  }
  return lines.join('\n')
}

export interface AnalysisResult {
  characters: Character[]
  segments: Segment[]
}

export async function analyzeChapter(rawText: string): Promise<AnalysisResult> {
  const chunks = chunkText(rawText)
  const allCharacters = new Map<string, Character>()
  allCharacters.set('narrator', { id: 'narrator', name: '旁白', gender: 'neutral', description: '叙述者' })

  const segments: Segment[] = []
  const nameToId = new Map<string, string>([['旁白', 'narrator']])
  let charIdx = 0

  // 串行处理：每块分析后将角色摘要传给下一块，确保跨块角色一致
  for (let i = 0; i < chunks.length; i++) {
    const characterContext = chunks.length > 1 ? buildCharacterContext(allCharacters, nameToId) : undefined
    const raw = await analyzeChunk(chunks[i], i, chunks.length, characterContext)

    // 合并角色
    for (const c of raw.characters) {
      if (c.name === '旁白') continue
      let id = nameToId.get(c.name)
      if (!id) {
        charIdx++
        id = `c${charIdx}`
        nameToId.set(c.name, id)
      }
      if (!allCharacters.has(id)) {
        const gender = (['male', 'female', 'neutral'].includes(c.gender) ? c.gender : 'neutral') as Character['gender']
        allCharacters.set(id, { id, name: c.name, gender, description: c.description })
      }
    }

    // 合并片段
    for (const s of raw.segments) {
      let cid = s.characterId
      const matchedChar = raw.characters.find((c) => c.id === cid)
      if (matchedChar && nameToId.has(matchedChar.name)) {
        cid = nameToId.get(matchedChar.name)!
      }
      if (cid === '旁白') cid = 'narrator'
      if (!allCharacters.has(cid)) cid = 'narrator'
      segments.push({
        id: nextSegId(),
        type: s.type === 'dialogue' ? 'dialogue' : 'narration',
        characterId: cid,
        text: s.text,
        emotion: s.emotion || 'calm',
        status: 'pending',
      })
    }
  }

  return { characters: Array.from(allCharacters.values()), segments }
}
