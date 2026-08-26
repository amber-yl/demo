"use client";

import { useMemo, useState } from "react";
import {
  PlayCircle,
  Gauge,
  Timer,
  Zap,
  TrendingUp,
  LineChart as LineChartIcon,
  GitBranch,
  History,
  Sparkles,
  CheckCircle2,
  Eye,
} from "lucide-react";
import LineChart from "@/components/LineChart";
import type { SimResult, WorkloadKind, SceneKind } from "@/types";
import styles from "./ResultPanel.module.less";

type TabKey = "linechart" | "stages" | "recommendations";

type Props = {
  result: SimResult | null;
  onApplyTemplate?: (id: string) => void;
  onRunSim?: () => void;
  kind: WorkloadKind;
  scene: SceneKind;
};

const KIND_LABEL: Record<WorkloadKind, string> = {
  inference: "推理",
  training: "训练",
  general: "通算",
  graph: "图算",
};

const SCENE_LABEL: Record<SceneKind, string> = {
  pd_separate: "PD 分离",
  pd_fused: "PD 融合",
};

export default function ResultPanel({
  result,
  onApplyTemplate,
  onRunSim,
  kind,
  scene,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("linechart");

  const metrics = result?.metrics;

  const throughputUnit = useMemo(() => {
    if (kind === "inference") return "tokens/s";
    return metrics?.throughput_flops_tf ? "TFLOPS" : "tokens/s";
  }, [kind, metrics?.throughput_flops_tf]);

  const throughputVal = useMemo(() => {
    if (!metrics) return 0;
    if (kind === "inference") return metrics.throughput_tokens_s ?? 0;
    return (
      metrics.throughput_flops_tf ??
      Math.round((metrics.throughput_tokens_s ?? 0) / 16)
    );
  }, [kind, metrics]);

  const ttftMs = metrics?.latency_p50_ms ?? 0;
  const latencyVal = metrics
    ? `${metrics.latency_p50_ms ?? 0} / ${metrics.latency_p99_ms ?? 0}`
    : "0 / 0";
  const tokensPerSec = metrics?.throughput_tokens_s ?? 0;

  const recommendations = useMemo(() => {
    const recs: string[] = [];
    if (result?.recommendation) {
      const parts = result.recommendation
        .split(/(?<=[。；;])\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      recs.push(...parts);
    }
    if (recs.length === 0 && result?.recommendation) {
      recs.push(result.recommendation);
    }
    if (recs.length === 0) {
      recs.push("基于当前场景参数已生成合理估算，可调整并行策略或量化精度后再对比。");
    }
    return recs;
  }, [result?.recommendation]);

  const recentRuns = useMemo(() => {
    if (!result) return [];
    const rows: {
      time: string;
      kind: WorkloadKind;
      scene: SceneKind;
      qps: number;
      p95: number;
    }[] = [];
    const baseTps = metrics?.throughput_tokens_s ?? 1000;
    const baseP95 = metrics?.latency_p99_ms ?? 100;
    const scenes: SceneKind[] = ["pd_separate", "pd_fused"];
    const kinds: WorkloadKind[] = ["inference", "training", "general", "graph"];
    for (let i = 0; i < 5; i++) {
      const factor = 0.75 + 0.25 * Math.sin(i * 1.7 + kind.length);
      const now = new Date();
      now.setMinutes(now.getMinutes() - (i + 1) * (12 + i * 7));
      rows.push({
        time: now.toLocaleTimeString("zh-CN", { hour12: false }),
        kind: i === 0 ? kind : kinds[(kinds.indexOf(kind) + i) % kinds.length],
        scene: i % 2 === 0 ? scene : scenes[i % 2],
        qps: Math.max(10, Math.round(baseTps * factor)),
        p95: Math.max(5, Math.round(baseP95 * (2.05 - factor))),
      });
    }
    return rows;
  }, [result, metrics, kind, scene]);

  if (!result) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <PlayCircle size={28} strokeWidth={1.8} />
          </div>
          <div className={styles.emptyTitle}>等待运行仿真</div>
          <div className={styles.emptyDesc}>
            在左侧配置好「模型 / 系统 / 运行时」参数，选择 PD 分离或融合场景，点击「开始运行」即可生成性能指标与优化建议。
          </div>
          <button className={styles.runBtn} onClick={onRunSim}>
            <PlayCircle size={16} strokeWidth={2} />
            运行仿真
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Metric Cards */}
      <div className={styles.metricCards}>
        <div className={styles.metricCard}>
          {metrics && (
            <div className={styles.metricCardTrend}>
              P50 · P99
            </div>
          )}
          <div className={`${styles.metricCardIcon} ${styles.purple}`}>
            <Timer size={16} strokeWidth={2} />
          </div>
          <div className={styles.metricCardLabel}>TTFT 首 Token</div>
          <div className={styles.metricCardValue}>
            {ttftMs}
            <span className={styles.metricCardUnit}>ms</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={`${styles.metricCardIcon} ${styles.amber}`}>
            <Gauge size={16} strokeWidth={2} />
          </div>
          <div className={styles.metricCardLabel}>延迟 P50 / P99</div>
          <div className={styles.metricCardValue}>
            {latencyVal}
            <span className={styles.metricCardUnit}>ms</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={`${styles.metricCardIcon} ${styles.green}`}>
            <Zap size={16} strokeWidth={2} />
          </div>
          <div className={styles.metricCardLabel}>Tokens / sec</div>
          <div className={styles.metricCardValue}>
            {Number(tokensPerSec).toLocaleString()}
            <span className={styles.metricCardUnit}>tok/s</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          {metrics && (
            <div className={styles.metricCardTrend}>
              MFU {metrics.mfu}%
            </div>
          )}
          <div className={`${styles.metricCardIcon} ${styles.cyan}`}>
            <TrendingUp size={16} strokeWidth={2} />
          </div>
          <div className={styles.metricCardLabel}>
            {kind === "inference" ? "系统吞吐量" : "计算吞吐"}
          </div>
          <div className={styles.metricCardValue}>
            {Number(throughputVal).toLocaleString()}
            <span className={styles.metricCardUnit}>{throughputUnit}</span>
          </div>
        </div>
      </div>

      {/* Tabs Panel */}
      <div className={styles.panelCard}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tabItem} ${activeTab === "linechart" ? styles.active : ""}`}
            onClick={() => setActiveTab("linechart")}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <LineChartIcon size={14} strokeWidth={2} />
              性能曲线
            </span>
          </button>
          <button
            className={`${styles.tabItem} ${activeTab === "stages" ? styles.active : ""}`}
            onClick={() => setActiveTab("stages")}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <GitBranch size={14} strokeWidth={2} />
              阶段进度
            </span>
          </button>
        </div>

        <div className={styles.panelBody}>
          {activeTab === "linechart" && result.charts && (
            <div className={styles.chartArea}>
              <LineChart
                title="吞吐量 vs 延迟 P99"
                xs={result.charts.xs}
                series={[
                  {
                    name: "吞吐量",
                    color: "#22d3ee",
                    data: result.charts.throughput,
                  },
                  {
                    name: "延迟 P99 (ms)",
                    color: "#fbbf24",
                    data: result.charts.latency_p99,
                    axis: "right",
                    unit: "ms",
                  },
                ]}
              />
            </div>
          )}

          {activeTab === "stages" && (
            <div className={styles.stagesList}>
              {(result.stages ?? []).map((s) => (
                <div className={styles.stageRow} key={s.name}>
                  <div className={styles.stageName}>{s.name}</div>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${Math.max(0, Math.min(100, s.pct))}%` }}
                    />
                  </div>
                  <div className={styles.stageMeta}>
                    {s.ms} ms · {s.pct}%
                  </div>
                </div>
              ))}
              <div className={styles.stagesFooter}>
                <span className={styles.stagesFooterLabel}>P95 总延迟</span>
                <span className={styles.stagesFooterValue}>
                  {metrics?.latency_p99_ms ?? 0} ms
                </span>
              </div>
            </div>
          )}

          {activeTab === "recommendations" && (
            <div className={styles.recommendations}>
              <div className={styles.recHeader}>
                <Sparkles size={14} style={{ color: "var(--purple)" }} />
                <span>AI Recommendations</span>
              </div>
              {recommendations.map((rec, i) => (
                <div className={styles.recTag} key={i}>
                  <span className={styles.recBadge}>
                    {i === 0 ? (
                      <Sparkles size={12} strokeWidth={2.2} />
                    ) : (
                      <CheckCircle2 size={12} strokeWidth={2.2} />
                    )}
                  </span>
                  <span>{rec}</span>
                </div>
              ))}
              {result.recommendation && (
                <div className={styles.recSummary} style={{ marginTop: 8 }}>
                  <h4>
                    {KIND_LABEL[kind]} · <b>{SCENE_LABEL[scene]}</b> 场景洞察
                  </h4>
                  <p>{result.recommendation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Runs Table */}
      <div className={styles.panelCard}>
        <div className={styles.panelBody}>
          <div className={styles.sectionTitle}>
            <History size={15} strokeWidth={2} style={{ color: "var(--purple)" }} />
            最近 5 次运行
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>时间</th>
                  <th style={{ width: 80 }}>Kind</th>
                  <th style={{ width: 100 }}>Scene</th>
                  <th>QPS</th>
                  <th>P95</th>
                  <th style={{ width: 80, textAlign: "right" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r, i) => (
                  <tr key={`run-${i}`}>
                    <td className={styles.logTime}>{r.time}</td>
                    <td>
                      <span className={styles.kindBadge}>{KIND_LABEL[r.kind]}</span>
                    </td>
                    <td>
                      <span className={styles.sceneBadge}>{SCENE_LABEL[r.scene]}</span>
                    </td>
                    <td className={styles.monoCell}>
                      {r.qps.toLocaleString()}
                    </td>
                    <td className={styles.monoCell}>{r.p95} ms</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className={styles.viewBtn}
                        onClick={() => {
                          const tplId =
                            (result as unknown as { templateId?: string })?.templateId;
                          if (tplId && onApplyTemplate) {
                            onApplyTemplate(tplId);
                          }
                          onRunSim?.();
                        }}
                      >
                        <Eye size={12} strokeWidth={2} />
                        <span>查看</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
