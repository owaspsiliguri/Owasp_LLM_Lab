#!/usr/bin/env bash
# Run the no-free-flags audit inside Linux.
#
# The Fix-It sandbox uses the Unix-only `resource` module, so the API will not
# start on a native Windows Python. This boots the API in a Linux container,
# runs scripts/audit_free_flags.py against it, then tears the container down.
#
# Usage:  bash scripts/audit_free_flags_docker.sh [extra benign inputs...]
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
  -e LAB_SECRET=audit-secret \
  -v labpipcache:/root/.cache/pip \
  python:3.12-slim \
  bash -c 'set -o pipefail
    apt-get update -qq && apt-get install -y -qq curl >/dev/null 2>&1
    pip install -q -r backend/requirements.txt
    ( uvicorn app.main:app --app-dir backend --port 8005 >/tmp/api.log 2>&1 & ) 
    for i in $(seq 1 30); do
      code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8005/api/health || true)
      [ "$code" = "200" ] && break
      sleep 1
    done
    python scripts/audit_free_flags.py http://127.0.0.1:8005/api'
