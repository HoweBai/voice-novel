import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
const sherpa = require('sherpa-onnx-node')

const modelPath = './models/kokoro'
const config = {
  model: {
    kokoro: {
      model: path.join(modelPath, 'model.onnx'),
      voices: path.join(modelPath, 'voices.bin'),
      tokens: path.join(modelPath, 'tokens.txt'),
      dataDir: path.join(modelPath, 'espeak-ng-data'),
      lexicon: path.join(modelPath, 'lexicon-zh.txt'),
    },
  },
  debug: false,
  numThreads: 1,
  provider: 'cpu',
}

const tts = await sherpa.OfflineTts.createAsync(config)
console.log('OfflineTts created. methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tts)))
const audio = tts.generate({
  text: '你好，这是一段测试语音。',
  generationConfig: { sid: 48, speed: 1.0, silenceScale: 0.2 },
})
console.log('audio keys:', Object.keys(audio))
console.log('sampleRate:', audio.sampleRate)
console.log('samples length:', audio.samples.length)
console.log('samples type:', typeof audio.samples, audio.samples?.constructor?.name)

// 写 WAV
const samples = audio.samples
const sampleRate = audio.sampleRate
const buffer = Buffer.alloc(44 + samples.length * 2)
buffer.write('RIFF', 0)
buffer.writeUInt32LE(36 + samples.length * 2, 4)
buffer.write('WAVE', 8)
buffer.write('fmt ', 12)
buffer.writeUInt32LE(16, 16)
buffer.writeUInt16LE(1, 20)
buffer.writeUInt16LE(1, 22)
buffer.writeUInt32LE(sampleRate, 24)
buffer.writeUInt32LE(sampleRate * 2, 28)
buffer.writeUInt16LE(2, 32)
buffer.writeUInt16LE(16, 34)
buffer.write('data', 36)
buffer.writeUInt32LE(samples.length * 2, 40)
for (let i = 0; i < samples.length; i++) {
  const s = Math.max(-1, Math.min(1, samples[i]))
  buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2)
}
fs.writeFileSync('./res/test-kokoro.wav', buffer)
console.log('WAV written:', fs.statSync('./res/test-kokoro.wav').size, 'bytes')
