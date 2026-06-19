---
type: blueprint
title: "Edge Matte: agent-kit dedupe cutover"
owner: ozby
status: completed
completed_at: "2026-06-19"
complexity: S
created: "2026-06-19"
last_updated: "2026-06-19"
progress: "100% (local setup/version-helper drift removed; raw act helper script replaced with wp ci act; workflow setup drift removed; reusable workflow callers now use the shared capability-aware contract)"
depends_on: []
cross_repo_depends_on:
  - repo: webpresso/agent-kit
    slug: 2026-06-19-agent-kit-wp-shared-e2e-secrets-act-supervisor
    require_status: completed
  - repo: webpresso/github-actions
    slug: 2026-06-19-github-actions-shared-setup-oidc-cache-pin-hardening
    require_status: in-progress
tags:
  - edge-matte
  - wp
  - ci
  - deploy
---

# Edge Matte: agent-kit dedupe cutover

**Goal:** Replace remaining copied setup/workflow logic in Edge Matte with shared `wp` / GitHub Actions contracts and keep only app-specific deploy/test behavior.

## Tasks

1. Inventory copied setup/install/workflow snippets.
2. Switch to shared reusable setup/workflow lanes.
3. Delete duplicate repo-local ownership that Agent Kit/GitHub Actions now owns.

#### [cutover] Task 3.1: Remove duplicated helper/setup ownership and adopt shared capability-aware workflow callers

**Status:** done

**Depends:** None

**Verification:**

```webpresso-evidence-v1
[{"agent":"codex","command":"node --test test/infra-release-workflow-expectations.test.ts test/reusable-deploy-workflows.test.ts","exit_code":0,"kind":"integration","result":"pass","target_files":[".github/workflows/deploy-preview.yml",".github/workflows/deploy-production.yml",".github/workflows/release.yml","test/infra-release-workflow-expectations.test.ts","test/reusable-deploy-workflows.test.ts"],"ts":"2026-06-19T22:19:00Z"},{"agent":"codex","command":"wp test","exit_code":0,"kind":"test","result":"pass","ts":"2026-06-19T15:20:00Z"},{"agent":"codex","audit_kind":"secret-provider-quarantine","kind":"audit","passed":true,"result":"pass","ts":"2026-06-19T15:20:00Z"}]
```

## Verification

- affected workflow validation
- repo `wp` verification gates

## Current completion evidence

- `package.json` `act:ci:e2e` now routes through `wp ci act` instead of raw
  `with-secrets -- act`.
- Deleted retired local helper:
  - `scripts/resolve-webpresso-cli-versions.js`
- Local setup action now installs global `vite-plus` + `@webpresso/agent-kit`
  directly rather than depending on the retired version-resolution helper.
- Deploy/release caller `install_command` blocks now use direct global installs
  and no longer reference the retired local helper.
- Production deploy caller no longer uses the old
  `DOPPLER_SERVICE_TOKEN || DOPPLER_TOKEN` fallback expression.
- Repo-owned CI/security/architecture workflows no longer invoke the local
  `setup-webpresso` action; they now install shared global tooling directly in
  the workflow steps.
- The now-unused local `.github/actions/setup-webpresso/action.yml` file was
  deleted.
- Reusable workflow caller cleanup:
  - `.github/workflows/deploy-preview.yml`,
    `.github/workflows/deploy-production.yml`, and `.github/workflows/release.yml`
    no longer pass the old fallback expressions and now pass only the shared
    `ci_secret_provider_token` plus repo-owned `secret_profile`
