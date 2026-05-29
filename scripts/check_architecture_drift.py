#!/usr/bin/env python3
"""Canonical architecture drift entrypoint for repo workflows and docs.

Delegates to the shared agent-kit audit surface while preserving the existing
`python3 scripts/check_architecture_drift.py` contract referenced across repo
docs, hooks, and workflows.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from shutil import which


def resolve_wp() -> str:
    path_wp = which("wp")
    if path_wp:
        return path_wp

    bun_global_wp = Path.home() / ".bun" / "bin" / "wp"
    if bun_global_wp.exists():
        return str(bun_global_wp)

    raise FileNotFoundError(
        "wp executable not found on PATH or at ~/.bun/bin/wp; install Webpresso tooling first."
    )


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    result = subprocess.run(
        [resolve_wp(), "audit", "architecture-drift", "--root", "."],
        cwd=repo_root,
        check=False,
    )
    return int(result.returncode)


if __name__ == "__main__":
    sys.exit(main())
