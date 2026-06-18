#!/usr/bin/env bash
# Synthesizes a disco groove music bed.
# Tries ffmpeg aevalsrc first; falls back to Python3 synthesis; then to
# looping the existing auditechme music bed if all else fails.
#
# 120 BPM: four-on-the-floor kick, offbeat open hi-hat, syncopated bass,
# subtle chord pad. Duration: 8 minutes (480s).
#
# Usage:
#   bash disco-bed.sh [output.wav]
#   Default output: disco-bed.wav (alongside this script)

set -euo pipefail

FFMPEG="${FFMPEG:-/usr/bin/ffmpeg}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="${1:-${SCRIPT_DIR}/disco-bed.wav}"
DURATION=480  # 8 minutes

echo "==> Synthesizing disco bed → $OUTPUT (${DURATION}s)"

# ── Method 1: ffmpeg aevalsrc (simple test first) ──────────────────────────
test_aevalsrc() {
  "$FFMPEG" -y -f lavfi \
    -i "aevalsrc=0.5*sin(2*PI*440*t)*exp(-5*t):sample_rate=44100:duration=1" \
    -c:a pcm_s16le /tmp/rg-disco-test.wav >/dev/null 2>&1 || return 1
  local vol
  vol=$("$FFMPEG" -i /tmp/rg-disco-test.wav -af volumedetect -vn -f null - 2>&1 | \
        grep max_volume | awk '{print $5}')
  # If max_volume > -90 dB, aevalsrc works
  [[ -n "$vol" && "${vol%.*}" -gt -90 ]] 2>/dev/null && return 0 || return 1
}

build_via_aevalsrc() {
  # Note: this ffmpeg (4.2.7) requires that commas inside function args use \,
  # and complex expressions with nested parens may fail silently.
  # We use the simplest possible expressions that work reliably.
  #
  # 120 BPM = 2 beats/s
  # Kick: 80Hz decaying sine on every beat (every 0.5s)
  #   tc = t - floor(t/0.5)*0.5  (time since last beat)
  #   Envelope: exp(-35*tc) -- fires for ~60ms, then near-silence
  # Hat: 5kHz decaying sine on offbeats (every 0.5s offset by 0.25)
  # Bass: low sine at 58Hz with long period decay
  # Pad: quiet 116Hz tone

  local KICK="0.55*sin(2*PI*80*t)*exp(-35*(t-floor(t/0.5)*0.5))"
  local HAT="0.15*sin(2*PI*5000*t)*exp(-60*(t-0.25-floor((t-0.25)/0.5)*0.5))"
  local BASS="0.40*sin(2*PI*58*t)*exp(-8*(t-floor(t/2.0)*2.0))"
  local PAD="0.06*sin(2*PI*116*t)"
  local MIX="0.70*(${KICK}+${HAT}+${BASS}+${PAD})"

  "$FFMPEG" -y -f lavfi \
    -i "aevalsrc=${MIX}|${MIX}:sample_rate=44100:duration=${DURATION}" \
    -c:a pcm_s16le -ar 44100 -ac 2 \
    "$OUTPUT" 2>&1 | tail -4
}

# ── Method 2: Python3 synthesis ─────────────────────────────────────────────
build_via_python() {
  python3 - "$OUTPUT" "$DURATION" <<'PYEOF'
import sys, wave, struct, math

out_path = sys.argv[1]
duration = int(sys.argv[2])

SR = 44100
BPM = 120
BEAT = 60.0 / BPM          # 0.5s per beat
BAR  = BEAT * 4             # 2.0s per bar
BAR2 = BAR * 2              # 4.0s per 2-bar loop

def kick(tc):
    """80Hz sine with tight exponential decay. Fires at tc=0."""
    return 0.55 * math.sin(2 * math.pi * 80 * tc) * math.exp(-35 * tc)

def hat(th):
    """5kHz sine burst (open hat character). Fires at th=0."""
    return 0.16 * math.sin(2 * math.pi * 5000 * th) * math.exp(-65 * th)

def chat(tc):
    """8kHz closed hat on 16th-note subdivisions (quieter)."""
    return 0.07 * math.sin(2 * math.pi * 8000 * tc) * math.exp(-100 * tc)

def bass(tb, freq):
    """Plucked bass note at given frequency. tb = time since note onset."""
    return 0.42 * math.sin(2 * math.pi * freq * tb) * math.exp(-10 * tb)

def pad(t):
    """Subtle chord pad: Bb minor triad, one octave up."""
    return (
        0.05 * math.sin(2 * math.pi * 116 * t) +   # Bb
        0.04 * math.sin(2 * math.pi * 138 * t) +   # Db
        0.03 * math.sin(2 * math.pi * 174 * t)     # F
    )

# Bass pattern (2-bar = 4.0s), each entry: (bar_start_time, freq_hz, gate_width_s)
BASS_NOTES = [
    (0.000, 58,  0.22),   # beat 1     Bb
    (0.250, 58,  0.18),   # e1         Bb eighth
    (1.000, 78,  0.22),   # beat 3     Eb
    (1.500, 58,  0.20),   # beat 4     Bb
    (1.750, 52,  0.18),   # e4         Ab (approach)
    (2.000, 58,  0.22),   # bar 2 beat1 Bb
    (2.500, 65,  0.18),   # e1         D (fill)
    (3.000, 78,  0.22),   # beat 3     Eb
    (3.500, 58,  0.20),   # beat 4     Bb
    (3.750, 69,  0.18),   # e4         Db (chromatic)
]

print(f"    Generating {duration}s @ {SR}Hz...", flush=True)
total_samples = SR * duration
step = SR // 10  # print progress every 0.1s worth of samples

buf = []
for n in range(total_samples):
    t = n / SR
    s = 0.0

    # ── Kick (4 on the floor) ──
    tc = t - math.floor(t / BEAT) * BEAT
    if tc < 0.09:
        s += kick(tc)

    # ── Open hi-hat (offbeats) ──
    th = (t - BEAT / 2) - math.floor((t - BEAT / 2) / BEAT) * BEAT
    if th < 0.07:
        s += hat(th)

    # ── Closed hi-hat (16th subdivisions, skip kick/hat slots) ──
    t16 = BEAT / 2  # 0.25s per 16th
    tc16 = t - math.floor(t / t16) * t16
    if tc16 < 0.03 and tc >= 0.03 and th >= 0.03:
        s += chat(tc16)

    # ── Bass ──
    bar_t = t - math.floor(t / BAR2) * BAR2
    for (bt, freq, gate) in BASS_NOTES:
        slot = bar_t - bt
        if 0.0 <= slot < gate:
            s += bass(slot, freq)
            break  # only one note per moment

    # ── Pad ──
    s += pad(t)

    # Clip and convert
    s = max(-1.0, min(1.0, s * 0.70))
    buf.append(int(s * 32767))

print(f"    Writing {len(buf)} samples → {out_path}", flush=True)
with wave.open(out_path, 'w') as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    # Interleave L+R (mono content duplicated to stereo)
    stereo = []
    for v in buf:
        stereo.append(v)
        stereo.append(v)
    wf.writeframes(struct.pack(f'<{len(stereo)}h', *stereo))
print("    Python synthesis done.", flush=True)
PYEOF
}

# ── Method 3: Loop the auditechme music bed ──────────────────────────────────
build_via_loop() {
  local SRC="/home/visiond/projects/auditechme/recordings/previews/music-bed-only.mp3"
  if [[ ! -f "$SRC" ]]; then
    echo "ERROR: Fallback source not found: $SRC" >&2
    return 1
  fi
  echo "    Using auditechme music bed (looped)"
  "$FFMPEG" -y -stream_loop -1 -i "$SRC" \
    -t "$DURATION" \
    -c:a pcm_s16le -ar 44100 -ac 2 \
    "$OUTPUT" 2>&1 | tail -4
}

# ── Run methods in order ────────────────────────────────────────────────────
SUCCESS=0

echo "    Trying method: Python3 synthesis (reliable)"
if build_via_python; then
  SUCCESS=1
fi

if [[ "$SUCCESS" -eq 0 ]]; then
  echo "    Python failed; trying ffmpeg aevalsrc"
  if test_aevalsrc && build_via_aevalsrc; then
    SUCCESS=1
  fi
fi

if [[ "$SUCCESS" -eq 0 ]]; then
  echo "    aevalsrc failed; looping fallback music bed"
  if build_via_loop; then
    SUCCESS=1
  fi
fi

if [[ "$SUCCESS" -eq 0 ]]; then
  echo "ERROR: All synthesis methods failed." >&2
  exit 1
fi

# ── Verify output ──────────────────────────────────────────────────────────
if [[ ! -f "$OUTPUT" ]]; then
  echo "ERROR: Output file not created: $OUTPUT" >&2
  exit 1
fi

SIZE=$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT" 2>/dev/null || echo "?")
echo "    Done: $OUTPUT (${SIZE} bytes)"

# Check signal level
MAXVOL=$("$FFMPEG" -i "$OUTPUT" -af volumedetect -vn -f null - 2>&1 | \
          grep max_volume | awk '{print $5}' || echo "?")
echo "    Max volume: ${MAXVOL} dB"

if [[ "$MAXVOL" == "?"  || "${MAXVOL%.*}" -lt -60 ]] 2>/dev/null; then
  echo "WARNING: Output may be silent or near-silence (max_volume=${MAXVOL})" >&2
fi

echo "==> disco-bed.sh complete"
