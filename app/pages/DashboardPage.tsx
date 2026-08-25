"use client";

import {
  LayoutDashboard,
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
import type { PageId } from "../types";
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

export default function DashboardPage({ onNavigate }: Props) {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.headerCard}>
        <div className={styles.headerIcon}>
          <LayoutDashboard size={24} />
        </div>
        <div className={styles.headerContent}>
          <h2 className={styles.headerTitle}>总览 Dashboard</h2>
          <div className={styles.headerSubtitle}>
            近 24 小时任务概览、资源与能耗指标，快速进入当前活跃仿真场景。
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => onNavigate("simulation/workload/inference")}
          >
            <Microscope size={14} />
            新建推理仿真
          </button>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => onNavigate("simulation/workload/training")}
          >
            <Zap size={14} />
            新建训练仿真
          </button>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconCyan}`}>
            <Microscope size={18} />
          </div>
          <div className={styles.statCardLabel}>今日仿真任务</div>
          <div className={styles.statCardValue}>
            28
            <span className={styles.statCardSuffix}>个</span>
          </div>
          <div className={`${styles.statCardTrend} ${styles.trendUp}`}>
            <TrendingUp size={12} />
            <span className={`${styles.trendTag} ${styles.trendTagSuccess}`}>
              +12% vs 昨日
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconAmber}`}>
            <Clock size={18} />
          </div>
          <div className={styles.statCardLabel}>运行中 / 排队中</div>
          <div className={styles.statCardValue}>
            6
            <span className={styles.statCardSuffix}>个</span>
          </div>
          <div className={`${styles.statCardTrend} ${styles.trendNeutral}`}>
            <span className={`${styles.trendTag} ${styles.trendTagInfo}`}>
              推理 3 · 训练 2 · 图算 1
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconGreen}`}>
            <CheckCircle2 size={18} />
          </div>
          <div className={styles.statCardLabel}>成功率</div>
          <div className={styles.statCardValue}>
            92.3
            <span className={styles.statCardSuffix}>%</span>
          </div>
          <div className={`${styles.statCardTrend} ${styles.trendUp}`}>
            <TrendingUp size={12} />
            <span className={`${styles.trendTag} ${styles.trendTagSuccess}`}>
              SLA 95% ✓
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconRed}`}>
            <XCircle size={18} />
          </div>
          <div className={styles.statCardLabel}>平均耗时</div>
          <div className={styles.statCardValue}>
            8.4
            <span className={styles.statCardSuffix}>分</span>
          </div>
          <div className={`${styles.statCardTrend} ${styles.trendDown}`}>
            <TrendingDown size={12} />
            <span className={`${styles.trendTag} ${styles.trendTagSuccess}`}>
              -6.2% vs 上周
            </span>
          </div>
        </div>
      </div>

      <div className={styles.quickEntries}>
        {[
          {
            title: "推理服务仿真",
            desc: "LLM 推理负载，支持 PD 分离与融合部署对比。",
            icon: <Zap size={22} />,
            bg: "rgba(34, 211, 238, 0.12)",
            fg: "var(--brand-400)",
            goto: "simulation/workload/inference" as PageId,
          },
          {
            title: "模型训练仿真",
            desc: "大模型训练负载，分析 MFU 与通信瓶颈。",
            icon: <Bot size={22} />,
            bg: "rgba(52, 211, 153, 0.12)",
            fg: "var(--success)",
            goto: "simulation/workload/training" as PageId,
          },
          {
            title: "通用计算仿真",
            desc: "HPC、通用批处理与科学计算负载。",
            icon: <Code2 size={22} />,
            bg: "rgba(251, 191, 36, 0.12)",
            fg: "var(--accent-400)",
            goto: "simulation/workload/general" as PageId,
          },
          {
            title: "系统仿真",
            desc: "芯片、服务器、网络与集群拓扑的系统级评估。",
            icon: <Network size={22} />,
            bg: "rgba(167, 139, 250, 0.12)",
            fg: "var(--purple)",
            goto: "simulation/system" as PageId,
          },
        ].map((m) => (
          <button
            key={m.title}
            className={styles.quickEntryCard}
            onClick={() => onNavigate(m.goto)}
          >
            <div
              className={styles.quickEntryIcon}
              style={{ background: m.bg, color: m.fg }}
            >
              {m.icon}
            </div>
            <div className={styles.quickEntryTitle}>{m.title}</div>
            <div className={styles.quickEntryDesc}>{m.desc}</div>
            <div className={styles.quickEntryArrow}>
              进入 <ArrowRight size={12} />
            </div>
          </button>
        ))}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div className={styles.tableTitle}>最近仿真任务列表</div>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>任务 ID</th>
                <th>任务名</th>
                <th>Kind</th>
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
  );
}
