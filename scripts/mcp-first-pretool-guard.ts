#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const delegateCommand = process.env.WP_PRETOOL_GUARD_BIN || "wp-pretool-guard";

const AUDIT_KINDS = new Set([
  "tph",
  "tph-e2e",
  "agents",
  "catalog-drift",
  "package-surface",
  "docs-frontmatter",
  "blueprint-lifecycle",
  "architecture-drift",
  "absolute-path-policy",
  "no-first-party-mjs",
  "roadmap-links",
  "bundle-budget",
  "commit-message",
  "tech-debt",
  "hook-surface",
  "ai-contracts",
  "no-relative-package-scripts",
]);

const SCRIPT_ROUTES = [
  {
    prefixes: [
      "pnpm run verify:paths",
      "pnpm verify:paths",
      "npm run verify:paths",
      "vp run verify:paths",
    ],
    reason:
      'Use wp_audit(kind="absolute-path-policy") instead — path-policy enforcement is owned by the agent-kit MCP audit surface.',
  },
  {
    prefixes: ["pnpm run docs:check", "pnpm docs:check", "npm run docs:check", "vp run docs:check"],
    reason:
      'Use wp_audit(kind="docs-frontmatter") instead — docs frontmatter checks are owned by the agent-kit MCP audit surface.',
  },
  {
    prefixes: [
      "pnpm run blueprints:check",
      "pnpm blueprints:check",
      "npm run blueprints:check",
      "vp run blueprints:check",
    ],
    reason:
      'Use wp_audit(kind="blueprint-lifecycle") instead — blueprint lifecycle checks are owned by the agent-kit MCP audit surface.',
  },
];

function makeDeny(reason: string) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

function writeJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function stripLeadingEnvironmentAssignments(command: string) {
  let next = command.trim();
  const assignmentPrefix =
    /^(?:env\s+)?(?:[A-Za-z_][A-Za-z0-9_]*=(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+)\s+)+/u;
  while (next) {
    const updated = next.replace(assignmentPrefix, "").trim();
    if (updated === next) return next;
    next = updated;
  }
  return next;
}

function normalizeCommand(command: string) {
  const trimmed = stripLeadingEnvironmentAssignments(command);
  const unwrapped = trimmed.replace(/^(?:with-secrets\s+--\s+)+/u, "");
  const corepackMatch =
    /^corepack\s+(pnpm|pnpx|npm|npx|yarn|yarnpkg|bun|bunx)(?:@[^\s]+)?\s+([\s\S]+)$/u.exec(
      unwrapped,
    );
  const corepackStripped = corepackMatch ? `${corepackMatch[1]} ${corepackMatch[2]}` : unwrapped;
  return corepackStripped.replace(/\s+/gu, " ").trim();
}

function matchesPrefix(command: string, prefix: string) {
  return command === prefix || command.startsWith(`${prefix} `);
}

function extractCommand(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const toolInput = (input as { tool_input?: unknown }).tool_input;
  if (!toolInput || typeof toolInput !== "object") return null;
  if (typeof (toolInput as { command?: unknown }).command === "string") {
    return (toolInput as { command: string }).command;
  }
  if (typeof (toolInput as { cmd?: unknown }).cmd === "string") {
    return (toolInput as { cmd: string }).cmd;
  }
  return null;
}

function routePackageManagerCommand(command: string) {
  if (/^(?:pnpm|npm)\s+(?:install|i)\b/u.test(command)) {
    return "Use vp install instead — dependency installation should go through the vp surface in this repo.";
  }

  const filteredExecMatch = /^(?:pnpm|npm)\s+--filter\s+(\S+)\s+exec\s+([\s\S]+)$/u.exec(command);
  if (filteredExecMatch) {
    const [, filter, execCommand] = filteredExecMatch;
    return `Use vp exec --filter ${filter} -- ${execCommand} instead — filtered workspace execution should go through the vp surface.`;
  }

  const filteredRunMatch =
    /^(?:pnpm|npm)\s+--filter\s+(\S+)\s+run\s+([^\s]+)(?:\s+([\s\S]+))?$/u.exec(command);
  if (filteredRunMatch) {
    const [, filter, task, rest] = filteredRunMatch;
    return `Use vp run --filter ${filter} ${task}${rest ? ` ${rest}` : ""} instead — filtered workspace tasks should go through the vp surface.`;
  }

  const execMatch = /^(?:pnpm|npm)\s+exec\s+([\s\S]+)$/u.exec(command);
  if (execMatch) {
    return `Use vp exec -- ${execMatch[1]} instead — package-manager command execution should go through the vp surface.`;
  }

  const runMatch = /^(?:pnpm|npm)\s+run\s+([^\s]+)(?:\s+([\s\S]+))?$/u.exec(command);
  if (runMatch) {
    const [, task, rest] = runMatch;
    return `Use vp run ${task}${rest ? ` ${rest}` : ""} instead — package scripts should go through the vp surface in this repo.`;
  }

  const shorthandTaskMatch = /^(?:pnpm|npm)\s+([A-Za-z0-9:_-]+)(?:\s+([\s\S]+))?$/u.exec(command);
  if (shorthandTaskMatch) {
    const [, task, rest] = shorthandTaskMatch;
    return `Use vp run ${task}${rest ? ` ${rest}` : ""} instead — package scripts should go through the vp surface in this repo.`;
  }

  return "Use vp/wp/MCP surfaces instead — raw pnpm/npm commands are not part of the supported repo workflow except explicit edge-case exceptions.";
}

function routeCommand(command: string) {
  const normalized = normalizeCommand(command);
  if (!normalized) return null;

  const auditMatch = /^wp\s+audit\s+([a-z0-9-]+)\b/u.exec(normalized);
  if (auditMatch) {
    const kind = auditMatch[1];
    if (AUDIT_KINDS.has(kind)) {
      return `Use wp_audit(kind="${kind}") instead — this audit is owned by the canonical agent-kit MCP surface.`;
    }
  }

  for (const route of SCRIPT_ROUTES) {
    for (const prefix of route.prefixes) {
      if (matchesPrefix(normalized, prefix)) return route.reason;
    }
  }

  if (/^(?:pnpm|npm)\b/u.test(normalized)) {
    return routePackageManagerCommand(normalized);
  }

  return null;
}

function delegate(rawInput: string) {
  const result = spawnSync(delegateCommand, [], {
    input: rawInput,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  if (result.error && "code" in result.error && result.error.code === "ENOENT") {
    writeJson(
      makeDeny(
        "wp-pretool-guard is unavailable. Run vp install or wp setup to restore the agent-kit hook surface.",
      ),
    );
    process.exit(0);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  process.exit(1);
}

export function inspectHookInput(rawInput: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawInput);
  } catch {
    return { action: "delegate", reason: null as string | null };
  }

  const command = extractCommand(parsed);
  if (!command) return { action: "delegate", reason: null as string | null };

  const reason = routeCommand(command);
  if (!reason) return { action: "delegate", reason: null as string | null };
  return { action: "deny", reason };
}

export function run(rawInput: string) {
  const decision = inspectHookInput(rawInput);
  if (decision.action === "deny" && decision.reason) {
    writeJson(makeDeny(decision.reason));
    return 0;
  }

  delegate(rawInput);
  return 0;
}

if (process.argv[1] === __filename) {
  let rawInput = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    rawInput += chunk;
  });
  process.stdin.on("end", () => {
    run(rawInput);
  });
}
