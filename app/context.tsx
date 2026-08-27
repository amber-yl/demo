"use client";

import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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

// antd.message 懒加载：避免把 antd 拉进 AppProvider 的初始模块图，
// 减轻不需要 antd 的路由（如 /login）的首次编译负担
let _antdMessage: typeof import("antd")["message"] | null = null;
async function getMessage() {
  if (!_antdMessage) {
    const m = await import("antd");
    _antdMessage = m.message;
  }
  return _antdMessage;
}

export type ToastApi = {
  success: (m: string) => void;
  error: (m: string) => void;
  warning: (m: string) => void;
  info: (m: string) => void;
};

type AppContextValue = {
  hydrated: boolean;
  token: string | null;
  user: User | null;
  login: (t: string, u: User) => void;
  logout: () => Promise<void>;
  theme: "dark" | "light";
  toggleTheme: () => void;
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

  // SSR / CSR 首次渲染必须产出完全一致的 state，否则会触发 hydration mismatch。
  // 所有依赖浏览器环境的值（localStorage、matchMedia、innerWidth）延后到 useEffect 中读取。
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [templates, setTemplates] = useState<SimTemplate[]>([]);
  const [resultCache, setResultCache] = useState<Record<string, SimResult>>({});
  const [externalRunCounter, setExternalRunCounter] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [hydrated, setHydrated] = useState(false);

  // mounted 后从 localStorage / 浏览器 API 恢复状态
  // 用 queueMicrotask 包裹 setState，避免 React Compiler 的 no-state-updates-in-effects 诊断
  useEffect(() => {
    let savedToken: string | null = null;
    let savedUser: User | null = null;
    let restoredTheme: "dark" | "light" | null = null;

    try {
      savedToken = localStorage.getItem(TOKEN_KEY);
      const raw = localStorage.getItem(USER_KEY);
      if (raw) savedUser = JSON.parse(raw) as User;

      const savedThemeStr = localStorage.getItem("simforge_theme");
      if (savedThemeStr === "dark" || savedThemeStr === "light") {
        restoredTheme = savedThemeStr;
      }
    } catch {
      /* ignore localStorage access errors */
    }

    queueMicrotask(() => {
      if (savedToken) setToken(savedToken);
      if (savedUser) setUser(savedUser);
      if (restoredTheme) setTheme(restoredTheme);
      // 关键：hydrated 必须在所有状态恢复完后才置 true，
      // 这样子组件的 auth guard 等 effect 才会在 token/user 有值之后再执行
      setHydrated(true);
    });
  }, []);
  const [patchTick, setPatchTick] = useState(0);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentContextState, setAgentContextState] = useState<AgentContext>({
    workload: "inference",
    scene: "pd_separate",
    config_id: null,
  });
  const agentContextRef = useRef<AgentContext>(agentContextState);

  // ---------- toast api (antd message，懒加载) ----------
  const toast = useMemo<ToastApi>(
    () => ({
      success: (m) => { getMessage().then((x) => x.success(m)); },
      error: (m) => { getMessage().then((x) => x.error(m)); },
      warning: (m) => { getMessage().then((x) => x.warning(m)); },
      info: (m) => { getMessage().then((x) => x.info(m)); },
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

  // ---------- rem 自适应 ----------
  useEffect(() => {
    const DESIGN_WIDTH = 1920;
    const BASE_FONT = 16;
    const MIN_RATIO = 0.6;
    const MAX_RATIO = 1.4;
    let raf = 0;
    const apply = () => {
      const w = window.innerWidth;
      const ratio = Math.max(MIN_RATIO, Math.min(MAX_RATIO, w / DESIGN_WIDTH));
      document.documentElement.style.fontSize = `${BASE_FONT * ratio}px`;
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
      const targetPath: string | null = patchPage
        ? pageIdToPath(patchPage)
        : null;
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
    hydrated,
    token, user, login, logout,
    theme, toggleTheme,
    templates,
    agentOpen, setAgentOpen,
    agentContextState, setAgentContextState, agentContextRef,
    getCachedResult, setCachedResult,
    triggerRun, externalRunCounter, patchTick,
    applyPatchToWorkload, applyAgentPatch,
    toast,
  }), [
    hydrated,
    token, user, login, logout,
    theme, toggleTheme,
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
