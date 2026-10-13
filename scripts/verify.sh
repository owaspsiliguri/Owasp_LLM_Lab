#!/usr/bin/env bash
# Run every check locally (what CI runs, minus Docker). Usage: scripts/verify.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ruff check backend tests
bandit -r backend/app -ll -q
pip-audit -r backend/constraints.txt --no-deps --ignore-vuln PYSEC-2026-3813 --ignore-vuln PYSEC-2026-3814 --ignore-vuln PYSEC-2026-3815
pytest -q
(cd frontend && npm ci && npm run lint && npm test && npm audit --omit=dev --audit-level=high && npm run build)
echo "All checks passed."
