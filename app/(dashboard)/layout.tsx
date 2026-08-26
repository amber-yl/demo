"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import AppSidebar from "@/components/AppSidebar";
import AppTopBar from "@/components/AppTopBar";
import AgentPanel from "@/components/AgentPanel";
import { useApp } from "@/context";
import type { WorkloadKind } from "@/types";
import styles from "@/layouts/AppShell.module.less";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    user,
    token,
    logout,
    theme,
    toggleTheme,
    sidebarCollapsed,
    toggleSidebar,
    agentOpen,
    setAgentOpen,
    agentContextState,
    setAgentContextState,
    applyAgentPatch,
    triggerRun,
  } = useApp();

  const pathname = usePathname();
  const router = useRouter();

  // auth guard：若未登录跳转登录页
  useEffect(() => {
    if (!token || !user) {
      router.replace("/login");
    }
  }, [token, user, router]);

  // 根据路径同步 agentContextState.workload
  useEffect(() => {
    if (pathname?.startsWith("/simulation/workload/")) {
      const k = pathname.split("/")[3] as WorkloadKind;
      queueMicrotask(() => {
        setAgentContextState((prev) =>
          prev.workload === k ? prev : { ...prev, workload: k },
        );
      });
    }
  }, [pathname, setAgentContextState]);

  if (!token || !user) {
    return null;
  }

  const isDashboard = pathname === "/dashboard";

  const kind: WorkloadKind | null =
    pathname?.startsWith("/simulation/workload/")
      ? (pathname.split("/")[3] as WorkloadKind)
      : null;

  const pageId =
    pathname === "/dashboard"
      ? "dashboard"
      : pathname?.startsWith("/")
        ? pathname.slice(1)
        : "dashboard";

  // Dashboard 页面：全屏无侧边栏
  if (isDashboard) {
    return (
      <div className={`${styles.appShell} ${styles.dashboardMode}`}>
        <div className={styles.mainArea}>
          <div className={styles.contentArea}>{children}</div>
        </div>
      </div>
    );
  }

  // 其他页面：带侧边栏 + topbar
  return (
    <div className={styles.appShell}>
      <AppSidebar
        user={user}
        onLogout={logout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        theme={theme}
      />
      <div className={styles.mainArea}>
        <AppTopBar
          currentPage={pageId as "dashboard"}
          onRunSim={kind ? triggerRun : undefined}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <div className={styles.contentArea}>{children}</div>
      </div>
      <AgentPanel
        token={token}
        open={agentOpen}
        onClose={() => setAgentOpen(!agentOpen)}
        context={agentContextState}
        applyPatch={applyAgentPatch}
        user={user}
        onApplyPrompt={() => { }}
      />
    </div>
  );
}
