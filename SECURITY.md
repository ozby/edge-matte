# Security Policy

## Reporting a vulnerability

**Do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Please report them privately through one of:

1. **GitHub Security Advisories** (preferred) — open a private report at
   <https://github.com/ozby/edge-matte/security/advisories/new>. This keeps the
   report confidential until a fix is ready and lets us coordinate a
   disclosure timeline with you.
2. If you cannot use GitHub Security Advisories, contact the maintainer
   privately by opening a minimal placeholder issue that asks for a private
   channel **without disclosing any vulnerability details**, and we will follow
   up with a secure contact path.

Please include, where possible:

- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- Affected component (worker route, adapter, deploy/secret path, etc.).
- Any suggested remediation.

## Response expectations

- We aim to acknowledge a report within a few business days.
- We will keep you informed about progress toward a fix.
- We ask that you give us a reasonable window to remediate before any public
  disclosure.

## Supported versions

EdgeMatte is a single deployed reference application (the `main` branch backing
`https://edge-matte.ozby.dev`). Only the latest `main` is supported; security
fixes land on `main` and are deployed to production. Older commits and forks are
not separately maintained.

| Version         | Supported |
| --------------- | --------- |
| `main` (latest) | ✅        |
| Older commits   | ❌        |

## Scope notes

- EdgeMatte uses Cloudflare's native `cf.image segment` background-removal
  transform — there is **no external provider API key** to leak.
- Secrets are sourced from a runtime secret provider, never committed to the
  repo. See [`docs/secrets.md`](./docs/secrets.md).
- The delete path uses SHA-256 capability tokens; only the token hash is
  persisted. Token-handling concerns are in scope for a security report.
