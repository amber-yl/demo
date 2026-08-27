// 全局共享类型
export type WorkloadKind = "inference" | "training";
export type SceneKind = "pd_separate" | "pd_fused";
export type PageId =
  | "dashboard"
  | "ngc-inference-sim"
  | "ngc-comparative-analyze"
  | "ngc-compute-memory-analyze";

export type User = {
  username: string;
  name: string;
  email: string;
  role: string;
};

export type FormDict = Record<string, string>;

export type SectionKey = "model" | "system" | "runtime";

export type SimTemplate = {
  id: string;
  name: string;
  workload: WorkloadKind;
  scene: SceneKind;
  model: FormDict;
  system: FormDict;
  runtime: FormDict;
};

export type SimMetrics = {
  throughput_tokens_s: number;
  throughput_flops_tf: number | null;
  latency_p50_ms: number;
  latency_p99_ms: number;
  vram_gb_per_gpu: number;
  power_w_per_gpu: number;
  gpu_utilization: number;
  mfu: number;
};

export type SimCharts = {
  xs: string[];
  throughput: number[];
  latency_p99: number[];
  gpu_util: number[];
  vram: number[];
  power: number[];
};

export type SimStage = { name: string; pct: number; ms: number };
export type SimLog = { time: string; level: string; msg: string };

export type SimResult = {
  id: string;
  status: string;
  created_at: string;
  config: {
    workload: WorkloadKind;
    scene: SceneKind;
    model: FormDict;
    system: FormDict;
    runtime: FormDict;
  };
  metrics: SimMetrics;
  charts: SimCharts;
  stages: SimStage[];
  logs: SimLog[];
  recommendation: string;
};

export type SectionMeta = {
  key: SectionKey;
  title: string;
  icon: string;
  bg: string;
  color: string;
};

export type ChatMsg = {
  role: "user" | "agent";
  text: string;
  patch?: Record<string, unknown>;
};

export type AgentContext = {
  workload: WorkloadKind;
  scene: SceneKind;
  config_id: string | null;
};
