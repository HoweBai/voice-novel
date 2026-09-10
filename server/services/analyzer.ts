import { chat } from './aiClient.js'
import type { Character, Segment } from '../../src/types/index.js'

const CHUNK_SIZE = 15000 // 单块上限，常规短篇小说一次调用完成，避免跨块角色分裂

const SYSTEM_PROMPT = `你是一位专业的小说文本分析师。用户会给你一段小说文本，你需要：
1. 识别文本中出现的所有角色（包括"旁白"——即非角色对白的叙述部分）。
2. 【重要】同一人物的不同称呼/指代必须合并为同一个角色。例如"小姑娘""她""领航员"指同一人时，只保留一个角色条目，用最常用的称呼作为 name，并在 description 中说明其他称呼。禁止把同一人物的不同叫法拆成多个角色。
3. 把整段文本按"朗读单元"拆分成有序的片段，每个片段要么是旁白(narration)，要么是某个角色的台词(dialogue)。
4. 为每段判断一个情绪标签（如 calm/excited/happy/sad/angry/serious/gentle/fearful），旁白多为 calm/serious。
5. 旁白的 characterId 固定为 "narrator"。
6. 不要改写、删减原文文本，片段文本尽量保持原句。

【说话人归属规则——请逐句在内部追踪"当前说话人"，这是最容易出错的环节】
a. 引号（""''「」）内的内容一定是某角色的台词或心声，必须归属给具体角色，禁止归给 narrator。
b. 显式提示优先：引号紧邻的"XX说/道/问/答/笑/喊/吼/低声道/冷冷道"等提示，说话人是 XX。注意提示可能在引号前（他说："……"）也可能在引号后（"……"他说）。
c. 【连续对话】当多组引号连续出现、中间只有简短动作/神态描写时（如"……"他皱眉。"……"她摇头），说话人按话轮交替：甲说一句、乙回一句，不可连续两句归给同一人，除非有明确的动作提示表明是同一人继续说。
d. 【问答配对】"XX问/疑惑道：'……'"之后紧跟的下一句引号，通常是被问的那个人在回答；反过来，"XX答/说道：'……'"所回应的是上一句问话的人。
e. 【动作伴随】引号与"他/她+动作"在同一句时（"……"他猛地站起来），这个"他/她"指代前文最近的同性角色，该句引号归这个角色。
f. 【代词与称呼】先确定本段视角人物：第一人称小说里"我"是视角主角，"我"说的话归主角；对白里出现的"你/您/师兄/前辈/队长"等是对听话人的称呼，不是说话人本人。
g. 【心理活动】"她心想/暗道：'……'"或明显是内心独白的引号内容，归该角色，类型仍为 dialogue。
h. 【兜底推断】没有显式提示时，综合"谁在场、谁刚被问到、话轮轮到谁、台词内容与谁的处境相符"推断；现场只有两名角色时严格按话轮交替；确实无法判断时，归给当前场景中最可能说话的角色，绝不要把对白丢给 narrator。

【切分规则】当一句话中同时包含叙述和对白时（如"小女孩蹦蹦跳跳地飞奔过来，一边说：'你终于回来了'，一边留下激动的眼泪"），必须在引号边界处拆分为多个片段：
   - 引号外的叙述部分 → narration（旁白）
   - 引号内的对白部分 → dialogue（说话角色）
   - 引号外的后续叙述 → narration（旁白）
   不要把对白和叙述混在同一个片段中。
   示例输入："小女孩蹦蹦跳跳地飞奔过来，一边说：'你终于回来了'，一边留下激动的眼泪"
   示例输出：
   {"type":"narration","characterId":"narrator","text":"小女孩蹦蹦跳跳地飞奔过来，一边说：","emotion":"excited"}
   {"type":"dialogue","characterId":"c1","text":"你终于回来了","emotion":"happy"}
   {"type":"narration","characterId":"narrator","text":"，一边留下激动的眼泪","emotion":"sad"}

【连续对话归属示例】
输入：老张推开办公室的门，小李立刻站了起来。"张队，您可算来了。"他递上一份文件。"情况怎么样？"老张接过文件翻了翻。"不太妙，证人改口了。""什么时候的事？""昨天晚上。"老张的脸色沉了下来。
输出（注意 c1 小李与 c2 老张话轮交替，提示语在引号后时归属"他"所指的人）：
{"type":"narration","characterId":"narrator","text":"老张推开办公室的门，小李立刻站了起来。","emotion":"calm"}
{"type":"dialogue","characterId":"c1","text":"张队，您可算来了。","emotion":"calm"}
{"type":"narration","characterId":"narrator","text":"他递上一份文件。","emotion":"calm"}
{"type":"dialogue","characterId":"c2","text":"情况怎么样？","emotion":"serious"}
{"type":"narration","characterId":"narrator","text":"老张接过文件翻了翻。","emotion":"calm"}
{"type":"dialogue","characterId":"c1","text":"不太妙，证人改口了。","emotion":"serious"}
{"type":"dialogue","characterId":"c2","text":"什么时候的事？","emotion":"serious"}
{"type":"dialogue","characterId":"c1","text":"昨天晚上。","emotion":"calm"}
{"type":"narration","characterId":"narrator","text":"老张的脸色沉了下来。","emotion":"serious"}

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

// 增量分析状态：跨多次 analyzePartial 调用保持角色 ID 稳定
export interface AnalyzeState {
  allCharacters: Map<string, Character>
  nameToId: Map<string, string>
  charIdx: number
}

export function initAnalyzeState(prior: Character[] = []): AnalyzeState {
  const allCharacters = new Map<string, Character>()
  const nameToId = new Map<string, string>([['旁白', 'narrator']])
  let charIdx = 0
  for (const c of prior) {
    if (c.id === 'narrator' || c.name === '旁白') {
      allCharacters.set('narrator', { id: 'narrator', name: '旁白', gender: 'neutral', description: '叙述者' })
      continue
    }
    allCharacters.set(c.id, c)
    nameToId.set(c.name, c.id)
    const m = c.id.match(/^c(\d+)$/)
    if (m) charIdx = Math.max(charIdx, Number(m[1]))
  }
  if (!allCharacters.has('narrator')) {
    allCharacters.set('narrator', { id: 'narrator', name: '旁白', gender: 'neutral', description: '叙述者' })
  }
  return { allCharacters, nameToId, charIdx }
}

// 分析一段文本（可以是全书，也可以是长书中的一个部分）。
// 传入 priorCharacters（之前部分已识别的角色）可保持角色 ID 稳定、避免角色分裂。
// 返回：characters 为截止当前累计的全部角色；segments 仅包含本次文本的片段。
export async function analyzePartial(
  rawText: string,
  priorCharacters: Character[] = [],
): Promise<AnalysisResult> {
  const state = initAnalyzeState(priorCharacters)
  const { allCharacters, nameToId } = state
  let { charIdx } = state

  const chunks = chunkText(rawText)
  const segments: Segment[] = []

  // 串行处理：每块分析后将角色摘要传给下一块，确保跨块角色一致
  for (let i = 0; i < chunks.length; i++) {
    const characterContext = buildCharacterContext(allCharacters, nameToId)
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

export async function analyzeChapter(rawText: string): Promise<AnalysisResult> {
  return analyzePartial(rawText, [])
}
