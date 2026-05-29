import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import { inspectHookInput } from '../scripts/mcp-first-pretool-guard.mjs'

function bashInput(command) {
  return JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command },
  })
}

test('denies wp audit commands in favor of wp_audit MCP', () => {
  const result = inspectHookInput(bashInput('wp audit architecture-drift --root .'))
  assert.equal(result.action, 'deny')
  assert.match(result.reason, /wp_audit\(kind="architecture-drift"\)/)
})

test('denies verify:paths wrapper in favor of wp_audit MCP', () => {
  const result = inspectHookInput(bashInput('pnpm run verify:paths'))
  assert.equal(result.action, 'deny')
  assert.match(result.reason, /absolute-path-policy/)
})

test('denies docs:check wrapper in favor of wp_audit MCP', () => {
  const result = inspectHookInput(bashInput('pnpm run docs:check'))
  assert.equal(result.action, 'deny')
  assert.match(result.reason, /docs-frontmatter/)
})

test('denies pnpm install in favor of vp install', () => {
  const result = inspectHookInput(bashInput('pnpm install --frozen-lockfile'))
  assert.equal(result.action, 'deny')
  assert.match(result.reason, /Use vp install instead/)
})

test('denies filtered pnpm exec in favor of vp exec', () => {
  const result = inspectHookInput(
    bashInput('pnpm --filter @edge-matte/worker exec wrangler deploy --env production'),
  )
  assert.equal(result.action, 'deny')
  assert.match(result.reason, /vp exec --filter @edge-matte\/worker -- wrangler deploy --env production/)
})

test('denies wrapped pnpm exec in favor of vp exec', () => {
  const result = inspectHookInput(
    bashInput('with-secrets -- pnpm --filter @edge-matte/worker exec wrangler deploy --env production'),
  )
  assert.equal(result.action, 'deny')
  assert.match(result.reason, /vp exec --filter @edge-matte\/worker -- wrangler deploy --env production/)
})

test('allows vp and wp recovery paths through to the delegate', () => {
  assert.equal(inspectHookInput(bashInput('vp install --frozen-lockfile')).action, 'delegate')
  assert.equal(inspectHookInput(bashInput('wp setup')).action, 'delegate')
})

test('delegates non-command tool inputs unchanged', () => {
  const result = inspectHookInput(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'x' } }))
  assert.equal(result.action, 'delegate')
})

test('CLI delegates to wp-pretool-guard when no local MCP-first deny applies', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-first-pretool-guard-'))
  const delegatePath = path.join(tmpDir, 'fake-delegate.sh')
  fs.writeFileSync(
    delegatePath,
    "#!/bin/sh\nprintf '%s\\n' '{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"delegate-called\"}}'\n",
  )
  fs.chmodSync(delegatePath, 0o755)

  const result = spawnSync(
    process.execPath,
    [path.resolve('scripts/mcp-first-pretool-guard.mjs')],
    {
      cwd: path.resolve('.'),
      input: bashInput('git status'),
      encoding: 'utf8',
      env: { ...process.env, WP_PRETOOL_GUARD_BIN: delegatePath },
    },
  )

  assert.equal(result.status, 0)
  assert.match(result.stdout, /delegate-called/)
})
