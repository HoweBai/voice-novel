# voice-novel — 有声小说阅读器 / Audiobook Reader

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://typescriptlang.org)

简体中文 | [English](#english)

本地运行的有声小说播放器。上传 EPUB/TXT/DOCX → AI 自动分析角色与对话 → 多 TTS 引擎配音 → 按章节流式播放。支持 Edge 云端、sherpa-onnx（Kokoro / ZipVoice 零样本克隆）、ChatTTS（PyTorch + CUDA）等多种引擎，可通过 `.env` 一键切换。

---

# voice-novel — Audiobook Reader

Local audiobook player. Upload EPUB/TXT/DOCX → AI analyzes characters and dialogue → multi-engine TTS synthesis → chapter-by-chapter streaming playback. Supports Edge Cloud, sherpa-onnx (Kokoro / ZipVoice zero-shot cloning), ChatTTS (PyTorch + CUDA) and more — switch engines via `.env`.

---

## Features / 功能

- **多格式导入** — 支持 EPUB / TXT / DOCX，自动提取章节
- **AI 角色分析** — 调用 OpenAI 兼容接口，自动提取角色、旁白与对话分段
- **多引擎配音** — Edge / Kokoro / ZipVoice / ChatTTS 四种引擎，音色可切换
- **音色分配** — 为每个角色单独指定音色，支持男女声混合
- **情绪与语速** — 细粒度控制情绪（愤怒/悲伤/欢快等）和语速系数
- **单段试听 + 批量生成** — SSE 实时进度推送，浏览器内连续播放
- **进度记忆** — 浏览器本地记录播放位置，续读无缝衔接

---

## Tech Stack / 技术栈

| Layer / 层级 | Stack / 技术栈 |
|---|---|
| Frontend / 前端 | React 18 · Vite 6 · TypeScript · TailwindCSS · Zustand |
| Backend / 后端 | Node.js 18+ · Express · tsx (hot reload) |
| AI Client / AI 调用 | OpenAI-compatible chat completions |
| TTS Engines / TTS 引擎 | Edge TTS · sherpa-onnx (Kokoro/ZipVoice) · ChatTTS (FastAPI + PyTorch CUDA) |

---

## Quick Start / 快速开始

### Prerequisites / 前置要求

- **Node.js** ≥ 18 · **npm** ≥ 9
- **Python** ≥ 3.10 （可选：仅使用 ChatTTS 引擎时需要）
- **Git**
- GPU 推理（可选）：NVIDIA 显卡 + CUDA 12.x（ChatTTS 最佳体验）

### Installation / 安装

```bash
git clone https://github.com/HoweBai/voice-novel.git
cd voice-novel
npm install
```

### Configuration / 配置

```bash
# 复制环境变量模板（Windows / macOS / Linux 通用）
cp .env.example .env

# 编辑 .env，填入你的 API 密钥
# Edit .env and fill in your API keys
```

**关键配置项 / Key variables**:

| 变量 / Variable | 说明 / Description |
|---|---|
| `OPENAI_API_KEY` | AI 角色分析接口密钥（必填，OpenAI 兼容格式）/ Required API key for AI character analysis (OpenAI-compatible) |
| `OPENAI_API_BASE` | 第三方 API 端点，如 `https://apihub.agnes-ai.com/v1` / Third-party API endpoint |
| `OPENAI_MODEL` | 模型名，默认 `agnes-2.5-flash` / Model name |
| `TTS_ENGINE` | 选 `edge` / `kokoro` / `zipvoice` / `chattts` / Select TTS engine |
| `HTTPS_PROXY` | 代理地址（Edge/HF 需联网时配置）/ Proxy for Edge/HF internet access |

### Start Development Server / 启动开发服务器

```bash
# 同时启动后端 (8787) 和前端 (5173) / Start both backend (8787) and frontend (5173)
npm run dev

# 仅后端 / Backend only
npm run dev:server

# 仅前端 / Frontend only
npm run dev:web
```

浏览器访问 **http://localhost:5173** 即可开始使用。

### ChatTTS 引擎额外步骤（可选）/ ChatTTS extra steps (optional)

```bash
# 1. 初始化 Python 虚拟环境 / Init Python venv
py -3.11 -m venv .venv-chattts

# 2. 激活 venv / Activate venv (Windows PowerShell)
.\.venv-chattts\Scripts\Activate.ps1
# macOS / Linux: source .venv-chattts/bin/activate

# 3. 安装依赖 / Install dependencies
pip install -r chattts-service/requirements.txt

# 4. 另开终端启动 ChatTTS 微服务 / Start ChatTTS service in another terminal
npm run chattts
```

首次启动会从 HuggingFace 自动下载模型到 `models/hf-cache/`，请确保网络畅通（或配置 `HTTPS_PROXY`）。

---

## TTS Engine Comparison / TTS 引擎对比

| 引擎 / Engine | 音质 / Quality | 速度 / Speed | 依赖 / Dependency | 中文对话感 / Dialogue Feel |
|---|---|---|---|---|
| **edge** | ⭐⭐⭐ | ⚡ 快 / Fast (云端) | 无需本地模型 / No local model | ⭐⭐ |
| **kokoro** | ⭐⭐ | 🖥️ 中 / Medium (CPU) | sherpa-onnx 模型 / Local model | ⭐⭐⭐ |
| **zipvoice** | ⭐⭐⭐ | 🖥️ 中 / Medium (CPU) | sherpa-onnx + vocos | ⭐⭐⭐⭐ |
| **chattts** | ⭐⭐⭐⭐ | 🐢 较慢 / Slower (CUDA) | Python + PyTorch + CUDA | ⭐⭐⭐⭐⭐ |

> **性能参考 / Performance notes**: RTX 2080 实测 ChatTTS RTF ≈ 1.7（1 秒音频约 1.7 秒合成）。CPU 机器建议选择 zipvoice 或 edge。

---

## Project Structure / 目录结构

```
voice-novel/
├── src/                  # 前端 React 源码 / Frontend React source
├── server/               # Node 后端 / Backend
│   ├── routes/           # API 路由 / API routes
│   └── services/         # 业务逻辑（TTS / AI / 文档解析）/ Business logic
├── chattts-service/      # ChatTTS Python 微服务 / Python microservice
├── storage/              # 运行时音频缓存（已 .gitignore）/ Runtime audio cache
├── models/               # TTS 模型文件（已 .gitignore）/ TTS model files
├── res/                  # 测试资源 / Test resources
├── .env.example          # 环境变量模板 / Environment template
└── README.md             # 本文件 / This file
```

---

## Branches / 分支说明

- **`master`** — 稳定版（Edge / Kokoro / ZipVoice）/ Stable branch
- **`feat/chattts`** — ChatTTS 引擎开发分支（PyTorch + CUDA，需独立 Python 微服务）/ ChatTTS development branch

---

## License / 许可

本项目采用 **MIT License** 开源协议。详见 [LICENSE](LICENSE)。
This project is open-sourced under the **MIT License**. See [LICENSE](LICENSE) for details.
