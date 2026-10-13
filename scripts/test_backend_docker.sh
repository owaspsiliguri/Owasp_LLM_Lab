#!/usr/bin/env bash
# Run the backend test suite + ruff on Linux.
#
# The Fix-It sandbox uses the Unix-only `resource` module, so `pytest` only
# works on Linux/macOS. Windows contributors: run this script (Docker Desktop
# required) or use WSL.
#
# Usage:  bash scripts/test_backend_docker.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOUNT="$ROOT"
command -v cygpath >/dev/null 2>&1 && MOUNT="$(cygpath -m "$ROOT")"

MSYS_NO_PATHCONV=1 docker run --rm \
  --network host \
  -v "$MOUNT":/srv \
  -w /srv \
  -e PYTHONDONTWRITEBYTECODE=1 \
  -e LAB_DATA_DIR=/tmp/lab-data \
  -v labpipcache:/root/.cache/pip \
  python:3.12-slim \
  bash -c 'set -o pipefail
    pip install -q -r backend/requirements-dev.txt
    python -m pytest -q 2>&1 | tail -30
    ruff check backend tests'
