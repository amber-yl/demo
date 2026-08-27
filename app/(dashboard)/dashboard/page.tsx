"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  api,
  type DashboardTask,
  type DashboardStat,
  type DashboardQuickEntry,
} from "@/utils/api";
import styles from "./DashboardPage.module.less";

const ICON_MAP: Record<string, React.ReactNode> = {
  Microscope: <Microscope size={18} />,
  Clock: <Clock size={18} />,
  CheckCircle2: <CheckCircle2 size={18} />,
  XCircle: <XCircle size={18} />,
  Zap: <Zap size={24} />,
  Bot: <Bot size={24} />,
  Code2: <Code2 size={24} />,
  Network: <Network size={24} />,
};

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

export default function DashboardRoutePage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [quickEntries, setQuickEntries] = useState<DashboardQuickEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getDashboard();
        setTasks(data.tasks);
        setStats(data.stats);
        setQuickEntries(data.quick_entries);
      } catch {
        /* keep empty state */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 路由预热：用户停留在 Dashboard 期间后台 prefetch 目标路由，
  // 触发 dev 模式按需编译，使首次跳转从 ~8s 降至秒开
  useEffect(() => {
    quickEntries.forEach((m) => {
      if (m.goto === "dashboard") return;
      router.prefetch(`/${m.goto}`);
    });
  }, [router, quickEntries]);

  const navigate = (p: PageId) => {
    if (p === "dashboard") {
      router.push("/dashboard");
    } else {
      router.push(`/${p}`);
    }
  };

  const statColorClass: Record<string, string> = {
    cyan: styles.statCardIconCyan,
    amber: styles.statCardIconAmber,
    green: styles.statCardIconGreen,
    red: styles.statCardIconRed,
  };
  const trendClass: Record<string, string> = {
    up: styles.trendUp,
    down: styles.trendDown,
    neutral: styles.trendNeutral,
  };
  const trendTagClass: Record<string, string> = {
    success: styles.trendTagSuccess,
    info: styles.trendTagInfo,
  };

  return (
    <div className={styles.pageWrapper}>
      {/* 仿真入口 — 大卡片，最显眼 */}
      <div className={styles.quickEntries}>
        {loading ? null : (
          quickEntries.map((m) => (
            <button
              key={m.title}
              className={styles.quickEntryCard}
              onClick={() => navigate(m.goto as PageId)}
            >
              <div
                className={styles.quickEntryAccent}
                style={{ background: m.accent }}
              />
              <div
                className={styles.quickEntryIcon}
                style={{ background: m.bg, color: m.fg }}
              >
                {ICON_MAP[m.icon] ?? <Zap size={24} />}
              </div>
              <div className={styles.quickEntryTitle}>{m.title}</div>
              <div className={styles.quickEntryDesc}>{m.desc}</div>
              <div className={styles.quickEntryArrow}>
                开始仿真
                <ArrowRight size={14} />
              </div>
            </button>
          ))
        )}
      </div>

      {/* 底部：统计概览 + 最近任务 */}
      <div className={styles.bottomRow}>
        {/* 统计概览 */}
        <div className={styles.statsCol}>
          <div className={styles.sectionTitle}>数据概览</div>
          <div className={styles.statsGrid}>
            {loading ? (
              <div style={{ color: "var(--text-tertiary)", padding: "1rem" }}>加载中...</div>
            ) : (
              stats.map((s) => (
                <div className={styles.statCard} key={s.label}>
                  <div className={`${styles.statCardIcon} ${statColorClass[s.color] ?? ""}`}>
                    {ICON_MAP[s.icon] ?? <Microscope size={18} />}
                  </div>
                  <div className={styles.statCardLabel}>{s.label}</div>
                  <div className={styles.statCardValue}>
                    {s.value}
                    <span className={styles.statCardSuffix}>{s.suffix}</span>
                  </div>
                  <div className={`${styles.statCardTrend} ${trendClass[s.trend] ?? ""}`}>
                    {s.trend === "up" && <TrendingUp size={12} />}
                    {s.trend === "down" && <TrendingDown size={12} />}
                    <span className={`${styles.trendTag} ${trendTagClass[s.trend_type] ?? ""}`}>
                      {s.trend_label}
                    </span>
                  </div>
                </div>
              ))
            )}
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
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "1rem", color: "var(--text-tertiary)" }}>
                        加载中...
                      </td>
                    </tr>
                  ) : (
                    tasks.map((t) => (
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
                              // 负载建模仿真路由已删除，任务详情跳转到复用 WorkloadPage 的 NGC 页面
                              navigate(
                                t.kind === "training"
                                  ? "ngc-compute-memory-analyze"
                                  : "ngc-inference-sim",
                              )
                            }
                          >
                            查看
                            <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
