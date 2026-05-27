import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import assert from 'node:assert/strict'

const scriptPath = resolve('scripts/check-no-dev-vars.ts')

function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), 'edge-matte-secret-check-'))
  try {
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function runCheck(cwd) {
  return spawnSync('bun', [scriptPath], {
    cwd,
    encoding: 'utf8',
  })
}

test('passes when repo has no forbidden secret files', () => {
  withTempDir((cwd) => {
    const result = runCheck(cwd)
    assert.equal(result.status, 0)
    assert.match(result.stdout, /OK: no forbidden \.dev\.vars or \.env files/)
  })
})

test('fails when .dev.vars is present', () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, '.dev.vars'), 'TOKEN=secret\n')
    const result = runCheck(cwd)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /forbidden \.dev\.vars or \.env files/)
    assert.match(result.stdout, /\.dev\.vars/)
  })
})

test('fails when .env file is present', () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, '.env.local'), 'API_KEY=secret\n')
    const result = runCheck(cwd)
    assert.equal(result.status, 1)
    assert.match(result.stdout, /\.env\.local/)
  })
})

test('allows .env.example for non-secret onboarding docs', () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, '.env.example'), 'PUBLIC_VALUE=example\n')
    mkdirSync(join(cwd, 'nested'), { recursive: true })
    writeFileSync(join(cwd, 'nested', '.env.example'), 'ALSO_OK=1\n')
    const result = runCheck(cwd)
    assert.equal(result.status, 0)
  })
})
