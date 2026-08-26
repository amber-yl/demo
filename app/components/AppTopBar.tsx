"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Sun, Moon } from "lucide-react";
import { ROUTE_GROUPS, STANDALONE_ROUTES, isPathInGroup } from "@/routes";
import styles from "./AppTopBar.module.less";

type Props = {
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
  theme,
  onToggleTheme,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <div className={styles.topbar}>
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
      </div>
    </div>
  );
}
