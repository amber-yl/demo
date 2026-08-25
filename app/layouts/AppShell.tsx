"use client";

import AppSidebar from "../components/AppSidebar";
import AppTopBar from "../components/AppTopBar";
import DashboardPage from "../pages/DashboardPage";
import WorkloadPage from "../pages/WorkloadPage";
import AgentPanel from "../components/AgentPanel";
import type {
  PageId,
  User,
  SimTemplate,
  WorkloadKind,
  SimResult,
  SceneKind,
  AgentContext,
} from "../types";
import styles from "./AppShell.module.less";

type Props = {
  user: User;
  page: PageId;
  setPage: (p: PageId) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  token: string;
  templates: SimTemplate[];
  externalRunCounter: number;
  patchTick: number;
  agentOpen: boolean;
  setAgentOpen: (v: boolean) => void;
  agentContextRef: React.MutableRefObject<AgentContext>;
  agentContextState: AgentContext;
  setAgentContextState: React.Dispatch<React.SetStateAction<AgentContext>>;
  getCachedResult: (kind: WorkloadKind, scene: SceneKind) => SimResult | null;
  setCachedResult: (kind: WorkloadKind, scene: SceneKind, result: SimResult) => void;
  triggerRun: () => void;
  applyAgentPatch: (patch: Record<string, unknown>) => void;
  applyPatchToWorkload: (patch: Record<string, unknown>) => void;
};

export default function AppShell(p: Props) {
  const {
    user,
    page,
    setPage,
    sidebarCollapsed,
    onToggleSidebar,
    onLogout,
    theme,
    onToggleTheme,
    token,
    templates,
    externalRunCounter,
    patchTick,
    agentOpen,
    setAgentOpen,
    agentContextState,
    getCachedResult,
    setCachedResult,
    triggerRun,
    applyAgentPatch,
    applyPatchToWorkload,
  } = p;

  const kind = page.startsWith("simulation/workload")
    ? (page.split("/")[2] as WorkloadKind)
    : null;

  return (
    <div className={styles.appShell}>
      <AppSidebar
        user={user}
        currentPage={page}
        onNavigate={setPage}
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
        theme={theme}
      />
      <div className={styles.mainArea}>
        <AppTopBar
          currentPage={page}
          onRunSim={kind ? triggerRun : undefined}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
        <div className={styles.contentArea}>
          {page === "dashboard" && <DashboardPage onNavigate={setPage} />}
          {kind && (
            <WorkloadPage
              key={`${kind}-${patchTick}`}
              kind={kind}
              token={token}
              externalRun={externalRunCounter}
              templates={templates}
              agentContext={agentContextState}
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
        onClose={() => setAgentOpen(!agentOpen)}
        context={agentContextState}
        applyPatch={applyAgentPatch}
        user={user}
        onApplyPrompt={() => { }}
      />
    </div>
  );
}
