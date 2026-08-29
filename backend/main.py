"""SimForge 算力仿真平台后端 API。

提供：登录鉴权、配置模板、场景仿真（推理/训练/通算/图算，PD分离与融合）、AI Agent 建议。
"""
from __future__ import annotations

import hashlib
import json
import random
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(title="SimForge Simulation API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


# ---------------------------- In-memory store ----------------------------

# 简单演示账号（可按需替换为 DB / OAuth）
DEMO_USERS = {
    "admin": {"password": "admin123", "name": "管理员", "email": "admin@simforge.ai", "role": "admin"},
    "chris": {"password": "chris123", "name": "Chris R.", "email": "chris@simforge.ai", "role": "engineer"},
    "engineer": {"password": "sim123", "name": "仿真工程师", "email": "eng@simforge.ai", "role": "engineer"},
}

# token -> { user, created_at }
SESSION_TOKENS: dict[str, dict[str, Any]] = {}


# ---------------------------- Models ----------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: dict[str, str]


class UserInfo(BaseModel):
    username: str
    name: str
    email: str
    role: str


class SimulationConfig(BaseModel):
    workload: str = Field("inference", pattern=r"^(inference|training|general|graph)$")
    scene: str = Field("pd_separate", pattern=r"^(pd_separate|pd_fused)$")
    template_id: str | None = None
    model: dict[str, Any] = Field(default_factory=dict)
    system: dict[str, Any] = Field(default_factory=dict)
    runtime: dict[str, Any] = Field(default_factory=dict)
    chip: dict[str, Any] = Field(default_factory=dict)


class AgentMessage(BaseModel):
    text: str
    context: dict[str, Any] = Field(default_factory=dict)


# ---------------------------- Helpers ----------------------------

def hash_credential(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


def require_auth(authorization: str | None = Header(default=None)) -> dict[str, str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="未登录或 Token 缺失")
    token = authorization.split(" ", 1)[1].strip()
    session = SESSION_TOKENS.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="登录已过期或无效 Token")
    return session["user"]


def now_id() -> str:
    prefix = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"SIM-{prefix}-{uuid4().hex[:6].upper()}"


@dataclass
class WorkloadProfile:
    throughput_base: tuple[float, float]
    latency_base: tuple[float, float]  # (p50_ms, p99_ms)
    vram_gb_per_gpu_base: float
    power_w_per_gpu_base: float
    util_base: float
    mfu_base: float
    description: str


WORKLOAD_PROFILES: dict[str, WorkloadProfile] = {
    "inference": WorkloadProfile((2400, 3400), (38, 125), 58, 300, 0.9, 0.52, "LLM 推理：吞吐优先，PD 分离可提升稳定性"),
    "training": WorkloadProfile((1200, 1800), (180, 480), 68, 420, 0.86, 0.44, "分布式训练：通信密集，PD 融合可降低跨卡开销"),
    "general": WorkloadProfile((6000, 9000), (12, 36), 24, 260, 0.78, 0.62, "通用计算：算子密集，融合可减少调度开销"),
    "graph": WorkloadProfile((900, 1400), (90, 280), 40, 320, 0.72, 0.36, "图计算：访存与聚合密集，分离可扩展分片"),
}


def pick(base_range: tuple[float, float], scene: str, fused_bonus: float = 0.1, fused_reduce: float = 0.08) -> float:
    low, high = base_range
    base = random.uniform(low, high)
    if scene == "pd_fused":
        return round(base * (1 + fused_bonus), 2)
    return round(base * (1 - fused_reduce * 0.2), 2)


def compute_metrics(config: SimulationConfig) -> dict[str, Any]:
    profile = WORKLOAD_PROFILES[config.workload]
    scene = config.scene

    gpu_count = int(str(config.system.get("gpu_count", "8")).replace(",", "") or "8")
    gpu_coef = min(1.2, 0.6 + 0.01 * gpu_count)

    throughput = pick(profile.throughput_base, scene, fused_bonus=0.16, fused_reduce=0.02) * gpu_coef
    p50, p99 = profile.latency_base
    if scene == "pd_fused":
        p50 *= 0.88
        p99 *= 0.84
    else:
        p50 *= 1.06
        p99 *= 1.12
    vram = profile.vram_gb_per_gpu_base * (0.92 if scene == "pd_fused" else 1.0) * (1 + max(0, (gpu_count - 8) * 0.01))
    power = profile.power_w_per_gpu_base * (1.04 if scene == "pd_fused" else 1.0)
    util = profile.util_base * (1.02 if scene == "pd_fused" else 0.98)
    mfu = profile.mfu_base * (1.06 if scene == "pd_fused" else 0.95)

    return {
        "throughput_tokens_s": int(round(throughput)),
        "throughput_flops_tf": round(throughput / 16, 1) if config.workload != "inference" else None,
        "latency_p50_ms": round(p50, 1),
        "latency_p99_ms": round(p99, 1),
        "vram_gb_per_gpu": round(vram, 1),
        "power_w_per_gpu": int(round(power)),
        "gpu_utilization": round(min(99, util * 100), 1),
        "mfu": round(mfu * 100, 1),
    }


def make_chart_series(config: SimulationConfig, metrics: dict[str, Any]) -> dict[str, Any]:
    random.seed(hash(f"{config.workload}-{config.scene}-{time.time_ns() // 1_000_000}") % (2**32))
    xs = [f"{i*10}s" for i in range(11)]
    base = metrics["throughput_tokens_s"] or 1000
    throughput = [round(base * (0.4 + i * 0.06 + random.uniform(-0.04, 0.04))) for i in range(11)]
    throughput[-1] = round(base * (random.uniform(0.95, 1.05)))
    latency = [round(metrics["latency_p99_ms"] * (1.3 - i * 0.03 + random.uniform(-0.05, 0.05)), 1) for i in range(11)]
    util = [round(min(99, 30 + i * 6.5 + random.uniform(-2, 2)), 1) for i in range(11)]
    vram = [round(metrics["vram_gb_per_gpu"] * (0.55 + min(1, i * 0.08) + random.uniform(-0.02, 0.02)), 1) for i in range(11)]
    power = [round(metrics["power_w_per_gpu"] * (0.55 + min(1, i * 0.06) + random.uniform(-0.03, 0.03))) for i in range(11)]
    return {"xs": xs, "throughput": throughput, "latency_p99": latency, "gpu_util": util, "vram": vram, "power": power}


def make_logs(config: SimulationConfig, metrics: dict[str, Any]) -> list[dict[str, str]]:
    gpu_model = config.system.get("gpu_model", "NVIDIA A100 80GB")
    gpu_count = config.system.get("gpu_count", "8")
    model_name = config.model.get("model_name", "LLaMA-3-70B")
    template = [
        ("INFO", f"初始化 SimEngine v2.4.1，负载类型：{config.workload}，场景：{config.scene}"),
        ("DEBUG", f"加载模板 {config.template_id or 'default'}"),
        ("INFO", f"模型配置：{model_name} | 精度 {config.model.get('precision', 'FP16')}"),
        ("INFO", f"硬件配置：{gpu_model} × {gpu_count}，并行策略 {config.system.get('parallel', 'TP 8 × DP 1')}"),
        ("DEBUG", f"并发/批大小：{config.runtime.get('concurrency', config.system.get('batch_size', '-'))}"),
        ("INFO", "加载校验点与网络拓扑"),
        ("WARN", "高并发场景下建议开启 Continuous Batching" if config.workload == "inference" else "通信权重较高，建议使用 PD 融合"),
        ("INFO", "预热阶段：执行 10 次迭代"),
        ("DEBUG", f"首阶段利用率 {metrics['gpu_utilization'] - 8:.1f}%"),
        ("INFO", "稳态压测阶段，采样间隔 50ms"),
        ("INFO", f"吞吐峰值 {metrics['throughput_tokens_s']} tokens/s，MFU {metrics['mfu']:.1f}%"),
        ("INFO", "生成性能报告，写入历史"),
        ("INFO", "仿真完成，指标已就绪"),
    ]
    logs = []
    for i, (level, msg) in enumerate(template):
        t = datetime.now().strftime("%H:%M:%S.") + f"{(i*37)%1000:03d}"
        logs.append({"time": t, "level": level, "msg": msg})
    return logs


def make_recommendation(config: SimulationConfig, metrics: dict[str, Any]) -> str:
    profile = WORKLOAD_PROFILES[config.workload]
    if config.scene == "pd_separate":
        return f"当前 PD 分离，{profile.description}；若追求更高吞吐与更低 P99，可尝试 PD 融合。当前 MFU {metrics['mfu']}%，Prefill 实例数可上调 1~2 档。"
    return f"当前 PD 融合，聚合吞吐提升约 12%；但若集群规模继续扩大，需评估跨节点分离方案。当前 P99 {metrics['latency_p99_ms']} ms，建议观察通信热点。"


def make_agent_reply(message: str, context: dict[str, Any]) -> str:
    text = message.strip().lower()
    workload = context.get("workload") or "inference"
    scene = context.get("scene") or "pd_separate"
    if "降低" in message and ("延迟" in message or "ttft" in text or "首 token" in message):
        return f"针对 {workload} + {scene}：1) 调大 Prefill 微批，开启 Continuous Batching；2) 将 KV Cache 策略切到 PagedAttention；3) 对长尾请求启用 speculative decoding。预计 TTFT 可降低 12%~18%。"
    if "对比" in message and ("pd" in text or "融合" in message or "分离" in message):
        return "PD 分离：稳定性好，易于扩缩容，适合多租户；PD 融合：跨卡开销低，吞吐与 P99 更优，适合单任务大集群。一般小集群优先融合，多租户或超大规模再引入分离。"
    if "优化配置" in message or "生成" in message:
        return (
            f"推荐配置（{workload} · {scene}）：GPU=H100 80GB × 16，精度=FP8，KV=PagedAttention，"
            f"并发=512，批大小=128，并行=TP 8 × DP 2。可直接点击「应用推荐」写入表单。"
        )
    if "训练" in message or "throughput" in text:
        return "训练场景建议：1) 使用 ZeRO Stage-2/3 + Activation Offload；2) PD 融合减少集合通信；3) 混合精度 BF16；预计 MFU 可从 44% 提升到 52%。"
    return (
        "我可以读取当前仿真上下文，你可以问：「如何降低首 Token 延迟？」「对比 PD 分离和融合部署」"
        "「生成一份优化后的配置」。我会给出可一键应用的参数建议。"
    )


# ---------------------------- Configurations ----------------------------

CONFIG_TEMPLATES: dict[str, dict[str, Any]] = {
    "llama3-70b-a100-pd": {
        "id": "llama3-70b-a100-pd",
        "name": "LLaMA-3-70B · A100 · PD 分离",
        "workload": "inference",
        "scene": "pd_separate",
        "model": {
            "model_name": "LLaMA-3-70B", "param_size": "70B", "precision": "FP16",
            "context_length": "8192", "vocab_size": "128K",
        },
        "system": {
            "gpu_model": "NVIDIA A100 80GB", "gpu_count": "8", "parallel": "TP 8 × DP 1",
            "interconnect": "NVLink 4 + IB 400G", "batch_size": "64",
        },
        "runtime": {
            "framework": "vLLM", "kv_cache": "PagedAttention", "quantization": "None",
            "concurrency": "256", "scheduler": "FCFS",
        },
    },
    "qwen2-72b-h100-fused": {
        "id": "qwen2-72b-h100-fused",
        "name": "Qwen-2-72B · H100 · PD 融合",
        "workload": "inference",
        "scene": "pd_fused",
        "model": {
            "model_name": "Qwen-2-72B", "param_size": "72B", "precision": "FP8",
            "context_length": "32768", "vocab_size": "152K",
        },
        "system": {
            "gpu_model": "NVIDIA H100 80GB", "gpu_count": "16", "parallel": "TP 8 × DP 2",
            "interconnect": "NVLink 4 + IB 400G", "batch_size": "128",
        },
        "runtime": {
            "framework": "TensorRT-LLM", "kv_cache": "PagedAttention", "quantization": "FP8",
            "concurrency": "512", "scheduler": "Continuous Batching",
        },
    },
    "llama405b-h800-train": {
        "id": "llama405b-h800-train",
        "name": "LLaMA-3.1-405B · H800 · 训练 PD 融合",
        "workload": "training",
        "scene": "pd_fused",
        "model": {
            "model_name": "LLaMA-3.1-405B", "param_size": "405B", "precision": "BF16",
            "context_length": "8192", "vocab_size": "128K",
        },
        "system": {
            "gpu_model": "NVIDIA H800 80GB", "gpu_count": "128", "parallel": "TP 8 × PP 4 × DP 4",
            "interconnect": "NVLink 4 + IB 400G", "batch_size": "2048",
        },
        "runtime": {
            "framework": "Megatron-LM", "kv_cache": "FlashAttention-2", "quantization": "None",
            "concurrency": "32", "scheduler": "3D Parallel",
        },
    },
    "gemm-a100-general": {
        "id": "gemm-a100-general",
        "name": "GEMM 通用压测 · A100 · PD 融合",
        "workload": "general",
        "scene": "pd_fused",
        "model": {
            "model_name": "CUDA GEMM Suite", "param_size": "N/A", "precision": "FP16",
            "context_length": "N/A", "vocab_size": "N/A",
        },
        "system": {
            "gpu_model": "NVIDIA A100 80GB", "gpu_count": "8", "parallel": "NCCL AllReduce",
            "interconnect": "NVLink 3 + IB 200G", "batch_size": "4096",
        },
        "runtime": {
            "framework": "CUDA + cuBLAS", "kv_cache": "N/A", "quantization": "None",
            "concurrency": "1024", "scheduler": "Static",
        },
    },
    "gnn-mi300-graph": {
        "id": "gnn-mi300-graph",
        "name": "GNN 消息传递 · MI300X · PD 分离",
        "workload": "graph",
        "scene": "pd_separate",
        "model": {
            "model_name": "GraphSAGE-3L", "param_size": "1.2B", "precision": "FP16",
            "context_length": "N/A", "vocab_size": "200M 节点",
        },
        "system": {
            "gpu_model": "AMD MI300X", "gpu_count": "32", "parallel": "Graph 分片 × DP 4",
            "interconnect": "Infinity Fabric + IB 400G", "batch_size": "512",
        },
        "runtime": {
            "framework": "DGL + ROCm", "kv_cache": "Feature Cache", "quantization": "INT8",
            "concurrency": "128", "scheduler": "Chunked PPR",
        },
    },
}


# ---------------------------- Static data (served via API) ----------------------------

FIELD_OPTIONS: dict[str, list[str]] = {
    "precision": ["FP8", "FP16", "BF16", "FP32", "INT8", "INT4"],
    "gpu_model": ["A100 40GB", "A100 80GB", "A100 80GB SXM", "H100 80GB", "H800 80GB", "MI300X", "B200"],
    "parallel": ["TP 1 × DP 1", "TP 2 × DP 1", "TP 4 × DP 1", "TP 8 × DP 1", "TP 8 × DP 2", "TP 8 × PP 2 × DP 2", "TP 8 × PP 4 × DP 2", "DP 8", "DP 16", "DP 32", "DP 64"],
    "interconnect": ["PCIe 5.0", "NVLink 3", "NVLink 4", "IB 200G", "IB 400G", "Infinity Fabric"],
    "framework": ["vLLM", "TGI", "TensorRT-LLM", "Megatron-LM", "DeepSpeed", "PyTorch 2.5", "DGL 2.0"],
    "scheduler": ["Continous Batching", "Static Batching", "3D Parallel", "ZeRO-3", "Default", "GraphSAINT"],
    "quantization": ["无量化", "FP16", "BF16", "FP8", "INT8 AWQ", "INT4 GPTQ", "INT4 AWQ"],
    "kvcache_policy": ["Auto", "Full", "Half", "Lazy", "—"],
}

GPU_TYPES = ["A100 40GB", "A100 80GB", "A100 80GB SXM", "H100 80GB", "H800 80GB", "MI300X", "B200", "昇腾950"]
PRECISIONS = ["FP8", "FP16", "BF16", "FP32", "INT8", "INT4"]
QUANTS = ["无量化", "FP16", "BF16", "FP8", "INT8 AWQ", "INT4 GPTQ", "INT4 AWQ"]
BITWIDTHS = ["4", "8", "16", "32"]
STRATEGIES = ["dynamic-batching", "continuous-batching", "fused", "beam", "naive", "greedy"]
PARALLEL_LEVELS = ["TP 1 × DP 1", "TP 2 × DP 1", "TP 4 × DP 1", "TP 8 × DP 1", "TP 8 × DP 2", "TP 8 × PP 2 × DP 2", "TP 8 × PP 4 × DP 2", "DP 8", "DP 16", "DP 32", "DP 64"]

SECTION_META = [
    {"key": "model", "title": "模型参数", "icon": "M", "bg": "rgba(34,211,238,.14)", "color": "#22d3ee"},
    {"key": "system", "title": "系统拓扑", "icon": "S", "bg": "rgba(52,211,153,.14)", "color": "#34d399"},
    {"key": "runtime", "title": "运行时参数", "icon": "R", "bg": "rgba(167,139,250,.14)", "color": "#a78bfa"},
]

WORKLOAD_DEFAULTS_BY_KIND: dict[str, dict[str, Any]] = {
    "inference": {
        "scene": "pd_separate", "strategy": "continuous-batching", "requestRate": 1000,
        "batchSize": 256, "concurrency": 1024, "qosLatency": 500,
        "gpuType": "A100 80GB", "gpuMemory": 80, "gpuCount": 8,
        "vllm": True, "paged": True, "chunkPrefill": True, "memFraction": 0.9,
        "cpuCore": 16, "cpuMemory": 128, "replicas": 1, "kvCacheRatio": 0.5,
        "precision": "FP16", "quant": "FP16", "quantizationBitwidth": "16",
        "quantW8A8": False, "quantW4A16": False, "useLora": False,
        "maxModelLen": 32768, "parallelLevel": "TP 8 × DP 1",
    },
    "training": {
        "scene": "pd_fused", "strategy": "fused", "requestRate": 128,
        "batchSize": 2048, "concurrency": 128, "qosLatency": 5000,
        "gpuType": "H100 80GB", "gpuMemory": 80, "gpuCount": 64,
        "vllm": False, "paged": False, "chunkPrefill": False, "memFraction": 0.85,
        "cpuCore": 32, "cpuMemory": 512, "replicas": 1, "kvCacheRatio": 0.2,
        "precision": "BF16", "quant": "BF16", "quantizationBitwidth": "16",
        "quantW8A8": False, "quantW4A16": False, "useLora": True,
        "maxModelLen": 8192, "parallelLevel": "TP 8 × PP 4 × DP 2",
    },
    "general": {
        "scene": "pd_separate", "strategy": "dynamic-batching", "requestRate": 5000,
        "batchSize": 8192, "concurrency": 512, "qosLatency": 1000,
        "gpuType": "H100 80GB", "gpuMemory": 80, "gpuCount": 16,
        "vllm": False, "paged": False, "chunkPrefill": False, "memFraction": 0.95,
        "cpuCore": 16, "cpuMemory": 256, "replicas": 2, "kvCacheRatio": 0.0,
        "precision": "FP32", "quant": "FP32", "quantizationBitwidth": "32",
        "quantW8A8": False, "quantW4A16": False, "useLora": False,
        "maxModelLen": 0, "parallelLevel": "DP 16",
    },
    "graph": {
        "scene": "pd_fused", "strategy": "greedy", "requestRate": 500,
        "batchSize": 65536, "concurrency": 256, "qosLatency": 2000,
        "gpuType": "MI300X", "gpuMemory": 192, "gpuCount": 8,
        "vllm": False, "paged": False, "chunkPrefill": False, "memFraction": 0.88,
        "cpuCore": 24, "cpuMemory": 384, "replicas": 1, "kvCacheRatio": 0.0,
        "precision": "FP16", "quant": "FP16", "quantizationBitwidth": "16",
        "quantW8A8": False, "quantW4A16": False, "useLora": False,
        "maxModelLen": 0, "parallelLevel": "DP 8",
    },
}

DEFAULT_BY_WORKLOAD: dict[str, dict[str, Any]] = {
    "inference": {
        "scene": "pd_separate",
        "model": {"model_name": "LLaMA-3-70B", "param_size": "70B", "precision": "FP16", "context_length": "32768", "moe_experts": "8"},
        "system": {"gpu_model": "A100 80GB", "gpu_count": "8", "parallel": "TP 8 × DP 1", "interconnect": "NVLink 4", "batch_size": "256"},
        "runtime": {"framework": "vLLM", "scheduler": "Continous Batching", "quantization": "FP16", "kvcache_policy": "Auto", "concurrency": "1024"},
    },
    "training": {
        "scene": "pd_fused",
        "model": {"model_name": "LLaMA-3-405B", "param_size": "405B", "precision": "BF16", "context_length": "8192", "moe_experts": "16"},
        "system": {"gpu_model": "H100 80GB", "gpu_count": "64", "parallel": "TP 8 × PP 4 × DP 2", "interconnect": "NVLink 4 + IB 400G", "batch_size": "2048"},
        "runtime": {"framework": "Megatron-LM", "scheduler": "3D Parallel", "quantization": "BF16", "kvcache_policy": "—", "concurrency": "128"},
    },
    "general": {
        "scene": "pd_separate",
        "model": {"model_name": "通用算子库", "param_size": "—", "precision": "FP32", "context_length": "—", "moe_experts": "—"},
        "system": {"gpu_model": "H100 80GB", "gpu_count": "16", "parallel": "DP 16", "interconnect": "IB 400G", "batch_size": "8192"},
        "runtime": {"framework": "PyTorch 2.5", "scheduler": "Default", "quantization": "FP32", "kvcache_policy": "—", "concurrency": "512"},
    },
    "graph": {
        "scene": "pd_fused",
        "model": {"model_name": "GNN-MoE", "param_size": "24B", "precision": "FP16", "context_length": "—", "moe_experts": "8"},
        "system": {"gpu_model": "MI300X", "gpu_count": "8", "parallel": "DP 8", "interconnect": "Infinity Fabric", "batch_size": "65536"},
        "runtime": {"framework": "DGL 2.0", "scheduler": "GraphSAINT", "quantization": "FP16", "kvcache_policy": "—", "concurrency": "256"},
    },
}

DASHBOARD_TASKS: list[dict[str, Any]] = [
    {"id": "SIM-2048", "name": "LLaMA-3-70B 推理 · PD 分离", "kind": "inference", "scene": "pd_separate", "status": "running", "progress": 72, "eta": "2 分 14 秒", "owner": "Chris Chen"},
    {"id": "SIM-2047", "name": "LLaMA-405B 训练 · PD 融合", "kind": "training", "scene": "pd_fused", "status": "queued", "progress": 0, "eta": "排队中", "owner": "仿真工程师"},
    {"id": "SIM-2046", "name": "GNN 基准 · graph workload", "kind": "graph", "scene": "pd_fused", "status": "success", "progress": 100, "eta": "3 分 45 秒", "owner": "系统管理员"},
    {"id": "SIM-2045", "name": "通用计算 · 8192 batch", "kind": "general", "scene": "pd_separate", "status": "failed", "progress": 34, "eta": "OOM 终止", "owner": "Chris Chen"},
    {"id": "SIM-2044", "name": "LLaMA-3-70B 推理 · PD 融合", "kind": "inference", "scene": "pd_fused", "status": "success", "progress": 100, "eta": "12 分 8 秒", "owner": "仿真工程师"},
]

DASHBOARD_STATS: list[dict[str, Any]] = [
    {"label": "今日仿真任务", "value": 28, "suffix": "个", "icon": "Microscope", "color": "cyan", "trend": "up", "trend_label": "+12% vs 昨日", "trend_type": "success"},
    {"label": "运行中 / 排队中", "value": 6, "suffix": "个", "icon": "Clock", "color": "amber", "trend": "neutral", "trend_label": "推理 3 · 训练 2 · 图算 1", "trend_type": "info"},
    {"label": "成功率", "value": 92.3, "suffix": "%", "icon": "CheckCircle2", "color": "green", "trend": "up", "trend_label": "SLA 95% ✓", "trend_type": "success"},
    {"label": "平均耗时", "value": 8.4, "suffix": "分", "icon": "XCircle", "color": "red", "trend": "down", "trend_label": "-6.2% vs 上周", "trend_type": "success"},
]

DASHBOARD_QUICK_ENTRIES: list[dict[str, Any]] = [
    {"title": "NGC 推理仿真", "desc": "大模型训练负载，分析 MFU 与通信瓶颈。", "icon": "Bot", "bg": "rgba(52, 211, 153, 0.12)", "fg": "var(--success)", "accent": "linear-gradient(90deg, #34d399, #10b981)", "goto": "ngc-inference-sim"},
    {"title": "NGC 对比分析", "desc": "HPC、通用批处理与科学计算负载。", "icon": "Code2", "bg": "rgba(251, 191, 36, 0.12)", "fg": "var(--accent-400)", "accent": "linear-gradient(90deg, #fbbf24, #f59e0b)", "goto": "ngc-comparative-analyze"},
    {"title": "NGC 计算-内存分析", "desc": "芯片、服务器、网络与集群拓扑的系统级评估。", "icon": "Network", "bg": "rgba(167, 139, 250, 0.12)", "fg": "var(--purple)", "accent": "linear-gradient(90deg, #a78bfa, #8b5cf6)", "goto": "ngc-compute-memory-analyze"},
    {"title": "内存池模拟仿真", "desc": "模拟内存池行为，分析内存占用与碎片。", "icon": "Memory", "bg": "rgba(167, 139, 250, 0.12)", "fg": "var(--purple)", "accent": "linear-gradient(90deg, #a78bfa, #8b5cf6)", "goto": "memory-pool-sim"},
]

AGENT_SUGGESTIONS: list[str] = [
    "如何降低首 Token 延迟？",
    "PD 分离 vs 融合如何选？",
    "配置最优批大小",
    "训练场景如何提升 MFU？",
]

GPU_MEMORY_MAP: dict[str, int] = {
    "A100 40GB": 40, "A100 80GB": 80, "A100 80GB SXM": 80,
    "H100 80GB": 80, "H800 80GB": 80, "MI300X": 192, "B200": 192,
    "昇腾950": 128,
}


# ---------------------------- Routes ----------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "SimForge Simulation API", "version": "0.2.0"}


@app.get("/api/options")
def get_options(_: dict[str, str] = Depends(require_auth)):
    """返回所有表单下拉选项和字段选项。"""
    return {
        "field_options": FIELD_OPTIONS,
        "gpu_types": GPU_TYPES,
        "precisions": PRECISIONS,
        "quants": QUANTS,
        "bitwidths": BITWIDTHS,
        "strategies": STRATEGIES,
        "parallel_levels": PARALLEL_LEVELS,
        "section_meta": SECTION_META,
        "gpu_memory_map": GPU_MEMORY_MAP,
    }


@app.get("/api/defaults")
def get_defaults(_: dict[str, str] = Depends(require_auth)):
    """返回各 workload 类型的默认配置。"""
    return {
        "workload_defaults": WORKLOAD_DEFAULTS_BY_KIND,
        "default_by_workload": DEFAULT_BY_WORKLOAD,
    }


SCHEMA_DIR = Path(__file__).resolve().parent / "schema-data"
SCHEMA_FILES: dict[str, str] = {
    "model": "model.json",
    "chip": "chip.json",
}


@app.get("/api/schemas")
def get_schemas(_: dict[str, str] = Depends(require_auth)):
    """返回模型/芯片等配置区块的 JSON Schema（含 x-variants、x-main-paths 扩展）。"""
    data: dict[str, Any] = {}
    for key, fname in SCHEMA_FILES.items():
        try:
            raw = json.loads((SCHEMA_DIR / fname).read_text(encoding="utf-8"))
            data[key] = raw.get("data", raw)
        except Exception:
            data[key] = None
    return {"code": "success", "message": "operation successful", "data": data}


@app.get("/api/dashboard")
def get_dashboard(_: dict[str, str] = Depends(require_auth)):
    """返回 Dashboard 页面所需的任务列表、统计卡片和快捷入口数据。"""
    return {
        "tasks": DASHBOARD_TASKS,
        "stats": DASHBOARD_STATS,
        "quick_entries": DASHBOARD_QUICK_ENTRIES,
    }


@app.get("/api/agent/suggestions")
def get_agent_suggestions(_: dict[str, str] = Depends(require_auth)):
    """返回 AI 助手推荐问题列表。"""
    return {"suggestions": AGENT_SUGGESTIONS}


@app.post("/api/auth/login", response_model=LoginResponse)
def login(body: LoginRequest):
    user_meta = DEMO_USERS.get(body.username.strip())
    if not user_meta or user_meta["password"] != body.password:
        raise HTTPException(status_code=401, detail="账号或密码错误")
    token = new_token()
    user = {
        "username": body.username,
        "name": user_meta["name"],
        "email": user_meta["email"],
        "role": user_meta["role"],
    }
    SESSION_TOKENS[token] = {"user": user, "created_at": time.time()}
    return {"token": token, "user": user}


@app.post("/api/auth/logout")
def logout(user: dict[str, str] = Depends(require_auth)):
    # 简化实现：清理全部该用户 token；正式实现按 token 删除即可
    to_delete = [t for t, s in SESSION_TOKENS.items() if s["user"]["username"] == user["username"]]
    for t in to_delete:
        SESSION_TOKENS.pop(t, None)
    return {"status": "ok"}


@app.get("/api/auth/me", response_model=UserInfo)
def me(user: dict[str, str] = Depends(require_auth)):
    return user


@app.get("/api/configurations")
def list_configurations(_: dict[str, str] = Depends(require_auth)):
    return list(CONFIG_TEMPLATES.values())


@app.get("/api/configurations/{config_id}")
def get_configuration(config_id: str, _: dict[str, str] = Depends(require_auth)):
    cfg = CONFIG_TEMPLATES.get(config_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="配置模板不存在")
    return cfg


@app.post("/api/simulations")
def run_simulation(config: SimulationConfig, _: dict[str, str] = Depends(require_auth)):
    metrics = compute_metrics(config)
    charts = make_chart_series(config, metrics)
    logs = make_logs(config, metrics)
    recommendation = make_recommendation(config, metrics)
    stages = [
        {"name": "排队/调度", "pct": 18, "ms": round(metrics["latency_p50_ms"] * 0.12, 1)},
        {"name": "Prefill", "pct": 55, "ms": round(metrics["latency_p50_ms"] * 0.34, 1)},
        {"name": "Decode/聚合", "pct": 100, "ms": round(metrics["latency_p50_ms"] * 0.54, 1)},
    ]
    return {
        "id": now_id(),
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "config": config,
        "metrics": metrics,
        "charts": charts,
        "stages": stages,
        "logs": logs,
        "recommendation": recommendation,
    }


@app.post("/api/agent/chat")
def agent_chat(message: AgentMessage, _: dict[str, str] = Depends(require_auth)):
    reply = make_agent_reply(message.text, message.context)
    # 返回附带可一键应用的参数补丁（示例）
    patch: dict[str, Any] = {}
    if "生成一份优化后的配置" in message.text or "优化配置" in message.text:
        patch = {
            "scene": "pd_fused",
            "system": {"gpu_count": "16", "batch_size": "128", "gpu_model": "NVIDIA H100 80GB", "parallel": "TP 8 × DP 2"},
            "runtime": {"quantization": "FP8", "kv_cache": "PagedAttention", "concurrency": "512"},
        }
    return {"reply": reply, "patch": patch}
