#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.dirname(__dirname)
const defaultDelegate = path.join(repoRoot, 'node_modules', '.bin', 'wp-pretool-guard')
const delegatePath = process.env.WP_PRETOOL_GUARD_BIN || defaultDelegate

const AUDIT_KINDS = new Set([
  'tph',
  'tph-e2e',
  'agents',
  'catalog-drift',
  'package-surface',
  'docs-frontmatter',
  'blueprint-lifecycle',
  'architecture-drift',
  'absolute-path-policy',
  'roadmap-links',
  'bundle-budget',
  'commit-message',
  'tech-debt',
  'hook-surface',
  'ai-contracts',
  'no-relative-package-scripts',
])

const ALLOWLIST_PREFIXES = [
  'pnpm install',
  'pnpm i',
  'npm install',
  'npm i',
  'vp install',
  'wp setup',
]

const SCRIPT_ROUTES = [
  {
    prefixes: ['pnpm run verify:paths', 'pnpm verify:paths', 'vp run verify:paths'],
    reason:
      'Use wp_audit(kind="absolute-path-policy") instead — path-policy enforcement is owned by the agent-kit MCP audit surface.',
  },
  {
    prefixes: ['pnpm run docs:check', 'pnpm docs:check', 'vp run docs:check'],
    reason:
      'Use wp_audit(kind="docs-frontmatter") instead — docs frontmatter checks are owned by the agent-kit MCP audit surface.',
  },
  {
    prefixes: ['pnpm run blueprints:check', 'pnpm blueprints:check', 'vp run blueprints:check'],
    reason:
      'Use wp_audit(kind="blueprint-lifecycle") instead — blueprint lifecycle checks are owned by the agent-kit MCP audit surface.',
  },
  {
    prefixes: ['python3 scripts/check_architecture_drift.py', 'python scripts/check_architecture_drift.py'],
    reason:
      'Use wp_audit(kind="architecture-drift") instead — architecture drift checks should go through the canonical agent-kit MCP audit surface.',
  },
]

function makeDeny(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

function stripLeadingEnvironmentAssignments(command) {
  let next = command.trim()
  const assignmentPrefix = /^(?:env\s+)?(?:[A-Za-z_][A-Za-z0-9_]*=(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+)\s+)+/u
  while (next) {
    const updated = next.replace(assignmentPrefix, '').trim()
    if (updated === next) return next
    next = updated
  }
  return next
}

function normalizeCommand(command) {
  const trimmed = stripLeadingEnvironmentAssignments(command)
  const corepackMatch =
    /^corepack\s+(pnpm|pnpx|npm|npx|yarn|yarnpkg|bun|bunx)(?:@[^\s]+)?\s+([\s\S]+)$/u.exec(trimmed)
  const corepackStripped = corepackMatch ? `${corepackMatch[1]} ${corepackMatch[2]}` : trimmed
  return corepackStripped.replace(/\s+/gu, ' ').trim()
}

function matchesPrefix(command, prefix) {
  return command === prefix || command.startsWith(`${prefix} `)
}

function extractCommand(input) {
  if (!input || typeof input !== 'object') return null
  const toolInput = input.tool_input
  if (!toolInput || typeof toolInput !== 'object') return null
  if (typeof toolInput.command === 'string') return toolInput.command
  if (typeof toolInput.cmd === 'string') return toolInput.cmd
  return null
}

function routeCommand(command) {
  const normalized = normalizeCommand(command)
  if (!normalized) return null

  for (const prefix of ALLOWLIST_PREFIXES) {
    if (matchesPrefix(normalized, prefix)) return null
  }

  const auditMatch = /^wp\s+audit\s+([a-z0-9-]+)\b/u.exec(normalized)
  if (auditMatch) {
    const kind = auditMatch[1]
    if (AUDIT_KINDS.has(kind)) {
      return `Use wp_audit(kind="${kind}") instead — this audit is owned by the canonical agent-kit MCP surface.`
    }
  }

  for (const route of SCRIPT_ROUTES) {
    for (const prefix of route.prefixes) {
      if (matchesPrefix(normalized, prefix)) return route.reason
    }
  }

  return null
}

function delegate(rawInput) {
  if (!existsSync(delegatePath)) {
    writeJson(
      makeDeny(
        'wp-pretool-guard is unavailable. Run vp install or wp setup to restore the agent-kit hook surface.',
      ),
    )
    process.exit(0)
  }

  const result = spawnSync(delegatePath, {
    input: rawInput,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (typeof result.status === 'number') {
    process.exit(result.status)
  }

  process.exit(1)
}

export function inspectHookInput(rawInput) {
  let parsed
  try {
    parsed = JSON.parse(rawInput)
  } catch {
    return { action: 'delegate', reason: null }
  }

  const command = extractCommand(parsed)
  if (!command) return { action: 'delegate', reason: null }

  const reason = routeCommand(command)
  if (!reason) return { action: 'delegate', reason: null }
  return { action: 'deny', reason }
}

export function run(rawInput) {
  const decision = inspectHookInput(rawInput)
  if (decision.action === 'deny') {
    writeJson(makeDeny(decision.reason))
    return 0
  }

  delegate(rawInput)
  return 0
}

if (process.argv[1] === __filename) {
  let rawInput = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => {
    rawInput += chunk
  })
  process.stdin.on('end', () => {
    run(rawInput)
  })
}
