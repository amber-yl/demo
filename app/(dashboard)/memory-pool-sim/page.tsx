"use client";

import WorkloadPageView from "@/components/WorkloadPageView";
import { SCENARIO_SCHEMAS } from "./schemas";

// 复用负载仿真页面（WorkloadPage）
// 场景 Schema 在 ./schemas 内定制（芯片抽屉字段覆盖为内存池专用配置，来源 demo.json）
export default function NgcInferenceSimPage() {
  return (
    <WorkloadPageView
      kind="inference"
      scenarioSchemas={SCENARIO_SCHEMAS}
    />
  );
}
