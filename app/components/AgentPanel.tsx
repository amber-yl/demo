"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  X,
  Bot,
  UserRound,
  Sparkles,
  Lightbulb,
  Wand2,
  ChevronRight,
} from "lucide-react";
import type { AgentContext, User } from "@/types";
import { BACKEND, WORKLOAD_LABEL, SCENE_LABEL, headers } from "@/utils";
import { api } from "@/utils/api";
import styles from "./AgentPanel.module.less";
import { Button } from 'antd';

type ChatMsg = {
  id: number;
  role: "user" | "agent";
  text: string;
  patches?: Record<string, unknown>[];
  time?: number;
};

type Props = {
  token: string;
  open: boolean;
  onClose: () => void;
  context: AgentContext;
  applyPatch: (patch: Record<string, unknown>) => void;
  user: User;
  onApplyPrompt?: () => void;
};

function flattenPatch(patch: Record<string, unknown>): [string, string][] {
  const rows: [string, string][] = [];
  if (patch.scene) {
    rows.push([
      "场景",
      (patch.scene as string) === "pd_fused" ? "PD 融合" : "PD 分离",
    ]);
  }
  const walk = (obj: unknown, prefix = "") => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      Object.entries(obj as Record<string, unknown>).forEach(([k, v]) => {
        const next = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) {
          walk(v, next);
        } else {
          rows.push([next, String(v)]);
        }
      });
    }
  };
  (["system", "runtime"] as const).forEach((k) => {
    if ((patch as Record<string, unknown>)[k]) {
      walk((patch as Record<string, unknown>)[k], k);
    }
  });
  return rows;
}

function mergePatches(patches: Record<string, unknown>[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const deepMerge = (target: Record<string, unknown>, src: Record<string, unknown>) => {
    for (const k of Object.keys(src)) {
      const sv = src[k];
      const tv = target[k];
      if (
        sv &&
        typeof sv === "object" &&
        !Array.isArray(sv) &&
        tv &&
        typeof tv === "object" &&
        !Array.isArray(tv)
      ) {
        deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
      } else {
        target[k] = sv;
      }
    }
  };
  for (const p of patches) deepMerge(merged, p);
  return merged;
}

export default function AgentPanel({
  token,
  open,
  onClose,
  context,
  applyPatch,
  user,
  onApplyPrompt,
}: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 1,
      role: "agent",
      text: "我可以读取当前仿真上下文。试试问我：「如何降低首 Token 延迟？」「PD 分离 vs 融合如何选？」「配置最优批大小」。",
      time: new Date().getTime() as number,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(2);

  useEffect(() => {
    api
      .getAgentSuggestions()
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTo({
        top: bodyRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    const userMsg: ChatMsg = {
      id: nextIdRef.current++,
      role: "user",
      text,
      time: new Date().getTime() as number,
    };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`${BACKEND}/api/agent/chat`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ text, context }),
      });
      const data = await res.json();
      const agentMsg: ChatMsg = {
        id: nextIdRef.current++,
        role: "agent",
        text: data.reply ?? "暂未回复",
        time: new Date().getTime() as number,
      };
      if (data.patch) {
        agentMsg.patches = Array.isArray(data.patch) ? data.patch : [data.patch];
      } else if (data.patches) {
        agentMsg.patches = data.patches;
      }
      setMessages((p) => [...p, agentMsg]);
    } catch {
      const mockPatches: Record<string, unknown>[] = [
        {
          scene: context.workload === "training" ? "pd_fused" : "pd_separate",
        },
        {
          system: { batch_size: context.workload === "training" ? "4096" : "512" },
          runtime: { concurrency: "2048" },
        },
      ];
      setMessages((p) => [
        ...p,
        {
          id: nextIdRef.current++,
          role: "agent",
          text: `无法连接后端 ${BACKEND}。以下是离线演示回复：\n\n针对当前「${WORKLOAD_LABEL[context.workload]} · ${SCENE_LABEL[context.scene]}」场景，建议：\n1. 调整批大小与并发平衡吞吐与延迟；\n2. 根据显存情况启用 KV Cache 半精度。\n\n下方补丁可一键应用到表单。`,
          patches: mockPatches,
          time: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const initials = user.name ? user.name.slice(0, 2).toUpperCase() : "U";

  const handleSuggestionClick = (s: string) => {
    onApplyPrompt?.();
    send(s);
  };

  const handleApplyAll = (patches: Record<string, unknown>[]) => {
    const merged = mergePatches(patches);
    applyPatch(merged);
  };

  return (
    <>
      <Button
        className={styles.fab}
        onClick={onClose}
        aria-label={open ? "关闭 AI 助手" : "打开 Nebula AI 助手"}
        title={open ? "关闭 AI 助手" : "打开 Nebula AI 助手"}
      >
        <Sparkles />
      </Button>

      <div className={`${styles.drawer} ${open ? styles.open : ""}`}>
        <div className={styles.header}>
          <div className={styles.avatar}>
            <Bot />
          </div>
          <div className={styles.headerText}>
            <div className={styles.title}>Nebula AI 助手</div>
            <div className={styles.subtitle}>基于仿真知识的智能助手</div>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="关闭"
          >
            <X />
          </button>
        </div>

        <div className={styles.contextBanner}>
          <div className={styles.label}>正在分析</div>
          <div className={styles.tags}>
            <span className={`${styles.contextTag} ${styles.cyan}`}>
              <Sparkles />
              {WORKLOAD_LABEL[context.workload]}
            </span>
            <span className={`${styles.contextTag} ${styles.purple}`}>
              <Wand2 />
              {SCENE_LABEL[context.scene]}
            </span>
            {context.config_id && (
              <span className={styles.contextTag}>
                模板：{context.config_id}
              </span>
            )}
          </div>
        </div>

        <div className={styles.body} ref={bodyRef}>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`${styles.msgRow} ${m.role === "user" ? styles.user : styles.agent
                }`}
            >
              {m.role === "agent" && (
                <div className={`${styles.msgAvatar} ${styles.agentAvatar}`}>
                  <Bot />
                </div>
              )}
              <div
                className={`${styles.bubble} ${m.role === "user" ? styles.userBubble : styles.agentBubble
                  }`}
              >
                {m.text}
                {m.patches && m.patches.length > 0 && (
                  <div className={styles.patchList}>
                    <div className={styles.patchHeader}>
                      <Lightbulb />
                      推荐参数补丁（点击下方应用到表单）
                    </div>
                    <div className={styles.pills}>
                      {m.patches.flatMap((patch, pi) =>
                        flattenPatch(patch)
                          .slice(0, 6)
                          .map(([k, v], ri) => (
                            <span
                              key={`${pi}-${ri}`}
                              className={styles.pill}
                            >
                              <span className={styles.pillKey}>{k}</span>
                              <ChevronRight size={10} />
                              <span className={styles.pillVal}>{v}</span>
                            </span>
                          )),
                      )}
                    </div>
                    <button
                      className={styles.applyBtn}
                      onClick={() => handleApplyAll(m.patches!)}
                    >
                      <Wand2 />
                      应用推荐到表单
                    </button>
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className={`${styles.msgAvatar} ${styles.userAvatar}`}>
                  {initials || <UserRound size={16} />}
                </div>
              )}
            </div>
          ))}

          {messages.length <= 1 && (
            <div className={styles.suggestions}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  className={styles.suggestionTag}
                  onClick={() => handleSuggestionClick(s)}
                >
                  <Lightbulb />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.promptsRow}>
            {suggestions.map((s) => (
              <button
                key={s}
                className={styles.promptChip}
                onClick={() => handleSuggestionClick(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className={styles.inputRow}>
            <div
              className={`${styles.inputWrap} ${sending ? styles.loading : ""}`}
            >
              <textarea
                className={styles.textarea}
                value={input}
                placeholder="询问当前配置、结果或优化建议…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
              />
            </div>
            <button
              className={styles.sendBtn}
              onClick={() => send()}
              disabled={sending || !input.trim()}
              aria-label="发送"
            >
              <Send />
            </button>
          </div>
          <div className={styles.hint}>
            基于当前负载 / 场景 / 模板上下文提供建议，可一键应用推荐参数。
          </div>
        </div>
      </div>
    </>
  );
}
