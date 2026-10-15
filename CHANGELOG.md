# Changelog

## [2.0.0] - 2026-10-15

### Phase 1 — Honesty, Robustness & Core Fixes
- **CapCut Honesty**:
  - Replaced misleading "1-click CapCut import" and "import timeline.xml into CapCut" claims.
  - Added default `capcut_ready/` export containing numbered silent clips, `voice.wav`, `music.wav`, `captions.srt`, and concise manual `IMPORT.md` steps.
  - Moved experimental `draft_content.json` generation behind `--capcut-draft` with runtime warning and `capcut_draft_notes` listing unvalidated CapCut versions (v4.0+, v5.x, v6.x+).
- **OpenTimelineIO NLE Export (`--export fcp7xml,edl,fcpxml`)**:
  - Added validated timeline generation using `opentimelineio==0.18.1` + `otio-fcp-adapter==1.0.0`, `otio-cmx3600-adapter==1.0.0`, and `otio-fcpx-xml-adapter==1.0.0`.
  - Every exported timeline is validated by re-reading it with OpenTimelineIO.
- **Robustness & Caching**:
  - Added automatic stage caching/resume (`--force` to recompute all stages).
  - Added pre-export disk-space estimation (`estimate_frame_disk_space`) and input validation.
  - Added `--frames jpg|png|none`, `--frames-every N`, and `--jpg-quality 1..100`.
  - Handled edge-case inputs: variable-frame-rate (VFR) videos, zero-cut videos, silent videos, music-only videos, and videos with no audio stream (`-an`).
- **Repo Hygiene**:
  - Expanded `.gitignore`, added `LICENSE` placeholder, pinned `requirements.txt` vs `requirements-extras.txt`, and added GitHub Actions CI (`.github/workflows/ci.yml`).

### Phase 2 — Accuracy Improvements
- **Scene Detection**:
  - Added `--detector transnet` (TransNetV2 PyTorch port with clean fallback) and `--detector merge` (consensus union of TransNetV2 + PySceneDetect ensemble).
  - Configured fade/dissolve cut placement at the temporal midpoint (`fade_bias=0.0`).
  - Added `benchmark_detectors.py` to evaluate detectors against hand-labelled `cuts.txt` (Precision / Recall / F1).
- **Cut Review & Recutting**:
  - Added `review.html` visual contact sheet with first/last frame thumbnails per clip.
  - Added `videosect recut` (`--merge`, `--split`, `--cuts-from`) to adjust cuts without re-running Demucs or Whisper.
- **Transcript Alignment & Hallucination Guards**:
  - Added `--align` (WhisperX forced alignment), `--language`, `--initial-prompt`, and `--diarize` (with graceful fallback when `HF_TOKEN` is missing).
  - Added `interpolate_missing_word_timestamps` to interpolate timestamps for numbers/symbols (`100%`, `2026`, `$50`) and mark `"interpolated": true`.
  - Added RMS energy and phrase guards against Whisper hallucinations on silent or music-only audio.
- **Voice Separation**:
  - Added `--separator demucs|roformer` (via `audio-separator`), `--denoise` (`afftdn`), `--loudnorm` (EBU R128), and `ab_separate.py` for side-by-side listening comparison.

### Phase 3 — Video Rebuilding & Analytics
- **`videosect assemble`**: Rebuild frame-accurate MP4 videos from `selection.json` (including individual frame dropping via `drop_frames`) + `voice.wav` (+ optional `music.wav`).
- **Edit & Audio Analytics (`analysis.json`, `analysis.html`)**: Shot-length stats & histogram, cuts per minute, pacing curve, voice vs music LUFS loudness, and music BPM + beat-cut sync via `librosa.beat.beat_track`.
- **Keyframes & Storyboard**: Extracted `first`/`middle`/`last` keyframes per clip and combined `keyframes/storyboard.jpg`.
- **Per-Clip Metadata**: Added `motion_level`, `brightness`, `dominant_colors`, and experimental `--describe` and `--shot-type`.
- **Burned-In Subtitle OCR (`--ocr-subs`)**: Non-destructively detects and OCRs burned-in subtitles via `rapidocr-onnxruntime` into `ocr_subtitles.json` and `ocr_subtitles.srt` with timing and style.
- **Batch Mode (`--batch`)**: Process a folder of videos and output `summary.csv`.
