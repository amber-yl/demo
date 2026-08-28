"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PlayCircle,
  Gauge,
  Server,
  Cpu,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  Save,
  RotateCcw,
} from "lucide-react";
import { Drawer, InputNumber, Select, message } from "antd";
import ResultPanel from "@/components/ResultPanel";
import {
  SchemaCardGrid,
  SchemaParamRow,
  FieldRow,
  FieldGrid,
  typeKeyOf,
  getByPath,
  setByPath,
  initValuesFromSchema,
  validateSchemaFields,
} from "@/components/SchemaFormFields";
import type { FieldErrors } from "@/components/SchemaFormFields";
import type {
  WorkloadKind,
  SceneKind,
  SimTemplate,
  AgentContext,
  SimResult,
} from "@/types";
import {
  WORKLOAD_LABEL,
  SCENE_LABEL,
} from "@/utils";
import { api } from "@/utils/api";
import type {
  OptionsData,
  ConfigSchema,
  SchemasData,
} from "@/utils/api";
import styles from "./WorkloadPage.module.less";

/** 配置表单参数栅格列数（2 = 一行两列，每列「label + 输入框」） */
const FORM_COLUMNS = 2;

export type WorkloadConfig = {
  scene: SceneKind;
  strategy: string;
  requestRate: number;
  batchSize: number;
  concurrency: number;
  qosLatency: number;
  gpuType: string;
  gpuMemory: number;
  gpuCount: number;
  vllm: boolean;
  paged: boolean;
  chunkPrefill: boolean;
  memFraction: number;
  cpuCore: number;
  cpuMemory: number;
  replicas: number;
  kvCacheRatio: number;
  precision: string;
  quant: string;
  quantizationBitwidth: string;
  quantW8A8: boolean;
  quantW4A16: boolean;
  useLora: boolean;
  maxModelLen: number;
  parallelLevel: string;
};

export const WORKLOAD_KIND_ORDER: WorkloadKind[] = [
  "inference",
  "training",
];

const CONFIG_WHITELIST: (keyof WorkloadConfig)[] = [
  "scene",
  "strategy",
  "requestRate",
  "batchSize",
  "concurrency",
  "qosLatency",
  "gpuType",
  "gpuMemory",
  "gpuCount",
  "vllm",
  "paged",
  "chunkPrefill",
  "memFraction",
  "cpuCore",
  "cpuMemory",
  "replicas",
  "kvCacheRatio",
  "precision",
  "quant",
  "quantizationBitwidth",
  "quantW8A8",
  "quantW4A16",
  "useLora",
  "maxModelLen",
  "parallelLevel",
];

function serialize(config: WorkloadConfig): Record<string, unknown> {
  return { ...config };
}

// ============= 配置驱动的表单字段定义 =============

type FieldDef = {
  key: keyof WorkloadConfig;
  label: string;
  kind: "number" | "select";
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  /** select 类型的选项来源（options 中的 key） */
  optionsKey?: "gpu_types" | "precisions" | "quants" | "bitwidths" | "parallel_levels";
  /** 选项 label 格式化 */
  optionFormat?: (v: string) => string;
  /** 数字输入框单位后缀 */
  unit?: string;
};

const SERVICE_FIELDS: FieldDef[] = [
  { key: "requestRate", label: "请求速率", kind: "number", min: 0, unit: "req/s" },
  { key: "batchSize", label: "Batch Size", kind: "number", min: 1, max: 256, precision: 0 },
  { key: "concurrency", label: "并发数", kind: "number", min: 1, max: 256, precision: 0 },
  { key: "qosLatency", label: "QoS 延迟", kind: "number", min: 0, unit: "ms" },
];

const CHIP_FIELDS: FieldDef[] = [
  { key: "gpuType", label: "GPU 类型", kind: "select", optionsKey: "gpu_types" },
  { key: "gpuMemory", label: "GPU 显存", kind: "number", min: 0, unit: "GB" },
  { key: "gpuCount", label: "GPU 数量", kind: "number", min: 1, precision: 0 },
  { key: "precision", label: "精度", kind: "select", optionsKey: "precisions" },
  { key: "quant", label: "量化方式", kind: "select", optionsKey: "quants" },
  {
    key: "quantizationBitwidth",
    label: "量化位宽",
    kind: "select",
    optionsKey: "bitwidths",
    optionFormat: (b) => `${b}-bit`,
  },
  { key: "maxModelLen", label: "最大序列长度", kind: "number", min: 0, precision: 0 },
  { key: "memFraction", label: "显存占用比例", kind: "number", min: 0, max: 1, step: 0.01 },
];

const RUNTIME_FIELDS: FieldDef[] = [
  { key: "cpuCore", label: "CPU 核数", kind: "number", min: 1, precision: 0 },
  { key: "cpuMemory", label: "CPU 内存", kind: "number", min: 1, unit: "GB" },
  { key: "replicas", label: "副本数", kind: "number", min: 1, precision: 0 },
  { key: "kvCacheRatio", label: "KV Cache 比例", kind: "number", min: 0, max: 1, step: 0.01 },
  { key: "parallelLevel", label: "并行策略", kind: "select", optionsKey: "parallel_levels" },
];

function mockSimResult(kind: WorkloadKind, scene: SceneKind): SimResult {
  const baseScale: Record<
    WorkloadKind,
    { tps: number; p50: number; mfu: number }
  > = {
    inference: { tps: 8200, p50: 28, mfu: 0.52 },
    training: { tps: 320, p50: 350, mfu: 0.46 },
  };
  const base = baseScale[kind];
  const pdSepBoost = scene === "pd_separate" ? 1.08 : 0.94;
  const gpuCount = 8;
  const effGpu = gpuCount * 0.85;
  const throughput = Math.round(base.tps * effGpu * pdSepBoost);
  const latencyP50 = Math.round(base.p50 / pdSepBoost);
  const latencyP99 = Math.round(latencyP50 * 2.4);
  const vramPerGpu =
    kind === "training" ? 74.3 : kind === "inference" ? 58.6 : 40.1;
  const power = 420 + Math.min(80, gpuCount * 2);
  const util = Math.round(
    (0.72 + 0.15 * base.mfu + 0.05 * Math.min(1, gpuCount / 64)) * 100,
  );
  const mfu = Math.round(base.mfu * (scene === "pd_fused" ? 1.05 : 0.98) * 100);
  const tflops = Math.round((mfu / 100) * gpuCount * 312);
  const n = 12;
  const xs = Array.from({ length: n }, (_, i) =>
    `${String(i + 1).padStart(2, "0")}:00`,
  );
  const jitter = (seed: number) =>
    Array.from(
      { length: n },
      (_, i) => 0.85 + 0.3 * Math.sin((i + seed) / 1.7 + kind.length) ** 2,
    );
  const j1 = jitter(1);
  const j2 = jitter(7);
  const j3 = jitter(13);
  const j4 = jitter(19);
  const charts = {
    xs,
    throughput: j1.map((j) => Math.round(throughput * j)),
    latency_p99: j2.map((j) => Math.round(latencyP99 * (2.1 - j))),
    gpu_util: j3.map((j) => Math.min(99, Math.round(util * (0.9 + 0.18 * j)))),
    vram: j4.map((j) => +(vramPerGpu * (0.94 + 0.1 * j)).toFixed(1)),
    power: j1.map((j) => Math.round(power * (0.9 + 0.15 * j))),
  };
  const stages = [
    { name: "输入处理", pct: 14, ms: Math.round(latencyP50 * 0.14) },
    { name: "KV 缓存加载", pct: 18, ms: Math.round(latencyP50 * 0.18) },
    {
      name: kind === "training" ? "前向计算" : "注意力计算",
      pct: 32,
      ms: Math.round(latencyP50 * 0.32),
    },
    {
      name: kind === "training" ? "反向传播" : "MLP 计算",
      pct: 22,
      ms: Math.round(latencyP50 * 0.22),
    },
    { name: "输出调度", pct: 14, ms: Math.round(latencyP50 * 0.14) },
  ];
  const mockLogs: { time: string; level: string; msg: string }[] = [
    {
      time: "OFFLINE",
      level: "INFO",
      msg: `[离线 Mock] 已生成 ${WORKLOAD_LABEL[kind]} · ${SCENE_LABEL[scene]} 仿真结果`,
    },
    {
      time: "OFFLINE",
      level: "WARN",
      msg: `当前未连接后端服务，展示为前端本地估算结果；如需真实数据请启动后端服务。`,
    },
  ];
  const recommendation =
    scene === "pd_separate"
      ? `基于 PD 分离场景分析：当前作业 MFU=${mfu}%，建议尝试提升并行数或启用 PD 融合以降低 AllReduce 压力。`
      : `基于 PD 融合场景分析：GPU 利用率 ${util}% 处于合理区间，建议关注量化精度，如延迟敏感可切换至 INT4/INT8 量化版本。`;
  return {
    id: `mock-${Date.now()}`,
    status: "completed",
    created_at: new Date().toISOString(),
    config: {
      workload: kind,
      scene,
      model: {},
      system: {},
      runtime: {},
    },
    metrics: {
      throughput_tokens_s: throughput,
      throughput_flops_tf:
        kind === "training" ? tflops : null,
      latency_p50_ms: latencyP50,
      latency_p99_ms: latencyP99,
      vram_gb_per_gpu: +vramPerGpu.toFixed(1),
      power_w_per_gpu: power,
      gpu_utilization: util,
      mfu,
    },
    charts,
    stages,
    logs: mockLogs,
    recommendation,
  };
}

type Props = {
  kind: WorkloadKind;
  token: string;
  externalRun: number;
  templates: SimTemplate[];
  agentContext: AgentContext;
  agentApplyPatch: (patch: Record<string, unknown>) => void;
  getCachedResult: (kind: WorkloadKind, scene: SceneKind) => SimResult | null;
  setCachedResult: (kind: WorkloadKind, scene: SceneKind, result: SimResult) => void;
  key?: string | number;
};


export default function WorkloadPage({
  kind,
  token,
  externalRun,
  templates,
  agentContext,
  agentApplyPatch,
  getCachedResult,
  setCachedResult,
}: Props) {
  const [options, setOptions] = useState<OptionsData | null>(null);
  const [workloadDefaults, setWorkloadDefaults] = useState<Record<WorkloadKind, WorkloadConfig> | null>(null);
  const [config, setConfig] = useState<WorkloadConfig | null>(null);
  const [runState, setRunState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<Array<{ t: number; lvl: string; msg: string }>>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [schemas, setSchemas] = useState<SchemasData>({ model: null, chip: null });
  // 模型/芯片配置值集合（由 JSON Schema 驱动，随类型下拉切换）
  const [modelValues, setModelValues] = useState<Record<string, unknown>>({});
  const [chipValues, setChipValues] = useState<Record<string, unknown>>({});

  // 自研表单校验错误（key: "config.<field>" / "model.<path>" / "chip.<path>"）
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // 模型/芯片参数抽屉（选中对应卡片后展示）
  const [modelDrawerOpen, setModelDrawerOpen] = useState(false);
  const [chipDrawerOpen, setChipDrawerOpen] = useState(false);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(true);
  const [gpuOpen, setGpuOpen] = useState(true);
  const [resourceOpen, setResourceOpen] = useState(true);

  const agentContextRef = useRef(agentContext);
  const runButtonRef = useRef<() => void>(() => { });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<() => Promise<void>>(async () => { });

  // 获取表单选项、默认配置和配置 Schema
  useEffect(() => {
    (async () => {
      try {
        const [opts, defs, sch] = await Promise.all([
          api.getOptions(),
          api.getDefaults(),
          api.getSchemas(),
        ]);
        setOptions(opts);
        const wd = defs.workload_defaults as Record<WorkloadKind, WorkloadConfig>;
        setWorkloadDefaults(wd);
        setSchemas(sch);
        setModelValues(initValuesFromSchema(sch.model));
        setChipValues(initValuesFromSchema(sch.chip));
      } catch {
        /* keep null state */
      }
    })();
  }, []);

  // applyDefaults：基于从 API 获取的默认值和 GPU 显存映射
  const applyDefaults = useCallback(
    (k: WorkloadKind, cfg?: Partial<WorkloadConfig>): WorkloadConfig => {
      const base = workloadDefaults?.[k];
      if (!base) return cfg as WorkloadConfig;
      if (!cfg) return { ...base };
      const merged: WorkloadConfig = { ...base, ...cfg } as WorkloadConfig;
      if (merged.vllm) {
        merged.paged = merged.paged ?? true;
        merged.chunkPrefill = merged.chunkPrefill ?? true;
      }
      const memMap = options?.gpu_memory_map ?? {};
      if (memMap[merged.gpuType]) {
        merged.gpuMemory = memMap[merged.gpuType];
      }
      return merged;
    },
    [workloadDefaults, options],
  );

  // 当 defaults 加载完成或 kind 变化时，初始化 config
  useEffect(() => {
    if (workloadDefaults) {
      queueMicrotask(() => {
        setConfig(applyDefaults(kind, workloadDefaults[kind]));
      });
    }
  }, [kind, workloadDefaults, applyDefaults]);

  useEffect(() => {
    agentContextRef.current = agentContext;
  }, [agentContext]);

  const runSimulation = useCallback(async () => {
    if (runState === "running" || !config) return;
    // 运行前按 JSON Schema 规则 + 字段定义校验全部参数
    const errs: FieldErrors = {};
    if (schemas.model) {
      for (const [k, v] of Object.entries(validateSchemaFields(schemas.model, modelValues))) {
        errs[`model.${k}`] = v;
      }
    }
    if (schemas.chip) {
      for (const [k, v] of Object.entries(validateSchemaFields(schemas.chip, chipValues))) {
        errs[`chip.${k}`] = v;
      }
    }
    for (const f of [...SERVICE_FIELDS, ...CHIP_FIELDS, ...RUNTIME_FIELDS]) {
      const v = config[f.key] as unknown;
      if (v === undefined || v === null || v === "") {
        errs[`config.${f.key}`] = `${f.label}为必填项`;
        continue;
      }
      if (f.kind === "number") {
        const num = Number(v);
        if (Number.isNaN(num)) errs[`config.${f.key}`] = `${f.label}必须为数字`;
        else if (f.min !== undefined && num < f.min) errs[`config.${f.key}`] = `${f.label}不能小于 ${f.min}`;
        else if (f.max !== undefined && num > f.max) errs[`config.${f.key}`] = `${f.label}不能大于 ${f.max}`;
      }
    }
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      setErrMsg("存在未通过校验的参数，请修正后再运行仿真");
      return;
    }
    const templateId =
      templates.find((t) => t.workload === kind)?.id ?? `tpl-${kind}`;
    setProgress(0);
    setLogs([]);
    setErrMsg(null);
    setRunState("running");
    setProgress(5);

    try {
      const result = await api.runSimulation(token, {
        kind,
        scene: config.scene,
        config: {
          ...serialize(config),
          model: { ...modelValues },
          chip: { ...chipValues },
        },
        templateId,
      });

      let p = 5;
      const progressTimer = setInterval(() => {
        p = Math.min(p + 5, 90);
        setProgress(p);
        setLogs((prev) => [
          ...prev,
          {
            t: Date.now(),
            lvl: "INFO",
            msg: `仿真进度 ${p}%...`,
          },
        ]);
      }, 80);

      await new Promise((r) => setTimeout(r, 640));
      clearInterval(progressTimer);

      setCachedResult(kind, config.scene, result);
      setRunState("success");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "仿真运行失败，已切换到离线演示模式";
      setErrMsg(msg);
      setRunState("error");
      const fallback = mockSimResult(kind, config.scene);
      setCachedResult(kind, config.scene, fallback);
      setRunState("success");
    } finally {
      setProgress(100);
    }
  }, [kind, config, token, templates, setCachedResult, runState, modelValues, chipValues, schemas]);

  useEffect(() => {
    simulationRef.current = runSimulation;
    runButtonRef.current = runSimulation;
  }, [runSimulation]);

  // 2. 监听 simforge:patch CustomEvent + agentApplyPatch，用 setTimeout+queueMicrotask 包装
  useEffect(() => {
    const applyPatch = (patch: Record<string, unknown>) => {
      const filtered: Partial<WorkloadConfig> = {};
      for (const k of CONFIG_WHITELIST) {
        if (k in patch) {
          (filtered as Record<string, unknown>)[k] = patch[k];
        }
      }
      if (Object.keys(filtered).length > 0) {
        setConfig((prev) => (prev ? { ...prev, ...filtered } : prev));
      }
    };

    const onPatch = (e: Event) => {
      const ce = e as CustomEvent<Record<string, unknown>>;
      const raw = ce.detail ?? {};
      setTimeout(() => {
        queueMicrotask(() => {
          applyPatch(raw);
          agentApplyPatch(raw);
        });
      }, 0);
    };

    window.addEventListener("simforge:patch", onPatch as EventListener);
    return () => window.removeEventListener("simforge:patch", onPatch as EventListener);
  }, [agentApplyPatch]);

  // 3. externalRun 外部触发
  useEffect(() => {
    if (externalRun > 0) simulationRef.current();
  }, [externalRun]);

  // 4. 更新 agentContext：setInterval 防抖同步
  useEffect(() => {
    const matchingTemplate = templates.find((t) => t.workload === kind);
    const update = () => {
      agentContextRef.current.workload = kind;
      agentContextRef.current.scene = config?.scene ?? "pd_separate";
      agentContextRef.current.config_id = matchingTemplate?.id ?? null;
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [kind, config, templates, agentContext]);

  // 5. 写入 simforge:nav CustomEvent，PageId = simulation/workload/${kind}
  useEffect(() => {
    const ev = new CustomEvent("simforge:nav", {
      detail: `simulation/workload/${kind}`,
    });
    window.dispatchEvent(ev);
  }, [kind]);

  // 6. config 关键字段变化 → applyDefaults 联动
  useEffect(() => {
    if (config) {
      queueMicrotask(() => {
        setConfig((c) => (c ? applyDefaults(kind, c) : c));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.scene, config?.strategy, config?.vllm, config?.gpuType, config?.precision, kind]);

  // ---------- Schema 驱动的模型/芯片配置 ----------

  /** 清除单个字段错误 */
  const clearFieldError = (key: string) => {
    setFieldErrors((prev) =>
      prev[key] ? { ...prev, [key]: undefined } : prev,
    );
  };

  /** 清除某前缀下的全部字段错误（如类型切换后） */
  const clearFieldErrorPrefix = (prefix: string) => {
    setFieldErrors((prev) => {
      const next: FieldErrors = {};
      let changed = false;
      for (const [k, v] of Object.entries(prev)) {
        if (k.startsWith(prefix)) changed = true;
        else if (v) next[k] = v;
      }
      return changed ? next : prev;
    });
  };

  /** 定位 schema 中类型选择属性对应的 variant 值集合 */
  const schemaVariantFor = (
    schema: ConfigSchema | null,
    typeValue: string,
  ): { typeKey: string; variant: Record<string, unknown> } | null => {
    const key = typeKeyOf(schema);
    if (!schema || !key) return null;
    const prop = schema.properties[key];
    const idx = prop?.enum?.indexOf(typeValue) ?? -1;
    if (idx < 0) return null;
    const variant = prop?.["x-variants"]?.[idx];
    return variant ? { typeKey: key, variant } : null;
  };

  /** 切换模型类型：用对应 variant 填充参数，并同步 precision / maxModelLen */
  const applyModelVariant = (type: string) => {
    const found = schemaVariantFor(schemas.model, type);
    const typeKey = found?.typeKey ?? "model_type";
    setModelValues((prev) => ({
      ...prev,
      [typeKey]: type,
      ...(found?.variant ?? {}),
    }));
    const v = found?.variant ?? {};
    clearFieldErrorPrefix("model.");
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      if (typeof v.precision === "string") next.precision = v.precision as string;
      if (typeof v.context_length === "number") next.maxModelLen = v.context_length as number;
      return next;
    });
  };

  /** 编辑模型参数（precision / context_length 与主表单字段联动） */
  const setModelValue = (path: string, value: unknown) => {
    setModelValues((prev) => ({ ...prev, [path]: value }));
    clearFieldError(`model.${path}`);
    if (path === "precision") {
      setConfig((prev) => (prev ? { ...prev, precision: value as string } : prev));
    } else if (path === "context_length") {
      setConfig((prev) => (prev ? { ...prev, maxModelLen: Number(value) || 0 } : prev));
    }
  };

  /** 选择模型卡片：应用 variant 并打开右侧参数抽屉 */
  const handleModelSelect = (type: string) => {
    applyModelVariant(type);
    setModelDrawerOpen(true);
  };

  /** 编辑芯片参数（路径可能嵌套，如 matrix_compute.fp16_tflops） */
  const setChipValue = (path: string, value: unknown) => {
    setChipValues((prev) => setByPath(prev, path, value));
    clearFieldError(`chip.${path}`);
  };

  /** 选择芯片卡片：应用 variant 并打开右侧参数抽屉 */
  const handleChipSelect = (type: string) => {
    applyChipVariant(type);
    setChipDrawerOpen(true);
  };

  /** 切换芯片类型：用对应 variant 填充芯片参数，并与 GPU 类型字段联动 */
  const applyChipVariant = (type: string) => {
    const found = schemaVariantFor(schemas.chip, type);
    const typeKey = found?.typeKey ?? "chip_type";
    setChipValues((prev) => ({
      ...prev,
      [typeKey]: type,
      ...(found?.variant ?? {}),
    }));
    clearFieldErrorPrefix("chip.");
    setConfig((prev) => (prev ? { ...prev, gpuType: type } : prev));
  };

  /** 编辑主表单配置字段；GPU 类型变化时联动芯片参数 */
  const setConfigField = (key: keyof WorkloadConfig, value: unknown) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
    clearFieldError(`config.${key}`);
    if (key === "gpuType" && typeof value === "string") {
      const chipTypeKey = typeKeyOf(schemas.chip);
      if (chipTypeKey && chipValues[chipTypeKey] !== value) {
        applyChipVariant(value);
      }
    }
  };

  /** 渲染配置驱动的主表单字段行 */
  const renderConfigField = (f: FieldDef) => {
    if (!config) return null;
    const value = config[f.key] as unknown;
    const err = fieldErrors[`config.${f.key}`];
    return (
      <FieldRow key={f.key} label={f.label} required error={err}>
        {f.kind === "select" ? (
          <Select
            value={value === undefined || value === null ? undefined : (value as string)}
            options={(options?.[f.optionsKey!] ?? []).map(
              (o: string) => ({ value: o, label: f.optionFormat ? f.optionFormat(o) : o }),
            )}
            onChange={(v) => setConfigField(f.key, v)}
            style={{ width: "100%" }}
          />
        ) : (
          <InputNumber
            value={value === undefined || value === null ? undefined : (value as number)}
            min={f.min}
            max={f.max}
            step={f.step}
            precision={f.precision}
            suffix={f.unit}
            controls={false}
            style={{ width: "100%" }}
            onChange={(v) => setConfigField(f.key, v)}
          />
        )}
      </FieldRow>
    );
  };

  // 模板/Agent 补丁等外部修改 config 时，同步回模型参数展示
  useEffect(() => {
    if (!config) return;
    queueMicrotask(() => {
      setModelValues((prev) =>
        prev.precision === config.precision && prev.context_length === config.maxModelLen
          ? prev
          : { ...prev, precision: config.precision, context_length: config.maxModelLen },
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.precision, config?.maxModelLen]);

  // 其他：dropdown 外部点击关闭（非指定 6 个 useEffect）
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
  }, [dropdownOpen]);

  const cachedResult = useMemo(
    () => (config ? getCachedResult(kind, config.scene) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, config?.scene, getCachedResult],
  );

  const applyTemplateConfig = (tpl: SimTemplate) => {
    const patch: Partial<WorkloadConfig> = {
      scene: tpl.scene,
    };
    const mapKey = (k: string): keyof WorkloadConfig | null => {
      const alias: Record<string, keyof WorkloadConfig> = {
        model_name: "strategy",
        param_size: "strategy",
        precision: "precision",
        context_length: "maxModelLen",
        gpu_model: "gpuType",
        gpu_count: "gpuCount",
        parallel: "parallelLevel",
        batch_size: "batchSize",
        concurrency: "concurrency",
      };
      return alias[k] ?? null;
    };
    for (const [k, v] of Object.entries(tpl.model)) {
      const mapped = mapKey(k);
      if (mapped) (patch as Record<string, unknown>)[mapped] = v;
    }
    for (const [k, v] of Object.entries(tpl.system)) {
      const mapped = mapKey(k);
      if (mapped) (patch as Record<string, unknown>)[mapped] = v;
    }
    for (const [k, v] of Object.entries(tpl.runtime)) {
      const mapped = mapKey(k);
      if (mapped) (patch as Record<string, unknown>)[mapped] = v;
    }
    // 模板指定了模型时，同步模型类型下拉及其参数
    if (typeof tpl.model?.model_name === "string") {
      applyModelVariant(tpl.model.model_name);
    }
    setConfig((prev) => (prev ? applyDefaults(kind, { ...prev, ...patch }) : prev));
    setDropdownOpen(false);
  };

  const lastLog = logs[logs.length - 1];

  // ---------- 抽屉底部操作：保存模板 / 重置 ----------

  /** 保存模型参数为本地自定义模板（localStorage） */
  const handleSaveModelTemplate = useCallback(() => {
    try {
      const typeKey = typeKeyOf(schemas.model);
      const typeValue = typeKey ? String(modelValues[typeKey] ?? "") : "";
      const payload = { kind, type: typeValue, values: { ...modelValues }, savedAt: Date.now() };
      const key = `simforge:custom-templates:${kind}:model`;
      const list = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
      list.push(payload);
      localStorage.setItem(key, JSON.stringify(list));
      message.success(typeValue ? `已保存「${typeValue}」模型参数为本地模板` : "已保存当前模型参数为本地模板");
    } catch {
      message.error("保存失败：浏览器存储不可用");
    }
  }, [kind, modelValues, schemas.model]);

  /** 重置模型参数为 schema 初始值（首个 variant），并联动主表单 precision / maxModelLen */
  const handleResetModelValues = useCallback(() => {
    const init = initValuesFromSchema(schemas.model);
    setModelValues(init);
    clearFieldErrorPrefix("model.");
    const typeKey = typeKeyOf(schemas.model);
    const variant = schemas.model?.properties[typeKey ?? ""]?.["x-variants"]?.[0] ?? {};
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      if (typeof variant.precision === "string") next.precision = variant.precision as string;
      if (typeof variant.context_length === "number") next.maxModelLen = variant.context_length as number;
      return next;
    });
    message.info("已重置模型参数为默认值");
  }, [schemas.model, clearFieldErrorPrefix]);

  /** 保存芯片参数为本地自定义模板（localStorage） */
  const handleSaveChipTemplate = useCallback(() => {
    try {
      const typeKey = typeKeyOf(schemas.chip);
      const typeValue = typeKey ? String(chipValues[typeKey] ?? "") : "";
      const payload = { kind, type: typeValue, values: { ...chipValues }, savedAt: Date.now() };
      const key = `simforge:custom-templates:${kind}:chip`;
      const list = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
      list.push(payload);
      localStorage.setItem(key, JSON.stringify(list));
      message.success(typeValue ? `已保存「${typeValue}」芯片参数为本地模板` : "已保存当前芯片参数为本地模板");
    } catch {
      message.error("保存失败：浏览器存储不可用");
    }
  }, [kind, chipValues, schemas.chip]);

  /** 重置芯片参数为 schema 初始值（首个 variant），并联动主表单 gpuType */
  const handleResetChipValues = useCallback(() => {
    const init = initValuesFromSchema(schemas.chip);
    setChipValues(init);
    clearFieldErrorPrefix("chip.");
    const typeKey = typeKeyOf(schemas.chip);
    const firstType = schemas.chip?.properties[typeKey ?? ""]?.enum?.[0];
    if (firstType && typeof firstType === "string") {
      setConfig((prev) => (prev ? { ...prev, gpuType: firstType } : prev));
    }
    message.info("已重置芯片参数为默认值");
  }, [schemas.chip, clearFieldErrorPrefix]);

  if (!config) return <div className={styles.page}>加载中...</div>;

  const modelTypeKey = typeKeyOf(schemas.model);
  const chipTypeKey = typeKeyOf(schemas.chip);

  return (
    <div className={styles.page}>
      {errMsg && (
        <div className={styles.globalError} role="alert">
          <div className={styles.globalErrorIcon}>
            <AlertTriangle size={16} />
          </div>
          <span className={styles.globalErrorText}>{errMsg}</span>
          <button
            type="button"
            className={styles.globalErrorClose}
            onClick={() => setErrMsg(null)}
            aria-label="关闭错误"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className={styles.mainGrid}>
        <div className={`${styles.card} ${styles.configCard}`}>
          <div className={styles.scrollBody}>

            <details
              className={`${styles.details} ${styles.fixedDetails}`}
              open={serviceOpen}
              onToggle={(e) =>
                setServiceOpen((e.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary className={styles.summary}>
                <span className={styles.summaryIcon}>
                  <Gauge size={16} />
                </span>
                <span className={styles.summaryTitle}>模型配置选择</span>
                {serviceOpen ? (
                  <ChevronDown size={16} className={styles.summaryArrow} />
                ) : (
                  <ChevronRight size={16} className={styles.summaryArrow} />
                )}
              </summary>
              <div className={styles.detailsBody}>
                {schemas.model && (
                  <SchemaCardGrid
                    schema={schemas.model}
                    value={modelTypeKey ? String(modelValues[modelTypeKey] ?? "") : undefined}
                    onSelect={handleModelSelect}
                    columns={1}
                  />
                )}
              </div>
            </details>

            <details
              className={`${styles.details} ${styles.fixedDetails}`}
              open={gpuOpen}
              onToggle={(e) =>
                setGpuOpen((e.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary className={styles.summary}>
                <span className={`${styles.summaryIcon} ${styles.green}`}>
                  <Server size={16} />
                </span>
                <span className={styles.summaryTitle}>芯片配置选择</span>
                {gpuOpen ? (
                  <ChevronDown size={16} className={styles.summaryArrow} />
                ) : (
                  <ChevronRight size={16} className={styles.summaryArrow} />
                )}
              </summary>
              <div className={styles.detailsBody}>
                {schemas.chip && (
                  <SchemaCardGrid
                    schema={schemas.chip}
                    value={chipTypeKey ? String(chipValues[chipTypeKey] ?? "") : undefined}
                    onSelect={handleChipSelect}
                    columns={1}
                  />
                )}
              </div>
            </details>

            <details
              className={styles.details}
              open={resourceOpen}
              onToggle={(e) =>
                setResourceOpen((e.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary className={styles.summary}>
                <span className={`${styles.summaryIcon} ${styles.purple}`}>
                  <Cpu size={16} />
                </span>
                <span className={styles.summaryTitle}>运行时配置</span>
                {resourceOpen ? (
                  <ChevronDown size={16} className={styles.summaryArrow} />
                ) : (
                  <ChevronRight size={16} className={styles.summaryArrow} />
                )}
              </summary>
              <div className={styles.detailsBody}>
                <FieldGrid columns={FORM_COLUMNS}>
                  {SERVICE_FIELDS.map(renderConfigField)}
                  {CHIP_FIELDS.map(renderConfigField)}
                  {RUNTIME_FIELDS.map(renderConfigField)}
                </FieldGrid>
              </div>
            </details>

            {runState === "running" && (
              <div className={styles.progressArea}>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {lastLog && (
                  <div className={styles.progressLog}>
                    <Sparkles size={13} />
                    <span>{lastLog.msg}</span>
                  </div>
                )}
              </div>
            )}

          </div>

          <div className={styles.configFooter}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={runSimulation}
              disabled={runState === "running"}
              style={{ color: "#fff" }}
            >
              {runState === "success" ? (
                <CheckCircle2 size={16} />
              ) : (
                <PlayCircle size={16} />
              )}
              <span >
                {runState === "running"
                  ? `运行中 ${progress}%`
                  : runState === "success"
                    ? "再次运行"
                    : "运行仿真"}
              </span>
            </button>
          </div>
        </div>

        <div className={styles.resultCard}>
          <ResultPanel
            result={cachedResult}
            kind={kind}
            scene={config.scene}
            onRunSim={runSimulation}
            onApplyTemplate={(id: string) => {
              const t = templates.find((x) => x.id === id);
              if (t) applyTemplateConfig(t);
            }}
          />
        </div>
      </div>

      {/* 模型参数抽屉：选中模型卡片后从右侧展示对应参数表单 */}
      <Drawer
        open={modelDrawerOpen}
        onClose={() => setModelDrawerOpen(false)}
        title={
          modelTypeKey && modelValues[modelTypeKey]
            ? `${modelValues[modelTypeKey]} 参数配置`
            : "模型参数配置"
        }
        placement="right"
        width={420}
        footer={
          <div className={styles.drawerFooter}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} flex-1`}
              onClick={handleSaveModelTemplate}
            >
              <Save size={15} />
              <span>保存模板</span>
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} flex-1`}
              onClick={handleResetModelValues}
            >
              <RotateCcw size={15} />
              <span>重置</span>
            </button>
          </div>
        }
      >
        <FieldGrid columns={1}>
          {(schemas.model?.["x-main-paths"] ?? []).map((p) => (
            <SchemaParamRow
              key={p}
              schema={schemas.model}
              path={p}
              value={getByPath(modelValues, p)}
              error={fieldErrors[`model.${p}`]}
              onChange={setModelValue}
            />
          ))}
        </FieldGrid>
      </Drawer>

      {/* 芯片参数抽屉：选中芯片卡片后从右侧展示对应参数表单 */}
      <Drawer
        open={chipDrawerOpen}
        onClose={() => setChipDrawerOpen(false)}
        title={
          chipTypeKey && chipValues[chipTypeKey]
            ? `${chipValues[chipTypeKey]} 参数配置`
            : "芯片参数配置"
        }
        placement="right"
        width={420}
        footer={
          <div className={styles.drawerFooter}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={handleResetChipValues}
            >
              <RotateCcw size={15} />
              <span>重置</span>
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleSaveChipTemplate}
            >
              <Save size={15} />
              <span>保存模板</span>
            </button>
          </div>
        }
      >
        <FieldGrid columns={1}>
          {(schemas.chip?.["x-main-paths"] ?? []).map((p) => (
            <SchemaParamRow
              key={p}
              schema={schemas.chip}
              path={p}
              value={getByPath(chipValues, p)}
              error={fieldErrors[`chip.${p}`]}
              onChange={setChipValue}
            />
          ))}
        </FieldGrid>
      </Drawer>
    </div >
  );
}
