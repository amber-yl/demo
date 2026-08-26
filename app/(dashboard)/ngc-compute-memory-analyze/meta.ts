import { BarChart3 } from "lucide-react";
import type { RouteMeta } from "@/routes";

/**
 * 路由元数据 —— 侧边栏导航自动发现此文件
 * 约定：在 app/(dashboard)/<route>/ 下创建 meta.ts 即自动出现在侧边栏
 */
const meta: RouteMeta = {
  path: "/ngc-compute-memory-analyze",
  title: "NGC 计算-内存分析",
  icon: BarChart3,
  subtitle: "NGC Compute Memory Analyze",
  order: 4,
};

export default meta;
