"use client";

import { useState } from "react";
import {
  User as UserIcon,
  Lock as LockIcon,
  LogIn as LogInIcon,
  AlertTriangle as ExclamationTriangleIcon,
  Sparkles as SparklesIcon,
} from "lucide-react";
import type { User } from "../types";
import { BACKEND, TOKEN_KEY, USER_KEY } from "../utils";
import { useToast } from "../page";
import styles from "./Login.module.less";

const DEMO_USERS: Record<string, { pwd: string; user: User }> = {
  admin: {
    pwd: "admin123",
    user: {
      username: "admin",
      name: "系统管理员",
      email: "admin@simforge.internal",
      role: "admin",
    },
  },
  chris: {
    pwd: "chris123",
    user: {
      username: "chris",
      name: "Chris Chen",
      email: "chris.chen@simforge.internal",
      role: "engineer",
    },
  },
  engineer: {
    pwd: "sim123",
    user: {
      username: "engineer",
      name: "仿真工程师",
      email: "engineer@simforge.internal",
      role: "engineer",
    },
  },
};

type Props = {
  onLogin: (token: string, user: User) => void;
};

export default function LoginPage({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  const doLogin = async (vals: { username: string; password: string }) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${BACKEND}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vals),
      });
      if (res.ok) {
        const data = await res.json();
        const token: string = data.token ?? data.access_token ?? `demo-${Date.now()}`;
        const user: User = {
          username: data.user?.username ?? data.username ?? vals.username,
          name: data.user?.name ?? data.name ?? vals.username,
          email: data.user?.email ?? data.email ?? `${vals.username}@simforge.internal`,
          role: data.user?.role ?? data.role ?? DEMO_USERS[vals.username]?.user.role ?? "user",
        };
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        onLogin(token, user);
        toast.success(`欢迎回来，${user.name}`);
        return;
      }
      throw new Error(`后端拒绝：${res.status}`);
    } catch {
      const demo = DEMO_USERS[vals.username];
      if (demo && demo.pwd === vals.password) {
        const token = `demo-local-${vals.username}-${Date.now()}`;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(demo.user));
        onLogin(token, demo.user);
        toast.success(`（离线演示）欢迎回来，${demo.user.name}`);
        return;
      }
      setErr(
        demo
          ? "密码不正确（演示账号已内置，默认同账号名前缀 + 123）"
          : `用户名或密码不正确；或后端 ${BACKEND}/api/auth/login 不可达。\n演示账号：admin/admin123、chris/chris123、engineer/sim123。`,
      );
      toast.error("登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit: React.ComponentProps<"form">["onSubmit"] = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const username = (formData.get("username") as string)?.trim() ?? "";
    const password = (formData.get("password") as string) ?? "";
    if (!username || !password) return;
    doLogin({ username, password });
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <div className={styles.logoWrapper}>S</div>
          <h1 className={styles.title}>SimForge · Nebula Lab</h1>
          <p className={styles.subtitle}>智能仿真管理平台</p>
        </div>

        {err && (
          <div className={styles.errorAlert} role="alert">
            <ExclamationTriangleIcon className={styles.errorIcon} />
            <div className={styles.errorContent}>
              <p className={styles.errorTitle}>登录失败</p>
              <p className={styles.errorMessage}>{err}</p>
            </div>
          </div>
        )}

        <form className={styles.loginForm} onSubmit={handleSubmit} noValidate>
          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.formLabel}>
              <UserIcon className={styles.labelIcon} />
              用户名
            </label>
            <div className={styles.inputWrapper}>
              <UserIcon className={styles.inputIcon} />
              <input
                id="username"
                name="username"
                type="text"
                className={styles.formInput}
                placeholder="admin / chris / engineer"
                defaultValue="admin"
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.formLabel}>
              <LockIcon className={styles.labelIcon} />
              密码
            </label>
            <div className={styles.inputWrapper}>
              <LockIcon className={styles.inputIcon} />
              <input
                id="password"
                name="password"
                type="password"
                className={styles.formInput}
                placeholder="admin123 / chris123 / sim123"
                defaultValue="admin123"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.loadingSpinner} />
            ) : (
              <LogInIcon className={styles.submitIcon} />
            )}
            {loading ? "登录中..." : "登录 Nebula"}
          </button>
        </form>

        <div className={styles.demoHint}>
          <div className={styles.demoHintHeader}>
            <SparklesIcon className={styles.sparklesIcon} />
            <span>演示账号（前后端离线均可登录）：</span>
          </div>
          <div className={styles.demoAccounts}>
            <code>admin / admin123</code>
            &nbsp;·&nbsp;
            <code>chris / chris123</code>
            &nbsp;·&nbsp;
            <code>engineer / sim123</code>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";
