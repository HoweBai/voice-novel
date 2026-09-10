import type { VoiceOption } from '../types'

// 前端内置音色目录（与后端 voices.ts 一致，便于即时渲染下拉）
export const VOICES: VoiceOption[] = [
  { shortName: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: 'female', style: '温暖女声 · 旁白首选' },
  { shortName: 'zh-CN-YunyangNeural', name: '云扬', gender: 'male', style: '沉稳男声 · 新闻播音风' },
  { shortName: 'zh-CN-YunyeNeural', name: '云野', gender: 'male', style: '醇厚男声 · 叙述感' },
  { shortName: 'zh-CN-YunxiNeural', name: '云希', gender: 'male', style: '青年男声 · 清朗' },
  { shortName: 'zh-CN-YunjianNeural', name: '云健', gender: 'male', style: '成熟男声 · 磁性' },
  { shortName: 'zh-CN-YunxiaNeural', name: '云夏', gender: 'male', style: '少年男声 · 活泼' },
  { shortName: 'zh-CN-YunfengNeural', name: '云枫', gender: 'male', style: '稳重男声 · 中年' },
  { shortName: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: 'female', style: '清甜女声 · 少女' },
  { shortName: 'zh-CN-XiaomoNeural', name: '晓墨', gender: 'female', style: '清冷女声 · 知性' },
  { shortName: 'zh-CN-XiaoruiNeural', name: '晓睿', gender: 'female', style: '干练女声 · 御姐' },
  { shortName: 'zh-CN-XiaohanNeural', name: '晓涵', gender: 'female', style: '温柔女声 · 成熟' },
  { shortName: 'zh-CN-XiaochenNeural', name: '晓辰', gender: 'female', style: '活泼女声 · 少女' },
]

export const EMOTION_LABELS: Record<string, string> = {
  calm: '平静',
  excited: '兴奋',
  happy: '愉悦',
  sad: '悲伤',
  angry: '愤怒',
  serious: '严肃',
  gentle: '温柔',
  fearful: '惊惧',
}

export function defaultVoiceFor(gender: string): string {
  if (gender === 'female') return 'zh-CN-XiaoyiNeural'
  if (gender === 'male') return 'zh-CN-YunxiNeural'
  return 'zh-CN-XiaoxiaoNeural'
}

// 角色配色（用于发言标记）
export const CHARACTER_COLORS = [
  '#e8943a', '#8aa9d8', '#c98aa9', '#7ec9a8', '#d6b24a',
  '#9a8ad8', '#d88a8a', '#6ab0c4', '#c0a06a', '#a0c06a',
]

export function colorForCharacter(index: number): string {
  return CHARACTER_COLORS[index % CHARACTER_COLORS.length]
}
