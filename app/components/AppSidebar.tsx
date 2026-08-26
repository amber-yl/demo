"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Microscope,
  Zap,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import type { PageId, User, WorkloadKind } from "../types";
import { WORKLOAD_LABEL, ROLE_LABEL } from "../utils";
import styles from "./AppSidebar.module.less";

type Props = {
  user: User;
  currentPage: PageId;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  theme: "dark" | "light";
};

type WorkloadChild = {
  key: WorkloadKind;
  label: string;
  icon: React.ReactNode;
};

const workloadChildren: WorkloadChild[] = [
  { key: "inference", label: "推理服务", icon: <Zap size={16} /> },
];

function pageIdToPath(page: PageId | string): string {
  if (page === "dashboard") return "/dashboard";
  return `/${page}`;
}

export default function AppSidebar({
  user,
  onLogout,
  collapsed,
  onToggleCollapse,
  theme,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // 根据真实 URL pathname 决定高亮和展开状态，忽略 props currentPage
  const activePageId: PageId =
    pathname === "/dashboard"
      ? "dashboard"
      : pathname?.startsWith("/simulation/workload/")
        ? (`simulation/workload/${pathname.split("/")[3]}` as PageId)
        : "dashboard";

  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [showUserPopover, setShowUserPopover] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const closeTimer = useRef<number | null>(null);
  const userCloseTimer = useRef<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const userInitials = user.name.slice(0, 2).toUpperCase();

  const clearClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const delayedClose = (fn: () => void) => {
    clearClose();
    closeTimer.current = window.setTimeout(() => {
      fn();
    }, 150);
  };

  const clearUserClose = () => {
    if (userCloseTimer.current) {
      window.clearTimeout(userCloseTimer.current);
      userCloseTimer.current = null;
    }
  };

  const delayedUserClose = () => {
    clearUserClose();
    userCloseTimer.current = window.setTimeout(() => {
      setShowUserPopover(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      clearClose();
      clearUserClose();
    };
  }, []);

  // 核心路由跳转：使用 Next.js router.push —— URL 会变化 ✅
  const navigate = (p: PageId) => {
    router.push(pageIdToPath(p));
  };

  const isWorkloadParentActive = activePageId.startsWith("simulation/workload/");

  const handleCollapseBtnTooltipEnter = () => setShowTooltip("collapse");
  const handleCollapseBtnTooltipLeave = () => setShowTooltip(null);

  const sidebarClassName = [
    styles.sidebar,
    collapsed ? "collapsed" : "",
    styles[theme],
  ].filter(Boolean).join(" ");

  return (
    <aside className={sidebarClassName}>
      <div className={styles.brandBar}>
        <div className={styles.brandIcon}>S</div>
        {!collapsed && (
          <div className={styles.brandText}>
            <div className={styles.brandTitle}>Nebula Sim Lab</div>
            <div className={styles.brandSubtitle}>仿真管理平台 · v2.4</div>
          </div>
        )}
      </div>

      <div className={styles.menuArea}>
        <div className={styles.menuItemGroup}>
          <button
            className={`${styles.menuItem} ${activePageId === "dashboard" ? styles.active : ""}`}
            onClick={() => navigate("dashboard")}
            onMouseEnter={() => collapsed && setHoveredMenu("dashboard")}
            onMouseLeave={() => collapsed && delayedClose(() => setHoveredMenu(null))}
          >
            <span className={styles.menuIcon}>
              <LayoutDashboard size={18} />
            </span>
            {!collapsed && <span className={styles.menuLabel}>总览 Dashboard</span>}
          </button>
          {collapsed && hoveredMenu === "dashboard" && (
            <div className={styles.tooltip}>总览 Dashboard</div>
          )}
        </div>

        <div className={styles.menuItemGroup}>
          <button
            className={`${styles.menuItem} ${isWorkloadParentActive ? styles.active : ""}`}
            onClick={() => {
              if (collapsed) {
                setHoveredMenu("simulation/workload");
              } else {
                navigate(`simulation/workload/${workloadChildren[0].key}` as PageId);
              }
            }}
            onMouseEnter={() => collapsed && setHoveredMenu("simulation/workload")}
            onMouseLeave={() => collapsed && delayedClose(() => setHoveredMenu(null))}
          >
            <span className={styles.menuIcon}>
              <Microscope size={18} />
            </span>
            {!collapsed && (
              <span className={styles.menuLabel}>负载建模仿真</span>
            )}
          </button>

          {!collapsed && (
            <div
              className={styles.subMenu}
            >
              {workloadChildren.map((child) => {
                const pageKey = `simulation/workload/${child.key}` as PageId;
                return (
                  <button
                    key={child.key}
                    className={`${styles.subMenuItem} ${activePageId === pageKey ? styles.active : ""}`}
                    onClick={() => navigate(pageKey)}
                  >
                    <span style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {child.icon}
                    </span>
                    <span>{child.label}</span>
                    <span className={styles.subMenuKindLabel}>{WORKLOAD_LABEL[child.key]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {collapsed && hoveredMenu === "simulation/workload" && (
            <div
              className={styles.collapsedPopover}
              onMouseEnter={clearClose}
              onMouseLeave={() => delayedClose(() => setHoveredMenu(null))}
            >
              <div className={styles.popoverTitle}>
                <Microscope size={14} />
                负载建模仿真
              </div>
              <div className={styles.popoverList}>
                {workloadChildren.map((child) => {
                  const pageKey = `simulation/workload/${child.key}` as PageId;
                  return (
                    <button
                      key={child.key}
                      className={`${styles.popoverItem} ${activePageId === pageKey ? styles.active : ""}`}
                      onClick={() => navigate(pageKey)}
                    >
                      {child.icon}
                      <span style={{ flex: 1 }}>{child.label}</span>
                      <span style={{ opacity: 0.6, fontSize: 12 }}>{WORKLOAD_LABEL[child.key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

      <div className={styles.footer}>
        <div
          className={styles.userArea}
          role="button"
          tabIndex={0}
          onMouseEnter={() => {
            clearUserClose();
            setShowUserPopover(true);
          }}
          onMouseLeave={delayedUserClose}
          onClick={(e) => {
            if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
              return;
            }
            setShowUserPopover((v) => !v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowUserPopover((v) => !v);
            }
          }}
        >
          <div className={styles.avatar}>{userInitials}</div>
          {!collapsed && (
            <div className={styles.userMeta}>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userRole}>
                {ROLE_LABEL[user.role] ?? user.role}
              </div>
            </div>
          )}

          {showUserPopover && (
            <div
              ref={popoverRef}
              className={styles.userPopover}
              onMouseEnter={clearUserClose}
              onMouseLeave={delayedUserClose}
            >
              <div className={styles.popoverHeader}>
                <div className={styles.popoverAvatar}>{userInitials}</div>
                <div className={styles.popoverUserInfo}>
                  <div className={styles.popoverUserName}>{user.name}</div>
                  <div className={styles.popoverUserEmail}>{user.email}</div>
                </div>
              </div>
              <div className={styles.popoverDivider} />
              <div className={styles.popoverRole}>
                {ROLE_LABEL[user.role] ?? user.role}
              </div>
              <button className={styles.logoutBtn} onClick={onLogout}>
                <LogOut size={14} />
                退出登录
              </button>
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <button
            className={styles.collapseBtn}
            onClick={onToggleCollapse}
            onMouseEnter={handleCollapseBtnTooltipEnter}
            onMouseLeave={handleCollapseBtnTooltipLeave}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          {showTooltip === "collapse" && (
            <div
              className={styles.tooltip}
              style={{
                left: collapsed ? "calc(100% + 4px)" : "auto",
                right: collapsed ? "auto" : "calc(100% + 4px)",
              }}
            >
              {collapsed ? "展开侧栏" : "收起侧栏"}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
