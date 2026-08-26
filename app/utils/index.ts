import type {
  WorkloadKind,
  SceneKind,
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
