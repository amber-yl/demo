"use client";

import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { message } from "antd";
import type {
  User,
  SimTemplate,
  WorkloadKind,
  SceneKind,
  SimResult,
  AgentContext,
  PageId,
} from "@/types";
import { TOKEN_KEY, USER_KEY } from "@/utils";
import { api } from "@/utils/api";

export type ToastApi = {
  success: (m: string) => void;
  error: (m: string) => void;
  warning: (m: string) => void;
  info: (m: string) => void;
};

type AppContextValue = {
  token: string | null;
  user: User | null;
  login: (t: string, u: User) => void;
  logout: () => Promise<void>;
  theme: "dark" | "light";
  toggleTheme: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  templates: SimTemplate[];
  agentOpen: boolean;
  setAgentOpen: (v: boolean) => void;
  agentContextState: AgentContext;
  setAgentContextState: React.Dispatch<React.SetStateAction<AgentContext>>;
  agentContextRef: React.MutableRefObject<AgentContext>;
  getCachedResult: (kind: WorkloadKind, scene: SceneKind) => SimResult | null;
  setCachedResult: (kind: WorkloadKind, scene: SceneKind, result: SimResult) => void;
  triggerRun: () => void;
  externalRunCounter: number;
  patchTick: number;
  applyPatchToWorkload: (raw: Record<string, unknown>) => void;
  applyAgentPatch: (raw: Record<string, unknown>) => void;
  toast: ToastApi;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}

export function useToast(): ToastApi {
  return useApp().toast;
}

function pageIdToPath(page: PageId | string): string {
  if (page === "dashboard") return "/dashboard";
  return `/${page}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null,
  );
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [templates, setTemplates] = useState<SimTemplate[]>([]);
  const [resultCache, setResultCache] = useState<Record<string, SimResult>>({});
  const [externalRunCounter, setExternalRunCounter] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("simforge_theme");
    if (saved === "dark" || saved === "light") return saved;
    const prefersLight =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: light)").matches
        : false;
    return prefersLight ? "light" : "dark";
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth <= 1024 : false,
  );
  const [patchTick, setPatchTick] = useState(0);
  const [agentOpen, setAgentOpen] = useState(true);
  const [agentContextState, setAgentContextState] = useState<AgentContext>({
    workload: "inference",
    scene: "pd_separate",
    config_id: null,
  });
  const agentContextRef = useRef<AgentContext>(agentContextState);

  // ---------- toast api (antd message) ----------
  const toast = useMemo<ToastApi>(
    () => ({
      success: (m) => message.success(m),
      error: (m) => message.error(m),
      warning: (m) => message.warning(m),
      info: (m) => message.info(m),
    }),
    [],
  );

  // ---------- 主题 + localStorage ----------
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("simforge_theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );
  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  // ---------- rem 自适应 + 侧栏自动折叠 ----------
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

  // ---------- patch 事件监听 ----------
  useEffect(() => {
    const onPatch = () => setPatchTick((c) => c + 1);
    window.addEventListener("simforge:patch", onPatch);
    return () => window.removeEventListener("simforge:patch", onPatch);
  }, []);

  // ---------- agentContext：state <-> ref 双向同步 ----------
  useEffect(() => {
    agentContextRef.current = agentContextState;
  }, [agentContextState]);

  // ---------- 拉取配置模板 ----------
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await api.getConfigurations(token);
        const locals: SimTemplate[] = [];
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("tpl-")) {
            try {
              locals.push(JSON.parse(localStorage.getItem(k)!));
            } catch {
              /* ignore */
            }
          }
        });
        setTemplates([...data, ...locals]);
      } catch {
        /* keep empty */
      }
    })();
  }, [token]);

  // ---------- token 校验 ----------
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const me = await api.getMe(token);
        if (!me) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
          toast.warning("登录态已失效，请重新登录");
        }
      } catch {
        /* offline: still allow */
      }
    })();
  }, [token, toast]);

  // ---------- 结果缓存 helpers ----------
  const cacheKey = useCallback(
    (kind: WorkloadKind, scene: SceneKind) => `${kind}:${scene}`,
    [],
  );
  const getCachedResult = useCallback(
    (kind: WorkloadKind, scene: SceneKind): SimResult | null =>
      resultCache[cacheKey(kind, scene)] ?? null,
    [resultCache, cacheKey],
  );
  const setCachedResult = useCallback(
    (kind: WorkloadKind, scene: SceneKind, result: SimResult) =>
      setResultCache((prev) => ({ ...prev, [cacheKey(kind, scene)]: result })),
    [cacheKey],
  );

  // ---------- patch 回调 ----------
  const applyPatchToWorkload = useCallback((raw: Record<string, unknown>) => {
    const ev = new CustomEvent("simforge:patch", { detail: raw });
    window.dispatchEvent(ev);
    try {
      sessionStorage.setItem("simforge-patch", JSON.stringify(raw));
    } catch {
      /* ignore */
    }
    setExternalRunCounter((c) => c + 1);
  }, []);

  const applyAgentPatch = useCallback(
    (raw: Record<string, unknown>) => {
      const patchPage = raw.__page as PageId | undefined;
      // 路由跳转：用 router.push 更新 URL ✅
      let targetPath: string | null = null;
      if (patchPage) {
        targetPath = pageIdToPath(patchPage);
      } else if (!pathname?.startsWith("/simulation/workload/")) {
        targetPath = pageIdToPath("simulation/workload/inference");
      }
      if (targetPath && targetPath !== pathname) {
        router.push(targetPath);
      }

      if (raw.scene === "pd_separate" || raw.scene === "pd_fused") {
        try {
          sessionStorage.setItem(
            "simforge-default-scene",
            raw.scene as string,
          );
        } catch {
          /* ignore */
        }
        setAgentContextState((prev) => ({
          ...prev,
          scene: raw.scene as SceneKind,
        }));
      }
      setExternalRunCounter((c) => c + 1);
    },
    [pathname, router],
  );

  const login = useCallback((t: string, u: User) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setToken(t);
    setUser(u);
    toast.success(`欢迎回来，${u.name}`);
  }, [toast]);

  const logout = useCallback(async () => {
    try {
      await api.logout(token ?? "");
    } catch {
      /* ignore */
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    toast.info("已退出登录");
  }, [token, toast]);

  const triggerRun = useCallback(() => {
    setExternalRunCounter((c) => c + 1);
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    token, user, login, logout,
    theme, toggleTheme,
    sidebarCollapsed, setSidebarCollapsed, toggleSidebar,
    templates,
    agentOpen, setAgentOpen,
    agentContextState, setAgentContextState, agentContextRef,
    getCachedResult, setCachedResult,
    triggerRun, externalRunCounter, patchTick,
    applyPatchToWorkload, applyAgentPatch,
    toast,
  }), [
    token, user, login, logout,
    theme, toggleTheme,
    sidebarCollapsed, toggleSidebar,
    templates,
    agentOpen,
    agentContextState,
    getCachedResult, setCachedResult,
    triggerRun, externalRunCounter, patchTick,
    applyPatchToWorkload, applyAgentPatch,
    toast,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
