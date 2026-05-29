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


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    result = subprocess.run(
        ["wp", "audit", "architecture-drift", "--root", "."],
        cwd=repo_root,
        check=False,
    )
    return int(result.returncode)


if __name__ == "__main__":
    sys.exit(main())
