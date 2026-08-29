import type { ScenarioSchemas } from "@/utils/api";
import { MEMORY_POOL_CHIP_DRAWER_SCHEMA } from "./chipDrawer";

/**
 * 内存池模拟仿真 · 场景 Schema 入口
 * 各仿真场景的抽屉参数 Schema 放在各自路由的 schemas/ 文件夹内，
 * 按需覆盖 modelDrawer / chipDrawer；缺省字段回退后端 /api/schemas。
 */
export const SCENARIO_SCHEMAS: ScenarioSchemas = {
  chipDrawer: MEMORY_POOL_CHIP_DRAWER_SCHEMA,
};
