export const agentKitConfig = {
  e2e: {
    hostAdapterModule: "./apps/e2e/src/agent-kit-host-adapter.ts",
  },
  deploy: {
    adapterModule: "./infra/src/deploy/agent-kit-deploy-adapter.ts",
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
          previewTransport: "custom_domain_env",
          routeSpec: { pattern: "preview-main.edge-matte.ozby.dev" },
          vars: {},
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
