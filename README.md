# voice-novel — 有声小说阅读器

本地运行的有声小说播放器：上传 EPUB/TXT/DOCX → AI 分析角色对话 → 多 TTS 引擎配音 → 按章节播放。

## 技术栈

- **前端**：React 18 + Vite 6 + TypeScript + TailwindCSS + Zustand
- **后端**：Node.js 18+ + Express + tsx（热重载）
- **TTS 引擎**（`.env` 中 `TTS_ENGINE` 切换）：
  - `edge`：Edge 在线 TTS（无需本地模型，需联网）
  - `kokoro`：本地 sherpa-onnx Kokoro（CPU，中英）
  - `zipvoice`：本地 sherpa-onnx ZipVoice 零样本声音克隆
  - `chattts`：本地 Python FastAPI 微服务 + PyTorch CUDA

## 快速开始

### 前置要求

- Node.js ≥ 18（npm ≥ 9）
- Python 3.10+（使用 ChatTTS 时需要）
- Git

### 安装

```bash
npm install
```

### 配置

复制环境变量模板并填写你的 API 密钥：

```bash
copy .env.example .env
# 编辑 .env：填入 OPENAI_API_KEY、选择 TTS_ENGINE 等
```

**.env 关键配置说明**：

| 变量 | 说明 |
|---|---|
| `OPENAI_API_KEY` | AI 角色分析接口密钥（必需，OpenAI 兼容格式） |
| `TTS_ENGINE` | `edge` / `kokoro` / `zipvoice` / `chattts` |
| `HTTPS_PROXY` | Edge TTS / HF 下载需代理时配置，如 `http://127.0.0.1:7890` |

**ChatTTS 引擎额外步骤**（可选）：

```bash
# 初始化 ChatTTS Python 虚拟环境（首次）
py -3.11 -m venv .venv-chattts
.\.venv-chattts\Scripts\Activate.ps1
pip install -r chattts-service/requirements.txt

# 启动 ChatTTS 微服务（需另开终端）
npm run chattts
```

模型首次启动会从 HuggingFace 自动下载到 `models/hf-cache/`，请确保有网络（或配置 `HTTPS_PROXY`）。

### 启动开发服务器

同时启动后端（8787）和前端（5173）：

```bash
npm run dev
```

仅启动后端：

```bash
npm run dev:server
```

仅启动前端：

```bash
npm run dev:web
```

访问 http://localhost:5173

### 生产部署

```bash
npm run build       # 构建前端
npm start           # 启动后端（NODE_ENV=production）
```

## 功能说明

1. **上传小说**：支持 EPUB / TXT / DOCX
2. **AI 分析**：提取角色、情绪、旁白与对话分段
3. **音色分配**：为每个角色分配音色（支持多引擎）
4. **试听 / 批量生成**：单段预览，SSE 进度推送批量合成
5. **播放器**：分段播放，记忆进度

## TTS 引擎对比

| 引擎 | 音质 | 速度 | 依赖 | 中文对话感 |
|---|---|---|---|---|
| edge | ⭐⭐⭐ | 快（云端） | 无需本地模型 | ⭐⭐ |
| kokoro | ⭐⭐ | 中（CPU） | sherpa-onnx 模型 | ⭐⭐⭐ |
| zipvoice | ⭐⭐⭐ | 中（CPU） | sherpa-onnx + vocos | ⭐⭐⭐⭐ |
| chattts | ⭐⭐⭐⭐ | 较慢（CUDA） | Python + PyTorch + CUDA | ⭐⭐⭐⭐⭐ |

> RTX 2080 实测 ChatTTS RTF ≈ 1.7（1 秒音频约 1.7 秒合成）；CPU 机器建议选择 zipvoice 或 edge。

## 目录结构

```
├── src/            # 前端 React 源码
├── server/         # Node 后端（Express + tsx）
│   ├── routes/     # API 路由
│   └── services/   # 业务逻辑（TTS / AI / 文档解析）
├── chattts-service/ # ChatTTS Python 微服务（FastAPI）
├── storage/        # 运行时音频缓存（已 .gitignore）
├── models/         # TTS 模型文件（已 .gitignore）
├── res/            # 测试资源（上传示例文件）
└── .env.example    # 环境变量模板
```

## 项目分支说明

- `master`：当前稳定版（ZipVoice / Kokoro / Edge 混编）
- `feat/chattts`：ChatTTS 引擎分支（PyTorch + CUDA，需独立 Python 微服务）

## License

Private / Personal Use