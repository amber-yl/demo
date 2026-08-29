"use client";

import WorkloadPageView from "@/components/WorkloadPageView";
import { SCENARIO_SCHEMAS } from "./schemas";

// 复用负载仿真页面（WorkloadPage）
export default function NgcComputeMemoryAnalyzePage() {
  return <WorkloadPageView kind="training" scenarioSchemas={SCENARIO_SCHEMAS} />;
}
