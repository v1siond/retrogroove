#!/usr/bin/env bash
# Orchestrates the RetroGroove lifecycle showcase recording.
# Resets the API dev DB, seeds admin + Disco Night event, builds frontend,
# starts both servers, records the paced showcase spec, copies the mp4.
#
# Usage:
#   bash e2e/demo/run-showcase.sh          # crisp full-quality pass
#   SHOWCASE_FAST=1 bash ...               # fast dress-rehearsal (quick)
#
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

# Admin credentials for the demo run
export DEMO_ADMIN_EMAIL="admin@retrogroove.pe"
export DEMO_ADMIN_PASSWORD="DemoShow2026!"

# Culqi stub + test token for the payment step
export CULQI_STUB=true
export NEXT_PUBLIC_CULQI_PUBLIC_KEY="pk_test_demo"

cleanup() {
  [[ -n "${PHX_PID:-}" ]] && kill "$PHX_PID" 2>/dev/null || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT

# ── 1/5 Reset dev DB + seed admin ──────────────────────────────────────────
echo "==> 1/5 reset dev DB + seed admin"
cd "$API"
MIX_ENV=dev mix ecto.drop --quiet 2>/dev/null || true
MIX_ENV=dev mix ecto.create --quiet
MIX_ENV=dev mix ecto.migrate

DEMO_ADMIN_EMAIL="$DEMO_ADMIN_EMAIL" DEMO_ADMIN_PASSWORD="$DEMO_ADMIN_PASSWORD" \
  MIX_ENV=dev mix run priv/repo/demo_seeds.exs

# ── 2/5 Seed the Disco Night event ──────────────────────────────────────────
echo "==> 2/5 seed Disco Night @ La Basílica 640"
ASSET_BASE_URL="http://localhost:$API_PORT" MIX_ENV=dev \
  mix run priv/repo/seeds/disco_night_basilica.exs

# ── 3/5 Start Phoenix API ────────────────────────────────────────────────────
echo "==> 3/5 start Phoenix API (:$API_PORT, Culqi stubbed)"
CULQI_STUB=true CORS_ORIGINS="http://localhost:$WEB_PORT" PORT=$API_PORT MIX_ENV=dev \
  mix phx.server > /tmp/rg-showcase-api.log 2>&1 &
PHX_PID=$!
for i in $(seq 1 40); do
  curl -sf "http://localhost:$API_PORT/api/events/upcoming" >/dev/null && break
  sleep 1
done
echo "    API up (pid $PHX_PID)"

# ── 4/5 Build frontend + start static server ─────────────────────────────────
echo "==> 4/5 build frontend (API=:$API_PORT) + serve static (:$WEB_PORT)"
cd "$SITE"
NEXT_PUBLIC_API_URL="http://localhost:$API_PORT/api" \
  NEXT_PUBLIC_CULQI_PUBLIC_KEY="$NEXT_PUBLIC_CULQI_PUBLIC_KEY" \
  npm run build > /tmp/rg-showcase-build.log 2>&1
fuser -k ${WEB_PORT}/tcp 2>/dev/null || true
PORT=$WEB_PORT BASE_PATH="" node e2e/visual/static-server.mjs > /tmp/rg-showcase-web.log 2>&1 &
WEB_PID=$!
for i in $(seq 1 20); do
  curl -sf "http://localhost:$WEB_PORT/" >/dev/null && break
  sleep 1
done
echo "    web up (pid $WEB_PID)"

# ── 5/5 Run the showcase spec ────────────────────────────────────────────────
echo "==> 5/5 run showcase spec"
SHOWCASE_BEAT="${SHOWCASE_BEAT:-0.9}" \
SHOWCASE_FAST="${SHOWCASE_FAST:-}" \
BASE_URL="http://localhost:$WEB_PORT" \
npx playwright test --config playwright.showcase.config.ts
STATUS=$?

# ── Post-process: find the webm Playwright recorded, upscale → mp4 ──────────
FAST="${SHOWCASE_FAST:-}"
WEBM=$(find "$SITE/showcase-results" -name "*.webm" | sort -t- -k1 | tail -1)
DEST="$SITE/demo-videos/retrogroove-lifecycle.mp4"
mkdir -p "$SITE/demo-videos" "$SITE/recordings"

if [[ -n "$WEBM" && -f "$WEBM" ]]; then
  echo ""
  echo "==> Transcoding $(basename "$WEBM") → retrogroove-lifecycle.mp4"
  if [[ -n "$FAST" ]]; then
    ffmpeg -y -i "$WEBM" \
      -vf "scale=3840:2160:flags=bilinear,fps=30" \
      -c:v libx264 -crf 30 -preset ultrafast \
      -pix_fmt yuv420p -movflags +faststart \
      "$DEST" 2>&1 | tail -5
  else
    ffmpeg -y -i "$WEBM" \
      -vf "scale=3840:2160:flags=lanczos,fps=60" \
      -c:v libx264 -crf 17 -preset slow \
      -pix_fmt yuv420p -movflags +faststart \
      "$DEST" 2>&1 | tail -5
  fi
  # Also save source webm as reference
  cp "$WEBM" "$SITE/recordings/demo-retrogroove-lifecycle.webm" 2>/dev/null || true
  echo ""
  echo "==> Video saved: $DEST"
  ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$DEST" 2>/dev/null || true
  ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate "$DEST" 2>/dev/null || true
else
  echo "WARNING: No webm found in showcase-results/ — check /tmp/rg-showcase-*.log"
fi

echo "==> done (exit $STATUS)"
echo "    API log:   /tmp/rg-showcase-api.log"
echo "    Build log: /tmp/rg-showcase-build.log"
exit $STATUS
