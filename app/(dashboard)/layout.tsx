"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import AppTopBar from "@/components/AppTopBar";
import type AgentPanelDefault from "@/components/AgentPanel";
import { AppProvider, useApp } from "@/context";
import styles from "@/layouts/AppShell.module.less";

// AgentPanel 含 antd Button + 多个 lucide 图标 + fetch 逻辑，体积较大。
// 首屏（尤其 Dashboard 全屏模式）并不需要它，按需加载可显著减小首屏 bundle。
const AgentPanel = dynamic<ComponentProps<typeof AgentPanelDefault>>(
  () => import("@/components/AgentPanel"),
  { ssr: false, loading: () => null },
);

function DashboardShell({ children }: { children: React.ReactNode }) {
  const {
    hydrated,
    user,
    token,
    logout,
    theme,
    toggleTheme,
    agentOpen,
    setAgentOpen,
    agentContextState,
    applyAgentPatch,
  } = useApp();

  const pathname = usePathname();
  const router = useRouter();

  // auth guard：等 hydrated 后（localStorage 恢复完）再检查，
  // 避免子组件 effect 先于父组件恢复状态就踢人导致登录跳转失败
  useEffect(() => {
    if (!hydrated) return;
    if (!token || !user) {
      router.replace("/login");
    }
  }, [hydrated, token, user, router]);

  // hydrated 前先渲染骨架（或空），不要在 hydrated 前就 return null
  if (!hydrated) {
    return <div className={styles.appShell} />;
  }

  if (!token || !user) {
    return null;
  }

  const isDashboard = pathname === "/dashboard";

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

  // 其他页面：topbar + 内容区
  return (
    <div className={styles.appShell}>
      <div className={styles.mainArea}>
        <AppTopBar
          user={user}
          onLogout={logout}
          currentPage={pageId as "dashboard"}
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AntdRegistry>
      <AppProvider>
        <DashboardShell>{children}</DashboardShell>
      </AppProvider>
    </AntdRegistry>
  );
}
