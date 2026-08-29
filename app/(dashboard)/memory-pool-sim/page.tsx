"use client";

import WorkloadPageView from "@/components/WorkloadPageView";
import { MEMORY_POOL_CHIP_DRAWER_SCHEMA } from "./chipDrawerSchema";

// 复用负载仿真页面（WorkloadPage）
// 芯片抽屉字段覆盖为内存池页专用配置（compute/storage/topology/protocol，来源 demo.json）
export default function NgcInferenceSimPage() {
  return (
    <WorkloadPageView
      kind="inference"
      chipDrawerSchema={MEMORY_POOL_CHIP_DRAWER_SCHEMA}
    />
  );
}
