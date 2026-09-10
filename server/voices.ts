import type { VoiceOption } from '../src/types/index.js'

// 精选中文 Edge TTS 音色，覆盖男/女/不同年龄段与气质，用于角色分配
export const VOICES: VoiceOption[] = [
  // 旁白候选
  { shortName: 'zh-CN-YunyangNeural', name: '云扬', gender: 'male', style: '沉稳男声 · 新闻播音风' },
  { shortName: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: 'female', style: '温暖女声 · 旁白首选' },
  { shortName: 'zh-CN-YunyeNeural', name: '云野', gender: 'male', style: '醇厚男声 · 叙述感' },
  // 男角色
  { shortName: 'zh-CN-YunxiNeural', name: '云希', gender: 'male', style: '青年男声 · 清朗' },
  { shortName: 'zh-CN-YunjianNeural', name: '云健', gender: 'male', style: '成熟男声 · 磁性' },
  { shortName: 'zh-CN-YunxiaNeural', name: '云夏', gender: 'male', style: '少年男声 · 活泼' },
  { shortName: 'zh-CN-YunfengNeural', name: '云枫', gender: 'male', style: '稳重男声 · 中年' },
  // 女角色
  { shortName: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: 'female', style: '清甜女声 · 少女' },
  { shortName: 'zh-CN-XiaomoNeural', name: '晓墨', gender: 'female', style: '清冷女声 · 知性' },
  { shortName: 'zh-CN-XiaoruiNeural', name: '晓睿', gender: 'female', style: '干练女声 · 御姐' },
  { shortName: 'zh-CN-XiaohanNeural', name: '晓涵', gender: 'female', style: '温柔女声 · 成熟' },
  { shortName: 'zh-CN-XiaochenNeural', name: '晓辰', gender: 'female', style: '活泼女声 · 少女' },
]

// 按性别给角色推荐默认音色
export function defaultVoiceFor(gender: string): string {
  if (gender === 'female') return 'zh-CN-XiaoyiNeural'
  if (gender === 'male') return 'zh-CN-YunxiNeural'
  return 'zh-CN-XiaoxiaoNeural' // neutral（旁白）默认温暖女声
}
