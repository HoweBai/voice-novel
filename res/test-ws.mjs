import WebSocket from 'ws'

const SYNTH_URL =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4'

console.log('连接 WebSocket:', SYNTH_URL)
const ws = new WebSocket(SYNTH_URL, {
  headers: {
    'User-Agent': 'Mozilla/5.0',
  },
})

ws.on('open', () => {
  console.log('✅ WebSocket 连接成功！')
  ws.close()
  process.exit(0)
})

ws.on('error', (e) => {
  console.error('❌ WebSocket 连接失败:', e.message)
  process.exit(1)
})

ws.on('close', (code, reason) => {
  console.log('WebSocket 关闭:', code, reason?.toString())
})

setTimeout(() => {
  console.log('⏱ 超时（15s）')
  process.exit(2)
}, 15000)
