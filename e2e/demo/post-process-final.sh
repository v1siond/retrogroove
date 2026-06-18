#!/usr/bin/env bash
# RetroGroove final post-process: voice + bottom captions + high-quality encode.
#
# Input: demo-videos/retrogroove-lifecycle.mp4 (fresh capture, may already have music)
# Output: demo-videos/retrogroove-lifecycle.mp4 (overwrite after backup to -prev.mp4)
#
# Steps:
#   1. Re-assemble voiceover WAVs at beat offsets (adelay+amix filter_complex)
#   2. Loudnorm the assembled VO
#   3. Build bottom-aligned ASS subtitle file (Alignment=2, MarginV=80)
#   4. Burn captions into video (video-only) at CRF 18 slow
#   5. Mux: captioned video + loudnormed VO sidechain-ducked over disco bed
#
# Usage: bash e2e/demo/post-process-final.sh

set -euo pipefail

export PATH="/home/visiond/.nvm/versions/node/v22.21.1/bin:/home/visiond/.asdf/shims:$PATH"

SITE=/home/visiond/projects/retrogroove-site
VODIR="$SITE/recordings/voiceover"
TIMELINE="$SITE/recordings/master-timeline.json"
NARRATION="$SITE/docs/voiceover/narration-script.json"
MUSIC="$SITE/e2e/demo/music/disco-bed.wav"
INPUT="$SITE/demo-videos/retrogroove-lifecycle.mp4"
OUTPUT="$SITE/demo-videos/retrogroove-lifecycle.mp4"

echo "==> RetroGroove final post-process"
echo "    Input:  $INPUT"
echo "    Output: $OUTPUT"

# ── Get video duration ────────────────────────────────────────────────────────
VID_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INPUT")
echo "    Video duration: ${VID_DUR}s"

# ── Step 1: Assemble voice-over using beat timestamps from master-timeline.json ──
echo ""
echo "==> Step 1/5: Assembling voice-over with beat timestamps"

python3 - "$VODIR" "$TIMELINE" "$VID_DUR" <<'PYEOF'
import sys, json, subprocess, os

vodir    = sys.argv[1]
tl_path  = sys.argv[2]
total_dur = float(sys.argv[3])

beat_to_wav = {
    "home":            "00-home.wav",
    "event-detail":    "01-event-detail.wav",
    "seat-selection":  "02-seat-selection.wav",
    "checkout":        "03-checkout.wav",
    "success":         "04-success.wav",
    "ticket-view":     "05-ticket-view.wav",
    "admin-builder":   "06-admin-builder.wav",
    "check-in":        "07-check-in.wav",
    "check-in-double": "08-check-in-double.wav",
    "end":             "09-end.wav",
}

with open(tl_path) as f:
    timeline = json.load(f)

# Deduplicate: keep first occurrence of each beat name
seen = set()
beats = []
for entry in timeline:
    name = entry["name"]
    if name not in seen and name in beat_to_wav:
        seen.add(name)
        beats.append((name, entry["t"]))

print(f"    Using {len(beats)} beats from timeline")
for name, t in beats:
    print(f"      {name}: t={t:.3f}s → {beat_to_wav[name]}")

# Build filter_complex with adelay+amix (NOT concat — concat produces silent files)
inputs = []
filter_parts = []
valid_idx = 0
for i, (name, t_start) in enumerate(beats):
    wav_path = os.path.join(vodir, beat_to_wav[name])
    if not os.path.exists(wav_path):
        print(f"    WARNING: missing {wav_path} — skipping")
        continue
    inputs.extend(["-i", wav_path])
    delay_ms = int(t_start * 1000)
    filter_parts.append(f"[{valid_idx}]adelay={delay_ms}|{delay_ms}[d{valid_idx}]")
    valid_idx += 1

n = valid_idx
mix_inputs = "".join(f"[d{i}]" for i in range(n))
filter_parts.append(f"{mix_inputs}amix=inputs={n}:duration=longest:dropout_transition=0[mixed]")
filter_parts.append(f"[mixed]atrim=0:{total_dur},apad=whole_dur={total_dur}[out]")
filter_str = ";".join(filter_parts)

out_wav = os.path.join(vodir, "vo-assembled.wav")
cmd = ["ffmpeg", "-y"] + inputs + [
    "-filter_complex", filter_str,
    "-map", "[out]",
    "-ar", "48000",
    "-ac", "2",
    "-c:a", "pcm_s16le",
    out_wav
]

print(f"\n    Running ffmpeg voice assembly ({n} clips)...")
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    print("STDERR:", result.stderr[-3000:])
    sys.exit(1)

# Verify duration + check RMS (not flat)
probe = subprocess.run(
    ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", out_wav],
    capture_output=True, text=True
)
print(f"    VO assembled: {out_wav}")
print(f"    Duration: {probe.stdout.strip()}s (expected ~{total_dur}s)")

astats = subprocess.run(
    ["ffmpeg", "-i", out_wav, "-af", "astats=metadata=1:reset=1", "-f", "null", "-"],
    capture_output=True, text=True
)
for line in astats.stderr.split("\n"):
    if "RMS level" in line or "Flat factor" in line:
        print(f"    astats: {line.strip()}")
PYEOF

VO_RAW="$VODIR/vo-assembled.wav"
VO_NORM="$VODIR/vo-loudnorm.wav"

# ── Step 2: Loudnorm the VO ───────────────────────────────────────────────────
echo ""
echo "==> Step 2/5: Loudnorm VO (I=-16 LRA=7 TP=-1.5)"
ffmpeg -y -i "$VO_RAW" \
  -af "loudnorm=I=-16:LRA=7:TP=-1.5" \
  -ar 48000 -ac 2 -c:a pcm_s16le \
  "$VO_NORM" 2>&1 | tail -4
echo "    Loudnorm done: $VO_NORM"

# ── Step 3: Generate bottom ASS captions ─────────────────────────────────────
echo ""
echo "==> Step 3/5: Generating bottom ASS captions (Alignment=2, MarginV=80)"
ASS_FILE="/tmp/retrogroove-captions-bottom.ass"

python3 - "$NARRATION" "$TIMELINE" "$ASS_FILE" <<'PYEOF'
import sys, json

narr_path = sys.argv[1]
tl_path   = sys.argv[2]
ass_path  = sys.argv[3]

with open(narr_path) as f:
    narration = json.load(f)
with open(tl_path) as f:
    timeline = json.load(f)

# Build beat → timestamp map (first occurrence wins)
beat_t = {}
for entry in timeline:
    if entry["name"] not in beat_t:
        beat_t[entry["name"]] = entry["t"]

def to_ass_time(s):
    """Convert seconds to ASS time format H:MM:SS.CC"""
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = s % 60
    cs = int((sec % 1) * 100)
    return f"{h}:{m:02d}:{int(sec):02d}.{cs:02d}"

# ASS header:
#  PlayResX/Y = 3840×2160 (matches 4K video)
#  Alignment=2 = bottom-center (standard sub position)
#  BorderStyle=1 = outline+shadow (solid box via Shadow=3 gives dark bg feel)
#  Fontsize=88 → ~2.3% of 3840 height, readable at 4K
#  MarginV=80 → 80px from bottom edge
ass_header = """[Script Info]
ScriptType: v4.00+
PlayResX: 3840
PlayResY: 2160
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,88,&H00FFFFFF,&H000000FF,&H00000000,&HAA000000,-1,0,0,0,100,100,2,0,1,5,3,2,80,80,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

lines_out = []
for entry in narration:
    beat = entry["beat"]
    line_text = entry["line"]
    # Use timeline timestamp for start (actual recording mark), narration t_end for end
    t_start = beat_t.get(beat, entry["t_start"])
    t_end   = entry["t_end"]
    start_str = to_ass_time(t_start)
    end_str   = to_ass_time(t_end)
    lines_out.append(f"Dialogue: 0,{start_str},{end_str},Caption,,0,0,0,,{line_text}")
    print(f"      [{beat}] {start_str} → {end_str}")

with open(ass_path, "w", encoding="utf-8") as f:
    f.write(ass_header)
    f.write("\n".join(lines_out) + "\n")

print(f"\n    ASS written: {ass_path}")
print(f"    {len(lines_out)} entries, Alignment=2 (bottom-center), MarginV=80, Fontsize=88 @4K")
PYEOF

# ── Step 4: Burn captions into video (video-only, CRF 18 slow) ───────────────
echo ""
echo "==> Step 4/5: Burning captions (CRF 18 slow, video-only stream)"

TMP_CAPTIONED="/tmp/rg-captioned-4k.mp4"

# Strip audio from source, burn ASS, re-encode at CRF 18
ffmpeg -y \
  -i "$INPUT" \
  -vf "ass=${ASS_FILE}" \
  -c:v libx264 -crf 18 -preset slow \
  -pix_fmt yuv420p -movflags +faststart \
  -an \
  "$TMP_CAPTIONED" 2>&1 | tail -6

echo "    Captions burned: $TMP_CAPTIONED"
VID_DUR_CAP=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP_CAPTIONED")
echo "    Duration: ${VID_DUR_CAP}s"

# ── Step 5: Mux — captioned video + VO sidechain-ducked over disco bed ───────
echo ""
echo "==> Step 5/5: Muxing audio (VO sidechain-duck over disco bed)"

PREV_MP4="${OUTPUT%.mp4}-prev.mp4"
if [[ -f "$OUTPUT" ]]; then
  echo "    Backing up existing: $PREV_MP4"
  cp "$OUTPUT" "$PREV_MP4"
fi

ffmpeg -y \
  -i "$TMP_CAPTIONED" \
  -i "$VO_NORM" \
  -stream_loop -1 -i "$MUSIC" \
  -filter_complex "
    [2:a]atrim=0:${VID_DUR_CAP},asetpts=PTS-STARTPTS,volume=+2dB[bed];
    [bed][1:a]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=800:makeup=1[ducked];
    [1:a][ducked]amix=inputs=2:duration=longest:dropout_transition=0[audio_out]
  " \
  -map 0:v \
  -map "[audio_out]" \
  -c:v copy \
  -c:a aac -b:a 192k \
  -t "$VID_DUR_CAP" \
  -movflags +faststart \
  "$OUTPUT" 2>&1 | tail -8

rm -f "$TMP_CAPTIONED"

echo ""
echo "==> Final output: $OUTPUT"
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=noprint_wrappers=1 "$OUTPUT"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,channels \
  -of default=noprint_wrappers=1 "$OUTPUT"
