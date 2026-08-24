"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ==================== Constants ==================== */
const BACKEND = "http://127.0.0.1:8000";
const TOKEN_KEY = "simforge_token";
const USER_KEY = "simforge_user";

type WorkloadKind = "inference" | "training" | "general" | "graph";
type SceneKind = "pd_separate" | "pd_fused";
type PageId =
  | "dashboard"
  | `simulation/workload/${WorkloadKind}`
  | "simulation/system"
  | "terminal"
  | "energy"
  | "infrastructure";

type User = { username: string; name: string; email: string; role: string };

type SimTemplate = {
  id: string;
  name: string;
  workload: WorkloadKind;
  scene: SceneKind;
  model: Record<string, unknown>;
  system: Record<string, unknown>;
  runtime: Record<string, unknown>;
};

type SimResult = {
  id: string;
  status: string;
  created_at: string;
  config: {
    workload: WorkloadKind;
    scene: SceneKind;
    model: Record<string, unknown>;
    system: Record<string, unknown>;
    runtime: Record<string, unknown>;
  };
  metrics: {
    throughput_tokens_s: number;
    throughput_flops_tf: number | null;
    latency_p50_ms: number;
    latency_p99_ms: number;
    vram_gb_per_gpu: number;
    power_w_per_gpu: number;
    gpu_utilization: number;
    mfu: number;
  };
  charts: {
    xs: string[];
    throughput: number[];
    latency_p99: number[];
    gpu_util: number[];
    vram: number[];
    power: number[];
  };
  stages: { name: string; pct: number; ms: number }[];
  logs: { time: string; level: string; msg: string }[];
  recommendation: string;
};

/* ==================== Icons (inline SVG, no extra deps) ==================== */
const Icon = {
  Search: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Bell: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  ChevronDown: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  ChevronRight: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Cpu: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  Gpu: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="12" rx="2" /><circle cx="8" cy="13" r="2" /><circle cx="16" cy="13" r="2" />
      <line x1="6" y1="3" x2="6" y2="7" /><line x1="10" y1="3" x2="10" y2="7" />
      <line x1="14" y1="3" x2="14" y2="7" /><line x1="18" y1="3" x2="18" y2="7" />
    </svg>
  ),
  Terminal: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  Zap: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Server: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="7" rx="1" /><rect x="2" y="14" width="20" height="7" rx="1" />
      <line x1="6" y1="6.5" x2="6.01" y2="6.5" /><line x1="6" y1="17.5" x2="6.01" y2="17.5" />
    </svg>
  ),
  Play: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill={p.color ?? "currentColor"}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  X: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Send: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Sparkles: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 22} height={p.size ?? 22} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
    </svg>
  ),
  Check: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Clock: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Layers: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Activity: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Database: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.7-4 3-9 3s-9-1.3-9-3" /><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" />
    </svg>
  ),
  Sliders: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  Save: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  Eye: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  User: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Lock: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  ArrowRight: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  Refresh: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  TrendingUp: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 12} height={p.size ?? 12} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  TrendingDown: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 12} height={p.size ?? 12} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
    </svg>
  ),
  Sun: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  Moon: (p: { size?: number; color?: string }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
};

/* ==================== Helpers ==================== */
function headers(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

const WORKLOAD_LABEL: Record<WorkloadKind, string> = {
  inference: "推理负载",
  training: "训练负载",
  general: "通算负载",
  graph: "图算负载",
};

const SCENE_LABEL: Record<SceneKind, string> = {
  pd_separate: "PD 分离",
  pd_fused: "PD 融合",
};

/* ==================== Login Page ==================== */
function LoginPage({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string; api?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!username.trim()) errs.username = "请输入账号";
    if (!password) errs.password = "请输入密码";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const res = await fetch(`${BACKEND}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors({ api: data?.detail ?? "登录失败" });
        setLoading(false);
        return;
      }
      const token: string = data.token;
      const user: User = data.user;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      onLogin(token, user);
    } catch (err) {
      console.error(err);
      setErrors({ api: `无法连接后端 ${BACKEND}。请确认已启动 FastAPI：uvicorn main:app --reload --port 8000` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-grid-bg" />
        <div className="login-brand">
          <div className="login-brand-icon">S</div>
          <div>
            <div className="login-brand-name">SimForge</div>
            <div className="login-brand-tag">COMPUTE SIMULATION PLATFORM</div>
          </div>
        </div>
        <div className="login-hero">
          <h1>在虚拟集群中<br />验证每一次算力决策</h1>
          <p>高精度算力仿真平台，覆盖推理、训练、通算、图算四大负载建模。支持 PD 分离 / 融合场景切换，从硬件选型到参数调优，用数据驱动每个决定。</p>
        </div>
        <div className="login-stats">
          <div><div className="login-stat-num">128+</div><div className="login-stat-label">GPU 模型支持</div></div>
          <div><div className="login-stat-num">97.3%</div><div className="login-stat-label">仿真精度</div></div>
          <div><div className="login-stat-num">50ms</div><div className="login-stat-label">采样间隔</div></div>
        </div>
      </div>
      <div className="login-right">
        <div>
          <h2 className="login-form-title">欢迎回来</h2>
          <p className="login-form-sub">登录以访问你的仿真工作区</p>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">账号</label>
            <div className="input-with-icon">
              <span className="input-icon"><Icon.User /></span>
              <input
                className={`form-input ${errors.username ? "error" : ""}`}
                placeholder="admin / chris / engineer"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            {errors.username && <div className="form-error-text">{errors.username}</div>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">密码</label>
            <div className="input-with-icon">
              <span className="input-icon"><Icon.Lock /></span>
              <input
                type="password"
                className={`form-input ${errors.password ? "error" : ""}`}
                placeholder="对应密码见登录提示"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {errors.password && <div className="form-error-text">{errors.password}</div>}
          </div>
          <div className="login-options">
            <label className="checkbox"><input type="checkbox" defaultChecked /> <span>记住我</span></label>
            <span className="link-btn">忘记密码？</span>
          </div>
          <button className="btn btn-primary btn-block" disabled={loading} style={{ padding: "12px 20px", fontSize: 14.5 }}>
            {loading ? "登录中..." : "登 录"}
          </button>
          {errors.api && (
            <div className="login-hint" style={{ borderColor: "rgba(248,113,113,.3)", color: "#fecaca" }}>
              <b>登录失败：</b>{errors.api}
            </div>
          )}
          <div className="login-hint">
            演示账号：<b>admin</b> / <b>admin123</b>，<b>chris</b> / <b>chris123</b>，<b>engineer</b> / <b>sim123</b>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==================== Sidebar & Topbar ==================== */
function useBreadcrumb(page: PageId) {
  const crumbs: { label: string; active?: boolean }[] = [];
  if (page === "dashboard") crumbs.push({ label: "总览", active: true });
  if (page.startsWith("simulation")) {
    crumbs.push({ label: "算力仿真" });
    if (page.startsWith("simulation/workload")) {
      crumbs.push({ label: "负载建模" });
      const kind = page.split("/")[2] as WorkloadKind;
      crumbs.push({ label: WORKLOAD_LABEL[kind], active: true });
    } else if (page === "simulation/system") {
      crumbs.push({ label: "系统仿真", active: true });
    }
  }
  if (page === "terminal") crumbs.push({ label: "终端", active: true });
  if (page === "energy") crumbs.push({ label: "能源", active: true });
  if (page === "infrastructure") crumbs.push({ label: "基础设施", active: true });
  return crumbs;
}

function Sidebar({
  user,
  currentPage,
  onNavigate,
  onLogout,
  collapsed,
  onToggleCollapse,
}: {
  user: User;
  currentPage: PageId;
  onNavigate: (p: PageId) => void;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse?: () => void;
}) {
  const [groups, setGroups] = useState<Record<string, boolean>>({ simulation: true, workload: true });
  const toggle = (k: string) => setGroups((p) => ({ ...p, [k]: !p[k] }));

  type NavItem = {
    id: string;
    label: string;
    icon?: React.ReactNode;
    path?: PageId;
    children?: NavItem[];
  };

  const nav: NavItem[] = [
    {
      id: "dashboard",
      label: "总览 Dashboard",
      icon: <Icon.Activity size={18} />,
      path: "dashboard",
    },
    {
      id: "simulation",
      label: "算力仿真",
      icon: <Icon.Cpu size={18} />,
      children: [
        {
          id: "workload",
          label: "负载建模",
          icon: <Icon.Layers size={16} />,
          children: [
            { id: "inference", label: "推理负载", path: "simulation/workload/inference" },
            { id: "training", label: "训练负载", path: "simulation/workload/training" },
            { id: "general", label: "通算负载", path: "simulation/workload/general" },
            { id: "graph", label: "图算负载", path: "simulation/workload/graph" },
          ],
        },
        {
          id: "system-sim",
          label: "系统仿真",
          icon: <Icon.Sliders size={16} />,
          path: "simulation/system",
        },
      ],
    },
    { id: "terminal", label: "终端", icon: <Icon.Terminal size={18} />, path: "terminal" },
    { id: "energy", label: "能源", icon: <Icon.Zap size={18} />, path: "energy" },
    { id: "infrastructure", label: "基础设施", icon: <Icon.Server size={18} />, path: "infrastructure" },
  ];

  const active = (it: NavItem): boolean => {
    if (it.path) return currentPage === it.path;
    if (!it.children) return false;
    return it.children.some((c) => active(c));
  };

  const initials = user.name.slice(0, 2).toUpperCase();
  const [popover, setPopover] = useState<string | null>(null);
  // 鼠标移动空隙保护：mouseleave 后延迟 150ms 再关 popover，mouseenter 时取消关闭，
  // 避免从触发图标 -> 弹出层（中间有 4px gap）移动时弹层一闪而逝
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClearPopover = () => {
    if (popTimerRef.current) {
      clearTimeout(popTimerRef.current);
      popTimerRef.current = null;
    }
  };
  const scheduleClearPopover = () => {
    cancelClearPopover();
    popTimerRef.current = setTimeout(() => setPopover(null), 150);
  };

  // 折叠模式下用 popover 渲染子菜单（避免二级菜单被隐藏）
  const renderPopoverChildren = (item: NavItem): React.ReactNode => {
    if (!item.children?.length) return null;
    const flat: { path?: PageId; label: string }[] = [];
    const walk = (list: NavItem[]) => {
      list.forEach((c) => {
        if (c.path) flat.push({ path: c.path, label: c.label });
        if (c.children) walk(c.children);
      });
    };
    walk(item.children);
    return (
      <div
        className="nav-popover"
        onMouseEnter={() => cancelClearPopover()}
        onMouseLeave={() => scheduleClearPopover()}
      >
        <div className="nav-popover-title">{item.label}</div>
        <div className="nav-popover-list">
          {flat.map((f) => (
            <button
              key={f.label}
              className="nav-popover-item"
              onClick={() => {
                if (f.path) {
                  onNavigate(f.path);
                  setPopover(null);
                }
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderItem = (it: NavItem, level = 0): React.ReactNode => {
    const hasChildren = !!it.children?.length;
    const expanded = groups[it.id] ?? !hasChildren;
    const showPop = collapsed && popover === it.id && hasChildren;
    const showLeafTooltip = collapsed && !hasChildren && popover === it.id;
    // 折叠模式下：leaf 项目显示一行 tooltip；hasChildren 的父级显示子菜单 popover
    // 注意：onMouseEnter/Leave 绑在外层 nav-wrap（包含 button + tooltip + popover），
    // 避免鼠标从 button 移到弹出层（中间有 10px 空隙）时触发 leave 导致弹层立刻消失
    return (
      <div
        key={it.id}
        className="nav-wrap"
        style={{ position: "relative" }}
        onMouseEnter={() => {
          if (!collapsed) return;
          cancelClearPopover();
          setPopover(it.id);
        }}
        onMouseLeave={() => {
          if (!collapsed) return;
          scheduleClearPopover();
        }}
      >
        <button
          className={`nav-item ${active(it) ? "active" : ""} ${hasChildren && !expanded ? "collapsed" : ""}`}
          style={{ paddingLeft: collapsed ? 0 : 12 + level * 14, justifyContent: collapsed ? "center" : undefined }}
          onClick={() => {
            if (collapsed && hasChildren) {
              setPopover((v) => (v === it.id ? null : it.id));
            } else if (hasChildren) {
              toggle(it.id);
            } else if (it.path) onNavigate(it.path);
          }}
        >
          {it.icon && <span className="nav-icon">{it.icon}</span>}
          {!collapsed && <span>{it.label}</span>}
          {!collapsed && hasChildren && (
            <span className="nav-arrow"><Icon.ChevronDown size={12} /></span>
          )}
          {/* 折叠模式下：leaf 项目的文字 tooltip（位于 button 子元素内，参照 button position:relative） */}
          {showLeafTooltip && (
            <div className="nav-tooltip">{it.label}</div>
          )}
        </button>
        {showPop && renderPopoverChildren(it)}
        {!collapsed && hasChildren && (
          <div
            className={`nav-children ${!expanded ? "collapsed" : ""}`}
            style={{ maxHeight: expanded ? (it.children!.length + 2) * 38 + 20 : 0 }}
          >
            {it.children!.map((c) => renderItem(c, level + 1))}
          </div>
        )}
        {!collapsed && !hasChildren && level > 0 && (
          <div
            className={`nav-child-item ${active(it) ? "active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => it.path && onNavigate(it.path)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && it.path && onNavigate(it.path)}
          >
            {it.label}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">S</div>
        {!collapsed && (
          <div>
            <div className="sidebar-logo-text">SimForge</div>
            <div className="sidebar-logo-sub">算力仿真平台</div>
          </div>
        )}
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? "展开侧栏" : "收起侧栏"}
        >
          {collapsed ? <Icon.ChevronRight size={14} /> : <Icon.ChevronDown size={14} />}
        </button>
      </div>
      <nav className="sidebar-nav">{nav.map((n) => renderItem(n))}</nav>
      <div className="sidebar-footer">
        <div className={`sidebar-user ${collapsed ? "collapsed" : ""}`}>
          <div className="sidebar-user-main" style={{ position: "relative", display: "flex", alignItems: "center", gap: collapsed ? 0 : 10 }}>
            <div className="sidebar-avatar">{initials}</div>
            {!collapsed && (
              <div className="sidebar-user-meta">
                <div className="sidebar-user-name">{user.name}</div>
                <div className="sidebar-user-role">{user.role === "admin" ? "平台管理员" : "仿真工程师"} · 登出</div>
              </div>
            )}
            {collapsed && <div className="nav-tooltip" style={{ top: 2 }}>{user.name} · {user.role === "admin" ? "平台管理员" : "仿真工程师"}</div>}
          </div>
          <button
            className={`btn-ghost btn-xs ${collapsed ? "logout-btn-collapsed" : ""}`}
            onClick={onLogout}
            title="退出登录"
          >
            <Icon.X size={12} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function TopBar({
  currentPage,
  onRunSim,
  theme,
  onToggleTheme,
}: {
  currentPage: PageId;
  onRunSim?: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  const crumbs = useBreadcrumb(currentPage);
  return (
    <header className="topbar">
      <div className="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i}>
            {i > 0 && <span className="breadcrumb-sep">/</span>}
            <span className={c.active ? "bc-active" : ""}>{c.label}</span>
          </span>
        ))}
      </div>
      <div className="topbar-right">
        {currentPage.startsWith("simulation/workload") && onRunSim && (
          <button className="btn btn-primary btn-sm" onClick={onRunSim}>
            <Icon.Play size={12} /> 运行仿真
          </button>
        )}
        <div className="topbar-search">
          <Icon.Search size={14} color="#6b7c93" />
          <input placeholder="搜索任务、模型、节点..." />
          <span className="kbd">⌘K</span>
        </div>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === "dark" ? "切换到白昼模式" : "切换到暗夜模式"}
        >
          {theme === "dark" ? <Icon.Sun size={18} /> : <Icon.Moon size={18} />}
        </button>
        <button className="icon-btn"><Icon.Bell size={18} /><span className="notif-dot" /></button>
      </div>
    </header>
  );
}

/* ==================== Dashboard ==================== */
function Dashboard({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const stats = [
    { label: "今日仿真任务", value: "128", trend: "+12.5%", up: true, icon: <Icon.Activity size={20} />, color: "cyan" },
    { label: "平均运行时长", value: "4.8min", trend: "-8.2%", up: true, icon: <Icon.Clock size={20} />, color: "green" },
    { label: "仿真成功率", value: "98.6%", trend: "+0.4%", up: true, icon: <Icon.Check size={20} />, color: "amber" },
    { label: "集群利用率", value: "73.2%", trend: "+5.1%", up: false, icon: <Icon.Server size={20} />, color: "purple" },
  ];
  const recent = [
    { id: 1, name: "LLaMA-3-70B 推理性能测试", type: "推理负载", status: "running", dur: "2m 34s" },
    { id: 2, name: "LLaMA-3.1-405B 分布式训练仿真", type: "训练负载", status: "success", dur: "12m 08s" },
    { id: 3, name: "GNN 消息传递基准", type: "图算负载", status: "success", dur: "3m 45s" },
    { id: 4, name: "CUDA 通用矩阵乘压测", type: "通算负载", status: "failed", dur: "1m 12s" },
    { id: 5, name: "MoE 路由策略对比", type: "推理负载", status: "pending", dur: "--" },
  ];
  const statusMap: Record<string, { label: string; cls: string }> = {
    running: { label: "运行中", cls: "status-running" },
    success: { label: "已完成", cls: "status-success" },
    failed: { label: "失败", cls: "status-failed" },
    pending: { label: "排队中", cls: "status-pending" },
  };
  const typeToPage: Record<string, PageId> = {
    "推理负载": "simulation/workload/inference",
    "训练负载": "simulation/workload/training",
    "通算负载": "simulation/workload/general",
    "图算负载": "simulation/workload/graph",
  };

  const modules: {
    title: string;
    desc: string;
    icon: React.ReactNode;
    bg: string;
    color: string;
    path: PageId;
  }[] = [
      {
        title: "算力仿真",
        desc: "负载建模与系统级仿真，覆盖推理/训练/通算/图算",
        icon: <Icon.Cpu size={24} />,
        bg: "linear-gradient(135deg, rgba(34,211,238,.2), rgba(34,211,238,.05))",
        color: "var(--brand-400)",
        path: "simulation/workload/inference",
      },
      {
        title: "终端",
        desc: "交互式查询与操作，支持脚本化批量仿真",
        icon: <Icon.Terminal size={24} />,
        bg: "linear-gradient(135deg, rgba(52,211,153,.2), rgba(52,211,153,.05))",
        color: "var(--success)",
        path: "terminal",
      },
      {
        title: "能源",
        desc: "PUE 分析、功耗与碳排放追踪",
        icon: <Icon.Zap size={24} />,
        bg: "linear-gradient(135deg, rgba(251,191,36,.2), rgba(251,191,36,.05))",
        color: "var(--accent-400)",
        path: "energy",
      },
      {
        title: "基础设施",
        desc: "集群拓扑、节点管理与高速互联",
        icon: <Icon.Server size={24} />,
        bg: "linear-gradient(135deg, rgba(167,139,250,.2), rgba(167,139,250,.05))",
        color: "var(--purple)",
        path: "infrastructure",
      },
    ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">总览 Dashboard</h1>
          <p className="page-subtitle">欢迎回到 SimForge。这里是你今日仿真集群与任务进度的实时概览。</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm"><Icon.Refresh size={13} /> 刷新数据</button>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate("simulation/workload/inference")}>
            <Icon.Play size={12} /> 新建仿真
          </button>
        </div>
      </div>

      <div className="stats-row">
        {stats.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className={`stat-card-icon ${s.color}`}>{s.icon}</div>
            <div className="stat-card-label">{s.label}</div>
            <div className="stat-card-value">{s.value}</div>
            <div className={`stat-card-trend ${s.up ? "trend-up" : "trend-down"}`}>
              {s.up ? <Icon.TrendingUp /> : <Icon.TrendingDown />}
              <span>{s.trend}</span>
              <span style={{ color: "var(--text-tertiary)", marginLeft: 4 }}>较昨日</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-main">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">最近运行任务</h3>
            <span className="link-btn" style={{ fontSize: 12 }}>查看全部</span>
          </div>
          <div className="card-body">
            <ul className="task-list">
              {recent.map((t) => (
                <li className="task-item" key={t.id}>
                  <div className="task-icon"><Icon.Activity size={16} /></div>
                  <div className="task-info">
                    <div className="task-name">{t.name}</div>
                    <div className="task-meta">
                      <span>{t.type}</span>
                      <span>·</span>
                      <span>耗时 {t.dur}</span>
                    </div>
                  </div>
                  <span className={`status-badge ${statusMap[t.status].cls}`}>
                    <span className="dot" />
                    {statusMap[t.status].label}
                  </span>
                  <button
                    className="task-action-btn"
                    onClick={() => {
                      const dest = typeToPage[t.type];
                      if (dest) onNavigate(dest);
                    }}
                  ><Icon.Eye size={12} /> 查看</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">平台能力</h3>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 12 }}>
            {["推理 / 训练 / 通算 / 图算 四大负载建模", "PD 分离 / 融合双场景一键对比", "配置模板库 + 表单下发后端仿真", "AI Agent 读取上下文，自动生成优化配置"].map((x, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "center",
                padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 8,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center",
                  background: "rgba(34,211,238,.12)", color: "var(--brand-400)",
                }}><Icon.Check size={13} /></div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{x}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="module-section">
        <h3>四大模块</h3>
        <div className="module-cards">
          {modules.map((m) => (
            <button key={m.path} className="module-card" onClick={() => onNavigate(m.path)}>
              <div className="module-card-icon" style={{ background: m.bg, color: m.color }}>{m.icon}</div>
              <div className="module-card-title">{m.title}</div>
              <div className="module-card-desc">{m.desc}</div>
              <div className="module-card-arrow"><span>进入模块</span><Icon.ArrowRight size={12} /></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==================== Workload Modeling Page ==================== */
type FormDict = Record<string, string>;
type ScenePreset = { model: FormDict; system: FormDict; runtime: FormDict };
type WorkloadPreset = { defaultScene: SceneKind; separate: ScenePreset; fused: ScenePreset };

const DEFAULT_BY_WORKLOAD: Record<WorkloadKind, WorkloadPreset> = {
  inference: {
    defaultScene: "pd_separate",
    separate: {
      model: { model_name: "LLaMA-3-70B", param_size: "70B", precision: "FP16", context_length: "8192", vocab_size: "128K" },
      system: { gpu_model: "NVIDIA A100 80GB", gpu_count: "8", parallel: "TP 8 × DP 1", interconnect: "NVLink 4 + IB 400G", batch_size: "64" },
      runtime: { framework: "vLLM", kv_cache: "PagedAttention", quantization: "None", concurrency: "256", scheduler: "FCFS" },
    },
    fused: {
      model: { model_name: "Qwen-2-72B", param_size: "72B", precision: "FP8", context_length: "16384", vocab_size: "152K" },
      system: { gpu_model: "NVIDIA H100 80GB", gpu_count: "16", parallel: "TP 8 × DP 2", interconnect: "NVLink 4 + IB 400G", batch_size: "256" },
      runtime: { framework: "SGLang", kv_cache: "Prefix Caching", quantization: "FP8", concurrency: "512", scheduler: "Continuous Batching" },
    },
  },
  training: {
    defaultScene: "pd_fused",
    separate: {
      model: { model_name: "LLaMA-3.1-405B", param_size: "405B", precision: "BF16", context_length: "8192", vocab_size: "128K" },
      system: { gpu_model: "NVIDIA H800 80GB", gpu_count: "128", parallel: "TP 8 × PP 4 × DP 4", interconnect: "NVLink 4 + IB 400G", batch_size: "2048" },
      runtime: { framework: "Megatron-LM", kv_cache: "FlashAttention-2", quantization: "None", concurrency: "32", scheduler: "3D Parallel" },
    },
    fused: {
      model: { model_name: "Mistral-8x7B", param_size: "56B", precision: "BF16", context_length: "32768", vocab_size: "128K" },
      system: { gpu_model: "NVIDIA A100 80GB", gpu_count: "128", parallel: "TP 8 × PP 2 × DP 8", interconnect: "NVLink 4 + IB 400G", batch_size: "4096" },
      runtime: { framework: "DeepSpeed-MII", kv_cache: "FlashAttention-2", quantization: "None", concurrency: "64", scheduler: "ZeRO Stage 3" },
    },
  },
  general: {
    defaultScene: "pd_fused",
    separate: {
      model: { model_name: "CUDA GEMM Suite", param_size: "N/A", precision: "FP16", context_length: "N/A", vocab_size: "N/A" },
      system: { gpu_model: "NVIDIA A100 80GB", gpu_count: "8", parallel: "NCCL AllReduce", interconnect: "NVLink 3 + IB 200G", batch_size: "4096" },
      runtime: { framework: "CUDA + cuBLAS", kv_cache: "N/A", quantization: "None", concurrency: "1024", scheduler: "Static" },
    },
    fused: {
      model: { model_name: "HPC Linpack + Transpose", param_size: "N/A", precision: "FP32", context_length: "N/A", vocab_size: "N/A" },
      system: { gpu_model: "NVIDIA H100 80GB", gpu_count: "64", parallel: "NCCL AllReduce", interconnect: "NVLink 4 + IB 400G", batch_size: "8192" },
      runtime: { framework: "CUDA + cuBLAS", kv_cache: "N/A", quantization: "None", concurrency: "2048", scheduler: "Static" },
    },
  },
  graph: {
    defaultScene: "pd_separate",
    separate: {
      model: { model_name: "GraphSAGE-3L", param_size: "1.2B", precision: "FP16", context_length: "N/A", vocab_size: "200M 节点" },
      system: { gpu_model: "AMD MI300X", gpu_count: "32", parallel: "Graph 分片 × DP 4", interconnect: "Infinity Fabric + IB 400G", batch_size: "512" },
      runtime: { framework: "DGL + ROCm", kv_cache: "Feature Cache", quantization: "INT8", concurrency: "128", scheduler: "Chunked PPR" },
    },
    fused: {
      model: { model_name: "GAT-3L + MoE", param_size: "3.4B", precision: "FP16", context_length: "N/A", vocab_size: "500M 节点" },
      system: { gpu_model: "NVIDIA H100 80GB", gpu_count: "64", parallel: "Graph 分片 × DP 8", interconnect: "NVLink 4 + IB 400G", batch_size: "1024" },
      runtime: { framework: "DGL + CUDA", kv_cache: "Feature Cache", quantization: "INT8", concurrency: "256", scheduler: "Kubernetes + Volcano" },
    },
  },
};

const FIELD_OPTIONS: Record<string, string[]> = {
  model_name: ["LLaMA-3-8B", "LLaMA-3-70B", "LLaMA-3.1-405B", "Qwen-2-72B", "Baichuan2-13B", "Mistral-8x7B", "CUDA GEMM Suite", "GraphSAGE-3L"],
  param_size: ["7B", "13B", "34B", "70B", "175B", "405B", "1.2B", "N/A"],
  precision: ["FP32", "FP16", "BF16", "FP8", "INT8", "INT4"],
  context_length: ["2048", "4096", "8192", "16384", "32768", "128000", "N/A"],
  vocab_size: ["32K", "128K", "152K", "200K", "200M 节点", "N/A"],
  gpu_model: ["NVIDIA A100 80GB", "NVIDIA H100 80GB", "NVIDIA H800 80GB", "NVIDIA A800 80GB", "NVIDIA RTX 4090", "AMD MI300X"],
  gpu_count: ["1", "2", "4", "8", "16", "32", "64", "128", "256"],
  parallel: ["TP 8 × DP 1", "TP 8 × DP 2", "TP 8 × PP 4 × DP 4", "DP 8", "Graph 分片 × DP 4", "NCCL AllReduce"],
  interconnect: ["PCIe 4.0 + RoCE", "NVLink 3 + IB 200G", "NVLink 4 + IB 400G", "Infinity Fabric + IB 400G"],
  batch_size: ["16", "32", "64", "128", "256", "512", "1024", "2048", "4096"],
  framework: ["vLLM", "TensorRT-LLM", "TGI", "SGLang", "DeepSpeed-MII", "Megatron-LM", "CUDA + cuBLAS", "DGL + ROCm"],
  kv_cache: ["None", "PagedAttention", "Continuous Batching", "Prefix Caching", "FlashAttention-2", "Feature Cache", "N/A"],
  quantization: ["None", "GPTQ", "AWQ", "SmoothQuant", "FP8", "INT8", "bitsandbytes"],
  concurrency: ["32", "64", "128", "256", "512", "1024", "2048"],
  scheduler: ["FCFS", "Continuous Batching", "Static", "3D Parallel", "Chunked PPR", "Kubernetes + Volcano"],
};

function applyDefaults(kind: WorkloadKind, scene?: SceneKind) {
  const preset = DEFAULT_BY_WORKLOAD[kind];
  const targetScene = scene ?? preset.defaultScene;
  const form = targetScene === "pd_separate" ? preset.separate : preset.fused;
  return JSON.parse(JSON.stringify({ scene: targetScene, model: form.model, system: form.system, runtime: form.runtime }));
}

type SectionKey = "model" | "system" | "runtime";
const SECTION_META: { key: SectionKey; title: string; icon: React.ReactNode; bg: string; color: string }[] = [
  { key: "model", title: "模型配置", icon: <Icon.Database size={15} />, bg: "rgba(34,211,238,.1)", color: "var(--brand-400)" },
  { key: "system", title: "系统配置", icon: <Icon.Gpu size={15} />, bg: "rgba(167,139,250,.1)", color: "var(--purple)" },
  { key: "runtime", title: "运行时配置", icon: <Icon.Sliders size={15} />, bg: "rgba(251,191,36,.1)", color: "var(--accent-400)" },
];

function LineChart({
  title,
  series,
  xs,
}: {
  title: string;
  series: { name: string; color: string; data: number[]; axis?: "left" | "right"; unit?: string }[];
  xs: string[];
}) {
  const W = 780;
  const H = 240;
  const pad = { l: 54, r: 54, t: 28, b: 30 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const leftMax = Math.max(1, ...series.filter((s) => !s.axis || s.axis === "left").flatMap((s) => s.data));
  const rightOnly = series.filter((s) => s.axis === "right");
  const rightMax = rightOnly.length ? Math.max(1, ...rightOnly.flatMap((s) => s.data)) : 0;

  const x = (i: number) => pad.l + (innerW * i) / Math.max(1, xs.length - 1);
  const yLeft = (v: number) => pad.t + innerH - (innerH * v) / leftMax;
  const yRight = (v: number) => pad.t + innerH - (innerH * v) / rightMax;

  const leftTicks = 4;
  const rightTicks = 4;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
        <div style={{ display: "flex", gap: 14 }}>
          {series.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-tertiary)" }}>
              <span style={{ width: 12, height: 2, background: s.color }} />
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ flex: 1, width: "100%", minHeight: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`grad-${title}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {Array.from({ length: leftTicks + 1 }).map((_, i) => {
          const y = pad.t + (innerH * i) / leftTicks;
          const v = leftMax - (leftMax * i) / leftTicks;
          return (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#1e2a3a" strokeDasharray="3 4" />
              <text x={pad.l - 8} y={y + 3} textAnchor="end" fill="#6b7c93" fontSize="10">
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        {rightOnly.length > 0 && Array.from({ length: rightTicks + 1 }).map((_, i) => {
          const y = pad.t + (innerH * i) / rightTicks;
          const v = rightMax - (rightMax * i) / rightTicks;
          return (
            <text key={i} x={W - pad.r + 8} y={y + 3} fill="#6b7c93" fontSize="10">
              {Math.round(v)}
            </text>
          );
        })}
        {xs.map((v, i) => (
          <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fill="#6b7c93" fontSize="10">{v}</text>
        ))}
        {series.map((s, i) => {
          const yFn = s.axis === "right" && rightMax > 0 ? yRight : yLeft;
          const d = s.data.map((v, idx) => `${idx === 0 ? "M" : "L"} ${x(idx)} ${yFn(v)}`).join(" ");
          const area = `${d} L ${x(s.data.length - 1)} ${pad.t + innerH} L ${x(0)} ${pad.t + innerH} Z`;
          return (
            <g key={s.name}>
              <path d={area} fill={`url(#grad-${title}-${i})`} />
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PatchDisplay({ patch }: { patch: Record<string, unknown> }) {
  const rows: [string, string][] = [];
  if (patch.scene) rows.push(["场景", patch.scene === "pd_fused" ? "PD 融合" : "PD 分离"]);
  const walk = (obj: unknown, prefix = "") => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      Object.entries(obj as Record<string, unknown>).forEach(([k, v]) => {
        const next = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) walk(v, next);
        else rows.push([next, String(v)]);
      });
    }
  };
  (["system", "runtime"] as const).forEach((k) => patch[k] && walk(patch[k], k));
  return (
    <div className="apply-patch">
      <div className="title">推荐参数补丁（点击下方应用到表单）</div>
      <div className="params">
        {rows.slice(0, 8).map(([k, v]) => (
          <div key={k} className="param"><span className="k">{k}</span><span className="v">{v}</span></div>
        ))}
      </div>
    </div>
  );
}

function WorkloadPage({
  token,
  kind,
  externalRun,
  templates,
  agentContext,
  agentApplyPatch,
  getCachedResult,
  setCachedResult,
}: {
  token: string;
  kind: WorkloadKind;
  externalRun?: number;
  templates: SimTemplate[];
  agentContext: { workload: WorkloadKind; scene: SceneKind; config_id: string | null };
  agentApplyPatch: (patch: Record<string, unknown>) => void;
  getCachedResult: (kind: WorkloadKind, scene: SceneKind) => SimResult | null;
  setCachedResult: (kind: WorkloadKind, scene: SceneKind, result: SimResult) => void;
}) {
  const initial = useMemo(() => applyDefaults(kind), [kind]);
  const [scene, setScene] = useState<SceneKind>(initial.scene);
  const [model, setModel] = useState<FormDict>(initial.model);
  const [system, setSystem] = useState<FormDict>(initial.system);
  const [runtime, setRuntime] = useState<FormDict>(initial.runtime);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [sceneTransitionKey, setSceneTransitionKey] = useState(0); // 切 scene 时自增触发 CSS 动画
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ model: true, system: true, runtime: true });
  const [runState, setRunState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimResult | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<SimResult["logs"]>([]);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [logFilter, setLogFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");
  const [resultTab, setResultTab] = useState<"performance" | "resource" | "compare">("performance");
  const logEndRef = useRef<HTMLDivElement>(null);
  const runButtonRef = useRef<() => void>(() => { });

  // kind 变化：重置表单（model/system/runtime/scene/templateId），但优先从 cache 读回 result
  useEffect(() => {
    const fresh = applyDefaults(kind);
    setScene(fresh.scene);
    setModel(fresh.model);
    setSystem(fresh.system);
    setRuntime(fresh.runtime);
    setTemplateId(null);
    setErrMsg(null);
    setSceneTransitionKey((k) => k + 1);
    // 优先从 cache 读回该 kind 默认 scene 下的结果
    const cached = getCachedResult(kind, fresh.scene);
    if (cached) {
      setResult(cached);
      setLogs(cached.logs ?? []);
      setRunState("done");
      setProgress(100);
    } else {
      setResult(null);
      setLogs([]);
      setRunState("idle");
      setProgress(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // kind 或 scene 变化：尝试从 cache 读回对应组合的结果（用于切 PD 分离/融合或重挂载）
  useEffect(() => {
    const cached = getCachedResult(kind, scene);
    if (cached) {
      setResult(cached);
      setLogs(cached.logs ?? []);
      setRunState("done");
      setProgress(100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, scene]);

  // 点击 PD 分离/融合 → 切换 scene + 重设表单预设 + 触发动画（保留旧 result，除非点开始运行才清空）
  const switchScene = (next: SceneKind) => {
    if (next === scene) return;
    const fresh = applyDefaults(kind, next);
    setScene(next);
    setModel(fresh.model);
    setSystem(fresh.system);
    setRuntime(fresh.runtime);
    setTemplateId(null);
    setErrMsg(null);
    setSceneTransitionKey((k) => k + 1);
  };

  const applyTemplate = (tpl: SimTemplate) => {
    setScene(tpl.scene);
    setModel(tpl.model as FormDict);
    setSystem(tpl.system as FormDict);
    setRuntime(tpl.runtime as FormDict);
    setTemplateId(tpl.id);
    setTemplatePickerOpen(false);
    setErrMsg(null);
    setSceneTransitionKey((k) => k + 1);
  };

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
  }, [logs]);

  const updateField = (sec: SectionKey, key: string, value: string) => {
    const setter = sec === "model" ? setModel : sec === "system" ? setSystem : setRuntime;
    setter((p) => ({ ...p, [key]: value }));
  };

  // 离线演示：生成 Mock 仿真结果（后端未启动时使用，保证完整演示流程）
  const generateMockResult = (): SimResult => {
    const baseScale: Record<WorkloadKind, { tps: number; p50: number; mfu: number }> = {
      inference: { tps: 8200, p50: 28, mfu: 0.52 },
      training: { tps: 320, p50: 350, mfu: 0.46 },
      general: { tps: 12500, p50: 18, mfu: 0.68 },
      graph: { tps: 980, p50: 110, mfu: 0.38 },
    };
    const base = baseScale[kind];
    const pdSepBoost = scene === "pd_separate" ? 1.08 : 0.94;
    const gpuCount = Math.max(1, parseInt(String(system.gpu_count ?? "1"), 10));
    const tp =
      (() => {
        const s = String(system.parallel ?? "TP 1");
        const m = s.match(/TP\s*(\d+)/);
        return m ? Math.max(1, parseInt(m[1], 10)) : 1;
      })();
    const dp =
      (() => {
        const s = String(system.parallel ?? "DP 1");
        const m = s.match(/DP\s*(\d+)/);
        return m ? Math.max(1, parseInt(m[1], 10)) : 1;
      })();
    const eff_gpu = gpuCount * (0.75 + 0.25 / tp);
    const throughput = Math.round(base.tps * eff_gpu * pdSepBoost);
    const latency_p50 = Math.round(base.p50 / pdSepBoost / Math.max(1, Math.log2(tp + 1)));
    const latency_p99 = Math.round(latency_p50 * 2.4);
    const vramPerGpu = kind === "training" ? 74.3 : kind === "inference" ? 58.6 : 40.1;
    const power = 420 + Math.min(80, gpuCount * 2);
    const util = Math.round((0.72 + 0.15 * base.mfu + 0.05 * Math.min(1, gpuCount / 64)) * 100);
    const mfu = Math.round((base.mfu * (scene === "pd_fused" ? 1.05 : 0.98)) * 100);
    const tflops = Math.round(mfu * 0.01 * gpuCount * 312);
    const n = 12;
    const xs = Array.from({ length: n }, (_, i) => `${String(i + 1).padStart(2, "0")}:00`);
    const jitter = (seed: number) =>
      Array.from({ length: n }, (_, i) => 0.85 + 0.3 * Math.sin((i + seed) / 1.7 + kind.length) ** 2);
    const j1 = jitter(1);
    const j2 = jitter(7);
    const j3 = jitter(13);
    const j4 = jitter(19);
    const charts = {
      xs,
      throughput: j1.map((j) => Math.round(throughput * j)),
      latency_p99: j2.map((j) => Math.round(latency_p99 * (2.1 - j))),
      gpu_util: j3.map((j) => Math.min(99, Math.round(util * (0.9 + 0.18 * j)))),
      vram: j4.map((j) => +(vramPerGpu * (0.94 + 0.1 * j)).toFixed(1)),
      power: j1.map((j) => Math.round(power * (0.9 + 0.15 * j))),
    };
    const stages = [
      { name: "输入处理", pct: 14, ms: Math.round(latency_p50 * 0.14) },
      { name: "KV 缓存加载", pct: 18, ms: Math.round(latency_p50 * 0.18) },
      { name: kind === "training" ? "前向计算" : "注意力计算", pct: 32, ms: Math.round(latency_p50 * 0.32) },
      { name: kind === "training" ? "反向传播" : "MLP 计算", pct: 22, ms: Math.round(latency_p50 * 0.22) },
      { name: "输出调度", pct: 14, ms: Math.round(latency_p50 * 0.14) },
    ];
    const logs: { time: string; level: string; msg: string }[] = [
      { time: "OFFLINE", level: "INFO", msg: `[离线 Mock] 已生成 ${WORKLOAD_LABEL[kind]} · ${scene === "pd_separate" ? "PD 分离" : "PD 融合"} 仿真结果` },
      { time: "OFFLINE", level: "INFO", msg: `GPU 集群: ${system.gpu_count ?? 8} × ${system.gpu_model ?? "A100 80GB"} · ${system.parallel ?? "TP 8 × DP 1"}` },
      { time: "OFFLINE", level: "INFO", msg: `模型: ${model.model_name ?? "LLaMA-3-70B"} · ${model.param_size ?? "70B"} · ${model.precision ?? "FP16"}` },
      { time: "OFFLINE", level: "INFO", msg: `框架: ${runtime.framework ?? "vLLM"} · Batch ${system.batch_size ?? "-"} · Concurrency ${runtime.concurrency ?? "-"}` },
      { time: "OFFLINE", level: "WARN", msg: "当前未连接后端 ${BACKEND}，展示为前端本地估算结果；如需真实数据请启动 uvicorn main:app --port 8000" },
    ];
    const recommendation =
      scene === "pd_separate"
        ? `基于 PD 分离场景分析：当前 ${kind === "training" ? "训练" : kind === "inference" ? "推理" : kind === "graph" ? "图算" : "通算"} 作业在 Batch=${system.batch_size ?? "-"} 下 MFU=${mfu}%，建议先尝试 ${dp >= 4 ? "降 DP 升 PP" : "提升 DP×并行数"} 或启用 ${scene === "pd_separate" ? "PD 融合" : "PD 分离"} 以降低 AllReduce 压力。`
        : `基于 PD 融合场景分析：GPU 利用率 ${util}% 处于合理区间，VRAM ${vramPerGpu.toFixed(1)} GB / GPU 建议关注 ${runtime.quantization ?? "无量化"}，如延迟敏感可切换至 INT4/INT8 量化版本。`;
    return {
      id: `mock-${Date.now()}`,
      status: "completed",
      created_at: new Date().toISOString(),
      config: { workload: kind, scene, model, system, runtime },
      metrics: {
        throughput_tokens_s: throughput,
        throughput_flops_tf: kind === "training" || kind === "general" ? tflops : null,
        latency_p50_ms: latency_p50,
        latency_p99_ms: latency_p99,
        vram_gb_per_gpu: +vramPerGpu.toFixed(1),
        power_w_per_gpu: power,
        gpu_utilization: util,
        mfu,
      },
      charts,
      stages,
      logs,
      recommendation,
    };
  };

  const runSimulation = async () => {
    if (runState === "running") return;
    setRunState("running");
    setProgress(0);
    setErrMsg(null);
    setLogs([]);
    setResult(null);
    const body = {
      workload: kind,
      scene,
      template_id: templateId,
      model,
      system,
      runtime,
    };
    const steps = [
      { p: 10, msg: "初始化 SimEngine 并加载配置模板" },
      { p: 30, msg: "构建硬件拓扑与并行策略" },
      { p: 55, msg: "预热阶段：执行若干迭代" },
      { p: 78, msg: "稳态压测阶段，采样指标" },
      { p: 100, msg: "生成性能报告" },
    ];
    let idx = 0;
    const timer = setInterval(() => {
      if (idx >= steps.length) {
        clearInterval(timer);
        return;
      }
      setProgress(steps[idx].p);
      setLogs((prev) => [
        ...prev,
        {
          time: new Date().toTimeString().slice(0, 8) + "." + String((idx * 137) % 1000).padStart(3, "0"),
          level: idx % 4 === 3 ? "WARN" : "INFO",
          msg: steps[idx].msg,
        },
      ]);
      idx += 1;
    }, 240);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`${BACKEND}/api/simulations`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      clearInterval(timer);
      if (!res.ok) {
        setRunState("error");
        setErrMsg(data?.detail ?? `请求失败：${res.status}`);
        return;
      }
      setProgress(100);
      const finalResult = data as SimResult;
      setResult(finalResult);
      setLogs(finalResult.logs);
      setRunState("done");
      setCachedResult(kind, scene, finalResult);
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn("[runSimulation] 后端不可达，切换为离线 Mock 模式：", e);
      // 进度条走完后再展示结果，给用户"运行"的体感
      if (timer) {
        while (idx < steps.length) {
          idx += 1;
        }
      }
      await new Promise((res) => setTimeout(res, 260 * Math.max(0, steps.length - 5)));
      clearInterval(timer);
      const mock = generateMockResult();
      setProgress(100);
      setLogs((prevProgressLogs) => {
        const mergedLogs = [
          ...prevProgressLogs,
          ...mock.logs,
          {
            time: new Date().toTimeString().slice(0, 8),
            level: "INFO",
            msg: "报告生成完成（演示数据）",
          },
        ] as SimResult["logs"];
        const finalMock = { ...mock, logs: mergedLogs };
        setResult(finalMock);
        setRunState("done");
        setCachedResult(kind, scene, finalMock);
        return mergedLogs;
      });
      setErrMsg(`当前使用离线演示模式（未连接 ${BACKEND}）。`);
    }
  };

  useEffect(() => {
    runButtonRef.current = runSimulation;
  });

  useEffect(() => {
    if (externalRun && externalRun > 0) runSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRun]);

  // expose run via ref
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    agentContext.workload = kind;
    // eslint-disable-next-line no-param-reassign
    agentContext.scene = scene;
    // eslint-disable-next-line no-param-reassign
    agentContext.config_id = templateId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const sectionProgress = (sec: SectionKey) => {
    const obj = sec === "model" ? model : sec === "system" ? system : runtime;
    const entries = Object.entries(obj);
    const filled = entries.filter(([, v]) => String(v ?? "").trim() !== "").length;
    return { filled, total: entries.length };
  };

  const workloadTabs: WorkloadKind[] = ["inference", "training", "general", "graph"];
  // 配置模板列表：按 kind + scene 双重过滤，保证切 PD 分离/融合时列表跟着变
  const availableTemplates = useMemo(
    () => templates.filter((t) => t.workload === kind && t.scene === scene),
    [templates, kind, scene]
  );
  const currentTemplateName = useMemo(() => {
    if (templateId) return templates.find((t) => t.id === templateId)?.name ?? "自定义配置";
    return availableTemplates[0]?.name ?? "自定义配置";
  }, [templateId, templates, availableTemplates]);

  const renderFields = (sec: SectionKey) => {
    const dict = sec === "model" ? model : sec === "system" ? system : runtime;
    const entries = Object.keys(dict);
    return entries.map((key, i) => {
      const opts = FIELD_OPTIONS[key];
      const value = dict[key] ?? "";
      const isSelect = !!opts;
      const full = i === 0 && sec === "model";
      return (
        <div key={key} className={`field ${full ? "full" : ""}`}>
          <label className="field-label">{key.replaceAll("_", " ").replace(/(^|\s)\S/g, (m) => m.toUpperCase())}</label>
          {isSelect ? (
            <select
              className="field-select"
              value={value}
              onChange={(e) => updateField(sec, key, e.target.value)}
            >
              {opts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              className="field-input"
              value={value}
              onChange={(e) => updateField(sec, key, e.target.value)}
            />
          )}
        </div>
      );
    });
  };

  const filteredLogs = logFilter === "ALL" ? logs : logs.filter((l) => l.level === logFilter);

  const metrics = result?.metrics;
  const throughputUnit = kind === "inference" ? "tokens/s" : (metrics?.throughput_flops_tf ? "TFLOPS" : "tokens/s");
  const throughputVal = kind === "inference" ? metrics?.throughput_tokens_s ?? 0 : (metrics?.throughput_flops_tf ?? Math.round((metrics?.throughput_tokens_s ?? 0) / 16));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">负载建模 · {WORKLOAD_LABEL[kind]}</h1>
          <p className="page-subtitle">
            选择配置模板或自定义「模型 / 系统 / 运行时」三类参数；在 PD 分离与融合场景间切换，提交后端运行并查看性能曲线。
          </p>
        </div>
      </div>

      <div className="workload-layout">
        {/* Config Panel */}
        <section className="config-panel">
          <div className="config-header">
            <div className={`template-picker ${templatePickerOpen ? "open" : ""}`} style={{ position: "relative" }}>
              <button
                type="button"
                style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: "transparent", border: 0, textAlign: "left", cursor: "pointer", padding: "10px 14px" }}
                onClick={() => setTemplatePickerOpen((v) => !v)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="template-picker-label">配置模板</div>
                  <div className="template-picker-value">{currentTemplateName}</div>
                </div>
                <Icon.ChevronDown size={14} />
              </button>
              {templatePickerOpen && (
                <div className="template-dropdown" onMouseLeave={() => setTemplatePickerOpen(false)}>
                  <button
                    type="button"
                    className={`template-dropdown-item ${templateId === null && !availableTemplates[0] ? "active" : ""}`}
                    onClick={() => {
                      setTemplateId(null);
                      setTemplatePickerOpen(false);
                    }}
                  >
                    <Icon.Sliders size={13} />
                    <span style={{ flex: 1 }}>自定义配置</span>
                    {templateId === null && !availableTemplates[0] && <Icon.Check size={12} />}
                  </button>
                  {availableTemplates.length === 0 ? (
                    <div className="template-dropdown-empty">当前场景暂无已保存模板，可点击右上角『保存』按钮新建</div>
                  ) : (
                    availableTemplates.map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        className={`template-dropdown-item ${templateId === t.id ? "active" : ""}`}
                        onClick={() => applyTemplate(t)}
                      >
                        <Icon.Database size={13} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                        {templateId === t.id && <Icon.Check size={12} />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const key = `${kind}-${Date.now()}`;
              localStorage.setItem(`tpl-${key}`, JSON.stringify({
                id: key, name: `本地保存 · ${new Date().toLocaleTimeString()}`,
                workload: kind, scene, model, system, runtime,
              }));
            }}><Icon.Save size={12} /> 保存</button>
          </div>

          <div style={{ padding: "12px 20px 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--text-tertiary)", fontWeight: 500 }}>仿真场景</span>
            <div className="scene-switch">
              <button
                className={`scene-switch-item ${scene === "pd_separate" ? "active" : ""}`}
                type="button"
                onClick={(e) => { e.stopPropagation(); switchScene("pd_separate"); }}
              >PD 分离</button>
              <button
                className={`scene-switch-item ${scene === "pd_fused" ? "active" : ""}`}
                type="button"
                onClick={(e) => { e.stopPropagation(); switchScene("pd_fused"); }}
              >PD 融合</button>
            </div>
          </div>

          <div className="workload-tabs" style={{ marginTop: 12 }}>
            {workloadTabs.map((w) => (
              <button
                key={w}
                className={`workload-tab ${w === kind ? "active" : ""}`}
                onClick={() => {
                  // navigation managed by parent
                  const ev = new CustomEvent("simforge:nav", { detail: `simulation/workload/${w}` as PageId });
                  window.dispatchEvent(ev);
                }}
              >
                {WORKLOAD_LABEL[w]}
              </button>
            ))}
          </div>

          <div className="config-body scene-form" key={sceneTransitionKey}>
            {SECTION_META.map((sec) => {
              const { filled, total } = sectionProgress(sec.key);
              return (
                <div key={sec.key} className={`config-section ${!sections[sec.key] ? "collapsed" : ""}`}>
                  <div className="config-section-header" onClick={() => setSections((p) => ({ ...p, [sec.key]: !p[sec.key] }))}>
                    <div className="config-section-icon" style={{ background: sec.bg, color: sec.color }}>{sec.icon}</div>
                    <span className="config-section-title">{sec.title}</span>
                    <div className="config-section-progress">
                      <span className="progress-pill">已配置 {filled}/{total}</span>
                    </div>
                    <span className="config-section-arrow"><Icon.ChevronDown size={12} /></span>
                  </div>
                  <div className="config-section-content">{renderFields(sec.key)}</div>
                </div>
              );
            })}
          </div>

          <div className="config-footer">
            <button className="btn btn-secondary" onClick={runSimulation} disabled={runState === "running"}>
              <Icon.Check size={13} /> {runState === "running" ? "运行中..." : "校验并运行"}
            </button>
            <button className="btn btn-primary" onClick={runSimulation} disabled={runState === "running"} style={{ position: "relative", overflow: "hidden" }}>
              {runState === "running" ? (
                <span style={{ position: "relative", zIndex: 1 }}>运行中 {progress}%</span>
              ) : (
                <><Icon.Play size={13} /> 开始运行</>
              )}
              {runState === "running" && (
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${progress}%`, background: "rgba(255,255,255,.2)", transition: "width .3s" }} />
              )}
            </button>
          </div>
        </section>

        {/* Result Panel */}
        <section className="result-panel">
          <div className="result-header">
            <div className="result-status">
              <span className={`status-badge ${runState === "running" ? "status-running" : runState === "done" ? "status-success" : runState === "error" ? "status-failed" : "status-pending"}`}>
                <span className="dot" />
                {runState === "idle" ? "待运行" : runState === "running" ? "运行中" : runState === "done" ? "已完成" : "失败"}
              </span>
              <span className="result-status-label">
                {result ? `任务 ID ${result.id} · ${SCENE_LABEL[scene]}` : errMsg ?? "配置好参数后点击『开始运行』"}
              </span>
            </div>
            {runState !== "idle" && (
              <div className="result-progress-wrap">
                <div className="progress-track"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
          </div>

          <div className="result-body">
            <div className="metric-cards">
              {runState === "idle" ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="metric-card">
                    <div className="skeleton skeleton-line-sm" />
                    <div className="skeleton skeleton-line-lg" style={{ width: "70%" }} />
                  </div>
                ))
              ) : (
                <>
                  <div className="metric-card">
                    <div className="metric-card-label">{kind === "inference" ? "系统吞吐量" : "计算吞吐"}</div>
                    <div className="metric-card-value">{Number(throughputVal).toLocaleString()}<span className="metric-card-unit">{throughputUnit}</span></div>
                    {metrics && <span className="metric-card-trend" style={{ background: "rgba(52,211,153,.12)", color: "var(--success)" }}>MFU {metrics.mfu}%</span>}
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">延迟 P50 / P99</div>
                    <div className="metric-card-value" style={{ fontSize: 18 }}>{metrics?.latency_p50_ms ?? 0} <span className="metric-card-unit">/</span> {metrics?.latency_p99_ms ?? 0}<span className="metric-card-unit">ms</span></div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">显存占用（单卡）</div>
                    <div className="metric-card-value">{metrics?.vram_gb_per_gpu ?? 0}<span className="metric-card-unit">GB</span></div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">GPU 利用率 / 功耗</div>
                    <div className="metric-card-value" style={{ fontSize: 18 }}>{metrics?.gpu_utilization ?? 0}<span className="metric-card-unit">%</span> / {metrics?.power_w_per_gpu ?? 0}<span className="metric-card-unit">W</span></div>
                  </div>
                </>
              )}
            </div>

            <div className="tabs">
              {(["performance", "resource", "compare"] as const).map((t) => (
                <button key={t} className={`tab-item ${resultTab === t ? "active" : ""}`} onClick={() => setResultTab(t)}>
                  {t === "performance" ? "性能曲线" : t === "resource" ? "资源监控" : "对比分析"}
                </button>
              ))}
            </div>

            {runState === "idle" ? (
              <div className="chart-area" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", color: "var(--text-tertiary)" }}>
                  <Icon.Activity size={32} />
                  <div style={{ marginTop: 10, fontSize: 13 }}>运行仿真后查看性能曲线与指标对比</div>
                </div>
              </div>
            ) : result && result.charts ? (
              <>
                {resultTab === "performance" && (
                  <div className="chart-area">
                    <LineChart
                      title="吞吐量 vs 延迟 P99"
                      xs={result.charts.xs}
                      series={[
                        { name: "吞吐量", color: "#22d3ee", data: result.charts.throughput },
                        { name: "延迟 P99 (ms)", color: "#fbbf24", data: result.charts.latency_p99, axis: "right", unit: "ms" },
                      ]}
                    />
                  </div>
                )}
                {resultTab === "resource" && (
                  <div className="chart-area">
                    <LineChart
                      title="GPU 利用率 / 显存 / 功耗"
                      xs={result.charts.xs}
                      series={[
                        { name: "GPU 利用率 %", color: "#22d3ee", data: result.charts.gpu_util },
                        { name: "显存 GB", color: "#a78bfa", data: result.charts.vram },
                        { name: "功耗 W", color: "#fbbf24", data: result.charts.power },
                      ]}
                    />
                  </div>
                )}
                {resultTab === "compare" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="stage-card">
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>端到端阶段耗时</div>
                      {(result.stages ?? []).map((s) => (
                        <div className="stage" key={s.name}>
                          <span>{s.name}</span>
                          <i><b style={{ width: `${s.pct}%` }} /></i>
                          <strong>{s.ms} ms</strong>
                        </div>
                      ))}
                      <div className="total">
                        <span>P95 总延迟</span>
                        <strong>{metrics?.latency_p99_ms ?? 0} ms</strong>
                      </div>
                    </div>
                    <div className="insight-card">
                      <span className="spark">✦</span>
                      <small>AI 优化建议</small>
                      <h3>{SCENE_LABEL[scene]} 场景</h3>
                      <p>{result.recommendation}</p>
                      <button className="btn btn-primary btn-sm" onClick={() => {
                        const patch = {
                          scene: scene === "pd_separate" ? "pd_fused" : "pd_separate",
                        };
                        agentApplyPatch(patch);
                      }}>切换对比场景 →</button>
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {errMsg && (
              <div className="login-hint" style={{ borderColor: "rgba(248,113,113,.3)", color: "#fecaca" }}>
                <b>运行失败：</b>{errMsg}
              </div>
            )}

            <div className="log-panel">
              <div className="log-panel-header" onClick={() => setLogCollapsed((v) => !v)}>
                <div className="log-panel-title"><Icon.Terminal size={14} /> 运行日志 <span style={{ marginLeft: 6, color: "var(--text-tertiary)", fontWeight: 400 }}>({filteredLogs.length} 条)</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                  <div className="log-filter">
                    {(["ALL", "INFO", "WARN", "ERROR"] as const).map((f) => (
                      <button key={f} className={`log-filter-btn ${logFilter === f ? "active" : ""}`} onClick={() => setLogFilter(f)}>{f}</button>
                    ))}
                  </div>
                  <span style={{ color: "var(--text-tertiary)", transform: logCollapsed ? "rotate(-90deg)" : undefined, transition: "transform .2s", display: "inline-flex" }}>
                    <Icon.ChevronDown size={12} />
                  </span>
                </div>
              </div>
              <div ref={logEndRef} className={`log-panel-body ${logCollapsed ? "collapsed" : ""}`}>
                {filteredLogs.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>暂无日志，点击『开始运行』启动仿真</div>
                ) : (
                  filteredLogs.map((l, i) => (
                    <div className="log-line" key={i}>
                      <span className="log-time">{l.time}</span>
                      <span className={`log-level ${l.level}`}>{l.level}</span>
                      <span className="log-msg">{l.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {result && (
              <div className="runs">
                <div className="card-title" style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <strong>同场景最近运行</strong>
                    <small>同一负载类型的对比</small>
                  </div>
                  <span className="link-btn" style={{ fontSize: 12 }}>查看全部 →</span>
                </div>
                <table>
                  <thead>
                    <tr><th>运行 ID</th><th>场景</th><th>吞吐</th><th>TTFT / P99</th><th>GPU 利用率</th><th>状态</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{result.id.slice(-6)}</td>
                      <td>{SCENE_LABEL[scene]}</td>
                      <td>{Number(throughputVal).toLocaleString()} {throughputUnit}</td>
                      <td>{metrics?.latency_p50_ms} / {metrics?.latency_p99_ms} ms</td>
                      <td>{metrics?.gpu_utilization}%</td>
                      <td><span className="status-badge status-success"><span className="dot" />最新</span></td>
                    </tr>
                    <tr>
                      <td>{"#" + (parseInt(result.id.slice(-4), 16) - 6).toString(16).toUpperCase().padStart(4, "0")}</td>
                      <td>{scene === "pd_separate" ? "PD 融合" : "PD 分离"}</td>
                      <td>{Math.round(Number(throughputVal) * (scene === "pd_separate" ? 1.1 : 0.9)).toLocaleString()} {throughputUnit}</td>
                      <td>{Math.round((metrics?.latency_p99_ms ?? 0) * (scene === "pd_separate" ? 0.9 : 1.1))} ms</td>
                      <td>{Math.round((metrics?.gpu_utilization ?? 0) * 0.97)}%</td>
                      <td><span className="status-badge status-success"><span className="dot" />完成</span></td>
                    </tr>
                    <tr>
                      <td>{"#" + (parseInt(result.id.slice(-4), 16) - 14).toString(16).toUpperCase().padStart(4, "0")}</td>
                      <td>基线 (8 GPU)</td>
                      <td>{Math.round(Number(throughputVal) * 0.6).toLocaleString()} {throughputUnit}</td>
                      <td>{Math.round((metrics?.latency_p99_ms ?? 0) * 1.3)} ms</td>
                      <td>{Math.round((metrics?.gpu_utilization ?? 0) * 0.86)}%</td>
                      <td><span className="status-badge status-success"><span className="dot" />完成</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ==================== Module Placeholders ==================== */
function SystemSimPage() {
  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">系统仿真</h1><p className="page-subtitle">构建芯片、服务器、网络与集群拓扑，评估系统级性能瓶颈。（演示占位）</p></div>
      </div>
      <div className="module-page">
        <aside className="module-sidebar">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>拓扑与参数</h3>
          {[
            ["集群规模", ["微型", "小型", "中型", "大型"]],
            ["节点数量", ["8", "32", "128", "512"]],
            ["网络拓扑", ["Fat-Tree", "Torus", "Dragonfly", "Mesh"]],
            ["互联技术", ["IB 200G", "IB 400G", "RoCE v2", "NVLink 4"]],
            ["调度器", ["Kubernetes + Volcano", "Slurm", "Ray", "MPI"]],
          ].map(([label, opts]) => (
            <div className="field full" key={label as string} style={{ marginBottom: 12 }}>
              <label className="field-label">{label as string}</label>
              <select className="field-select">{(opts as string[]).map((o) => <option key={o}>{o}</option>)}</select>
            </div>
          ))}
        </aside>
        <main className="module-main">
          <div className="metric-cards">
            {[
              ["集群吞吐", "84.7%", "峰值 88.2%"],
              ["节点利用率", "79.3%", "均衡 0.87"],
              ["网络瓶颈率", "3.2%", "无严重拥塞"],
              ["调度 P99", "128 ms", "均值 45 ms"],
            ].map(([a, b, c]) => (
              <div className="metric-card" key={a}>
                <div className="metric-card-label">{a}</div>
                <div className="metric-card-value">{b}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>{c}</div>
              </div>
            ))}
          </div>
          <div className="chart-area" style={{ minHeight: 360 }}>
            <LineChart
              title="集群吞吐 / 节点利用率 / 网络负载"
              xs={["0", "5", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55", "60"]}
              series={[
                { name: "集群吞吐", color: "#22d3ee", data: [60, 72, 78, 82, 85, 86, 87, 88, 87, 86, 85, 84, 83] },
                { name: "节点利用率", color: "#34d399", data: [50, 65, 72, 78, 80, 82, 83, 84, 83, 82, 81, 80, 79] },
                { name: "网络负载", color: "#a78bfa", data: [30, 45, 52, 58, 62, 65, 68, 70, 68, 65, 62, 58, 55] },
              ]}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function TerminalPage() {
  type Line = { kind: "in" | "out"; text: string };
  const initial: Line[] = [
    { kind: "out", text: "SimForge Terminal v2.4.1 — 输入 help 查看命令" },
    { kind: "in", text: "sim --list" },
    { kind: "out", text: "ID       NAME                       STATUS   DURATION\n1024     LLaMA-3-70B inference test  running  2m 34s\n1023     LLaMA-405B training sim     done     12m 08s\n1022     GNN benchmark                done     3m 45s" },
  ];
  const [lines, setLines] = useState<Line[]>(initial);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lines]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;
    const outs: string[] = [];
    if (cmd === "help") outs.push("可用命令：sim --list / sim --run <id> / node --status / gpu --util / help / clear");
    else if (cmd === "clear") { setLines([]); setInput(""); return; }
    else if (cmd === "node --status") outs.push("node01 healthy 8/8 GPU    node02 healthy 8/8 GPU    node04 degraded 6/8 GPU");
    else if (cmd === "gpu --util") outs.push("平均 73.2%  峰值 96.8%  分布：>90%(8)，70-90%(16)，50-70%(4)，<50%(4)");
    else if (cmd.startsWith("sim --run")) outs.push(`[INFO] 启动 ${cmd} ... 已进入运行队列`);
    else outs.push(`命令未找到：${cmd}`);
    setLines((p) => [...p, { kind: "in", text: cmd }, ...outs.map((t) => ({ kind: "out" as const, text: t }))]);
    setInput("");
  };
  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">终端</h1><p className="page-subtitle">命令行式交互，快速查询与操作仿真任务、节点、GPU 状态。</p></div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm">新建会话</button>
          <button className="btn btn-secondary btn-sm">上传脚本</button>
        </div>
      </div>
      <div className="card" style={{ minHeight: 560, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10, background: "var(--bg-elevated)" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#f87171" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fbbf24" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#34d399" }} />
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 12 }}>
            simforge@cluster-01:~/simulations
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="icon-btn" style={{ width: 28, height: 28 }}><Icon.Refresh size={13} /></button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 16, background: "var(--bg-deep)", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.8 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              {l.kind === "in" ? (
                <div style={{ display: "flex", gap: 8, color: "var(--text-primary)" }}>
                  <span style={{ color: "var(--success)" }}>simforge</span>
                  <span style={{ color: "var(--text-tertiary)" }}>:</span>
                  <span style={{ color: "var(--brand-400)" }}>~</span>
                  <span style={{ color: "var(--text-tertiary)" }}>$</span>
                  <span>{l.text}</span>
                </div>
              ) : (
                <div style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{l.text}</div>
              )}
            </div>
          ))}
          <div ref={endRef} />
          <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <span style={{ color: "var(--success)" }}>simforge</span>
            <span style={{ color: "var(--text-tertiary)" }}>:</span>
            <span style={{ color: "var(--brand-400)" }}>~</span>
            <span style={{ color: "var(--text-tertiary)" }}>$</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              spellCheck={false}
              placeholder="输入命令..."
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontFamily: "inherit", fontSize: 13 }}
            />
          </form>
        </div>
      </div>
    </div>
  );
}

function EnergyPage() {
  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">能源</h1><p className="page-subtitle">实时功耗、PUE、碳排放与绿电占比。（演示占位）</p></div>
      </div>
      <div className="stats-row">
        {[
          ["实时总功耗", "429 kW", "cyan"],
          ["PUE 实时值", "1.25", "green"],
          ["日均碳排放", "3.4 tCO₂e", "amber"],
          ["绿电占比", "28.6 %", "purple"],
        ].map(([a, b, c]) => (
          <div className="stat-card" key={a}>
            <div className={`stat-card-icon ${c as string}`}><Icon.Zap size={20} /></div>
            <div className="stat-card-label">{a}</div>
            <div className="stat-card-value">{b}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div className="chart-area" style={{ minHeight: 360 }}>
          <LineChart
            title="IT 负载 / 制冷 / 配电损耗 + PUE（右轴）"
            xs={["00", "04", "08", "12", "16", "20", "24h"]}
            series={[
              { name: "IT 负载 kW", color: "#22d3ee", data: [320, 300, 280, 350, 380, 360, 340] },
              { name: "制冷 kW", color: "#a78bfa", data: [65, 58, 52, 75, 82, 78, 70] },
              { name: "配电损耗 kW", color: "#fbbf24", data: [18, 16, 14, 20, 22, 20, 19] },
              { name: "PUE", color: "#f87171", data: [1.26, 1.25, 1.24, 1.28, 1.27, 1.26, 1.25], axis: "right" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function InfraPage() {
  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">基础设施</h1><p className="page-subtitle">计算集群、网络、存储与运行镜像的统一视图。（演示占位）</p></div>
      </div>
      <div className="module-cards" style={{ marginBottom: 24 }}>
        {[
          ["计算资源", "16 集群 · 2,048 GPU · 可用 576", <Icon.Cpu size={24} />, "rgba(34,211,238,.14)", "var(--brand-400)"],
          ["网络资源", "IB 400G · 无阻塞 Fat-Tree", <Icon.Activity size={24} />, "rgba(52,211,153,.14)", "var(--success)"],
          ["存储资源", "18.6 PB · 使用 64%", <Icon.Database size={24} />, "rgba(251,191,36,.14)", "var(--accent-400)"],
          ["环境镜像", "驱动 550.90 · CUDA 12.6", <Icon.Server size={24} />, "rgba(167,139,250,.14)", "var(--purple)"],
        ].map(([title, desc, icon, bg, color], i) => (
          <div key={i} className="module-card" style={{ cursor: "default" }}>
            <div className="module-card-icon" style={{ background: bg as string, color: color as string }}>{icon as React.ReactNode}</div>
            <div className="module-card-title">{title as string}</div>
            <div className="module-card-desc">{desc as string}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><h3 className="card-title">集群列表</h3></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {["集群", "区域", "节点", "GPU 总量", "利用率", "状态"].map((x) => (
                  <th key={x} style={{ textAlign: "left", padding: "12px 16px", color: "var(--text-tertiary)", fontWeight: 400 }}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["nebula-a100-prd", "华北-北京", "32", "256", "86.4%", "在线"],
                ["nebula-h100-ai", "华东-上海", "64", "512", "72.9%", "在线"],
                ["nebula-h800-train", "西南-贵州", "128", "1024", "91.2%", "在线"],
                ["nebula-mi300x-graph", "华南-深圳", "16", "128", "66.8%", "维护"],
              ].map((row) => (
                <tr key={row[0]} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {row.map((c, i) => (
                    <td key={i} style={{ padding: "12px 16px", color: i === row.length - 1 ? (c === "在线" ? "var(--success)" : "var(--accent-400)") : "var(--text-secondary)" }}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ==================== AI Agent Panel ==================== */
type ChatMsg = { role: "user" | "agent"; text: string; patch?: Record<string, unknown> };
function AgentPanel({
  token,
  open,
  onClose,
  context,
  applyPatch,
  user,
  onApplyPrompt,
}: {
  token: string;
  open: boolean;
  onClose: () => void;
  context: { workload: WorkloadKind; scene: SceneKind; config_id: string | null };
  applyPatch: (p: Record<string, unknown>) => void;
  user: User;
  onApplyPrompt?: (text: string) => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      role: "agent",
      text: "我可以读取当前仿真上下文。试试问我：「如何降低首 Token 延迟？」「对比 PD 分离和融合部署」「生成一份优化后的配置」。",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" }); }, [msgs]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    const userMsg: ChatMsg = { role: "user", text };
    setMsgs((p) => [...p, userMsg]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`${BACKEND}/api/agent/chat`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ text, context }),
      });
      const data = await res.json();
      setMsgs((p) => [...p, { role: "agent", text: data.reply ?? "暂未回复", patch: data.patch }]);
    } catch {
      setMsgs((p) => [...p, { role: "agent", text: `无法连接后端 ${BACKEND}。请启动：uvicorn main:app --reload --port 8000` }]);
    } finally {
      setSending(false);
    }
  };

  const suggestions = [
    "如何降低首 Token 延迟？",
    "对比 PD 分离和融合部署",
    "生成一份优化后的配置",
    "训练场景如何提升 MFU？",
  ];

  const initials = user.name.slice(0, 2).toUpperCase();

  return (
    <>
      <button className={`agent-fab ${open ? "open" : ""}`} onClick={onClose}>
        <Icon.Sparkles />
      </button>
      <aside className={`agent-panel ${open ? "open" : ""}`} style={{ marginBottom: '60px' }}>
        <div className="agent-panel-header">
          <div className="agent-avatar"><Icon.Sparkles size={18} /></div>
          <div>
            <div className="agent-info-name">Simulation Agent</div>
            <div className="agent-info-status"><span className="dot" />在线 · 已接入当前配置</div>
          </div>
          <button className="agent-close-btn" onClick={onClose}><Icon.X size={14} /></button>
        </div>
        <div className="agent-context">
          <small>正在分析</small>
          <strong>{WORKLOAD_LABEL[context.workload]} · {SCENE_LABEL[context.scene]}</strong>
          <span>{context.config_id ? `模板：${context.config_id}` : "自定义配置"}</span>
        </div>
        <div className="agent-panel-body" ref={bodyRef}>
          {msgs.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              <div className="chat-avatar">{m.role === "user" ? initials : <Icon.Sparkles size={14} />}</div>
              <div className="chat-bubble">
                <p style={{ margin: 0 }}>{m.text}</p>
                {m.patch && Object.keys(m.patch).length > 0 && (
                  <>
                    <PatchDisplay patch={m.patch} />
                    <div style={{ marginTop: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => applyPatch(m.patch!)}>应用推荐到表单</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {msgs.length <= 1 && (
            <div className="quick-prompts">
              {suggestions.map((s) => (
                <button key={s} className="quick-prompt-item" onClick={() => { onApplyPrompt?.(s); send(s); }}>{s}</button>
              ))}
            </div>
          )}
        </div>
        <div className="agent-panel-footer">
          <form
            className="agent-input-wrap"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <textarea
              className="agent-input"
              placeholder="询问当前配置、结果或优化建议…"
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button className="agent-send-btn" type="submit" disabled={sending || !input.trim()}>
              <Icon.Send size={16} />
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

/* ==================== Root App ==================== */
export default function App() {
  const [token, setToken] = useState<string | null>(() => typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [page, setPage] = useState<PageId>("dashboard");
  const [agentOpen, setAgentOpen] = useState(true);
  const [templates, setTemplates] = useState<SimTemplate[]>([]);
  // 结果缓存：kind:scene -> SimResult，切 kind/scene/页面后回来可以读回之前跑过的结果
  const [resultCache, setResultCache] = useState<Record<string, SimResult>>({});
  const cacheKey = useCallback((kind: WorkloadKind, scene: SceneKind) => `${kind}:${scene}`, []);
  const getCachedResult = useCallback((kind: WorkloadKind, scene: SceneKind): SimResult | null =>
    resultCache[cacheKey(kind, scene)] ?? null, [resultCache, cacheKey]);
  const setCachedResult = useCallback((kind: WorkloadKind, scene: SceneKind, result: SimResult) =>
    setResultCache((prev) => ({ ...prev, [cacheKey(kind, scene)]: result })), [cacheKey]);
  const [externalRunCounter, setExternalRunCounter] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("simforge_theme");
    if (saved === "dark" || saved === "light") return saved;
    // 默认跟随系统
    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
    return prefersLight ? "light" : "dark";
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth <= 1024 : false
  );

  const agentContextRef = useRef<{ workload: WorkloadKind; scene: SceneKind; config_id: string | null }>({
    workload: "inference", scene: "pd_separate", config_id: null,
  });

  // 主题切换：应用到 <html data-theme> 并持久化
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("simforge_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const toggleSidebar = () => setSidebarCollapsed((v) => !v);

  // 屏幕适配：基于 1920px 设计稿的 rem 动态缩放 + 侧栏自动折叠
  // 基准：1920px -> 1rem = 16px；按窗口宽度等比缩放，限制 0.6 ~ 1.4 倍
  useEffect(() => {
    const DESIGN_WIDTH = 1920;
    const BASE_FONT = 16;
    const MIN_RATIO = 0.6;
    const MAX_RATIO = 1.4;
    const COLLAPSE_BREAKPOINT = 1024;
    let raf = 0;
    let lastCollapseState: boolean | null = null;
    const apply = () => {
      const w = window.innerWidth;
      const ratio = Math.max(MIN_RATIO, Math.min(MAX_RATIO, w / DESIGN_WIDTH));
      document.documentElement.style.fontSize = `${BASE_FONT * ratio}px`;
      // 窗口大小变化时，小屏默认收起侧栏；大屏默认展开；仅在用户未手动干预的首次触发
      if (lastCollapseState === null) {
        const shouldCollapse = w <= COLLAPSE_BREAKPOINT;
        setSidebarCollapsed((prev) => (prev === shouldCollapse ? prev : shouldCollapse));
        lastCollapseState = shouldCollapse;
      }
    };
    apply();
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const onNav = (e: Event) => {
      const ce = e as CustomEvent<PageId>;
      setPage(ce.detail);
    };
    window.addEventListener("simforge:nav", onNav as EventListener);
    return () => window.removeEventListener("simforge:nav", onNav as EventListener);
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/api/configurations`, { headers: headers(token) });
        if (res.ok) {
          const data = (await res.json()) as SimTemplate[];
          // merge local saved templates
          const locals: SimTemplate[] = [];
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith("tpl-")) {
              try { locals.push(JSON.parse(localStorage.getItem(k)!)); } catch { /* ignore */ }
            }
          });
          setTemplates([...data, ...locals]);
        }
      } catch { /* keep empty */ }
    })();
  }, [token]);

  // on mount: validate token
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/api/auth/me`, { headers: headers(token) });
        if (!res.ok) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null); setUser(null);
        }
      } catch {
        // offline: still allow local demo UI
      }
    })();
  }, [token]);

  // patchTick: bump key on simforge:patch to allow scene override from Agent
  const [patchTick, setPatchTick] = useState(0);
  useEffect(() => {
    const onPatch = () => setPatchTick((c) => c + 1);
    window.addEventListener("simforge:patch", onPatch);
    return () => window.removeEventListener("simforge:patch", onPatch);
  }, []);

  if (!token || !user) {
    return <LoginPage onLogin={(t, u) => { setToken(t); setUser(u); }} />;
  }

  const applyPatchToWorkload = (raw: Record<string, unknown>) => {
    // dispatch to current WorkloadPage via window event; we also change state at top-level for scene
    if (raw.scene === "pd_separate" || raw.scene === "pd_fused") {
      // easiest: reload patch by triggering a custom event; but we directly change via storage-backed state using a force-reload trick: dispatch a special update to the page inner component
      // Instead, we apply on top of current defaults via custom event
      const ev = new CustomEvent("simforge:patch", { detail: raw });
      window.dispatchEvent(ev);
    }
    // Also prompt user that scene was switched: just change scene via synthetic patch using localStorage bridge
    try { sessionStorage.setItem("simforge-patch", JSON.stringify(raw)); } catch { /* ignore */ }
    // force re-run by bumping counter (only effective if we are on workload page)
    setExternalRunCounter((c) => c + 1);
    // Note: real patch happens inside WorkloadPage component below via sessionStorage
  };

  const kind = page.startsWith("simulation/workload") ? (page.split("/")[2] as WorkloadKind) : null;

  // Helper: apply patch (scene switch + bump run counter)
  const applyAgentPatch = (raw: Record<string, unknown>) => {
    if (!page.startsWith("simulation/workload/")) {
      // Auto-navigate to inference workload page on patch
      setPage("simulation/workload/inference");
    }
    if (raw.scene === "pd_separate" || raw.scene === "pd_fused") {
      // Toggle global scene preference by forcing WorkloadPage re-init
      try {
        sessionStorage.setItem("simforge-default-scene", raw.scene);
      } catch { /* ignore */ }
      setPage((p) => p);
    }
    // also bump counter so user sees change feedback
    setExternalRunCounter((c) => c + 1);
  };

  const logout = async () => {
    try {
      await fetch(`${BACKEND}/api/auth/logout`, { method: "POST", headers: headers(token) });
    } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const triggerRun = () => setExternalRunCounter((c) => c + 1);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        user={user}
        currentPage={page}
        onNavigate={setPage}
        onLogout={logout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
      <div className="main-area">
        <TopBar currentPage={page} onRunSim={kind ? triggerRun : undefined} theme={theme} onToggleTheme={toggleTheme} />
        <div className="page-content">
          {page === "dashboard" && <Dashboard onNavigate={setPage} />}
          {page === "simulation/system" && <SystemSimPage />}
          {page === "terminal" && <TerminalPage />}
          {page === "energy" && <EnergyPage />}
          {page === "infrastructure" && <InfraPage />}
          {kind && (
            <WorkloadPage
              key={`${kind}-${patchTick}`}
              kind={kind}
              token={token}
              externalRun={externalRunCounter}
              templates={templates}
              agentContext={agentContextRef.current}
              agentApplyPatch={applyPatchToWorkload}
              getCachedResult={getCachedResult}
              setCachedResult={setCachedResult}
            />
          )}
        </div>
      </div>
      <AgentPanel
        token={token}
        open={agentOpen}
        onClose={() => setAgentOpen((v) => !v)}
        context={agentContextRef.current}
        applyPatch={applyAgentPatch}
        user={user}
        onApplyPrompt={() => { /* handled inline via send() */ }}
      />
    </div>
  );
}
