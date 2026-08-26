"use client";

import {
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Microscope,
  Network,
  Server,
  TrendingUp,
  TrendingDown,
  Bot,
  Code2,
} from "lucide-react";
import type { PageId } from "@/types";
import styles from "./DashboardPage.module.less";

type Props = {
  onNavigate: (p: PageId) => void;
};

type TaskType = {
  id: string;
  name: string;
  kind: string;
  scene: string;
  status: string;
  progress: number;
  eta: string;
  owner: string;
};

const tasks: TaskType[] = [
  {
    id: "SIM-2048",
    name: "LLaMA-3-70B 推理 · PD 分离",
    kind: "inference",
    scene: "pd_separate",
    status: "running",
    progress: 72,
    eta: "2 分 14 秒",
    owner: "Chris Chen",
  },
  {
    id: "SIM-2047",
    name: "LLaMA-405B 训练 · PD 融合",
    kind: "training",
    scene: "pd_fused",
    status: "queued",
    progress: 0,
    eta: "排队中",
    owner: "仿真工程师",
  },
  {
    id: "SIM-2046",
    name: "GNN 基准 · graph workload",
    kind: "graph",
    scene: "pd_fused",
    status: "success",
    progress: 100,
    eta: "3 分 45 秒",
    owner: "系统管理员",
  },
  {
    id: "SIM-2045",
    name: "通用计算 · 8192 batch",
    kind: "general",
    scene: "pd_separate",
    status: "failed",
    progress: 34,
    eta: "OOM 终止",
    owner: "Chris Chen",
  },
  {
    id: "SIM-2044",
    name: "LLaMA-3-70B 推理 · PD 融合",
    kind: "inference",
    scene: "pd_fused",
    status: "success",
    progress: 100,
    eta: "12 分 8 秒",
    owner: "仿真工程师",
  },
];

function statusBadge(s: string) {
  switch (s) {
    case "running":
      return (
        <span className={`${styles.statusBadge} ${styles.statusRunning}`}>
          <span className={styles.dot} />
          运行中
        </span>
      );
    case "queued":
      return (
        <span className={`${styles.statusBadge} ${styles.statusQueued}`}>
          <span className={styles.dot} />
          排队中
        </span>
      );
    case "success":
      return (
        <span className={`${styles.statusBadge} ${styles.statusSuccess}`}>
          <span className={styles.dot} />
          成功
        </span>
      );
    case "failed":
      return (
        <span className={`${styles.statusBadge} ${styles.statusFailed}`}>
          <span className={styles.dot} />
          失败
        </span>
      );
    default:
      return (
        <span className={`${styles.statusBadge} ${styles.statusQueued}`}>
          <span className={styles.dot} />
          未知
        </span>
      );
  }
}

function kindBadge(k: string) {
  const iconMap: Record<string, React.ReactNode> = {
    inference: <Zap size={12} />,
    training: <Bot size={12} />,
    general: <Code2 size={12} />,
    graph: <Network size={12} />,
  };
  const labelMap: Record<string, string> = {
    inference: "推理",
    training: "训练",
    general: "通算",
    graph: "图算",
  };
  const clsMap: Record<string, string> = {
    inference: styles.kindInference,
    training: styles.kindTraining,
    general: styles.kindGeneral,
    graph: styles.kindGraph,
  };
  return (
    <span className={`${styles.kindBadge} ${clsMap[k] ?? styles.kindGeneral}`}>
      {iconMap[k] ?? <Server size={12} />}
      {labelMap[k] ?? k}
    </span>
  );
}

function sceneLabel(s: string) {
  return s === "pd_fused" ? "PD 融合" : "PD 分离";
}

const quickEntries = [
  {
    title: "推理服务仿真",
    desc: "LLM 推理负载，支持 PD 分离与融合部署对比。",
    icon: <Zap size={24} />,
    bg: "rgba(34, 211, 238, 0.12)",
    fg: "var(--brand-400)",
    accent: "linear-gradient(90deg, #22d3ee, #06b6d4)",
    goto: "simulation/workload/inference" as PageId,
  },
  {
    title: "模型训练仿真",
    desc: "大模型训练负载，分析 MFU 与通信瓶颈。",
    icon: <Bot size={24} />,
    bg: "rgba(52, 211, 153, 0.12)",
    fg: "var(--success)",
    accent: "linear-gradient(90deg, #34d399, #10b981)",
    goto: "simulation/workload/training" as PageId,
  },
  {
    title: "通用计算仿真",
    desc: "HPC、通用批处理与科学计算负载。",
    icon: <Code2 size={24} />,
    bg: "rgba(251, 191, 36, 0.12)",
    fg: "var(--accent-400)",
    accent: "linear-gradient(90deg, #fbbf24, #f59e0b)",
    goto: "simulation/workload/general" as PageId,
  },
  {
    title: "系统仿真",
    desc: "芯片、服务器、网络与集群拓扑的系统级评估。",
    icon: <Network size={24} />,
    bg: "rgba(167, 139, 250, 0.12)",
    fg: "var(--purple)",
    accent: "linear-gradient(90deg, #a78bfa, #8b5cf6)",
    goto: "simulation/system" as PageId,
  },
];

const stats = [
  {
    icon: <Microscope size={16} />,
    iconBg: "rgba(34, 211, 238, 0.12)",
    iconColor: "var(--brand-400)",
    label: "今日仿真任务",
    value: "28",
    suffix: "个",
    trend: <TrendingUp size={11} />,
    trendText: "+12%",
    trendCls: styles.trendTagSuccess,
  },
  {
    icon: <Clock size={16} />,
    iconBg: "rgba(251, 191, 36, 0.12)",
    iconColor: "var(--accent-400)",
    label: "运行/排队",
    value: "6",
    suffix: "个",
    trend: null,
    trendText: "推理3 训练2 图1",
    trendCls: styles.trendTagInfo,
  },
  {
    icon: <CheckCircle2 size={16} />,
    iconBg: "rgba(52, 211, 153, 0.12)",
    iconColor: "var(--success)",
    label: "成功率",
    value: "92.3",
    suffix: "%",
    trend: <TrendingUp size={11} />,
    trendText: "SLA 95%",
    trendCls: styles.trendTagSuccess,
  },
  {
    icon: <XCircle size={16} />,
    iconBg: "rgba(248, 113, 113, 0.12)",
    iconColor: "var(--danger)",
    label: "平均耗时",
    value: "8.4",
    suffix: "分",
    trend: <TrendingDown size={11} />,
    trendText: "-6.2%",
    trendCls: styles.trendTagSuccess,
  },
];

export default function DashboardPage({ onNavigate }: Props) {
  return (
    <div className={styles.pageWrapper}>
      {/* 仿真入口 — 大卡片，最显眼 */}
      <div className={styles.quickEntries}>
        {quickEntries.map((m) => (
          <button
            key={m.title}
            className={styles.quickEntryCard}
            onClick={() => onNavigate(m.goto)}
          >
            <div className={styles.quickEntryAccent} style={{ background: m.accent }} />
            <div
              className={styles.quickEntryIcon}
              style={{ background: m.bg, color: m.fg }}
            >
              {m.icon}
            </div>
            <div className={styles.quickEntryTitle}>{m.title}</div>
            <div className={styles.quickEntryDesc}>{m.desc}</div>
            <div className={styles.quickEntryArrow}>
              开始仿真
              <ArrowRight size={14} />
            </div>
          </button>
        ))}
      </div>

      {/* 底部：统计概览 + 最近任务 */}
      <div className={styles.bottomRow}>
        {/* 统计概览 */}
        <div className={styles.statsCol}>
          <div className={styles.sectionTitle}>数据概览</div>
          <div className={styles.statsGrid}>
            {stats.map((s) => (
              <div key={s.label} className={styles.statCard}>
                <div
                  className={styles.statCardIcon}
                  style={{ background: s.iconBg, color: s.iconColor }}
                >
                  {s.icon}
                </div>
                <div className={styles.statCardLabel}>{s.label}</div>
                <div className={styles.statCardValue}>
                  {s.value}
                  <span className={styles.statCardSuffix}>{s.suffix}</span>
                </div>
                <div className={styles.statCardTrend}>
                  {s.trend}
                  <span className={`${styles.trendTag} ${s.trendCls}`}>
                    {s.trendText}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 最近任务列表 */}
        <div className={styles.tableCol}>
          <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <div className={styles.tableTitle}>最近仿真任务</div>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>任务 ID</th>
                    <th>任务名</th>
                    <th>类型</th>
                    <th>场景</th>
                    <th>状态</th>
                    <th>进度</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>
                        {t.id}
                      </td>
                      <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{t.name}</td>
                      <td>{kindBadge(t.kind)}</td>
                      <td>{sceneLabel(t.scene)}</td>
                      <td>{statusBadge(t.status)}</td>
                      <td>
                        {t.status === "queued" ? (
                          <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                            等待调度
                          </span>
                        ) : (
                          <div className={styles.progressBar}>
                            <div
                              className={styles.progressFill}
                              style={{ width: `${t.progress}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          className={styles.viewBtn}
                          onClick={() =>
                            onNavigate(`simulation/workload/${t.kind}` as PageId)
                          }
                        >
                          查看
                          <ArrowRight size={12} />
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
    </div>
  );
}
