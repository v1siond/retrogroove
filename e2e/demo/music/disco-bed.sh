#!/usr/bin/env bash
# Synthesizes a disco groove music bed — v3 (cleaner, more recognizably disco).
#
# 120 BPM four-on-the-floor:
#   - Kick: 55Hz boom with click transient, tight decay
#   - Open hi-hat: narrow noise burst on the offbeats (2 & 4 shoulders)
#   - Closed hi-hat: 16th-note pulse underneath
#   - Funky bass: 2-bar syncopated pattern
#   - String pad stab: short Bb-minor chord hits on beats 1 & 3
#
# Duration: 8 minutes (480s). Mixed quiet (~-22 dB peak) for ambient use.
#
# Usage:
#   bash disco-bed.sh [output.wav]
#   Default output: disco-bed.wav (alongside this script)

set -euo pipefail

FFMPEG="${FFMPEG:-/usr/bin/ffmpeg}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="${1:-${SCRIPT_DIR}/disco-bed.wav}"
DURATION=480  # 8 minutes

echo "==> Synthesizing disco bed v3 → $OUTPUT (${DURATION}s)"

# ── Python3 synthesis (primary — most reliable, best sound control) ──────────
build_via_python() {
  python3 - "$OUTPUT" "$DURATION" <<'PYEOF'
import sys, wave, struct, math, random

out_path = sys.argv[1]
duration = int(sys.argv[2])

SR   = 44100
BPM  = 120
BEAT = 60.0 / BPM      # 0.5 s
BAR  = BEAT * 4        # 2.0 s
BAR2 = BAR * 2         # 4.0 s — our loop period

# ── Envelope helpers ─────────────────────────────────────────────────────────
def adsr(t, attack, decay, sustain_level, release, total_gate):
    """Simple ADSR envelope — t is time since note onset."""
    if t < 0:
        return 0.0
    if t < attack:
        return t / attack
    t2 = t - attack
    if t2 < decay:
        return 1.0 - (1.0 - sustain_level) * (t2 / decay)
    t3 = t2 - decay
    if t3 < (total_gate - attack - decay):
        return sustain_level
    t4 = t - (total_gate - release)
    if t4 < release:
        return sustain_level * (1.0 - t4 / release)
    return 0.0

# ── Drum sounds ──────────────────────────────────────────────────────────────
def kick(tc):
    """
    Two-layer kick: low boom (55 Hz) + click transient (800 Hz).
    Pitch sweeps down for the classic disco thump.
    """
    if tc < 0 or tc > 0.22:
        return 0.0
    # Pitch sweep: 160 Hz → 55 Hz in first 80ms
    sweep_freq = 160.0 * math.exp(-30 * tc) + 55.0
    boom  = 0.80 * math.sin(2 * math.pi * sweep_freq * tc) * math.exp(-20 * tc)
    click = 0.35 * math.sin(2 * math.pi * 800  * tc) * math.exp(-200 * tc)
    return boom + click

def open_hat(th):
    """
    Open hi-hat: short filtered noise burst — offbeats.
    Simulate with high-freq sine mix (deterministic, no true RNG per sample).
    """
    if th < 0 or th > 0.12:
        return 0.0
    # Mix of high partials to sound hat-like without true noise
    v = (  0.5 * math.sin(2 * math.pi * 7900 * th)
         + 0.3 * math.sin(2 * math.pi * 9300 * th)
         + 0.2 * math.sin(2 * math.pi * 11700 * th) )
    return v * 0.22 * math.exp(-55 * th)

def closed_hat(tc):
    """Closed hat on 16ths — tighter, quieter."""
    if tc < 0 or tc > 0.04:
        return 0.0
    v = (  0.5 * math.sin(2 * math.pi * 10000 * tc)
         + 0.5 * math.sin(2 * math.pi * 13000 * tc) )
    return v * 0.10 * math.exp(-200 * tc)

# ── Bass line ─────────────────────────────────────────────────────────────────
# 2-bar syncopated funky bass pattern (Bb-minor, classic disco range)
# Each entry: (beat_offset_in_2bars, freq_hz, gate_s)
BASS_NOTES = [
    (0.000,  58.3,  0.20),  # Bb2  beat 1
    (0.375,  77.8,  0.15),  # Eb3  syncopated "and-of-1"
    (0.500,  58.3,  0.20),  # Bb2  beat 2
    (1.000,  58.3,  0.25),  # Bb2  beat 3
    (1.500,  69.3,  0.18),  # Db3  beat 4
    (1.750,  58.3,  0.15),  # Bb2  "and-of-4" (anticipation)
    (2.000,  58.3,  0.20),  # Bb2  bar 2 beat 1
    (2.375,  65.4,  0.15),  # D3   "and-of-1"
    (2.500,  46.2,  0.25),  # Bb1  drop (one octave down)
    (3.000,  77.8,  0.20),  # Eb3  beat 3
    (3.500,  58.3,  0.18),  # Bb2  beat 4
    (3.750,  69.3,  0.15),  # Db3  chromatic lead-in
]

def bass(tb, freq, gate):
    """Plucked bass: sine + 2nd harmonic, shaped with ADSR."""
    if tb < 0 or tb > gate + 0.06:
        return 0.0
    amp = adsr(tb, 0.003, 0.04, 0.55, 0.06, gate)
    v = (0.70 * math.sin(2 * math.pi * freq * tb)
       + 0.25 * math.sin(2 * math.pi * freq * 2 * tb)
       + 0.05 * math.sin(2 * math.pi * freq * 3 * tb))
    return v * amp * 0.55

# ── String pad stab ───────────────────────────────────────────────────────────
# Short chord hit on beat 1 and beat 3 of every bar.
# Bb minor: Bb (116 Hz), Db (138 Hz), F (174 Hz) — one octave up for brightness
PAD_STAB_DUR = 0.30

def pad_stab(ts):
    """Bb minor chord stab with fast attack, medium release."""
    if ts < 0 or ts > PAD_STAB_DUR + 0.10:
        return 0.0
    amp = adsr(ts, 0.008, 0.05, 0.40, 0.20, PAD_STAB_DUR)
    v = (0.45 * math.sin(2 * math.pi * 116.5 * ts)   # Bb3
       + 0.35 * math.sin(2 * math.pi * 138.6 * ts)   # Db4
       + 0.25 * math.sin(2 * math.pi * 174.6 * ts)   # F4
       + 0.12 * math.sin(2 * math.pi * 233.1 * ts))  # Bb4 (top)
    return v * amp * 0.18

print(f"    Generating {duration}s @ {SR}Hz (disco v3)...", flush=True)
total_samples = SR * duration

buf = []
for n in range(total_samples):
    t = n / SR
    s = 0.0

    # ── Kick: four on the floor ──
    tc_kick = t - math.floor(t / BEAT) * BEAT
    s += kick(tc_kick)

    # ── Open hi-hat: offbeats (0.25 s after each kick) ──
    t_oh = t - BEAT / 2
    th_oh = t_oh - math.floor(t_oh / BEAT) * BEAT if t_oh >= 0 else 1.0
    s += open_hat(th_oh)

    # ── Closed hi-hat: 16th-note grid (skip kick and open-hat slots) ──
    t16 = BEAT / 2                         # 16th note = 0.25 s at 120 BPM
    tc16 = t - math.floor(t / t16) * t16
    if tc_kick > 0.05 and th_oh > 0.05:   # don't double up with kick/hat
        s += closed_hat(tc16)

    # ── Bass: 2-bar pattern ──
    bar2_t = t - math.floor(t / BAR2) * BAR2
    for (bt, freq, gate) in BASS_NOTES:
        slot = bar2_t - bt
        if -0.001 <= slot <= gate + 0.06:
            s += bass(slot, freq, gate)
            break

    # ── Pad stab: on beat 1 and beat 3 of every bar ──
    # beat 1 = 0.0 s into each bar, beat 3 = 1.0 s into each bar
    bar_t = t - math.floor(t / BAR) * BAR
    ts1 = bar_t              # time since beat 1
    ts3 = bar_t - BEAT * 2  # time since beat 3
    s += pad_stab(ts1)
    if ts3 >= 0:
        s += pad_stab(ts3)

    # Soft clip + master at ~-22 dBFS (factor ~0.078)
    s = math.tanh(s * 0.9) * 0.078
    buf.append(int(max(-32767, min(32767, s * 32767))))

    if n % (SR * 30) == 0:
        print(f"    {n // SR}s / {duration}s", flush=True)

print(f"    Writing {len(buf)} samples → {out_path}", flush=True)
with wave.open(out_path, 'w') as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    stereo = []
    for v in buf:
        stereo.append(v)
        stereo.append(v)
    wf.writeframes(struct.pack(f'<{len(stereo)}h', *stereo))
print("    Python disco synthesis v3 done.", flush=True)
PYEOF
}

# ── Fallback: ffmpeg aevalsrc (simpler, less good) ──────────────────────────
test_aevalsrc() {
  "$FFMPEG" -y -f lavfi \
    -i "aevalsrc=0.5*sin(2*PI*440*t)*exp(-5*t):sample_rate=44100:duration=1" \
    -c:a pcm_s16le /tmp/rg-disco-test.wav >/dev/null 2>&1 || return 1
  local vol
  vol=$("$FFMPEG" -i /tmp/rg-disco-test.wav -af volumedetect -vn -f null - 2>&1 | \
        grep max_volume | awk '{print $5}')
  [[ -n "$vol" && "${vol%.*}" -gt -90 ]] 2>/dev/null && return 0 || return 1
}

build_via_aevalsrc() {
  local KICK="0.55*sin(2*PI*80*t)*exp(-35*(t-floor(t/0.5)*0.5))"
  local HAT="0.15*sin(2*PI*5000*t)*exp(-60*(t-0.25-floor((t-0.25)/0.5)*0.5))"
  local BASS="0.40*sin(2*PI*58*t)*exp(-8*(t-floor(t/2.0)*2.0))"
  local PAD="0.06*sin(2*PI*116*t)"
  local MIX="0.078*(${KICK}+${HAT}+${BASS}+${PAD})"

  "$FFMPEG" -y -f lavfi \
    -i "aevalsrc=${MIX}|${MIX}:sample_rate=44100:duration=${DURATION}" \
    -c:a pcm_s16le -ar 44100 -ac 2 \
    "$OUTPUT" 2>&1 | tail -4
}

# ── Fallback: loop existing music bed ────────────────────────────────────────
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

# ── Run methods in order ─────────────────────────────────────────────────────
SUCCESS=0

echo "    Trying method: Python3 synthesis v3"
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

# ── Verify output ─────────────────────────────────────────────────────────────
if [[ ! -f "$OUTPUT" ]]; then
  echo "ERROR: Output file not created: $OUTPUT" >&2
  exit 1
fi

SIZE=$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT" 2>/dev/null || echo "?")
echo "    Done: $OUTPUT (${SIZE} bytes)"

MAXVOL=$("$FFMPEG" -i "$OUTPUT" -af volumedetect -vn -f null - 2>&1 | \
          grep max_volume | awk '{print $5}' || echo "?")
echo "    Max volume: ${MAXVOL} dB"

echo "==> disco-bed.sh v3 complete"
