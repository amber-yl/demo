import { BACKEND, TOKEN_KEY, headers } from "./index";
import type {
  WorkloadKind,
  SceneKind,
  FormDict,
  SectionMeta,
  SimTemplate,
  SimResult,
  User,
} from "../types";

// ============= 类型定义 =============

export type OptionsData = {
  field_options: Record<string, string[]>;
  gpu_types: string[];
  precisions: string[];
  quants: string[];
  bitwidths: string[];
  strategies: string[];
  parallel_levels: string[];
  section_meta: SectionMeta[];
  gpu_memory_map: Record<string, number>;
};

export type WorkloadConfigData = {
  scene: SceneKind;
  strategy: string;
  requestRate: number;
  batchSize: number;
  concurrency: number;
  qosLatency: number;
  gpuType: string;
  gpuMemory: number;
  gpuCount: number;
  vllm: boolean;
  paged: boolean;
  chunkPrefill: boolean;
  memFraction: number;
  cpuCore: number;
  cpuMemory: number;
  replicas: number;
  kvCacheRatio: number;
  precision: string;
  quant: string;
  quantizationBitwidth: string;
  quantW8A8: boolean;
  quantW4A16: boolean;
  useLora: boolean;
  maxModelLen: number;
  parallelLevel: string;
};

export type DefaultsData = {
  workload_defaults: Record<WorkloadKind, WorkloadConfigData>;
  default_by_workload: Record<
    WorkloadKind,
    { scene: SceneKind; model: FormDict; system: FormDict; runtime: FormDict }
  >;
};

export type DashboardTask = {
  id: string;
  name: string;
  kind: string;
  scene: string;
  status: string;
  progress: number;
  eta: string;
  owner: string;
};

export type DashboardStat = {
  label: string;
  value: number;
  suffix: string;
  icon: string;
  color: string;
  trend: string;
  trend_label: string;
  trend_type: string;
};

export type DashboardQuickEntry = {
  title: string;
  desc: string;
  icon: string;
  bg: string;
  fg: string;
  goto: string;
};

export type DashboardData = {
  tasks: DashboardTask[];
  stats: DashboardStat[];
  quick_entries: DashboardQuickEntry[];
};

export type AgentReply = {
  reply: string;
  patch: Record<string, unknown>;
};

// ============= 封装请求 =============

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

async function request<T>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BACKEND}${path}`, {
    method: options?.method ?? "GET",
    headers: headers(token),
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body });
}

// ============= API 方法 =============

export const api = {
  // 认证
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${BACKEND}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("登录失败");
    return (await res.json()) as { token: string; user: User };
  },

  async logout(token: string): Promise<void> {
    try {
      await fetch(`${BACKEND}/api/auth/logout`, {
        method: "POST",
        headers: headers(token),
      });
    } catch {
      /* ignore */
    }
  },

  async getMe(token: string): Promise<User | null> {
    try {
      const res = await fetch(`${BACKEND}/api/auth/me`, { headers: headers(token) });
      if (!res.ok) return null;
      return (await res.json()) as User;
    } catch {
      return null;
    }
  },

  // 配置模板
  async getConfigurations(token: string): Promise<SimTemplate[]> {
    const res = await fetch(`${BACKEND}/api/configurations`, { headers: headers(token) });
    if (!res.ok) return [];
    return (await res.json()) as SimTemplate[];
  },

  // 仿真
  async runSimulation(
    token: string,
    payload: { kind: WorkloadKind; scene: SceneKind; config: Record<string, unknown>; templateId: string },
  ): Promise<SimResult> {
    const res = await fetch(`${BACKEND}/api/simulations`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("仿真请求失败");
    const data = await res.json();
    return (data.data ?? data) as SimResult;
  },

  // AI Agent
  async agentChat(
    token: string,
    message: string,
    context: Record<string, unknown>,
  ): Promise<AgentReply> {
    return post<AgentReply>("/api/agent/chat", { text: message, context });
  },

  // 表单选项和默认配置
  async getOptions(): Promise<OptionsData> {
    return request<OptionsData>("/api/options");
  },

  async getDefaults(): Promise<DefaultsData> {
    return request<DefaultsData>("/api/defaults");
  },

  // Dashboard
  async getDashboard(): Promise<DashboardData> {
    return request<DashboardData>("/api/dashboard");
  },

  // Agent 推荐问题
  async getAgentSuggestions(): Promise<string[]> {
    const data = await request<{ suggestions: string[] }>("/api/agent/suggestions");
    return data.suggestions;
  },
};
