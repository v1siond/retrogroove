#!/usr/bin/env bash
# Orchestrates the real-backend demo: resets the API's dev DB, seeds an admin,
# starts the Phoenix API (Izipay stubbed) + the static frontend, then runs the
# narrated Playwright demo suite and records video.
#
# NOTE: this resets the retrogroove_api *dev* database (fresh app, no real data).
set -uo pipefail

NODE=/home/visiond/.nvm/versions/node/v22.21.1/bin
export PATH="$NODE:$PATH"
# asdf shims alone don't pick up the right Erlang/Elixir — source the full script
# shellcheck disable=SC1091
source /home/visiond/.asdf/asdf.sh 2>/dev/null || true

API=/home/visiond/projects/retrogroove_api
SITE=/home/visiond/projects/retrogroove-site
API_PORT="${RG_API_PORT:-4099}"   # use 4099 to avoid collision with Firebase on 4000
WEB_PORT=3340

cleanup() {
  [[ -n "${PHX_PID:-}" ]] && kill "$PHX_PID" 2>/dev/null
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null
}
trap cleanup EXIT

echo "==> 1/4 reset demo DB + seed admin + Disco Night event"
cd "$API"
MIX_ENV=dev mix ecto.drop --quiet 2>/dev/null
MIX_ENV=dev mix ecto.create --quiet
MIX_ENV=dev mix ecto.migrate
DEMO_ADMIN_EMAIL="${DEMO_ADMIN_EMAIL:-admin@retrogroove.pe}" \
  DEMO_ADMIN_PASSWORD="${DEMO_ADMIN_PASSWORD:-DemoShow2026!}" \
  MIX_ENV=dev mix run priv/repo/demo_seeds.exs
# Seed the real Disco Night event so the demo's home shows it.
ASSET_BASE_URL="http://localhost:$API_PORT" MIX_ENV=dev \
  mix run priv/repo/seeds/disco_night_basilica.exs

export DEMO_ADMIN_EMAIL="${DEMO_ADMIN_EMAIL:-admin@retrogroove.pe}"
export DEMO_ADMIN_PASSWORD="${DEMO_ADMIN_PASSWORD:-DemoShow2026!}"

echo "==> 2/4 start Phoenix API (:$API_PORT, Izipay stubbed)"
IZIPAY_STUB=true CORS_ORIGINS="http://localhost:$WEB_PORT" PORT=$API_PORT MIX_ENV=dev \
  mix phx.server > /tmp/rg-demo-api.log 2>&1 &
PHX_PID=$!
for i in $(seq 1 40); do
  curl -sf "http://localhost:$API_PORT/api/events/upcoming" >/dev/null && break
  sleep 1
done
echo "    API up"

echo "==> 3/4 build frontend (API=$API_PORT) + serve static (:$WEB_PORT)"
cd "$SITE"
NEXT_PUBLIC_API_URL="http://localhost:$API_PORT/api" \
  IZIPAY_STUB=true \
  npm run build >/tmp/rg-demo-build.log 2>&1
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

# Save the recordings to a stable, readable folder. Playwright wipes its output
# dir on every run, so the per-test videos in demo-results/ don't survive the
# next run of any suite — these named copies do.
echo "==> saving recordings to $SITE/demo-videos/"
rm -rf "$SITE/demo-videos"
mkdir -p "$SITE/demo-videos"
i=1
for d in "$SITE"/demo-results/full-demo-*/; do
  [[ -f "$d/video.webm" ]] || continue
  name=$(basename "$d" | sed -E 's/^full-demo-//; s/-chromium$//' | cut -c1-48)
  cp "$d/video.webm" "$(printf '%s/demo-videos/%02d-%s.webm' "$SITE" "$i" "$name")"
  i=$((i + 1))
done
ls -1 "$SITE/demo-videos/" 2>/dev/null

echo "==> done (exit $STATUS). videos: $SITE/demo-videos/ · API log: /tmp/rg-demo-api.log"
exit $STATUS
