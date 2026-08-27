"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Tooltip } from "antd";
import type { ConfigSchema, SchemaProperty } from "@/utils/api";
import sf from "./SchemaFormFields.module.less";

// ============= JSON Schema 工具 =============

/** 找到 schema 中带 x-variants 的类型选择属性（model_type / chip_type） */
export function typeKeyOf(schema: ConfigSchema | null): string | null {
  if (!schema) return null;
  return (
    Object.keys(schema.properties ?? {}).find((k) =>
      Array.isArray(schema.properties[k]?.["x-variants"]),
    ) ?? null
  );
}

/** 按路径读取嵌套值，支持数组下标（如 data_placement.memory.0.capacity_gb） */
export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, seg) => {
    if (acc == null) return undefined;
    if (Array.isArray(acc)) return acc[Number(seg)];
    return (acc as Record<string, unknown>)[seg];
  }, obj);
}

/** 不可变地按路径写入嵌套值 */
export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const segs = path.split(".");
  const clone = (node: unknown, i: number): unknown => {
    if (i === segs.length) return value;
    const key = segs[i];
    if (Array.isArray(node)) {
      const arr = [...node];
      arr[Number(key)] = clone(arr[Number(key)], i + 1);
      return arr;
    }
    const rec = { ...(node as Record<string, unknown>) };
    rec[key] = clone(rec[key], i + 1);
    return rec;
  };
  return clone(obj, 0) as T;
}

/** 按路径解析 schema 属性定义（取 title/unit/enum 等） */
export function resolveProp(
  schema: ConfigSchema | null,
  path: string,
): SchemaProperty | null {
  if (!schema) return null;
  let node: unknown = schema;
  for (const seg of path.split(".")) {
    if (!Number.isNaN(Number(seg))) continue; // 数组下标层级
    if (node && typeof node === "object") {
      const rec = node as Record<string, unknown>;
      if (rec.properties && typeof rec.properties === "object") {
        node = (rec.properties as Record<string, unknown>)[seg];
        continue;
      }
      if (rec.items && typeof rec.items === "object") {
        node = rec.items;
        const itemRec = node as Record<string, unknown>;
        if (itemRec.properties && typeof itemRec.properties === "object") {
          node = (itemRec.properties as Record<string, unknown>)[seg];
          continue;
        }
      }
    }
    return null;
  }
  return (node as SchemaProperty) ?? null;
}

/** 判断路径对应字段是否为 schema 标记的必填项 */
export function isRequiredBySchema(schema: ConfigSchema, path: string): boolean {
  const segs = path.split(".");
  const leaf = segs[segs.length - 1];
  const parentPath = segs
    .slice(0, -1)
    .filter((s) => Number.isNaN(Number(s)))
    .join(".");
  const parent = parentPath
    ? resolveProp(schema, parentPath)
    : (schema as unknown as SchemaProperty);
  const required =
    parent?.required ?? (parent?.items as { required?: string[] } | undefined)?.required;
  return Array.isArray(required) && required.includes(leaf);
}

/** 从 schema 初始化值集合：类型选择属性取首个枚举值 + 对应 variant */
export function initValuesFromSchema(schema: ConfigSchema | null): Record<string, unknown> {
  const key = typeKeyOf(schema);
  if (!schema || !key) return {};
  const prop = schema.properties[key];
  const first = prop?.enum?.[0];
  const variant = prop?.["x-variants"]?.[0] ?? {};
  return { ...(first !== undefined ? { [key]: first } : {}), ...variant };
}

// ============= 自研校验（依据 JSON Schema） =============

export type FieldErrors = Record<string, string | undefined>;

const isEmpty = (v: unknown) => v === undefined || v === null || v === "";

/** 单字段校验：required / 数字 / min / max / pattern */
export function validateSchemaField(
  prop: SchemaProperty,
  value: unknown,
  required: boolean,
): string | null {
  const title = prop.title ?? "该项";
  if (isEmpty(value)) {
    return required ? `${title}为必填项` : null;
  }
  const isNumber = prop.type === "number" || prop.type === "integer";
  if (isNumber) {
    const num = Number(value);
    if (Number.isNaN(num)) return `${title}必须为数字`;
    if (prop.minimum !== undefined && num < prop.minimum) {
      return `${title}不能小于 ${prop.minimum}`;
    }
    if (prop.maximum !== undefined && num > prop.maximum) {
      return `${title}不能大于 ${prop.maximum}`;
    }
  }
  if (typeof prop.pattern === "string" && prop.pattern) {
    try {
      if (!new RegExp(prop.pattern).test(String(value))) {
        return `${title}格式不正确`;
      }
    } catch {
      /* 非法正则忽略 */
    }
  }
  return null;
}

/** 校验 schema 的全部主要参数，返回 path -> 错误信息 */
export function validateSchemaFields(
  schema: ConfigSchema,
  values: Record<string, unknown>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const path of schema["x-main-paths"] ?? []) {
    const prop = resolveProp(schema, path);
    if (!prop) continue;
    const msg = validateSchemaField(
      prop,
      getByPath(values, path),
      isRequiredBySchema(schema, path),
    );
    if (msg) errors[path] = msg;
  }
  return errors;
}

// ============= 自研表单行：label 一列 + 输入框一列 =============

/** 省略号 label：被截断时悬停 Tooltip 显示全文 */
function EllipsisLabel({ text, required }: { text: string; required?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  return (
    <Tooltip title={clipped ? text : null} placement="topLeft">
      <div
        ref={ref}
        className={`${sf.fieldLabel} ${required ? sf.fieldRequired : ""}`}
        onMouseEnter={() => {
          const el = ref.current;
          if (el) setClipped(el.scrollWidth > el.clientWidth);
        }}
      >
        {text}
      </div>
    </Tooltip>
  );
}

export function FieldRow({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={sf.fieldRow}>
      <EllipsisLabel text={label} required={required} />
      <div className={sf.fieldControl}>
        {children}
        {error ? <div className={sf.fieldError}>{error}</div> : null}
      </div>
    </div>
  );
}

export function FieldGrid({
  columns = 1,
  children,
}: {
  columns?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        columnGap: 16,
      }}
    >
      {children}
    </div>
  );
}

// ============= 类型卡片选择（模型/芯片） =============

/**
 * 卡片式类型选择：分类筛选 Tab + 卡片栅格；
 * 选中卡片以品牌色边框 + 右上角「已选」徽标标识。
 */
export function SchemaCardGrid({
  schema,
  value,
  onSelect,
  columns = 2,
}: {
  schema: ConfigSchema;
  /** 当前选中的类型枚举值 */
  value?: string;
  onSelect: (type: string) => void;
  /** 栅格列数，1 = 每张卡片独占一行 */
  columns?: 1 | 2;
}) {
  const [tab, setTab] = useState("全部");
  const cards = schema["x-cards"] ?? [];
  const categories = Array.from(
    new Set(cards.map((c) => c.category).filter((c): c is string => Boolean(c))),
  );

  const shown = tab === "全部" ? cards : cards.filter((c) => c.category === tab);

  return (
    <div className={sf.cardWrap}>
      {categories.length > 1 && (
        <div className={sf.cardTabs}>
          {["全部", ...categories].map((cat) => (
            <button
              key={cat}
              type="button"
              className={`${sf.cardTab} ${tab === cat ? sf.cardTabActive : ""}`}
              onClick={() => setTab(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
      <div
        className={sf.cardGrid}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {shown.map((card) => {
          const active = card.type === value;
          return (
            <div
              key={card.type}
              role="button"
              tabIndex={0}
              className={
                active ? `${sf.modelCard} ${sf.modelCardActive}` : sf.modelCard
              }
              onClick={() => onSelect(card.type)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(card.type);
                }
              }}
            >
              {active ? (
                <span className={`${sf.cardCorner} ${sf.selBadge}`}>✓ 已选</span>
              ) : card.recommended ? (
                <span className={`${sf.cardCorner} ${sf.recBadge}`}>推荐</span>
              ) : null}
              <div className={sf.cardHead}>
                <div className={sf.cardName}>{card.type}</div>
                {card.tags && card.tags.length > 0 && (
                  <div className={sf.cardTags}>
                    {card.tags.map((t, ti) => (
                      <span key={t} className={`${sf.cardTag} ${sf[`tag${ti % 3}`]}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {card.description && (
                <div className={sf.cardDesc}>{card.description}</div>
              )}
              {card.summary && <div className={sf.cardSummary}>{card.summary}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
