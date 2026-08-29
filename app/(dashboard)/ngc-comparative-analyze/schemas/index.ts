import type { ScenarioSchemas } from "@/utils/api";

/**
 * NGC 对比分析 · 场景 Schema 入口
 * 当前模型/芯片抽屉复用后端 /api/schemas 返回的通用 Schema；
 * 需要展示 NGC 对比专属参数时，在此覆盖 modelDrawer / chipDrawer
 * （字段与验证规则随 Schema 定义，参考 memory-pool-sim/schemas 的写法）。
 */
export const SCENARIO_SCHEMAS: ScenarioSchemas = {};
