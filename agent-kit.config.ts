export const agentKitConfig = {
  e2e: {
    hostAdapterModule: "./apps/e2e/src/agent-kit-host-adapter.ts",
  },
  deploy: {
    cloudflare: {
      lanes: {
        dev: { wranglerEnvName: "dev" },
        preview_main: { wranglerEnvName: "preview-main" },
        preview_pr: { wranglerEnvNamePattern: "preview-pr-<n>" },
        prd: {
          wranglerEnvName: "production",
          deployedWorkerNameMode: "top_level_name",
        },
      },
      production: {
        metadataPath: "infra/release-metadata.production.json",
      },
      targets: [
        {
          id: "edge-matte-worker",
          type: "worker_plus_assets",
          topLevelWorkerName: "edge-matte",
          previewTransport: "workers_dev_env",
          vars: {
            APP_ORIGIN: "https://edge-matte.ozby.dev",
          },
          requiredSecrets: [],
          storageMode: "isolated",
          destroyMode: "wrangler_delete_env",
          productionStrategyDefault: "direct",
        },
      ],
    },
  },
} as const;

export default agentKitConfig;
