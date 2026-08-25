import { useCallback, useEffect, useState } from "react";
import type { WorkloadKind, SceneKind, SimResult } from "../types";

// ============= 主题切换 Hook =============
export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("simforge_theme");
    if (saved === "dark" || saved === "light") return saved;
    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
    return prefersLight ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("simforge_theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, setTheme, toggleTheme };
}

// ============= rem 自适应 Hook =============
export function useResponsiveRem() {
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
}

// ============= 侧栏折叠自动 + 手动 =============
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth <= 1024 : false,
  );
  const toggle = useCallback(() => setCollapsed((v) => !v), []);
  useEffect(() => {
    const COLLAPSE_BREAKPOINT = 1024;
    let raf = 0;
    let lastCollapseState: boolean | null = null;
    const apply = () => {
      const w = window.innerWidth;
      if (lastCollapseState === null) {
        const shouldCollapse = w <= COLLAPSE_BREAKPOINT;
        setCollapsed((prev) => (prev === shouldCollapse ? prev : shouldCollapse));
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
  return { collapsed, setCollapsed, toggle };
}

// ============= 结果缓存（App 级） =============
export function useResultCache() {
  const [resultCache, setResultCache] = useState<Record<string, SimResult>>({});
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
  return { resultCache, cacheKey, getCachedResult, setCachedResult };
}
