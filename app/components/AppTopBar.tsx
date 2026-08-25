"use client";

import React, { useState } from "react";
import { ChevronRight, PlayCircle, Sun, Moon } from "lucide-react";
import type { PageId, WorkloadKind, SceneKind } from "../types";
import { WORKLOAD_LABEL, SCENE_LABEL } from "../utils";
import styles from "./AppTopBar.module.less";

type Props = {
  currentPage: PageId;
  onRunSim?: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

type Crumb = {
  label: string;
  subLabel?: string;
  active?: boolean;
};

function buildCrumbs(page: PageId): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Dashboard" }];

  if (page === "dashboard") {
    crumbs.push({ label: "总览", active: true });
  } else if (page.startsWith("simulation/workload/")) {
    const kind = page.split("/")[2] as WorkloadKind;
    crumbs.push({ label: "负载建模仿真" });
    crumbs.push({ label: WORKLOAD_LABEL[kind], active: true });
  }

  return crumbs;
}

function isWorkloadPage(page: PageId): page is `simulation/workload/${WorkloadKind}` {
  return page.startsWith("simulation/workload/");
}

export default function AppTopBar({
  currentPage,
  onRunSim,
  theme,
  onToggleTheme,
}: Props) {
  const crumbs = buildCrumbs(currentPage);
  const showSegmented = isWorkloadPage(currentPage);
  const [scene, setScene] = useState<SceneKind>("pd_separate");

  const handleSceneChange = (next: SceneKind) => {
    setScene(next);
    console.log("[AppTopBar] scene switched:", SCENE_LABEL[next]);
  };

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

      <div className={styles.centerArea}>
        {showSegmented && (
          <div className={styles.segmented} role="tablist">
            <button
              role="tab"
              aria-selected={scene === "pd_separate"}
              className={`${styles.segmentedBtn} ${scene === "pd_separate" ? styles.segmentedBtnActive : ""}`}
              onClick={() => handleSceneChange("pd_separate")}
              type="button"
            >
              {SCENE_LABEL.pd_separate}
            </button>
            <button
              role="tab"
              aria-selected={scene === "pd_fused"}
              className={`${styles.segmentedBtn} ${scene === "pd_fused" ? styles.segmentedBtnActive : ""}`}
              onClick={() => handleSceneChange("pd_fused")}
              type="button"
            >
              {SCENE_LABEL.pd_fused}
            </button>
          </div>
        )}
      </div>

      <div className={styles.rightArea}>
        {onRunSim && (
          <button
            className={styles.runButton}
            onClick={onRunSim}
            type="button"
          >
            <PlayCircle />
            运行仿真
          </button>
        )}
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
