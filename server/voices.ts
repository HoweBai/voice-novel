import type { VoiceOption } from '../src/types/index.js'

// 精选中文 Edge TTS 音色，覆盖男/女/不同年龄段与气质，用于角色分配
const EDGE_VOICES: VoiceOption[] = [
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

// Kokoro TTS v1.1-zh 音色（shortName 为 voices.bin 中的 sid 索引）
// 注意：sid 顺序按官方模型包内 voices 的排列顺序，与名称编号不对应，
// 例如 sid 9/10/11/12 实际是 zf_007/zf_008/zf_017/zf_018（女声），
// zm_009 起从 sid 58 开始。下方映射已逐一实测验证（基频 F0 判定性别）。
const KOKORO_VOICES: VoiceOption[] = [
  // 旁白候选
  { shortName: '60', name: 'zm_011', gender: 'male', style: '沉稳男声 · 旁白首选' },
  { shortName: '57', name: 'zf_099', gender: 'female', style: '温暖女声 · 旁白首选' },
  { shortName: '63', name: 'zm_014', gender: 'male', style: '浑厚男声 · 叙述感' },
  // 男角色
  { shortName: '58', name: 'zm_009', gender: 'male', style: '青年男声 · 清朗' },
  { shortName: '59', name: 'zm_010', gender: 'male', style: '青年男声 · 俊朗' },
  { shortName: '61', name: 'zm_012', gender: 'male', style: '成熟男声 · 磁性' },
  { shortName: '67', name: 'zm_025', gender: 'male', style: '低沉男声 · 磁性' },
  { shortName: '93', name: 'zm_080', gender: 'male', style: '稳重男声 · 中年' },
  { shortName: '86', name: 'zm_062', gender: 'male', style: '苍劲男声 · 老年' },
  // 女角色
  { shortName: '3', name: 'zf_001', gender: 'female', style: '清甜女声 · 少女' },
  { shortName: '11', name: 'zf_017', gender: 'female', style: '活泼女声 · 少女' },
  { shortName: '23', name: 'zf_038', gender: 'female', style: '明快女声 · 娇俏' },
  { shortName: '39', name: 'zf_072', gender: 'female', style: '清亮女声 · 通透' },
  { shortName: '32', name: 'zf_049', gender: 'female', style: '温柔女声 · 亲和' },
  { shortName: '43', name: 'zf_076', gender: 'female', style: '成熟女声 · 知性' },
  { shortName: '14', name: 'zf_021', gender: 'female', style: '清冷女声 · 御姐' },
]

// ZipVoice 零样本克隆音色（shortName 为 models/zipvoice-voices/profiles.json 中的档案 id）
// 5 男 6 女，含 2 个真实人声新闻女声；顺序：旁白候选在前，角色在后
const ZIPVOICE_VOICES: VoiceOption[] = [
  // 旁白候选
  { shortName: 'zv-yunyang', name: '沉稳男声', gender: 'male', style: '沉稳男声 · 旁白首选' },
  { shortName: 'zv-xiaoxiao', name: '温暖女声', gender: 'female', style: '温暖女声 · 旁白首选' },
  { shortName: 'zv-yunjhe', name: '醇厚男声', gender: 'male', style: '醇厚男声 · 叙述感' },
  // 男角色
  { shortName: 'zv-yunxi', name: '清朗青年', gender: 'male', style: '青年男声 · 清朗' },
  { shortName: 'zv-yunjian', name: '磁性男声', gender: 'male', style: '成熟男声 · 磁性' },
  { shortName: 'zv-yunxia', name: '少年男声', gender: 'male', style: '少年男声 · 活泼' },
  // 女角色
  { shortName: 'zv-xiaoyi', name: '清甜少女', gender: 'female', style: '清甜女声 · 少女' },
  { shortName: 'zv-hsiaochen', name: '端庄女声', gender: 'female', style: '端庄女声 · 知性' },
  { shortName: 'zv-hsiaoyu', name: '柔和女声', gender: 'female', style: '柔和女声 · 亲和' },
  { shortName: 'zv-newsf1', name: '新闻女声A', gender: 'female', style: '清亮女声 · 播报' },
  { shortName: 'zv-newsf2', name: '新闻女声B', gender: 'female', style: '沉稳女声 · 播报' },
]

// ChatTTS 固化 speaker 音色（shortName 为 chattts-service/voices.json 中的音色 id）
// 由 curate_voices.py 随机采样 + F0 性别筛选后人工挑选，id 与 spk 绑定，跨会话稳定
const CHAT_TTS_VOICES: VoiceOption[] = [
  // 旁白候选
  { shortName: 'ct-male-1', name: '沉稳男声', gender: 'male', style: '沉稳男声 · 旁白首选' },
  { shortName: 'ct-female-1', name: '温暖女声', gender: 'female', style: '温暖女声 · 旁白首选' },
  { shortName: 'ct-male-2', name: '醇厚男声', gender: 'male', style: '醇厚男声 · 叙述感' },
  // 男角色
  { shortName: 'ct-male-3', name: '清朗青年', gender: 'male', style: '青年男声 · 清朗' },
  { shortName: 'ct-male-4', name: '磁性男声', gender: 'male', style: '成熟男声 · 磁性' },
  { shortName: 'ct-male-5', name: '少年男声', gender: 'male', style: '少年男声 · 活泼' },
  // 女角色
  { shortName: 'ct-female-2', name: '清甜少女', gender: 'female', style: '清甜女声 · 少女' },
  { shortName: 'ct-female-3', name: '活泼女声', gender: 'female', style: '活泼女声 · 少女' },
  { shortName: 'ct-female-4', name: '知性女声', gender: 'female', style: '知性女声 · 端庄' },
  { shortName: 'ct-female-5', name: '温柔女声', gender: 'female', style: '温柔女声 · 亲和' },
  { shortName: 'ct-female-6', name: '清冷女声', gender: 'female', style: '清冷女声 · 御姐' },
]

const TTS_ENGINE = process.env.TTS_ENGINE || 'edge'

export const VOICES: VoiceOption[] =
  TTS_ENGINE === 'kokoro' ? KOKORO_VOICES :
  TTS_ENGINE === 'zipvoice' ? ZIPVOICE_VOICES :
  TTS_ENGINE === 'chattts' ? CHAT_TTS_VOICES : EDGE_VOICES

// 按性别给角色推荐默认音色
export function defaultVoiceFor(gender: string): string {
  if (TTS_ENGINE === 'kokoro') {
    if (gender === 'female') return '3'
    if (gender === 'male') return '58'
    return '60' // neutral（旁白）默认沉稳男声
  }
  if (TTS_ENGINE === 'zipvoice') {
    if (gender === 'female') return 'zv-xiaoyi'
    if (gender === 'male') return 'zv-yunxi'
    return 'zv-yunyang' // neutral（旁白）默认沉稳男声
  }
  if (TTS_ENGINE === 'chattts') {
    if (gender === 'female') return 'ct-female-2'
    if (gender === 'male') return 'ct-male-3'
    return 'ct-male-1' // neutral（旁白）默认沉稳男声
  }
  if (gender === 'female') return 'zh-CN-XiaoyiNeural'
  if (gender === 'male') return 'zh-CN-YunxiNeural'
  return 'zh-CN-XiaoxiaoNeural' // neutral（旁白）默认温暖女声
}
