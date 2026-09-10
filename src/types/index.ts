export type Gender = 'male' | 'female' | 'neutral'

export interface Character {
  id: string // 如 'narrator' | 'c1'
  name: string // 如 '旁白' | '林晨'
  gender: Gender
  voiceId?: string // 分配的 Edge TTS 音色 ShortName
  description?: string // AI 给出的角色简述
}

export type SegmentType = 'narration' | 'dialogue'

export interface Segment {
  id: string
  type: SegmentType
  characterId: string // 归属角色
  text: string // 该段朗读文本
  emotion?: string // 情绪（calm/excited/sad...）→ 影响 TTS rate/pitch
  audioUrl?: string // 生成后的音频地址
  durationSec?: number
  status?: 'pending' | 'generating' | 'ready' | 'error'
}

export interface Chapter {
  id: string
  title: string
  rawText: string
  segments: Segment[]
  audioReady: boolean
}

export interface Book {
  id: string
  title: string
  chapters: Chapter[]
  characters: Character[]
}

export interface VoiceOption {
  shortName: string
  name: string
  gender: Gender
  style: string
}

export type AppStage = 'upload' | 'analyzing' | 'cast' | 'generating' | 'playing'
