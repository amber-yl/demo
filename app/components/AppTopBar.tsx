"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, Sun, Moon } from "lucide-react";
import type { PageId, WorkloadKind } from "../types";
import { WORKLOAD_LABEL } from "../utils";
import styles from "./AppTopBar.module.less";

type Props = {
  currentPage?: PageId;
  onRunSim?: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

type Crumb = {
  label: string;
  subLabel?: string;
  active?: boolean;
};

function buildCrumbs(page: PageId | string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Dashboard" }];

  if (page === "dashboard" || page === "/dashboard") {
    crumbs.push({ label: "总览", active: true });
  } else if (page.startsWith("simulation/workload/") || page.startsWith("/simulation/workload/")) {
    const parts = page.replace(/^\//, "").split("/");
    const kind = parts[2] as WorkloadKind;
    crumbs.push({ label: "负载建模仿真" });
    crumbs.push({ label: WORKLOAD_LABEL[kind], active: true });
  }

  return crumbs;
}

export default function AppTopBar({
  currentPage,
  theme,
  onToggleTheme,
}: Props) {
  const pathname = usePathname();
  // 用真实 URL pathname 作为来源，props 仅作为 fallback
  const page = currentPage ?? (pathname === "/dashboard" ? "dashboard" : pathname?.slice(1) ?? "dashboard");
  const crumbs = buildCrumbs(page);

  return (
    <div className={styles.topbar}>
      <nav className={styles.breadcrumb} aria-label="breadcrumb">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <React.Fragment key={idx}>
              <span
                className={`${styles.crumbItem} ${crumb.active ? styles.crumbActive : ""}`}
              >
                {crumb.label}
                {crumb.subLabel && (
                  <span className={styles.crumbSubLabel}>({crumb.subLabel})</span>
                )}
              </span>
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
