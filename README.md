# Video Dissection Tool 🎬

An automated engineering pipeline that takes one short video and breaks it into modular components: **frame-accurate silent video clips**, **isolated voice and music audio stems**, **image sequences per clip**, and **word-aligned timestamped transcripts**.

Designed for video creators and engineers who rebuild or remix videos from granular components.

---

## 📁 Output Folder Structure

Every dissected video generates an isolated output folder in `output/<video_name>/`:

```
output/<video_name>/
├── audio/
│   ├── voice.wav              # Isolated speech track (Demucs vocals stem)
│   └── music.wav              # Isolated background music / ambient track
├── transcript/
│   ├── transcript.txt         # Timestamped readable text
│   ├── transcript.srt         # SubRip formatted subtitles (HH:MM:SS,mmm)
│   └── transcript.json        # Word-level timestamps & segment probabilities
├── clips/
│   ├── clip_001.mp4           # Silent re-encoded shot clip (no audio track, -an)
│   ├── clip_002.mp4
│   └── ...
├── frames/
│   ├── clip_001/
│   │   ├── 000001.jpg         # Frame-accurate image sequence (1-indexed)
│   │   ├── 000002.jpg
│   │   └── ...
│   └── clip_002/
│       ├── 000001.jpg
│       └── ...
├── capcut_ready/              # Default export: numbered silent clips, audio stems, captions & IMPORT.md
│   ├── clip_001.mp4           # Frame-accurate silent scene clips in numerical order
│   ├── clip_002.mp4
│   ├── voice.wav              # Isolated vocal stem (full duration)
│   ├── music.wav              # Isolated background music stem (full duration)
│   ├── captions.srt           # Word-aligned SubRip subtitle captions
│   └── IMPORT.md              # Clear step-by-step manual assembly guide for CapCut
├── capcut_project/            # Optional experimental draft (generated with --capcut-draft)
│   ├── draft_content.json     # Experimental multi-track CapCut timeline
│   ├── draft_meta_info.json   # CapCut project metadata
│   └── capcut_draft_notes     # Compatibility warning and version notes
├── timeline_fcp7.xml          # OpenTimelineIO FCP7 / Premiere XML (with --export fcp7xml)
├── timeline.edl               # OpenTimelineIO CMX 3600 EDL (with --export edl)
├── timeline.fcpxml            # OpenTimelineIO FCPX XML (with --export fcpxml)
├── CapCut_Project_<name>.zip  # Zipped CapCut ready bundle with clips, stems, and instructions
└── scenes.json                # Complete scene index linking clips, timing, & speech
```

---

## ⚡ Accuracy Over Speed by Default

By default, the tool selects maximum precision:
- **Audio Stem Separation**: Demucs `htdemucs_ft` fine-tuned model (`--two-stems=vocals`)
- **Speech Transcription**: Whisper `large-v3` via `faster-whisper` with `vad_filter=True` and `word_timestamps=True` run directly on `voice.wav`
- **High-Precision Scene Cut Detection**: Multi-pass `--detector ensemble` combining PySceneDetect `AdaptiveDetector` (resilient to camera motion & lighting changes) + `ContentDetector` + `ThresholdDetector` (fade-to-black cuts), with automatic single-clip fallback if 0 cuts are found
- **Audio-Aware Speech-Boundary Snapping**: Automatically nudges visual scene cuts within 220ms of spoken word boundaries so syllables and words are never sliced mid-utterance, then quantizes cut points to exact integer frame boundaries (`round(t * fps) / fps`)
- **Spatial Watermark Removal (`--watermark`)**: Optional corner watermark detection & inpainting (`auto`, `bottom-right`, `top-right`, `top-left`, `bottom-left`, or custom `x,y,w,h` pixels) via FFmpeg `delogo` while leaving center/bottom burned-in subtitles untouched
- **CFR Conformance**: Pre-conforms variable-frame-rate (VFR) videos to constant frame rate (CFR) to prevent audio/video timestamp drift and frame count divergence
- **Exact Frame Boundaries**: Re-encodes clips (`-c:v libx264 -crf 18 -an`) rather than keyframe-snapped stream copying (`-c copy`), guaranteeing zero cut-point drift

Use `--fast` for a quick draft run using lighter models (`base` whisper, standard `htdemucs`).

---

## 🚀 Quick Start

### 1. Google Colab (GPU Recommended)
A ready-to-run Jupyter notebook is included in [`video_dissection.ipynb`](./video_dissection.ipynb):
1. Open [`video_dissection.ipynb`](./video_dissection.ipynb) in [Google Colab](https://colab.research.google.com/).
2. Select **Runtime** → **Change runtime type** → **T4 GPU**.
3. Run the cells in order:
   - Install dependencies (`ffmpeg`, `faster-whisper`, `demucs`, `scenedetect`).
   - Upload your video file or mount Google Drive.
   - Run the dissection pipeline (includes default capcut_ready/ export & watermark removal).
   - Automatically download **`CapCut_Project_<video_name>.zip`** and **`output_<video_name>.zip`** directly to your browser.

---

### 2. Local Machine (CPU: e.g. AMD Ryzen 5600)
The tool automatically detects CPU environments and configures optimal settings:
- Detects available physical CPU cores (e.g. 6 cores / 12 threads)
- Sets Whisper `compute_type="int8"` for efficient quantization on x86_64
- Runs Demucs on CPU with multi-threading

#### System Requirements:
- Python 3.10+
- FFmpeg (`sudo apt-get install ffmpeg` on Ubuntu/Debian, `brew install ffmpeg` on macOS, or `winget install Gyan.FFmpeg` on Windows)

#### Installation:
```bash
# Clone the repository
git clone https://github.com/Taimoor505/videosect.git
cd videosect

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### Run on CPU:
```bash
# Accurate mode (default: large-v3 + htdemucs_ft + ensemble cuts + capcut_ready/ export)
python3 dissect.py input_video.mp4 --watermark auto

# Fast mode (recommended for initial test runs on CPU)
python3 dissect.py input_video.mp4 --fast
```

---

### 3. Local Machine (NVIDIA GPU / CUDA)
If an NVIDIA GPU with CUDA is detected, the tool automatically uses:
- `device="cuda"`
- `compute_type="float16"`
- GPU acceleration for both Demucs stem isolation and Whisper transcription.

```bash
python3 dissect.py input_video.mp4 --detector ensemble --threshold 27.0 --watermark auto
```

---

## 🛠️ Command-Line Interface (CLI) Reference

```bash
python3 dissect.py [VIDEO] [OPTIONS]
```

| Argument | Type | Default | Description |
|---|---|---|---|
| `video` | Positional | *Required* | Path to input video file (`.mp4`, `.mov`, `.mkv`, etc.) |
| `-o`, `--output-dir` | Path | `./output` | Root directory where output folders are created |
| `--fast` | Flag | `False` | Enables quick mode (`base` whisper, standard `htdemucs`) |
| `--detector` | String | `ensemble` | `ensemble` (Adaptive+Content+Fade), `adaptive`, or `content` |
| `--threshold` | Float | `27.0` | Scene cut sensitivity threshold |
| `--no-snap-speech` | Flag | `False` | Disables snapping scene cuts to spoken word boundaries |
| `--watermark` | String | `none` | `none`, `auto`, `bottom-right`, `top-right`, `top-left`, `bottom-left`, or `x,y,w,h` |
| `--min-scene-len` | Float | `0.5` | Minimum shot duration in seconds |
| `--device` | String | `auto` | `auto`, `cuda` (NVIDIA GPU), or `cpu` (AMD Ryzen / Intel) |
| `--whisper-model` | String | `large-v3` (`base` in `--fast`) | Specific faster-whisper model tag |
| `--demucs-model` | String | `htdemucs_ft` (`htdemucs` in `--fast`) | Specific Demucs separation checkpoint |
| `--target-fps` | Float | `30.0` | Frame rate to conform video to (prevents VFR drift) |
| `--keep-temp` | Flag | `False` | Retains intermediate scratch files in `_temp/` |
| `--capcut` | Flag | `True` | Automatically generates default `capcut_ready/` folder with numbered clips, stems, and `IMPORT.md` |
| `--no-capcut` | Flag | `False` | Disables automatic `capcut_ready/` folder generation |
| `--capcut-draft` | Flag | `False` | Experimental: generates `draft_content.json` + `capcut_draft_notes` (may be rejected by newer CapCut Desktop versions) |
| `--export` | String | `None` | Comma-separated OpenTimelineIO NLE exports: `fcp7xml`, `edl`, `fcpxml` (for Premiere, Resolve, Final Cut Pro) |

---

## 🎬 CapCut & NLE Timeline Export Guide

### Default Export: `capcut_ready/` (100% Reliable Manual Assembly)

CapCut does not officially support importing XML timeline files, and newer CapCut Desktop versions (v4.0+) encrypt or reject externally generated `draft_content.json` files.

By default (or with `--capcut`), Videosect exports a `capcut_ready/` folder organized for rapid manual assembly in under 30 seconds on CapCut Desktop, Web, or Mobile:

1. **Open CapCut** and click **Create project**, then import all files from `capcut_ready/`.
2. **Video Track 1**: Drag `clip_001.mp4` through `clip_N.mp4` onto Track 1 in numerical order. Because cuts are frame-quantized, they align end-to-end with zero gaps or drift.
3. **Audio Track 1**: Drag `voice.wav` to `00:00:00.000`.
4. **Audio Track 2**: Drag `music.wav` to `00:00:00.000`.
5. **Captions**: Go to **Text** → **Local captions** (or **Import captions**) and select `captions.srt`.

Detailed instructions are also automatically written to `capcut_ready/IMPORT.md`.

---

### Experimental: `--capcut-draft`

If you are using CapCut Desktop versions that support unencrypted JSON drafts, pass `--capcut-draft` to generate `capcut_project/` containing `draft_content.json`, `draft_meta_info.json`, and `capcut_draft_notes`:

```bash
python3 dissect.py input_video.mp4 --capcut-draft
```

Copy the folder into your local drafts path:
- **Windows**: `%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft\`
- **macOS**: `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/`

*Note: Newer versions of CapCut Desktop may report "Project file corrupted" or ignore unencrypted drafts. Use `capcut_ready/` for guaranteed compatibility.*

---

### Professional NLE Timelines via OpenTimelineIO (`--export`)

**Important:** CapCut cannot import XML files. For professional NLEs that have official XML/EDL import capabilities (DaVinci Resolve, Adobe Premiere Pro, Final Cut Pro), use the `--export` option:

```bash
python3 dissect.py input_video.mp4 --export fcp7xml,edl,fcpxml
```

This generates OpenTimelineIO-validated timeline files:
- `timeline_fcp7.xml` — Final Cut Pro 7 / Adobe Premiere Pro XML
- `timeline.edl` — CMX 3600 Edit Decision List
- `timeline.fcpxml` — Final Cut Pro X XML

---

## 📋 `scenes.json` Specification

`scenes.json` links the visual clips, frame counts, exact timestamps, and spoken dialogue:

```json
{
  "video_name": "example_interview",
  "source_file": "example_interview.mp4",
  "total_duration": 14.82,
  "fps": 30.0,
  "clip_count": 3,
  "models": {
    "whisper": "large-v3",
    "demucs": "htdemucs_ft",
    "device": "cpu"
  },
  "scenes": [
    {
      "clip_id": "clip_001",
      "file": "clips/clip_001.mp4",
      "frames_dir": "frames/clip_001",
      "start_time": 0.0,
      "end_time": 4.5,
      "start_timestamp": "00:00:00.000",
      "end_timestamp": "00:00:04.500",
      "duration": 4.5,
      "frame_count": 135,
      "spoken_text": "Welcome to our studio demo.",
      "spoken_words": [
        { "word": "Welcome", "start": 0.3, "end": 0.8, "probability": 0.99 },
        { "word": "to", "start": 0.82, "end": 0.95, "probability": 0.98 },
        { "word": "our", "start": 0.96, "end": 1.15, "probability": 0.97 },
        { "word": "studio", "start": 1.2, "end": 1.8, "probability": 0.99 },
        { "word": "demo.", "start": 1.85, "end": 2.4, "probability": 0.98 }
      ]
    }
  ]
}
```

---

## 🧪 Verification & Test Suite

Run the automated test suite with:

```bash
python3 test_dissect.py
```

### What was tested:
1. **SubRip (.srt) Formatter**: Strict validation of millisecond comma separators (`00:00:01,234`), 1-based sequential indices, and clean subtitle blocks.
2. **Plain-Text Transcript Generator**: Timestamp bracket format verification (`[00:00:01.200 --> 00:00:03.400] text`).
3. **Word-Level Timestamp JSON Serialization**: Segment and nested word schema validation.
4. **Word-to-Scene Matching Algorithm**:
   - Verification of exact midpoint assignment inside `[scene_start, scene_end)`
   - Boundary tolerance tests
   - Completely silent shot verification (empty string `""` and empty word array `[]`)
5. **Scene Cut Fallback Mechanism**:
   - Validates that videos with 0 cuts or subtle cuts fall back safely to a single clip spanning `(0.0, total_duration)`.
6. **Device & Thread Auto-Detection**:
   - Auto selection of `int8` compute for CPU and `float16` for CUDA.
   - Dynamic CPU thread assignment based on physical host cores.
7. **FFmpeg CFR Conformance**: Ensures variable frame rate videos are conformed without timestamp drifting.
8. **Silent Re-encoding Validation**: Uses `ffprobe` to verify that produced clips have **zero audio streams** (`-an`).
9. **Frame Extraction Precision**: Confirms frame extraction generates ordered `000001.jpg` sequences whose count matches `duration * fps`.
10. **Full End-to-End Synthetic Pipeline**: Executes a synthetic 2-scene color-cut video with audio tone through the complete pipeline, asserting that the output directory structure matches the required specification.

### What could not be tested locally without external weights:
- **Live CUDA GPU hardware execution** (tested via simulated parameters; tested on Colab GPU).
- **Live download of 3GB neural network weights** for Demucs (`htdemucs_ft`) and Whisper (`large-v3`) in a sandbox environment without external network access (the pipeline includes an audio filter fallback path so the entire workflow executes cleanly in test environments).

---

## 📄 License
Apache-2.0
