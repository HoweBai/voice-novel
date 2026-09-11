# -*- coding: utf-8 -*-
"""
ChatTTS speaker 音色采样与筛选：
1. 用固定 torch 种子采样 N 个随机 speaker（spk_emb 可序列化复用，即"固化音色"）
2. 每个 speaker 合成一段固定文本，保存样本 wav
3. 分帧自相关估算基频 F0，按中位数判定性别（>=160Hz 女，<160Hz 男）
4. 输出 candidates.json（含 spk 字符串、F0、性别），供人工/脚本挑选生成 voices.json

用法：
  python curate_voices.py [采样数量，默认40]
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
SAMPLES_DIR = PROJECT_ROOT / "models" / "chattts-voices" / "samples"
MODEL_DIR = PROJECT_ROOT / "models" / "chattts-model"
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)

SAMPLE_RATE = 24000
# 约 12 秒的叙述文本，便于稳定估 F0
TEXT = (
    "夜色渐渐深了，窗外的风声也慢慢安静下来。他端起桌上温热的茶杯，"
    "轻轻吹开浮动的茶叶，目光越过窗棂，落在远处那盏昏黄的灯火上，久久没有说话。"
)


def median_f0(x: np.ndarray, sr: int = SAMPLE_RATE) -> float:
    """分帧自相关估基频，返回八度校正后的中位数 F0（Hz）"""
    frame = sr // 20   # 50ms
    hop = sr // 50     # 20ms
    max_lag = sr // 60
    vals = []
    for start in range(0, len(x) - frame - max_lag, hop):
        fr = x[start:start + frame]
        if float(np.mean(fr ** 2)) < 0.002:  # 静音帧跳过
            continue
        best, best_val = 0, 0.0
        for lag in range(sr // 350, sr // 60):
            v = float(np.dot(fr, x[start + lag:start + lag + frame]))
            if v > best_val:
                best_val, best = v, lag
        if best:
            vals.append(sr / best)
    if not vals:
        return 0.0
    f = float(np.median(vals))
    # 八度校正
    while f < 75:
        f *= 2
    while f > 350:
        f /= 2
    return f


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    import ChatTTS
    import torch

    print("[curate] 加载 ChatTTS 模型 ...", flush=True)
    chat = ChatTTS.Chat()
    # source='huggingface' 走 Python 版 huggingface_hub 下载（local 模式的 Go 下载器在无控制台环境会 panic）
    ok = chat.load(
        source="huggingface",
        compile=False,
        device="cuda" if torch.cuda.is_available() else "cpu",
    )
    if not ok:
        raise RuntimeError("ChatTTS 模型加载失败")

    import ChatTTS as C
    candidates = []
    for i in range(n):
        seed = 20260000 + i * 137  # 固定种子，可复现
        torch.manual_seed(seed)
        spk = chat.sample_random_speaker()
        wavs = chat.infer(
            [TEXT],
            params_infer_code=C.Chat.InferCodeParams(
                spk_emb=spk, temperature=0.3, top_P=0.7, top_K=20
            ),
        )
        wav = wavs[0].reshape(-1).astype(np.float32)
        f0 = median_f0(wav)
        gender = "female" if f0 >= 160 else "male"
        sf.write(str(SAMPLES_DIR / f"seed-{seed}.wav"), wav, SAMPLE_RATE)
        candidates.append({
            "seed": seed,
            "f0": round(f0, 1),
            "gender": gender,
            "spk": spk,
        })
        print(f"[{i+1}/{n}] seed={seed} F0={f0:.0f}Hz {gender}", flush=True)

    out = BASE_DIR / "candidates.json"
    out.write_text(json.dumps(candidates, ensure_ascii=False, indent=2), encoding="utf-8")
    males = [c for c in candidates if c["gender"] == "male"]
    females = [c for c in candidates if c["gender"] == "female"]
    print(f"\n完成：{len(males)} 男 / {len(females)} 女 -> {out}")
    print(f"样本音频 -> {SAMPLES_DIR}")


if __name__ == "__main__":
    main()
