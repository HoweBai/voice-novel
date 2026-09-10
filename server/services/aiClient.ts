// OpenAI 兼容的 Chat Completions 客户端，从 .env 读取配置
const API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1'
const API_KEY = process.env.OPENAI_API_KEY || ''
const MODEL = process.env.OPENAI_MODEL || 'agnes-2.5-flash'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const AI_TIMEOUT_MS = 600_000 // 单次 AI 调用超时 10 分钟（长文本分析可能较慢）
const MAX_RETRIES = 4
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function chat(messages: ChatMessage[], temperature = 0.2): Promise<string> {
  if (!API_KEY) {
    throw new Error('未配置 OPENAI_API_KEY，请在 .env 中设置')
  }
  const url = `${API_BASE.replace(/\/$/, '')}/chat/completions`

  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
          console.log(`[aiClient] ${res.status} 错误，第 ${attempt + 1}/${MAX_RETRIES} 次重试...`)
          await sleep(1000 * Math.pow(2, attempt) + Math.random() * 500)
          continue
        }
        throw new Error(`AI 请求失败 ${res.status}: ${detail.slice(0, 300)}`)
      }
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content
      if (!content) throw new Error('AI 返回内容为空')
      return content as string
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error(`AI 请求超时（${AI_TIMEOUT_MS / 1000}s）`)
      // 网络错误也重试
      const isNetworkErr = e?.message?.includes('fetch failed') || e?.message?.includes('ECONNRESET') || e?.code === 'ECONNREFUSED'
      if (isNetworkErr && attempt < MAX_RETRIES) {
        console.log(`[aiClient] 网络错误，第 ${attempt + 1}/${MAX_RETRIES} 次重试...`)
        await sleep(1000 * Math.pow(2, attempt) + Math.random() * 500)
        continue
      }
      lastErr = e
      break
    } finally {
      clearTimeout(timer)
    }
  }
  if (lastErr instanceof Error) throw lastErr
  throw new Error('AI 请求失败')
}

export function getModelName() {
  return MODEL
}
