import { codeInspectorPlugin } from 'code-inspector-plugin'
import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  // NOTE: 不要显式写 main，交给 vinext 内置的 worker runtime 接管
  compatibility_flags: ["nodejs_compat"],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    css: {
      modules: {
        generateScopedName: process.env.NODE_ENV === "production"
          ? "[hash:base64:8]"
          : "[name]__[local]___[hash:base64:5]",
        localsConvention: "camelCaseOnly",
        exportGlobals: true,
      },
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
          additionalData: `
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
          `,
        },
      },
    },
    plugins: [
      codeInspectorPlugin({
        bundler: 'vite',
        enforcePre: true,
        editor: 'trae',
        hideConsole: false,
        include: [/\.jsx?$/, /\.tsx?$/],
        exclude: [/node_modules/, /\.next/, /dist/],
        showSwitch: true,
      }),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      })
    ],
  };
});
