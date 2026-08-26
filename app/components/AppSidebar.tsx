"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu, Tooltip } from "antd";
import type { MenuProps } from "antd";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Home,
} from "lucide-react";
import type { User } from "@/types";
import { ROLE_LABEL } from "@/utils";
import {
  ROUTE_GROUPS,
  STANDALONE_ROUTES,
  isPathInGroup,
} from "@/routes";
import styles from "./AppSidebar.module.less";

type Props = {
  user: User;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  theme: "dark" | "light";
};

/** 将路由配置转为 antd Menu items */
function buildMenuItems(): MenuProps["items"] {
  const items: MenuProps["items"] = [];

  // 分组路由（有子菜单）
  for (const group of ROUTE_GROUPS) {
    const GroupIcon = group.icon;
    items.push({
      key: group.key,
      icon: <GroupIcon size={16} />,
      label: group.title,
      children: group.children.map((child) => {
        const ChildIcon = child.icon;
        return {
          key: child.path,
          icon: <ChildIcon size={14} />,
          label: child.title,
        };
      }),
    });
  }

  // 独立路由（无子菜单）
  for (const route of STANDALONE_ROUTES) {
    const RouteIcon = route.icon;
    items.push({
      key: route.path,
      icon: <RouteIcon size={16} />,
      label: route.title,
    });
  }

  return items;
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
  const navigate = (path: string) => router.push(path);

  // 根据 pathname 确定选中项和展开的分组
  let activeKey = "";
  let activeGroupKey = "";

  for (const group of ROUTE_GROUPS) {
    if (isPathInGroup(pathname, group.key)) {
      activeGroupKey = group.key;
      const child = group.children.find(
        (c) => pathname === c.path || pathname.startsWith(c.path + "/"),
      );
      if (child) activeKey = child.path;
      break;
    }
  }

  if (!activeKey) {
    for (const route of STANDALONE_ROUTES) {
      if (pathname === route.path || pathname.startsWith(route.path + "/")) {
        activeKey = route.path;
        break;
      }
    }
  }

  const [openKeys, setOpenKeys] = useState<string[]>(
    activeGroupKey ? [activeGroupKey] : [],
  );

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    navigate(key);
  };

  // 用户信息弹出层（保留自定义实现）
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

  const menuItems = buildMenuItems();

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
        {/* 返回 Dashboard 按钮 */}
        {collapsed ? (
          <Tooltip title="返回 Dashboard" placement="right">
            <button
              className={`${styles.menuItem} ${styles.homeBtn}`}
              onClick={() => navigate("/dashboard")}
            >
              <span className={styles.menuIcon}>
                <Home size={18} />
              </span>
            </button>
          </Tooltip>
        ) : (
          <button
            className={`${styles.menuItem} ${styles.homeBtn}`}
            onClick={() => navigate("/dashboard")}
          >
            <span className={styles.menuIcon}>
              <Home size={18} />
            </span>
            <span className={styles.menuLabel}>返回 Dashboard</span>
          </button>
        )}

        {/* antd Menu：收起模式下通过 Portal 渲染 tooltip/popup，不受父容器 overflow 限制 */}
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={activeKey ? [activeKey] : []}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={(keys) => !collapsed && setOpenKeys(keys as string[])}
          items={menuItems}
          onClick={handleMenuClick}
          theme={theme}
          className={styles.antMenu}
        />
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

        <Tooltip title={collapsed ? "展开侧栏" : "收起侧栏"} placement="right">
          <button
            className={styles.collapseBtn}
            onClick={onToggleCollapse}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
