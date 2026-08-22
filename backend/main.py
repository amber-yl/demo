"""Nebula Sim Lab demo API — replace mock calculations with real simulators later."""
from datetime import datetime, timezone
from random import randint, uniform
from time import sleep
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Nebula Simulation API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])


class SimulationConfig(BaseModel):
    workload: str = "inference"
    model: str = "Llama-3.1-70B"
    accelerator: str = "NVIDIA H100 SXM"
    gpu_count: int = Field(32, ge=1)
    deployment: str = "pd_disaggregated"
    concurrency: int = Field(256, ge=1)
    sequence_length: int = Field(2048, ge=1)


@app.get("/api/configurations")
def configurations():
    return [{"id": "llama-pd", "name": "Llama 3.1 · PD 分离", "type": "inference"}, {"id": "qwen-fused", "name": "Qwen 2.5 · 融合部署", "type": "inference"}]


@app.post("/api/simulations")
def run_simulation(config: SimulationConfig):
    sleep(0.2)
    return {"id": f"SIM-{datetime.now(timezone.utc):%Y%m%d}-{uuid4().hex[:4].upper()}", "status": "completed", "config": config, "metrics": {"throughput_tokens_s": randint(17200, 19000), "ttft_ms": round(uniform(82, 94), 1), "tpot_ms": round(uniform(18, 22), 1), "gpu_utilization": round(uniform(86, 92), 1)}, "recommendation": "增加 Prefill 实例数可进一步降低首 Token 延迟。"}


@app.get("/api/health")
def health():
    return {"status": "ok"}
