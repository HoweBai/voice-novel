# -*- coding: utf-8 -*-
"""
ChatTTS 配音微服务
- 启动时加载 ChatTTS 模型（CUDA 优先），读取 voices.json 中固化的 speaker 音色
- HTTP 接口（默认端口 8788）：
    GET  /health   健康检查
    GET  /voices   音色列表
    POST /tts      {"text","voice","speed"?, "emotion"?} -> audio/wav (24kHz/16bit/mono)
- 语速：用 ChatTTS 原生 [speed_N] 控制（N=0~10，5 为常速，越大越快）
"""
import io
import json
import os
import threading
from pathlib import Path

import numpy as np
import soundfile as sf
import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
VOICES_FILE = BASE_DIR / "voices.json"
# 模型文件下载到项目 models 下（models/ 已在 .gitignore 中）
MODEL_DIR = PROJECT_ROOT / "models" / "chattts-model"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

SAMPLE_RATE = 24000

# 情绪 -> ChatTTS 文本细化 prompt（口语化程度/笑声/停顿）
EMOTION_PROMPT = {
    "calm": "[oral_2][laugh_0][break_4]",
    "serious": "[oral_1][laugh_0][break_5]",
    "gentle": "[oral_3][laugh_0][break_5]",
    "happy": "[oral_4][laugh_2][break_3]",
    "excited": "[oral_6][laugh_1][break_2]",
    "sad": "[oral_1][laugh_0][break_7]",
    "angry": "[oral_5][laugh_0][break_2]",
    "fearful": "[oral_3][laugh_0][break_6]",
}
# 情绪 -> 语速系数（与 Node 端其它引擎保持一致）
EMOTION_SPEED = {
    "calm": 1.0, "excited": 1.15, "happy": 1.1, "sad": 0.88,
    "angry": 1.2, "serious": 0.95, "gentle": 0.92, "fearful": 1.08,
}

app = FastAPI(title="ChatTTS 配音服务")
_infer_lock = threading.Lock()
_chat = None
_voices: dict = {}


def load_voices() -> dict:
    if not VOICES_FILE.exists():
        print(f"[chattts] 警告：{VOICES_FILE.name} 不存在，请先运行 curate_voices.py 并生成音色档案", flush=True)
        return {}
    data = json.loads(VOICES_FILE.read_text(encoding="utf-8"))
    return {v["id"]: v for v in data}


def get_chat():
    """惰性加载 ChatTTS 模型（首次调用时加载，失败直接抛出）"""
    global _chat
    if _chat is None:
        import ChatTTS
        import torch
        device = os.environ.get("CHATTTS_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
        # CHATTTS_HALF=1 开启 fp16（experimental，2080 上约快 15%，默认关以保质量）
        half = os.environ.get("CHATTTS_HALF", "0") == "1"
        print(f"[chattts] 开始加载模型 (device={device}, half={half}) ...", flush=True)
        chat = ChatTTS.Chat()
        # source='huggingface' 走 Python 版 huggingface_hub（local 模式的 Go 下载器在无控制台环境会 panic）
        ok = chat.load(source="huggingface", compile=False, device=device, experimental=half)
        if not ok:
            raise RuntimeError("ChatTTS 模型加载失败（检查网络/代理或 HF 缓存）")
        _chat = chat
        print("[chattts] 模型加载完成", flush=True)
    return _chat


class TtsRequest(BaseModel):
    text: str
    voice: str
    speed: float = 1.0      # 用户全局语速系数
    emotion: str = "calm"


@app.get("/health")
def health():
    import torch
    return {
        "status": "ok",
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "voices": len(_voices),
    }


@app.get("/voices")
def list_voices():
    return [
        {"id": v["id"], "name": v["name"], "gender": v["gender"], "style": v["style"]}
        for v in _voices.values()
    ]


def speed_token(total_speed: float) -> int:
    """总语速系数(0.5~2.0) -> ChatTTS [speed_N]（N=0..10，5 为常速，越大越快）"""
    return int(min(10, max(0, round(total_speed * 5))))


@app.post("/tts")
def tts(req: TtsRequest):
    v = _voices.get(req.voice)
    if not v:
        return JSONResponse({"error": f"未知音色: {req.voice}"}, status_code=400)
    if not req.text.strip():
        return JSONResponse({"error": "text 为空"}, status_code=400)

    total_speed = min(2.0, max(0.5, req.speed)) * EMOTION_SPEED.get(req.emotion, 1.0)
    total_speed = min(2.0, max(0.5, total_speed))
    tok = speed_token(total_speed)

    # GPU 推理串行化，避免并发请求抢占显存
    with _infer_lock:
        chat = get_chat()
        import ChatTTS
        params_refine = ChatTTS.Chat.RefineTextParams(
            prompt=EMOTION_PROMPT.get(req.emotion, EMOTION_PROMPT["calm"]),
        )
        params_infer = ChatTTS.Chat.InferCodeParams(
            prompt=f"[speed_{tok}]",
            spk_emb=v["spk"],
            temperature=0.3,
            top_P=0.7,
            top_K=20,
        )
        wavs = chat.infer(
            [req.text],
            params_refine_text=params_refine,
            params_infer_code=params_infer,
        )

    wav = wavs[0]
    if wav.ndim == 2:
        wav = wav[0]
    wav = np.clip(wav.astype(np.float32), -1.0, 1.0)

    buf = io.BytesIO()
    sf.write(buf, wav, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    return Response(content=buf.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    _voices = load_voices()
    # 启动即加载模型，让显存/模型问题在启动阶段暴露
    get_chat()
    uvicorn.run(
        app,
        host=os.environ.get("CHATTTS_HOST", "127.0.0.1"),
        port=int(os.environ.get("CHATTTS_PORT", "8788")),
        log_level="info",
    )
