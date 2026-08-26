import {
  Microscope,
  Zap,
  Activity,
  Network,
  Cpu,
  type LucideIcon,
} from "lucide-react";

/** 单条路由元数据 */
export type RouteMeta = {
  /** 路由路径，与 Next.js App Router 约定一致 */
  path: string;
  /** 菜单显示标题 */
  title: string;
  /** lucide 图标组件 */
  icon: LucideIcon;
  /** 可选副标题 */
  subtitle?: string;
  /** 可选分组 key，有 group 的路由会被归入同一侧边栏分组 */
  group?: string;
  /** 可选排序权重，数值越小越靠前（默认 100） */
  order?: number;
};

/** 父级路由组元数据 */
export type RouteGroup = {
  /** 分组 key，用于高亮判断 */
  key: string;
  /** 菜单显示标题 */
  title: string;
  /** lucide 图标组件 */
  icon: LucideIcon;
  /** 子路由列表 */
  children: RouteMeta[];
};

// ============= 动态路由元数据 =============
// [kind] 动态路由无法通过 meta.ts 自动发现，在此定义
const workloadChildren: RouteMeta[] = [
  { path: "/simulation/workload/inference", title: "推理服务", icon: Zap, subtitle: "Inference" },
  { path: "/simulation/workload/training", title: "模型训练", icon: Activity, subtitle: "Training" },
  { path: "/simulation/workload/general", title: "通用计算", icon: Cpu, subtitle: "General" },
  { path: "/simulation/workload/graph", title: "图神经网络", icon: Network, subtitle: "Graph" },
];

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

const discoveredRoutes = discoverRoutes();

// 将自动发现的路由按 group 字段分组
const groupMap = new Map<string, RouteMeta[]>();
const standaloneRoutes: RouteMeta[] = [];

for (const route of discoveredRoutes) {
  if (route.group) {
    if (!groupMap.has(route.group)) groupMap.set(route.group, []);
    groupMap.get(route.group)!.push(route);
  } else {
    standaloneRoutes.push(route);
  }
}

// 组配置：可扩展自定义组的标题和图标
const GROUP_CONFIG: Record<string, { title: string; icon: LucideIcon }> = {};

const discoveredGroups: RouteGroup[] = Array.from(groupMap.entries()).map(
  ([key, children]) => {
    const config = GROUP_CONFIG[key];
    return {
      key,
      title: config?.title ?? key,
      icon: config?.icon ?? children[0].icon,
      children: children.sort((a, b) => a.path.localeCompare(b.path)),
    };
  },
);

// ============= 导出 =============

export const ROUTE_GROUPS: RouteGroup[] = [
  {
    key: "simulation/workload",
    title: "负载建模仿真",
    icon: Microscope,
    children: workloadChildren,
  },
  ...discoveredGroups,
];

export const STANDALONE_ROUTES: RouteMeta[] = standaloneRoutes.sort(
  (a, b) => (a.order ?? 100) - (b.order ?? 100),
);

/** 根据 pathname 获取当前匹配的路由元数据 */
export function matchRoute(pathname: string): RouteMeta | null {
  for (const group of ROUTE_GROUPS) {
    for (const child of group.children) {
      if (pathname === child.path || pathname.startsWith(child.path + "/")) {
        return child;
      }
    }
  }
  for (const route of STANDALONE_ROUTES) {
    if (pathname === route.path || pathname.startsWith(route.path + "/")) {
      return route;
    }
  }
  return null;
}

/** 判断 pathname 是否属于某个分组 */
export function isPathInGroup(pathname: string, groupKey: string): boolean {
  return pathname.startsWith(`/${groupKey}`);
}

/** 判断路由是否激活 */
export function isRouteActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + "/");
}
