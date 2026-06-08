#!/usr/bin/env bash
# Orchestrates the real-backend demo: resets the API's dev DB, seeds an admin,
# starts the Phoenix API (Culqi stubbed) + the static frontend, then runs the
# narrated Playwright demo suite and records video.
#
# NOTE: this resets the retrogroove_api *dev* database (fresh app, no real data).
set -uo pipefail

ASDF=/home/visiond/.asdf/shims
NODE=/home/visiond/.nvm/versions/node/v22.21.1/bin
export PATH="$NODE:$ASDF:$PATH"

API=/home/visiond/projects/retrogroove_api
SITE=/home/visiond/projects/retrogroove-site
API_PORT=4000
WEB_PORT=3340

cleanup() {
  [[ -n "${PHX_PID:-}" ]] && kill "$PHX_PID" 2>/dev/null
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null
}
trap cleanup EXIT

echo "==> 1/4 reset demo DB + seed admin"
cd "$API"
MIX_ENV=dev mix ecto.drop --quiet 2>/dev/null
MIX_ENV=dev mix ecto.create --quiet
MIX_ENV=dev mix ecto.migrate
MIX_ENV=dev mix run priv/repo/demo_seeds.exs

echo "==> 2/4 start Phoenix API (:$API_PORT, Culqi stubbed)"
CULQI_STUB=true CORS_ORIGINS="http://localhost:$WEB_PORT" PORT=$API_PORT MIX_ENV=dev \
  mix phx.server > /tmp/rg-demo-api.log 2>&1 &
PHX_PID=$!
for i in $(seq 1 40); do
  curl -sf "http://localhost:$API_PORT/api/events/upcoming" >/dev/null && break
  sleep 1
done
echo "    API up"

echo "==> 3/4 build frontend (API=$API_PORT) + serve static (:$WEB_PORT)"
cd "$SITE"
NEXT_PUBLIC_API_URL="http://localhost:$API_PORT/api" npm run build >/tmp/rg-demo-build.log 2>&1
fuser -k $WEB_PORT/tcp 2>/dev/null
PORT=$WEB_PORT node e2e/visual/static-server.mjs >/tmp/rg-demo-web.log 2>&1 &
WEB_PID=$!
for i in $(seq 1 20); do
  curl -sf "http://localhost:$WEB_PORT/" >/dev/null && break
  sleep 1
done
echo "    web up"

echo "==> 4/4 run demo suite"
npx playwright test --config playwright.demo.config.ts
STATUS=$?

echo "==> done (exit $STATUS). API log: /tmp/rg-demo-api.log"
exit $STATUS
