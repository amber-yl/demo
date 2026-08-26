"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PlayCircle,
  Save,
  Gauge,
  Server,
  Cpu,
  CircleDollarSign,
  Settings2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  X,
} from "lucide-react";
import ResultPanel from "@/components/ResultPanel";
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
import type { OptionsData } from "@/utils/api";
import styles from "./WorkloadPage.module.less";

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

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(true);
  const [gpuOpen, setGpuOpen] = useState(true);
  const [resourceOpen, setResourceOpen] = useState(true);

  const agentContextRef = useRef(agentContext);
  const runButtonRef = useRef<() => void>(() => { });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<() => Promise<void>>(async () => { });

  // 获取表单选项和默认配置
  useEffect(() => {
    (async () => {
      try {
        const [opts, defs] = await Promise.all([
          api.getOptions(),
          api.getDefaults(),
        ]);
        setOptions(opts);
        const wd = defs.workload_defaults as Record<WorkloadKind, WorkloadConfig>;
        setWorkloadDefaults(wd);
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
        config: serialize(config),
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
  }, [kind, config, token, templates, setCachedResult, runState]);

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

  const availableTemplates = useMemo(
    () => templates.filter((t) => t.workload === kind),
    [templates, kind],
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
    setConfig((prev) => (prev ? applyDefaults(kind, { ...prev, ...patch }) : prev));
    setDropdownOpen(false);
  };

  const updateNumber = (key: keyof WorkloadConfig, val: string) => {
    const num = Number(val);
    if (!Number.isNaN(num)) {
      setConfig((prev) => (prev ? { ...prev, [key]: num } : prev));
    }
  };

  const updateString = (key: keyof WorkloadConfig, val: string) => {
    setConfig((prev) => (prev ? { ...prev, [key]: val } : prev));
  };

  const updateBool = (key: keyof WorkloadConfig, val: boolean) => {
    setConfig((prev) => (prev ? { ...prev, [key]: val } : prev));
  };

  const switchScene = (next: SceneKind) => {
    setConfig((prev) => (prev ? applyDefaults(kind, { ...prev, scene: next }) : prev));
  };

  const lastLog = logs[logs.length - 1];
  const fid = (s: string) => `wp-${kind}-${s}`;

  if (!config) return <div className={styles.page}>加载中...</div>;

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
            <div className={styles.globalControls}>
              <div className={styles.formRow}>
                <label htmlFor={fid("scene")} className={styles.label}>
                  <CircleDollarSign size={14} />
                  仿真场景
                </label>
                <div className={styles.segmented} id={fid("scene")}>
                  {(["pd_separate", "pd_fused"] as SceneKind[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`${styles.segmentedItem} ${config.scene === s ? styles.active : ""
                        }`}
                      onClick={() => switchScene(s)}
                      aria-pressed={config.scene === s}
                    >
                      {SCENE_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formRow}>
                <label htmlFor={fid("tpl")} className={styles.label}>
                  <FileJson size={14} />
                  负载模板
                </label>
                <div style={{ position: "relative", flex: 1 }}>
                  <button
                    id={fid("tpl")}
                    type="button"
                    className={styles.select}
                    onClick={() => setDropdownOpen((o) => !o)}
                  >
                    <span>
                      {availableTemplates[0]?.name ?? "自定义配置"}
                    </span>
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              <div className={styles.formRow}>
                <label htmlFor={fid("strategy")} className={styles.label}>
                  <Settings2 size={14} />
                  调度策略
                </label>
                <select
                  id={fid("strategy")}
                  className={styles.select}
                  value={config.strategy}
                  onChange={(e) => updateString("strategy", e.target.value)}
                >
                  {(options?.strategies ?? []).map((s: string) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <details
              className={styles.details}
              open={serviceOpen}
              onToggle={(e) =>
                setServiceOpen((e.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary className={styles.summary}>
                <span className={styles.summaryIcon}>
                  <Gauge size={16} />
                </span>
                <span className={styles.summaryTitle}>模型配置</span>
                {serviceOpen ? (
                  <ChevronDown size={16} className={styles.summaryArrow} />
                ) : (
                  <ChevronRight size={16} className={styles.summaryArrow} />
                )}
              </summary>
              <div className={styles.detailsBody}>
                <div className={styles.formRow}>
                  <label htmlFor={fid("requestRate")} className={styles.label}>请求速率 (req/s)</label>
                  <input
                    id={fid("requestRate")}
                    type="number"
                    className={styles.input}
                    value={config.requestRate}
                    onChange={(e) => updateNumber("requestRate", e.target.value)}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("batchSize")} className={styles.label}>Batch Size</label>
                  <div className={styles.inputGroup}>
                    <input
                      id={fid("batchSize")}
                      type="range"
                      className={styles.slider}
                      min={1}
                      max={256}
                      value={config.batchSize}
                      onChange={(e) =>
                        updateNumber("batchSize", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      className={styles.numberInput}
                      min={1}
                      max={256}
                      value={config.batchSize}
                      onChange={(e) =>
                        updateNumber("batchSize", e.target.value)
                      }
                      aria-label="batchSize number"
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("concurrency")} className={styles.label}>并发数</label>
                  <div className={styles.inputGroup}>
                    <input
                      id={fid("concurrency")}
                      type="range"
                      className={styles.slider}
                      min={1}
                      max={256}
                      value={config.concurrency}
                      onChange={(e) =>
                        updateNumber("concurrency", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      className={styles.numberInput}
                      min={1}
                      max={256}
                      value={config.concurrency}
                      onChange={(e) =>
                        updateNumber("concurrency", e.target.value)
                      }
                      aria-label="concurrency number"
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("qosLatency")} className={styles.label}>QoS 延迟 (ms)</label>
                  <input
                    id={fid("qosLatency")}
                    type="number"
                    className={styles.input}
                    value={config.qosLatency}
                    onChange={(e) => updateNumber("qosLatency", e.target.value)}
                  />
                </div>
              </div>
            </details>

            <details
              className={styles.details}
              open={gpuOpen}
              onToggle={(e) =>
                setGpuOpen((e.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary className={styles.summary}>
                <span className={`${styles.summaryIcon} ${styles.green}`}>
                  <Server size={16} />
                </span>
                <span className={styles.summaryTitle}>硬件配置</span>
                {gpuOpen ? (
                  <ChevronDown size={16} className={styles.summaryArrow} />
                ) : (
                  <ChevronRight size={16} className={styles.summaryArrow} />
                )}
              </summary>
              <div className={styles.detailsBody}>
                <div className={styles.formRow}>
                  <label htmlFor={fid("gpuType")} className={styles.label}>GPU 类型</label>
                  <select
                    id={fid("gpuType")}
                    className={styles.select}
                    value={config.gpuType}
                    onChange={(e) => updateString("gpuType", e.target.value)}
                  >
                    {(options?.gpu_types ?? []).map((g: string) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("gpuMemory")} className={styles.label}>GPU 显存 (GB)</label>
                  <input
                    id={fid("gpuMemory")}
                    type="number"
                    className={styles.input}
                    value={config.gpuMemory}
                    onChange={(e) => updateNumber("gpuMemory", e.target.value)}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("gpuCount")} className={styles.label}>GPU 数量</label>
                  <input
                    id={fid("gpuCount")}
                    type="number"
                    className={styles.input}
                    value={config.gpuCount}
                    onChange={(e) => updateNumber("gpuCount", e.target.value)}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("precision")} className={styles.label}>精度</label>
                  <select
                    id={fid("precision")}
                    className={styles.select}
                    value={config.precision}
                    onChange={(e) => updateString("precision", e.target.value)}
                  >
                    {(options?.precisions ?? []).map((p: string) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("quant")} className={styles.label}>量化方式</label>
                  <select
                    id={fid("quant")}
                    className={styles.select}
                    value={config.quant}
                    onChange={(e) => updateString("quant", e.target.value)}
                  >
                    {(options?.quants ?? []).map((q: string) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("bitwidth")} className={styles.label}>量化位宽</label>
                  <select
                    id={fid("bitwidth")}
                    className={styles.select}
                    value={config.quantizationBitwidth}
                    onChange={(e) =>
                      updateString("quantizationBitwidth", e.target.value)
                    }
                  >
                    {(options?.bitwidths ?? []).map((b: string) => (
                      <option key={b} value={b}>
                        {b}-bit
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("maxModelLen")} className={styles.label}>最大序列长度</label>
                  <input
                    id={fid("maxModelLen")}
                    type="number"
                    className={styles.input}
                    value={config.maxModelLen}
                    onChange={(e) => updateNumber("maxModelLen", e.target.value)}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("memFraction")} className={styles.label}>显存占用比例</label>
                  <div className={styles.inputGroup}>
                    <input
                      id={fid("memFraction")}
                      type="range"
                      className={styles.slider}
                      min={0}
                      max={1}
                      step={0.01}
                      value={config.memFraction}
                      onChange={(e) =>
                        updateNumber("memFraction", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      className={styles.numberInput}
                      min={0}
                      max={1}
                      step={0.01}
                      value={config.memFraction}
                      onChange={(e) =>
                        updateNumber("memFraction", e.target.value)
                      }
                      aria-label="memFraction number"
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("vllm")} className={styles.label}>
                    vLLM 加速
                    {config.vllm ? (
                      <ToggleRight
                        size={18}
                        className={styles.toggleOn}
                        onClick={() => updateBool("vllm", false)}
                        role="presentation"
                      />
                    ) : (
                      <ToggleLeft
                        size={18}
                        className={styles.toggleOff}
                        onClick={() => updateBool("vllm", true)}
                        role="presentation"
                      />
                    )}
                  </label>
                  <input
                    id={fid("vllm")}
                    type="checkbox"
                    checked={config.vllm}
                    onChange={(e) => updateBool("vllm", e.target.checked)}
                    className={styles.hiddenCheckbox}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("paged")} className={styles.label}>
                    Paged Attention
                    {config.paged ? (
                      <ToggleRight
                        size={18}
                        className={styles.toggleOn}
                        onClick={() => updateBool("paged", false)}
                        role="presentation"
                      />
                    ) : (
                      <ToggleLeft
                        size={18}
                        className={styles.toggleOff}
                        onClick={() => updateBool("paged", true)}
                        role="presentation"
                      />
                    )}
                  </label>
                  <input
                    id={fid("paged")}
                    type="checkbox"
                    checked={config.paged}
                    onChange={(e) => updateBool("paged", e.target.checked)}
                    className={styles.hiddenCheckbox}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("chunkPrefill")} className={styles.label}>
                    Chunked Prefill
                    {config.chunkPrefill ? (
                      <ToggleRight
                        size={18}
                        className={styles.toggleOn}
                        onClick={() => updateBool("chunkPrefill", false)}
                        role="presentation"
                      />
                    ) : (
                      <ToggleLeft
                        size={18}
                        className={styles.toggleOff}
                        onClick={() => updateBool("chunkPrefill", true)}
                        role="presentation"
                      />
                    )}
                  </label>
                  <input
                    id={fid("chunkPrefill")}
                    type="checkbox"
                    checked={config.chunkPrefill}
                    onChange={(e) => updateBool("chunkPrefill", e.target.checked)}
                    className={styles.hiddenCheckbox}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("quantW8A8")} className={styles.label}>
                    W8A8 量化
                    {config.quantW8A8 ? (
                      <ToggleRight
                        size={18}
                        className={styles.toggleOn}
                        onClick={() => updateBool("quantW8A8", false)}
                        role="presentation"
                      />
                    ) : (
                      <ToggleLeft
                        size={18}
                        className={styles.toggleOff}
                        onClick={() => updateBool("quantW8A8", true)}
                        role="presentation"
                      />
                    )}
                  </label>
                  <input
                    id={fid("quantW8A8")}
                    type="checkbox"
                    checked={config.quantW8A8}
                    onChange={(e) => updateBool("quantW8A8", e.target.checked)}
                    className={styles.hiddenCheckbox}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("quantW4A16")} className={styles.label}>
                    W4A16 量化
                    {config.quantW4A16 ? (
                      <ToggleRight
                        size={18}
                        className={styles.toggleOn}
                        onClick={() => updateBool("quantW4A16", false)}
                        role="presentation"
                      />
                    ) : (
                      <ToggleLeft
                        size={18}
                        className={styles.toggleOff}
                        onClick={() => updateBool("quantW4A16", true)}
                        role="presentation"
                      />
                    )}
                  </label>
                  <input
                    id={fid("quantW4A16")}
                    type="checkbox"
                    checked={config.quantW4A16}
                    onChange={(e) => updateBool("quantW4A16", e.target.checked)}
                    className={styles.hiddenCheckbox}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("useLora")} className={styles.label}>
                    启用 LoRA
                    {config.useLora ? (
                      <ToggleRight
                        size={18}
                        className={styles.toggleOn}
                        onClick={() => updateBool("useLora", false)}
                        role="presentation"
                      />
                    ) : (
                      <ToggleLeft
                        size={18}
                        className={styles.toggleOff}
                        onClick={() => updateBool("useLora", true)}
                        role="presentation"
                      />
                    )}
                  </label>
                  <input
                    id={fid("useLora")}
                    type="checkbox"
                    checked={config.useLora}
                    onChange={(e) => updateBool("useLora", e.target.checked)}
                    className={styles.hiddenCheckbox}
                  />
                </div>
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
                <div className={styles.formRow}>
                  <label htmlFor={fid("cpuCore")} className={styles.label}>CPU 核数</label>
                  <input
                    id={fid("cpuCore")}
                    type="number"
                    className={styles.input}
                    value={config.cpuCore}
                    onChange={(e) => updateNumber("cpuCore", e.target.value)}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("cpuMemory")} className={styles.label}>CPU 内存 (GB)</label>
                  <input
                    id={fid("cpuMemory")}
                    type="number"
                    className={styles.input}
                    value={config.cpuMemory}
                    onChange={(e) => updateNumber("cpuMemory", e.target.value)}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("replicas")} className={styles.label}>副本数</label>
                  <input
                    id={fid("replicas")}
                    type="number"
                    className={styles.input}
                    value={config.replicas}
                    onChange={(e) => updateNumber("replicas", e.target.value)}
                  />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("kvCacheRatio")} className={styles.label}>KV Cache 比例</label>
                  <div className={styles.inputGroup}>
                    <input
                      id={fid("kvCacheRatio")}
                      type="range"
                      className={styles.slider}
                      min={0}
                      max={1}
                      step={0.01}
                      value={config.kvCacheRatio}
                      onChange={(e) =>
                        updateNumber("kvCacheRatio", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      className={styles.numberInput}
                      min={0}
                      max={1}
                      step={0.01}
                      value={config.kvCacheRatio}
                      onChange={(e) =>
                        updateNumber("kvCacheRatio", e.target.value)
                      }
                      aria-label="kvCacheRatio number"
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor={fid("parallelLevel")} className={styles.label}>并行策略</label>
                  <select
                    id={fid("parallelLevel")}
                    className={styles.select}
                    value={config.parallelLevel}
                    onChange={(e) =>
                      updateString("parallelLevel", e.target.value)
                    }
                  >
                    {(options?.parallel_levels ?? []).map((p: string) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
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
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => {
                const key = `${kind}-${Date.now()}`;
                const tpl: SimTemplate = {
                  id: key,
                  name: `本地保存 · ${new Date().toLocaleTimeString()}`,
                  workload: kind,
                  scene: config.scene,
                  model: {},
                  system: {},
                  runtime: {},
                };
                try {
                  localStorage.setItem(`tpl-${key}`, JSON.stringify(tpl));
                } catch {
                  /* ignore */
                }
              }}
            >
              <Save size={14} />
              <span>保存模板</span>
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => {
                if (workloadDefaults)
                  setConfig(applyDefaults(kind, workloadDefaults[kind]));
              }}
            >
              <RefreshCw size={14} />
              <span>重置</span>
            </button>
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
    </div>
  );
}
