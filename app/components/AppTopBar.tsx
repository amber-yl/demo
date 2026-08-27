"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Sun, Moon, LogOut } from "lucide-react";
import type { User } from "@/types";
import { ROLE_LABEL } from "@/utils";
import { ROUTE_GROUPS, STANDALONE_ROUTES, isPathInGroup } from "@/routes";
import styles from "./AppTopBar.module.less";

type Props = {
  user: User;
  onLogout: () => void;
  currentPage?: string;
  onRunSim?: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

type Crumb = {
  label: string;
  active?: boolean;
  clickable?: boolean;
  href?: string;
};

/** 根据 pathname 从路由元数据构建面包屑 */
function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [
    { label: "首页", clickable: true, href: "/dashboard" },
  ];

  if (pathname === "/dashboard" || pathname === "/") {
    crumbs.push({ label: "总览", active: true });
    return crumbs;
  }

  // 从 ROUTE_GROUPS 匹配分组路由
  for (const group of ROUTE_GROUPS) {
    if (!isPathInGroup(pathname, group.key)) continue;

    crumbs.push({ label: group.title });

    const child = group.children.find(
      (c) => pathname === c.path || pathname.startsWith(c.path + "/"),
    );

    if (child) {
      crumbs.push({ label: child.title, active: true });
    }
    return crumbs;
  }

  // 从 STANDALONE_ROUTES 匹配独立路由
  for (const route of STANDALONE_ROUTES) {
    if (pathname === route.path || pathname.startsWith(route.path + "/")) {
      crumbs.push({ label: route.title, active: true });
      return crumbs;
    }
  }

  return crumbs;
}

export default function AppTopBar({
  user,
  onLogout,
  theme,
  onToggleTheme,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  // 用户信息弹出层（自侧边栏底部迁移至顶栏右上角）
  const [showUserPopover, setShowUserPopover] = useState(false);
  const userCloseTimer = useRef<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const userInitials = user.name.slice(0, 2).toUpperCase();

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
    return () => clearUserClose();
  }, []);

  return (
    <div className={styles.topbar}>
      {/* 品牌标识：左上角，点击返回 Dashboard */}
      <button
        className={styles.brandBar}
        onClick={() => router.push("/dashboard")}
        type="button"
        title="返回 Dashboard"
      >
        <div className={styles.brandIcon}>S</div>
        <div className={styles.brandText}>
          <div className={styles.brandTitle}>Nebula Sim Lab</div>
          <div className={styles.brandSubtitle}>智能仿真管理平台</div>
        </div>
      </button>

      <span className={styles.brandDivider} aria-hidden="true" />

      <nav className={styles.breadcrumb} aria-label="breadcrumb">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <React.Fragment key={idx}>
              {crumb.clickable && crumb.href ? (
                <button
                  className={`${styles.crumbItem} ${styles.crumbLink}`}
                  onClick={() => router.push(crumb.href!)}
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  className={`${styles.crumbItem} ${crumb.active ? styles.crumbActive : ""}`}
                >
                  {crumb.label}
                </span>
              )}
              {!isLast && (
                <span className={styles.crumbSep} aria-hidden="true">
                  <ChevronRight />
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <div className={styles.rightArea}>
        <button
          className={styles.iconButton}
          onClick={onToggleTheme}
          type="button"
          aria-label={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
          title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </button>

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
          <div className={styles.userMeta}>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userRole}>
              {ROLE_LABEL[user.role] ?? user.role}
            </div>
          </div>

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
      </div>
    </div>
  );
}
