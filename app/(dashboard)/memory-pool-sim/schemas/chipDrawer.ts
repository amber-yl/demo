import type { ConfigSchema } from "@/utils/api";

/**
 * 内存池模拟仿真 · 芯片抽屉参数 Schema
 * 内容来源：demo.json（compute / compute_count / storage / storage_count / topology / protocol）
 *
 * 转换规则（demo.json → ConfigSchema）：
 *  - enum 数组：enum 原样，x-enum-label 同值（label = value）
 *  - enum 对象：enum = keys，x-enum-label = values
 *  - valueType: "Radio.Button" 保留在属性上，DrawerSchemaForm 据此渲染 Radio.Group
 *  - 每个 x-main-paths 字段补 default，供 initFlatDefaults 初始化
 */
export const MEMORY_POOL_CHIP_DRAWER_SCHEMA: ConfigSchema = {
  type: "object",
  properties: {
    compute: {
      type: "string",
      title: "计算节点",
      valueType: "Select",
      enum: [
        "昇腾910C 384超节点 (384✖️Ascend 910C, 64GB/卡)",
        "昇腾950 Pod (64✖️Ascend 950, 128GB/卡)",
        "昇腾950 Server (8✖️Ascend 950, 128GB/卡)",
      ],
      "x-enum-label": [
        "昇腾910C 384超节点 (384✖️Ascend 910C, 64GB/卡)",
        "昇腾950 Pod (64✖️Ascend 950, 128GB/卡)",
        "昇腾950 Server (8✖️Ascend 950, 128GB/卡)",
      ],
      default: "昇腾910C 384超节点 (384✖️Ascend 910C, 64GB/卡)",
    },
    compute_count: {
      type: "number",
      title: "数量(实例)",
      valueType: "InputNumber",
      minimum: 1,
      default: 1,
    },
    storage: {
      type: "string",
      title: "存储节点",
      valueType: "Select",
      enum: ["鲲鹏内存节点(16TB 800GB/s)", "SSU (1PB 120GB/s)"],
      "x-enum-label": ["鲲鹏内存节点(16TB 800GB/s)", "SSU (1PB 120GB/s)"],
      default: "鲲鹏内存节点(16TB 800GB/s)",
    },
    storage_count: {
      type: "number",
      title: "数量(实例)",
      valueType: "InputNumber",
      minimum: 1,
      default: 1,
    },
    topology: {
      type: "string",
      title: "拓扑",
      valueType: "Select",
      enum: ["flat-tree", "clos"],
      "x-enum-label": ["平拓扑", "层级拓扑"],
      default: "flat-tree",
    },
    protocol: {
      type: "string",
      title: "协议",
      valueType: "Radio.Button",
      enum: ["ub", "eth"],
      "x-enum-label": ["UB", "ECoE"],
      default: "ub",
    },
  },
  "x-main-paths": [
    "compute",
    "compute_count",
    "storage",
    "storage_count",
    "topology",
    "protocol",
  ],
};
