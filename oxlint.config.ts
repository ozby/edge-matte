import { rules as webpressoRules } from "@webpresso/agent-kit/oxlint";
import { defineConfig } from "oxlint";

export default defineConfig({
  jsPlugins: [
    "@webpresso/agent-kit/oxlint/code-safety",
    "@webpresso/agent-kit/oxlint/foundation-purity",
    "@webpresso/agent-kit/oxlint/graphql-conventions",
    "@webpresso/agent-kit/oxlint/import-hygiene",
    "@webpresso/agent-kit/oxlint/monorepo-paths",
    "@webpresso/agent-kit/oxlint/query-patterns",
    "@webpresso/agent-kit/oxlint/testing-quality",
    "@webpresso/agent-kit/oxlint/tier-boundaries",
  ],
  rules: {
    ...webpressoRules,
  },
});
