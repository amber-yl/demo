import type { NextConfig } from "next";
import type { Configuration, RuleSetRule } from "webpack";

const BRAND_VARS = `
  @brand-500: #22d3ee;
  @brand-400: #0891b2;
  @brand-600: #06b6d4;
  @brand-700: #0e7490;
  @accent-500: #f59e0b;
  @success: #10b981;
  @warning: #f59e0b;
  @danger: #ef4444;
  @purple: #8b5cf6;
  @radius-sm: 6px;
  @radius-md: 10px;
  @radius-lg: 14px;
`;

type RuleUseEntry =
  | string
  | { loader?: string; options?: Record<string, unknown> };

function ruleUseLoaders(use: RuleSetRule["use"] | undefined): RuleUseEntry[] {
  if (!use) return [];
  if (typeof use === "string") return [use];
  if (Array.isArray(use)) {
    const out: RuleUseEntry[] = [];
    for (const u of use) {
      if (typeof u === "string") out.push(u);
      else if (u && typeof u === "object" && "loader" in u) {
        out.push({
          loader: (u as { loader?: string }).loader,
          options: (u as { options?: Record<string, unknown> }).options,
        });
      }
    }
    return out;
  }
  if (typeof use === "object") {
    return [
      {
        loader: (use as { loader?: string }).loader,
        options: (use as { options?: Record<string, unknown> }).options,
      },
    ];
  }
  return [];
}

/**
 * 基于 Next.js 内置的 CSS Modules / 全局 CSS 规则克隆出对应的 Less 规则。
 * next-with-less v3.0.1 仅适配 Next 13.3，在 Next 15.3 下无法正确克隆
 * 带 issuerLayer 的 app/pages 分层规则，会导致 .module.less 命中兜底 error-loader
 * 报 "CSS Modules cannot be imported from within node_modules"，故沿用此实现。
 */
function injectLessSupport(config: Configuration): void {
  const rules = config.module?.rules ?? [];
  const oneOfRule = rules.find(
    (r) => r && typeof r === "object" && "oneOf" in r && Array.isArray((r as { oneOf?: unknown[] }).oneOf),
  ) as { oneOf: RuleSetRule[] } | undefined;
  if (!oneOfRule || !oneOfRule.oneOf) return;

  const original = [...oneOfRule.oneOf];

  const getTest = (r: RuleSetRule): RegExp | null => {
    if (!r || typeof r !== "object" || !("test" in r)) return null;
    const t = (r as { test?: unknown }).test;
    return t instanceof RegExp ? t : null;
  };

  const moduleCssRule: RuleSetRule | undefined = original.find((r) => {
    const t = getTest(r);
    return !!t && /module/.test(t.source) && /css/.test(t.source);
  });

  const moduleIdx = moduleCssRule ? original.indexOf(moduleCssRule) : -1;
  const globalCssRule: RuleSetRule | undefined = original.find((r, i) => {
    if (moduleIdx >= 0 && i <= moduleIdx) return false;
    const t = getTest(r);
    if (!t) return false;
    if (!/css/.test(t.source)) return false;
    if (/module/.test(t.source)) return false;
    return /\\\.css|\/\.css|\.css\$/.test(t.source);
  });

  const lessModuleRule: RuleSetRule | null = moduleCssRule
    ? cloneCssRuleForLess(moduleCssRule, true)
    : null;
  const lessGlobalRule: RuleSetRule | null = globalCssRule
    ? cloneCssRuleForLess(globalCssRule, false)
    : null;

  const insertAtOriginal = (
    baseRule: RuleSetRule | undefined,
    newRule: RuleSetRule | null,
    resultList: RuleSetRule[],
  ): RuleSetRule[] => {
    if (!newRule) return resultList;
    const idx = baseRule ? original.indexOf(baseRule) : -1;
    if (idx >= 0) {
      const origBefore = original.slice(0, idx);
      let pos = 0;
      for (const r of resultList) {
        if (origBefore.includes(r)) pos++;
      }
      resultList.splice(pos, 0, newRule);
    } else {
      resultList.unshift(newRule);
    }
    return resultList;
  };

  let merged: RuleSetRule[] = [...original];
  merged = insertAtOriginal(moduleCssRule, lessModuleRule, merged);
  merged = insertAtOriginal(globalCssRule, lessGlobalRule, merged);
  oneOfRule.oneOf = merged;
}

function cloneCssRuleForLess(
  baseRule: RuleSetRule,
  isModule: boolean,
): RuleSetRule {
  const useList = ruleUseLoaders(baseRule.use);

  useList.push({
    loader: require.resolve("less-loader"),
    options: {
      lessOptions: {
        javascriptEnabled: true,
      },
      additionalData: BRAND_VARS,
    },
  });

  return {
    ...baseRule,
    test: isModule ? /\.module\.less$/ : /\.less$/,
    use: useList,
  };
}

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // 按需引入 lucide-react 图标，避免全量打包拖慢首屏编译
    optimizePackageImports: ["lucide-react"],
  },
  webpack: (config) => {
    injectLessSupport(config);
    return config;
  },
};

export default nextConfig;
