import type { LucideIcon } from "lucide-react";

/** 单条路由元数据 */
export type RouteMeta = {
  /** 路由路径，与 Next.js App Router 约定一致 */
  path: string;
  /** 菜单显示标题 */
  title: string;
  /** lucide 图标组件 */
  icon: LucideIcon;
  /** 可选排序权重，数值越小越靠前（默认 100） */
  order?: number;
};

// ============= 自动发现静态路由 =============
// 扫描 app/(dashboard)/**/meta.ts，每个 meta.ts 导出 RouteMeta
function discoverRoutes(): RouteMeta[] {
  const metas: RouteMeta[] = [];
  try {
    const ctx = (require as any).context("./(dashboard)", true, /\/meta\.ts$/);
    for (const key of ctx.keys()) {
      const mod = ctx(key);
      const meta: RouteMeta = mod.default ?? mod;
      if (meta && meta.path) {
        metas.push(meta);
      }
    }
  } catch {
    // require.context 不可用（Turbopack 等环境），回退为空
  }
  return metas;
}

// ============= 导出 =============

export const STANDALONE_ROUTES: RouteMeta[] = discoverRoutes().sort(
  (a, b) => (a.order ?? 100) - (b.order ?? 100),
);
