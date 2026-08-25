import type {
  WorkloadKind,
  SceneKind,
  FormDict,
  SectionMeta,
  SectionKey,
} from "../types";

// ============= 基础常量 =============
export const BACKEND = "http://127.0.0.1:8000";
export const TOKEN_KEY = "simforge_token";
export const USER_KEY = "simforge_user";

export const WORKLOAD_LABEL: Record<WorkloadKind, string> = {
  inference: "推理服务",
  training: "模型训练",
  general: "通用计算",
  graph: "图神经网络",
};

export const SCENE_LABEL: Record<SceneKind, string> = {
  pd_separate: "PD 分离",
  pd_fused: "PD 融合",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "系统管理员",
  engineer: "仿真工程师",
  user: "平台用户",
};

// ============= 请求 headers =============
export function headers(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ============= 表单默认值 =============
export const DEFAULT_BY_WORKLOAD: Record<
  WorkloadKind,
  { scene: SceneKind; model: FormDict; system: FormDict; runtime: FormDict }
> = {
  inference: {
    scene: "pd_separate",
    model: {
      model_name: "LLaMA-3-70B",
      param_size: "70B",
      precision: "FP16",
      context_length: "32768",
      moe_experts: "8",
    },
    system: {
      gpu_model: "A100 80GB",
      gpu_count: "8",
      parallel: "TP 8 × DP 1",
      interconnect: "NVLink 4",
      batch_size: "256",
    },
    runtime: {
      framework: "vLLM",
      scheduler: "Continous Batching",
      quantization: "FP16",
      kvcache_policy: "Auto",
      concurrency: "1024",
    },
  },
  training: {
    scene: "pd_fused",
    model: {
      model_name: "LLaMA-3-405B",
      param_size: "405B",
      precision: "BF16",
      context_length: "8192",
      moe_experts: "16",
    },
    system: {
      gpu_model: "H100 80GB",
      gpu_count: "64",
      parallel: "TP 8 × PP 4 × DP 2",
      interconnect: "NVLink 4 + IB 400G",
      batch_size: "2048",
    },
    runtime: {
      framework: "Megatron-LM",
      scheduler: "3D Parallel",
      quantization: "BF16",
      kvcache_policy: "—",
      concurrency: "128",
    },
  },
  general: {
    scene: "pd_separate",
    model: {
      model_name: "通用算子库",
      param_size: "—",
      precision: "FP32",
      context_length: "—",
      moe_experts: "—",
    },
    system: {
      gpu_model: "H100 80GB",
      gpu_count: "16",
      parallel: "DP 16",
      interconnect: "IB 400G",
      batch_size: "8192",
    },
    runtime: {
      framework: "PyTorch 2.5",
      scheduler: "Default",
      quantization: "FP32",
      kvcache_policy: "—",
      concurrency: "512",
    },
  },
  graph: {
    scene: "pd_fused",
    model: {
      model_name: "GNN-MoE",
      param_size: "24B",
      precision: "FP16",
      context_length: "—",
      moe_experts: "8",
    },
    system: {
      gpu_model: "MI300X",
      gpu_count: "8",
      parallel: "DP 8",
      interconnect: "Infinity Fabric",
      batch_size: "65536",
    },
    runtime: {
      framework: "DGL 2.0",
      scheduler: "GraphSAINT",
      quantization: "FP16",
      kvcache_policy: "—",
      concurrency: "256",
    },
  },
};

export function applyDefaults(kind: WorkloadKind, sceneOverride?: SceneKind) {
  const base = DEFAULT_BY_WORKLOAD[kind];
  if (!sceneOverride) return base;
  return {
    scene: sceneOverride,
    model: { ...base.model },
    system: { ...base.system },
    runtime: { ...base.runtime },
  };
}

// ============= 字段下拉选项 =============
export const FIELD_OPTIONS: Record<string, string[]> = {
  precision: ["FP8", "FP16", "BF16", "FP32", "INT8", "INT4"],
  gpu_model: [
    "A100 40GB",
    "A100 80GB",
    "A100 80GB SXM",
    "H100 80GB",
    "H800 80GB",
    "MI300X",
    "B200",
  ],
  parallel: [
    "TP 1 × DP 1",
    "TP 2 × DP 1",
    "TP 4 × DP 1",
    "TP 8 × DP 1",
    "TP 8 × DP 2",
    "TP 8 × PP 2 × DP 2",
    "TP 8 × PP 4 × DP 2",
    "DP 8",
    "DP 16",
    "DP 32",
    "DP 64",
  ],
  interconnect: ["PCIe 5.0", "NVLink 3", "NVLink 4", "IB 200G", "IB 400G", "Infinity Fabric"],
  framework: ["vLLM", "TGI", "TensorRT-LLM", "Megatron-LM", "DeepSpeed", "PyTorch 2.5", "DGL 2.0"],
  scheduler: [
    "Continous Batching",
    "Static Batching",
    "3D Parallel",
    "ZeRO-3",
    "Default",
    "GraphSAINT",
  ],
  quantization: ["无量化", "FP16", "BF16", "FP8", "INT8 AWQ", "INT4 GPTQ", "INT4 AWQ"],
  kvcache_policy: ["Auto", "Full", "Half", "Lazy", "—"],
};

// ============= Section 元信息 =============
export const SECTION_META: SectionMeta[] = [
  { key: "model", title: "模型参数", icon: "M", bg: "rgba(34,211,238,.14)", color: "#22d3ee" },
  { key: "system", title: "系统拓扑", icon: "S", bg: "rgba(52,211,153,.14)", color: "#34d399" },
  { key: "runtime", title: "运行时参数", icon: "R", bg: "rgba(167,139,250,.14)", color: "#a78bfa" },
];

// ============= 便捷：某 section 的 setter =============
export function sectionSetter(
  sec: SectionKey,
  setModel: React.Dispatch<React.SetStateAction<FormDict>>,
  setSystem: React.Dispatch<React.SetStateAction<FormDict>>,
  setRuntime: React.Dispatch<React.SetStateAction<FormDict>>,
): React.Dispatch<React.SetStateAction<FormDict>> {
  return sec === "model" ? setModel : sec === "system" ? setSystem : setRuntime;
}
