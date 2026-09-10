# 有声阅读器（Voice Novel）实施计划

## 概述

构建一个 Web 有声阅读器：用户上传读物（小说/文本），系统通过 AI 理解内容、识别角色（旁白、男主、女主、男2、女2 等）与对话归属，为每个角色分配独立的 TTS 音色，按故事发展顺序生成并播放多角色配音音频，让听众产生沉浸式代入感。

**技术选型（已确认）：**
- TTS：Edge TTS（免费方案，多中文音色，可后续替换为更高级方案）
- AI 理解：OpenAI 兼容的第三方模型 API（用户配置 endpoint/key/model，如 agnes-2.5-flash）
- 应用形态：Web 应用（前后端）

## 当前状态分析

- 项目目录 `d:\Code\voice-novel` 当前为**空**，无任何代码或配置文件。
- 需要从零搭建：前端、后端、文档解析、AI 分析、TTS 生成、播放器。

## 架构设计

### 技术栈
- **前端**：React 18 + Vite + TypeScript + Tailwind CSS + Zustand（状态管理）
- **后端**：Node.js + Express（同仓库，提供 API 与静态资源）
- **TTS**：`msedge-tts` npm 包（Node.js 调用微软 Edge 免费 TTS 服务）
- **AI**：OpenAI 兼容 Chat Completions 客户端（可配置 base URL / API key / model 名）
- **文档解析**：`txt` 原生读取；`epub` 用 `epub2`；`docx` 用 `mammoth`
- **音频**：按段生成 mp3，存临时目录，静态路由分发，前端按播放列表顺序播放

### 目录结构
```
voice-novel/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── tsconfig.node.json
├── index.html
├── .env.example                  # API/TTS 配置模板
├── server/                        # 后端 (Express)
│   ├── index.ts                  # Express 入口 + 静态资源 + 路由挂载
│   ├── routes/
│   │   ├── upload.ts             # 上传 + 文档解析 → 纯文本 + 章节
│   │   ├── analyze.ts           # AI 分析 → 角色 + 段落结构
│   │   └── tts.ts                # 按段生成音频 + 进度查询
│   ├── services/
│   │   ├── documentParser.ts    # txt/epub/docx → { chapters: [{title,text}] }
│   │   ├── aiClient.ts          # OpenAI 兼容客户端（读取 env 配置）
│   │   ├── analyzer.ts          # 章节文本 → 结构化 segments 的提示词与解析
│   │   └── ttsEngine.ts         # msedge-tts 封装：文本+音色 → mp3 文件
│   ├── voices.ts                # 可用 Edge TTS 中文音色目录（含性别/风格描述）
│   └── storage.ts               # 任务/音频文件临时存储与清理
├── src/                           # 前端 (React)
│   ├── main.tsx
│   ├── App.tsx                   # 顶层路由/步骤状态
│   ├── components/
│   │   ├── UploadPanel.tsx      # 上传 + 解析进度
│   │   ├── CharacterPanel.tsx   # 角色列表 + 音色分配
│   │   ├── PlayerView.tsx       # 播放器主视图
│   │   ├── TranscriptView.tsx   # 同步字幕/文本（高亮当前段、标注角色）
│   │   ├── PlayerControls.tsx   # 播放/暂停/上一段/下一段/语速
│   │   └── ChapterList.tsx      # 章节切换
│   ├── hooks/
│   │   ├── useAudioPlayer.ts    # 播放列表 + 当前段 + 同步逻辑
│   │   └── useApi.ts            # 封装后端调用
│   ├── store/
│   │   └── appStore.ts          # Zustand: 书籍/角色/段落/播放状态
│   ├── types/
│   │   └── index.ts             # Book/Chapter/Character/Segment 类型
│   ├── lib/
│   │   └── constants.ts        # 音色候选、情绪→SSML 映射等
│   └── styles/
│       └── globals.css          # Tailwind + 设计令牌 + 字体
└── public/
    └── fonts/                   # 自托管中文字体（衬线展示字 + 正文）
```

### 核心数据模型（src/types/index.ts）
```typescript
type Gender = 'male' | 'female' | 'neutral';

interface Character {
  id: string;            // 如 'narrator' | 'c1'
  name: string;          // 如 '旁白' | '林晨'
  gender: Gender;
  voiceId?: string;      // 分配的 Edge TTS 音色 ID
  description?: string;  // AI 给出的角色简述
}

type SegmentType = 'narration' | 'dialogue';

interface Segment {
  id: string;
  type: SegmentType;
  characterId: string;   // 归属角色
  text: string;          // 该段朗读文本
  emotion?: string;      // 情绪（如 calm/excited/sad）→ 影响 SSML
  audioUrl?: string;     // 生成后的音频地址
  durationSec?: number;
}

interface Chapter {
  id: string;
  title: string;
  rawText: string;
  segments: Segment[];
  audioReady: boolean;
}

interface Book {
  id: string;
  title: string;
  chapters: Chapter[];
  characters: Character[];
}
```

### AI 分析流程（server/services/analyzer.ts）
1. 章节文本（必要时按 ~3000 字分块）发送给 AI，提示词要求**仅返回 JSON**：
```json
{
  "characters": [
    {"id":"narrator","name":"旁白","gender":"neutral"},
    {"id":"c1","name":"林晨","gender":"male","description":"男主，沉稳内敛"}
  ],
  "segments": [
    {"type":"narration","characterId":"narrator","text":"窗外的雨没有停……","emotion":"calm"},
    {"type":"dialogue","characterId":"c1","text":"你来了。","emotion":"calm"}
  ]
}
```
2. 合并多块结果：角色去重（按名字归并 id），段落按顺序拼接。
3. 提示词要点：识别说话人归属（"某某道："后引号内为该角色台词）、旁白为 narration、保持原文顺序、不要改写文本。

### TTS 音色目录（server/voices.ts）
精选中文 Edge TTS 音色，覆盖男/女/不同年龄段与气质，用于角色分配：
- 旁白候选：`zh-CN-YunyangNeural`（沉稳男声/新闻风）、`zh-CN-XiaoxiaoNeural`（温暖女声）
- 男角色：`zh-CN-YunxiNeural`（青年）、`zh-CN-YunjianNeural`（成熟）、`zh-CN-YunxiaNeural`（少年）
- 女角色：`zh-CN-XiaoyiNeural`、`zh-CN-XiaomoNeural`、`zh-CN-XiaoruiNeural`（各气质）
- 每个音色附带性别与风格标签，前端下拉选择。

### 播放同步逻辑（src/hooks/useAudioPlayer.ts）
- 维护当前章节的 segment 播放列表。
- `<audio>` 元素按序播放，`onended` 自动进入下一段。
- 当前段索引驱动 `TranscriptView` 高亮与自动滚动。
- 支持上一段/下一段跳转、播放速度调整。

## 设计方向（前端美学）

**概念：沉浸式文学剧场**——如深夜灯下听一部广播剧。
- **主题**：暗色暖调（深墨蓝/炭黑底 + 琥珀/暖金强调色），营造剧场氛围。
- **字体**：自托管中文衬线展示字体（标题）+ 精致无衬线正文字体；英文配特色衬线字体。
- **动效**：上传→解析→配音阶段使用分步渐显与进度呼吸；当前朗读段落柔光高亮 + 滚动跟随；角色头像/标签随发言切换有微妙过渡。
- **布局**：左侧章节/角色面板，中央大字幕流，底部固定播放控制条。
- **细节**：噪点纹理叠加、角色发言时左侧色条标记、波形/段落时长可视化。

## 实施步骤

### 步骤 1：项目脚手架与配置
- 初始化 Vite + React + TS，安装依赖（express, msedge-tts, mammoth, epub2, zustand, tailwind, axios, multer 等）。
- 配置 Tailwind、tsconfig、vite 代理后端、`.env.example`（`OPENAI_API_BASE`、`OPENAI_API_KEY`、`OPENAI_MODEL`、`PORT`）。
- 建立 `server/` 与 `src/` 目录骨架。

### 步骤 2：后端 - 文档解析与上传
- `server/services/documentParser.ts`：txt 直读；epub/docx 提取纯文本；按章节标题或固定字数切分为 `Chapter[]`。
- `server/routes/upload.ts`：`multer` 接收文件 → 解析 → 返回 `{ bookId, title, chapters: [{id,title,rawText}] }`。

### 步骤 3：后端 - AI 分析
- `server/services/aiClient.ts`：OpenAI 兼容 chat completions 调用，从 env 读配置。
- `server/services/analyzer.ts`：章节分块 + 提示词 + JSON 解析容错（提取首个 `{...}`）+ 角色合并。
- `server/routes/analyze.ts`：接收 `chapterId/rawText` → 返回 `{ characters, segments }`。

### 步骤 4：后端 - TTS 生成
- `server/voices.ts`：音色目录。
- `server/services/ttsEngine.ts`：`msedge-tts` 把 `text + voiceId`（+ emotion→rate/pitch）合成 mp3，写入 `storage/<bookId>/<segmentId>.mp3`。
- `server/routes/tts.ts`：接收 `{ bookId, chapterId, assignments: {characterId→voiceId} }` → 逐段生成，SSE 或轮询返回进度与各段 `audioUrl`。
- `server/storage.ts`：文件目录管理与按 bookId 清理。

### 步骤 5：前端 - 类型与状态
- `src/types/index.ts`、`src/store/appStore.ts`（书籍/角色/播放状态）、`src/lib/constants.ts`。
- `src/hooks/useApi.ts` 封装上传/分析/TTS 调用。

### 步骤 6：前端 - 上传与角色分配
- `UploadPanel`：拖拽/选择文件 → 调上传 → 展示解析出的章节列表。
- `CharacterPanel`：列出 AI 识别的角色，为每个角色下拉选择音色（带试听），旁白默认分配。完成后触发该章 TTS 生成。

### 步骤 7：前端 - 播放器与字幕同步
- `useAudioPlayer`：播放列表、当前段、自动连播、速度。
- `PlayerView` + `TranscriptView` + `PlayerControls` + `ChapterList`：当前段高亮、自动滚动、角色标签、波形/时长。
- 底部固定控制条：播放/暂停、上一段/下一段、语速、章节进度。

### 步骤 8：视觉打磨
- 引入自托管字体、Tailwind 设计令牌、噪点纹理、段落柔光高亮与过渡动效，落地"沉浸式文学剧场"美学。

## 假设与决策

1. **AI 模型兼容性**：用户提到的 "agnes-2.5-flash" 模型按 OpenAI 兼容接口处理；通过 `.env` 配置 `OPENAI_API_BASE`/`OPENAI_API_KEY`/`OPENAI_MODEL`，任何兼容 chat completions 的 endpoint 均可接入。若该模型不支持稳定 JSON 输出，analyzer 会做 JSON 容错提取。
2. **TTS 免费方案**：首版用 `msedge-tts`（免费、多中文音色）；音色区分度有限但足够区分角色性别/气质。后续可在 `ttsEngine.ts` 替换为 Azure/ElevenLabs/本地模型，接口保持不变。
3. **章节化处理**：整本小说一次性生成不现实；按章节为单位分析+生成+播放，单章完成后即可收听，体验更流畅。
4. **音频生成策略**：MVP 采用"整章生成后再播放"（带进度条）；未来可改为流式/按需生成。
5. **文件格式优先级**：txt 优先支持，epub/docx 作为可选增强。
6. **数据持久化**：MVP 不做数据库，书/音频存本地临时目录，进程重启需重新上传（后续可加 SQLite）。

## 验证方式

- **后端 API**：用 curl/Postman 验证 `/api/upload`（txt）、`/api/analyze`、`/api/tts` 返回结构与生成的 mp3 可播放。
- **端到端**：准备一段含旁白+多角色对话的短文本（~2000 字），走完 上传→分析→分配音色→生成→播放 全流程，确认：
  - 角色识别正确、对话归属无误；
  - 各角色音色可区分；
  - 字幕高亮与音频同步、自动连播顺畅。
- **UI 检查**：浏览器中确认暗色暖调主题、字体加载、段落高亮动效、响应式布局正常。
