"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LoginPage from "./components/LoginPage";
import AppShell from "./layouts/AppShell";
import type {
  User,
  PageId,
  SimTemplate,
  WorkloadKind,
  SceneKind,
  SimResult,
  AgentContext,
} from "./types";
import { TOKEN_KEY, USER_KEY, BACKEND, headers } from "./utils";
import "./Page.module.less";

type ToastKind = "success" | "error" | "warning" | "info";
type ToastItem = { id: number; kind: ToastKind; msg: string };

export type ToastApi = {
  success: (m: string) => void;
  error: (m: string) => void;
  warning: (m: string) => void;
  info: (m: string) => void;
};

const ToastApiContext = React.createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = React.useContext(ToastApiContext);
  if (!api) throw new Error("useToast must be used within ToastProvider");
  return api;
}

// ============= Root =============
export default function App() {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null,
  );
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [page, setPage] = useState<PageId>("dashboard");
  const [agentOpen, setAgentOpen] = useState(true);
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
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(1);

  // Agent context：引用稳定的 state 对象（非 ref），避免 ref-in-render lint
  const [agentContextState, setAgentContextState] = useState<AgentContext>({
    workload: "inference",
    scene: "pd_separate",
    config_id: null,
  });
  const agentContextRef = useRef<AgentContext>(agentContextState);

  // ---------- toast api (inline context provider) ----------
  const pushToast = useCallback((kind: ToastKind, msg: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, kind, msg }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);
  const toastApi = useMemo<ToastApi>(
    () => ({
      success: (m) => pushToast("success", m),
      error: (m) => pushToast("error", m),
      warning: (m) => pushToast("warning", m),
      info: (m) => pushToast("info", m),
    }),
    [pushToast],
  );

  // ------- 主题 + localStorage -------
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("simforge_theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );
  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  // ------- rem 自适应 + 侧栏自动折叠 -------
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

  // ------- nav 事件监听 -------
  useEffect(() => {
    const onNav = (e: Event) => {
      const ce = e as CustomEvent<PageId>;
      setPage(ce.detail);
    };
    window.addEventListener("simforge:nav", onNav as EventListener);
    return () => window.removeEventListener("simforge:nav", onNav as EventListener);
  }, []);

  // ------- patch 事件监听（key bump）-------
  useEffect(() => {
    const onPatch = () => setPatchTick((c) => c + 1);
    window.addEventListener("simforge:patch", onPatch);
    return () => window.removeEventListener("simforge:patch", onPatch);
  }, []);

  // ------- agentContext：state <-> ref 双向同步 -------
  useEffect(() => {
    agentContextRef.current = agentContextState;
  }, [agentContextState]);

  // ------- 拉取配置模板 -------
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/api/configurations`, {
          headers: headers(token),
        });
        if (res.ok) {
          const data = (await res.json()) as SimTemplate[];
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
        }
      } catch {
        /* keep empty */
      }
    })();
  }, [token]);

  // ------- token 校验 -------
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/api/auth/me`, {
          headers: headers(token),
        });
        if (!res.ok) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
          toastApi.warning("登录态已失效，请重新登录");
        }
      } catch {
        /* offline: still allow */
      }
    })();
  }, [token, toastApi]);

  // ------- 结果缓存 helpers -------
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

  // ------- WorkloadPage 端 patch 回调：事件 + sessionStorage bridge -------
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

  // ------- Agent 端 patch 回调（跨页）-------
  const applyAgentPatch = useCallback(
    (raw: Record<string, unknown>) => {
      const patchPage = raw.__page as PageId | undefined;
      if (!patchPage && !page.startsWith("simulation/workload/")) {
        setPage("simulation/workload/inference");
      } else if (patchPage) {
        setPage(patchPage);
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
        // 写一份 state 让下面 effect 同步
        setAgentContextState((prev) => ({
          ...prev,
          scene: raw.scene as SceneKind,
        }));
      }
      setExternalRunCounter((c) => c + 1);
    },
    [page],
  );

  const logout = useCallback(async () => {
    try {
      await fetch(`${BACKEND}/api/auth/logout`, {
        method: "POST",
        headers: headers(token ?? ""),
      });
    } catch {
      /* ignore */
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    toastApi.info("已退出登录");
  }, [token, toastApi]);

  const triggerRun = useCallback(() => {
    setExternalRunCounter((c) => c + 1);
  }, []);

  // ------- 同步 agentContextState.page/kind 随当前页变化 -------
  useEffect(() => {
    if (page.startsWith("simulation/workload/")) {
      const k = page.split("/")[2] as WorkloadKind;
      queueMicrotask(() => {
        setAgentContextState((prev) =>
          prev.workload === k ? prev : { ...prev, workload: k },
        );
      });
    }
  }, [page]);

  return (
    <ToastApiContext.Provider value={toastApi}>
      {/* ===== 全局通知堆栈 ===== */}
      <ul className="sf-toast-stack" aria-label="global notifications">
        {toasts.map((t) => (
          <li key={t.id} className={`sf-toast sf-toast-${t.kind}`}>
            {t.msg}
          </li>
        ))}
      </ul>

      {!token || !user ? (
        <LoginPage
          onLogin={(t, u) => {
            setToken(t);
            setUser(u);
            toastApi.success(`欢迎回来，${u.name}`);
          }}
        />
      ) : (
        <AppShell
          user={user}
          page={page}
          setPage={setPage}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          onLogout={logout}
          theme={theme}
          onToggleTheme={toggleTheme}
          token={token}
          templates={templates}
          externalRunCounter={externalRunCounter}
          patchTick={patchTick}
          agentOpen={agentOpen}
          setAgentOpen={setAgentOpen}
          agentContextRef={agentContextRef}
          getCachedResult={getCachedResult}
          setCachedResult={setCachedResult}
          triggerRun={triggerRun}
          applyAgentPatch={applyAgentPatch}
          applyPatchToWorkload={applyPatchToWorkload}
          agentContextState={agentContextState}
          setAgentContextState={setAgentContextState}
        />
      )}
    </ToastApiContext.Provider>
  );
}
