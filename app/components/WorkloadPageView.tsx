"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context";
import type { WorkloadKind } from "@/types";
import type { ScenarioSchemas } from "@/utils/api";
import OriginalWorkloadPage from "@/pages/WorkloadPage";

/**
 * WorkloadPage 的通用复用视图：
 * 接收固定的 kind，从 useApp() 取所有依赖 props。
 * 供 /simulation/workload/[kind] 及 NGC 相关页面等路由复用。
 */
export default function WorkloadPageView({
  kind,
  scenarioSchemas,
}: {
  kind: WorkloadKind;
  /** 场景定制 Schema（模型/芯片抽屉覆盖），来自各路由的 schemas/index.ts */
  scenarioSchemas?: ScenarioSchemas | null;
}) {
  const app = useApp();

  const [mountTick, setMountTick] = useState(0);
  useEffect(() => {
    // kind 变化时触发组件 key bump，等同原 AppShell 的 key 机制
    queueMicrotask(() => setMountTick((c) => c + 1));
  }, [kind]);

  return (
    <OriginalWorkloadPage
      key={`${kind}-${app.patchTick}-${mountTick}`}
      kind={kind}
      token={app.token ?? ""}
      externalRun={app.externalRunCounter}
      templates={app.templates}
      agentContext={app.agentContextState}
      agentApplyPatch={app.applyPatchToWorkload}
      getCachedResult={app.getCachedResult}
      setCachedResult={app.setCachedResult}
      scenarioSchemas={scenarioSchemas}
    />
  );
}
