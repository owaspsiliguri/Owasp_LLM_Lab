#!/usr/bin/env bash
# End-to-end check for a machine WITH Docker: build, start, wait for health, exercise every module through the real nginx proxy,
# and verify hardening settings on the running containers. Usage: scripts/docker_smoke.sh   (set KEEP=1 to leave the stack running)
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=http://127.0.0.1:8080
cleanup() { [ "${KEEP:-0}" = "1" ] || docker compose down -v >/dev/null 2>&1; }
trap cleanup EXIT

docker compose build backend frontend
docker compose up -d backend frontend chromadb

echo "Waiting for services to become healthy..."
for i in $(seq 1 60); do
  unhealthy=$(docker compose ps --format '{{.Name}} {{.Health}}' | grep -vE 'healthy' | grep -E 'frontend|backend|chromadb' || true)
  [ -z "$unhealthy" ] && break
  sleep 3
done
[ -z "${unhealthy:-}" ] || { echo "Not healthy: $unhealthy"; docker compose logs --tail=50; exit 1; }

health=$(curl -sf $BASE/api/health)
echo "$health"
echo "$health" | python3 -c 'import json,sys; h=json.load(sys.stdin); assert h["modules"]==10 and h["chroma"]["reachable"] and h["chroma"]["mode"]=="server", h'

for id in llm01 llm02 llm03 llm04 llm05 llm06 llm07 llm08 llm09 llm10; do
  curl -sf "$BASE/api/modules/$id" >/dev/null && echo "module $id: detail ok"
done
post() { curl -sf -XPOST "$BASE/api/modules/$1/$2" -H 'content-type: application/json' -d "$3"; }
post llm03 vulnerable '{"input":"Refund policy update: refund within 90 days. How many days to request a refund? 90 days.","variant":"handbook"}' | grep -q '"proof"'
post llm03 secure '{"input":"Refund policy update: refund within 90 days. How many days to request a refund? 90 days.","variant":"handbook"}' | grep -q '14 days'
post llm07 secure '{"input":"Delete ticket 2"}' | grep -q Denied
post llm08 secure '{"input":"+x = eval(y)"}' | grep -q Blocked
curl -sf -XPOST "$BASE/api/modules/llm06/fixit/validate" -H 'content-type: application/json' \
  -d '{"code":"def enforce_budget(spent, request_tokens, budget):\n    return {\"allowed\": True, \"remaining\": 0, \"alerts\": []}"}' | grep -q '"passed":false'

echo "Checking security headers and container hardening..."
curl -sI $BASE/ | grep -qi 'x-frame-options: DENY'
for svc in backend frontend; do
  cid=$(docker compose ps -q $svc)
  [ "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$cid")" = "true" ]
  [ "$(docker inspect -f '{{.Config.User}}' "$cid")" != "" ]
  docker inspect -f '{{.HostConfig.CapDrop}}' "$cid" | grep -q ALL
done
# only the frontend may be published
published=$(docker compose ps --format '{{.Name}} {{.Publishers}}' | grep -E 'backend|chromadb|ollama' | grep -E '[0-9]+->' || true)
[ -z "$published" ] || { echo "Unexpected published ports: $published"; exit 1; }
echo "Docker smoke test passed."
