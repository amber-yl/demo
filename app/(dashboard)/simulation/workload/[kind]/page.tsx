"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/context";
import type { WorkloadKind } from "@/types";
import OriginalWorkloadPage from "@/pages/WorkloadPage";

const VALID_KINDS: WorkloadKind[] = ["inference", "training", "general", "graph"];

// 包装原始 WorkloadPage：从 URL params 取 kind，从 useApp() 取所有 props
function WorkloadPageWrapper() {
  const params = useParams();
  const app = useApp();

  const kindRaw = Array.isArray(params?.kind) ? params.kind[0] : (params?.kind as string);
  const kind: WorkloadKind =
    VALID_KINDS.includes(kindRaw as WorkloadKind)
      ? (kindRaw as WorkloadKind)
      : "inference";

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
    />
  );
}

export default function SimulationWorkloadKindPage() {
  return <WorkloadPageWrapper />;
}
