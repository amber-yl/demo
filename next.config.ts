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
 * （不能依赖 .scss 规则——如果项目没有安装 sass 包，Next 根本不会注入 scss 规则。）
 *
 * 思路：
 *   1. 找到 Next 内置处理 `.module.css` 的 rule → 克隆为 `.module.less` 规则（Less + CSS Modules）
 *   2. 找到 Next 内置处理纯 `.css` 的 rule → 克隆为纯 `.less` 规则（全局 Less）
 *   3. 复制 use 链（Next 官方的 mini-css-extract / css-loader / postcss /
 *      CSS Modules 配置、issuer 等全部复用），然后把 less-loader 插在最前面。
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

  // 1. 先找 `.module.css` 规则（source 里同时包含 module + css）
  const moduleCssRule: RuleSetRule | undefined = original.find((r) => {
    const t = getTest(r);
    return !!t && /module/.test(t.source) && /css/.test(t.source);
  });

  // 2. 再找全局 `.css` 规则（包含 css 但不含 module，且为常规 .css test）
  //    注意：必须找 module 规则之后出现的那条，避免取到 oneOf 前面残留的特殊 CSS 规则
  const moduleIdx = moduleCssRule ? original.indexOf(moduleCssRule) : -1;
  const globalCssRule: RuleSetRule | undefined = original.find((r, i) => {
    if (moduleIdx >= 0 && i <= moduleIdx) return false;
    const t = getTest(r);
    if (!t) return false;
    if (!/css/.test(t.source)) return false;
    if (/module/.test(t.source)) return false;
    // 排除特殊路径匹配（next-image-loader 之类也会用类似 css 的占位）
    return /\\\.css|\/\.css|\.css\$/.test(t.source);
  });

  const lessModuleRule: RuleSetRule | null = moduleCssRule
    ? cloneCssRuleForLess(moduleCssRule, true)
    : null;
  const lessGlobalRule: RuleSetRule | null = globalCssRule
    ? cloneCssRuleForLess(globalCssRule, false)
    : null;

  // 插入顺序：先 .module.less（更具体），再 .less（全局）
  // 位置：插在它对应的 CSS 规则之前，保证命中时先取 Less 版本
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
  // issuer / include / exclude / parser / resolve 等内部使用 Set/Map/RegExp，
  // 必须按引用保留，绝不能 JSON 序列化。只替换 test 和 use。
  const useList = ruleUseLoaders(baseRule.use);

  // 若源规则是 .module.css，less-loader 插在最末尾（最先执行）
  // 普通 less 文件同理。这里不需要额外过滤，因为 css-loader 直接兼容 less-loader 输出。
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
  transpilePackages: ["lucide-react"],
  devIndicators: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  webpack: (config) => {
    injectLessSupport(config);
    return config;
  },
};

export default nextConfig;
