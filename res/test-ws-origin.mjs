import WebSocket from 'ws'

const SYNTH_URL =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4'

const origins = [
  'https://www.bing.com',
  'https://www.microsoft.com',
  'https://www.office.com',
  'http://www.bing.com',
  undefined,
]

for (const origin of origins) {
  const label = origin || '(无 Origin)'
  try {
    await new Promise((resolve) => {
      const ws = new WebSocket(SYNTH_URL, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
          ...(origin ? { Origin: origin } : {}),
        },
      })
      const timer = setTimeout(() => {
        console.log(`[${label}] 超时`)
        ws.close()
        resolve()
      }, 10000)
      ws.on('open', () => {
        console.log(`[${label}] ✅ 连接成功`)
        clearTimeout(timer)
        ws.close()
        resolve()
      })
      ws.on('error', (e) => {
        console.log(`[${label}] ❌ ${e.message}`)
        clearTimeout(timer)
        resolve()
      })
    })
  } catch (e) {
    console.log(`[${label}] 异常: ${e.message}`)
  }
}
