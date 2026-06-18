#!/usr/bin/env bash
# RetroGroove lifecycle showcase v2 orchestration script.
#
# Flow:
#   1. Reset dev DB + seed admin only (event is created by the spec's Act 1)
#   2. Start Phoenix API
#   3. Build frontend + start static server
#   4. Synthesize disco music bed (if not cached)
#   5. Run Playwright showcase spec
#   6. Post-process: webm → 4K mp4 + music mux
#
# Usage:
#   bash e2e/demo/run-showcase.sh              # full 4K pass
#   SHOWCASE_FAST=1 bash e2e/demo/run-showcase.sh   # fast dress rehearsal

set -uo pipefail

NODE=/home/visiond/.nvm/versions/node/v22.21.1/bin
export PATH="$NODE:$PATH"
# shellcheck disable=SC1091
source /home/visiond/.asdf/asdf.sh 2>/dev/null || true

API=/home/visiond/projects/retrogroove_api
SITE=/home/visiond/projects/retrogroove-site
API_PORT="${RG_API_PORT:-4099}"
WEB_PORT=3340
# Music bed is synthesized at ~-24 dB peak; a tiny +2 dB boost lands it near the
# ~-22 dB ambient target. (Was -20 dB, which buried the bed at ~-44 dB — inaudible.)
MUSIC_VOL="${MUSIC_VOL:-+2dB}"
FAST="${SHOWCASE_FAST:-}"

export DEMO_ADMIN_EMAIL="admin@retrogroove.pe"
export DEMO_ADMIN_PASSWORD="demo1234"
export CULQI_STUB=true
export NEXT_PUBLIC_CULQI_PUBLIC_KEY="pk_test_demo"

PHX_PID=""
WEB_PID=""

cleanup() {
  [[ -n "${PHX_PID:-}" ]] && kill "$PHX_PID" 2>/dev/null || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT

# ── 1/6 Reset DB + seed admin only ─────────────────────────────────────────
echo "==> 1/6 reset dev DB + seed admin (no event — Act 1 creates it)"
cd "$API"
MIX_ENV=dev mix ecto.drop --quiet 2>/dev/null || true
MIX_ENV=dev mix ecto.create --quiet
MIX_ENV=dev mix ecto.migrate
DEMO_ADMIN_EMAIL="$DEMO_ADMIN_EMAIL" DEMO_ADMIN_PASSWORD="$DEMO_ADMIN_PASSWORD" \
  MIX_ENV=dev mix run priv/repo/demo_seeds.exs

# ── 2/6 Start Phoenix API ────────────────────────────────────────────────────
echo "==> 2/6 start Phoenix API (:$API_PORT, Culqi stubbed)"
CULQI_STUB=true CORS_ORIGINS="http://localhost:$WEB_PORT" PORT=$API_PORT MIX_ENV=dev \
  mix phx.server > /tmp/rg-showcase-api.log 2>&1 &
PHX_PID=$!
echo "    waiting for API..."
for i in $(seq 1 40); do
  curl -sf "http://localhost:$API_PORT/api/events/upcoming" >/dev/null 2>&1 && break
  sleep 1
done
echo "    API up (pid $PHX_PID)"

# ── 3/6 Build frontend + start static server ─────────────────────────────────
echo "==> 3/6 build frontend + serve (:$WEB_PORT)"
cd "$SITE"
NEXT_PUBLIC_API_URL="http://localhost:$API_PORT/api" \
  NEXT_PUBLIC_CULQI_PUBLIC_KEY="$NEXT_PUBLIC_CULQI_PUBLIC_KEY" \
  npm run build > /tmp/rg-showcase-build.log 2>&1
fuser -k ${WEB_PORT}/tcp 2>/dev/null || true
PORT=$WEB_PORT BASE_PATH="" node e2e/visual/static-server.mjs > /tmp/rg-showcase-web.log 2>&1 &
WEB_PID=$!
echo "    waiting for web server..."
for i in $(seq 1 20); do
  curl -sf "http://localhost:$WEB_PORT/" >/dev/null 2>&1 && break
  sleep 1
done
echo "    web up (pid $WEB_PID)"

# ── 4/6 Synthesize disco music bed ──────────────────────────────────────────
echo "==> 4/6 synthesize disco music bed"
MUSIC_FILE="$SITE/e2e/demo/music/disco-bed.wav"
mkdir -p "$SITE/e2e/demo/music"
if [[ ! -f "$MUSIC_FILE" ]]; then
  bash "$SITE/e2e/demo/music/disco-bed.sh" "$MUSIC_FILE"
else
  echo "    cached: $MUSIC_FILE"
fi
echo "    music bed ready: $MUSIC_FILE"

# ── 5/6 Run Playwright showcase spec ────────────────────────────────────────
echo "==> 5/6 run showcase spec"
cd "$SITE"
SHOWCASE_BEAT="${SHOWCASE_BEAT:-0.9}" \
SHOWCASE_FAST="${FAST}" \
DEMO_ADMIN_EMAIL="$DEMO_ADMIN_EMAIL" \
DEMO_ADMIN_PASSWORD="$DEMO_ADMIN_PASSWORD" \
BASE_URL="http://localhost:$WEB_PORT" \
npx playwright test --config playwright.showcase.config.ts
PLAY_STATUS=$?

# ── 6/6 Post-process: webm → 4K mp4 + music mux ────────────────────────────
echo "==> 6/6 post-process video + add music bed"
WEBM=$(find "$SITE/showcase-results" -name "*.webm" | sort | tail -1)
DEST="$SITE/demo-videos/retrogroove-lifecycle.mp4"
mkdir -p "$SITE/demo-videos"

if [[ -n "$WEBM" && -f "$WEBM" ]]; then
  VID_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WEBM" 2>/dev/null || echo "300")
  echo "    webm found: $(basename "$WEBM"), duration ~${VID_DUR}s"

  if [[ -n "$FAST" ]]; then
    # Fast dress rehearsal: quick transcode, no music
    ffmpeg -y -i "$WEBM" \
      -vf "scale=3840:2160:flags=bilinear,fps=30" \
      -c:v libx264 -crf 30 -preset ultrafast \
      -pix_fmt yuv420p -movflags +faststart \
      "$DEST" 2>&1 | tail -8
  else
    # Full quality: lanczos upscale + disco music bed
    TMP_MP4="/tmp/rg-noaudio.mp4"
    ffmpeg -y -i "$WEBM" \
      -vf "scale=3840:2160:flags=lanczos,fps=60" \
      -c:v libx264 -crf 17 -preset slow \
      -pix_fmt yuv420p -movflags +faststart \
      -an "$TMP_MP4" 2>&1 | tail -5

    # Mux video + looped music at low volume
    if [[ -f "$MUSIC_FILE" ]]; then
      ffmpeg -y \
        -i "$TMP_MP4" \
        -stream_loop -1 -i "$MUSIC_FILE" \
        -map 0:v -map 1:a \
        -c:v copy \
        -c:a aac -b:a 128k \
        -af "volume=${MUSIC_VOL}" \
        -t "$VID_DUR" \
        -movflags +faststart \
        "$DEST" 2>&1 | tail -5
    else
      # No music — just copy
      mv "$TMP_MP4" "$DEST"
    fi

    rm -f "$TMP_MP4"
  fi

  echo ""
  echo "==> Video saved: $DEST"
  ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$DEST" 2>/dev/null || true
  ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,channels \
    -of default=noprint_wrappers=1 "$DEST" 2>/dev/null || true
else
  echo "WARNING: No webm found in showcase-results/ — check /tmp/rg-showcase-*.log"
fi

echo ""
echo "==> done (Playwright exit $PLAY_STATUS)"
echo "    API log:   /tmp/rg-showcase-api.log"
echo "    Build log: /tmp/rg-showcase-build.log"
exit $PLAY_STATUS
