#!/usr/bin/env python3
"""
A/B Vocal Stem Separation Comparison Script (`ab_separate.py`)
==============================================================
Runs both `demucs` and `roformer` (with fallback) on the same video or audio clip
and outputs:
  - `voice_demucs.wav` & `music_demucs.wav`
  - `voice_roformer.wav` & `music_roformer.wav`
  - `ab_comparison.json` (loudness LUFS, RMS dBFS, and runtime per model)
so you can listen side-by-side and choose the best vocal separator for your material.

Usage:
    python ab_separate.py input_video.mp4 [-o ./ab_output] [--denoise] [--loudnorm]
"""

import argparse
import json
import shutil
import time
from pathlib import Path
from typing import Any, Dict

import dissect


def run_ab_separation(
    input_path: Path,
    output_dir: Path,
    device: str = "auto",
    fast: bool = False,
    denoise: bool = False,
    loudnorm: bool = False
) -> Dict[str, Any]:
    input_path = input_path.resolve()
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    dev_name, _, _ = dissect.detect_device(device)
    info = dissect.get_video_info(input_path)
    duration = float(info.get("duration", 1.0))
    has_audio = bool(info.get("has_audio", True)) or input_path.suffix.lower() in (".wav", ".mp3", ".flac", ".m4a")

    raw_wav = output_dir / "source_mix.wav"
    if input_path.suffix.lower() == ".wav":
        shutil.copy2(input_path, raw_wav)
    else:
        dissect.extract_initial_audio(input_path, raw_wav, has_audio=has_audio, duration=duration)

    report: Dict[str, Any] = {
        "source_file": input_path.name,
        "duration_sec": round(duration, 3),
        "models": {}
    }

    for backend in ("demucs", "roformer"):
        if backend == "roformer":
            has_audio_separator = False
            try:
                import audio_separator  # noqa: F401
                has_audio_separator = True
            except ImportError:
                has_audio_separator = False

            if not has_audio_separator:
                print("[A/B Separate] audio-separator is not installed; skipping roformer model.")
                continue

        sub_dir = output_dir / f"_tmp_{backend}"
        sub_dir.mkdir(parents=True, exist_ok=True)
        t0 = time.time()
        v_wav, m_wav = dissect.separate_audio_stems(
            audio_wav_path=raw_wav,
            output_audio_dir=sub_dir,
            device=dev_name,
            fast=fast,
            separator_backend=backend,
            denoise=denoise,
            loudnorm=loudnorm,
            has_audio=has_audio,
            duration=duration
        )
        elapsed = round(time.time() - t0, 2)

        out_voice = output_dir / f"voice_{backend}.wav"
        out_music = output_dir / f"music_{backend}.wav"
        shutil.copy2(v_wav, out_voice)
        shutil.copy2(m_wav, out_music)
        shutil.rmtree(sub_dir, ignore_errors=True)

        v_lufs = dissect.measure_audio_lufs(out_voice)
        m_lufs = dissect.measure_audio_lufs(out_music)
        report["models"][backend] = {
            "voice_file": str(out_voice.name),
            "music_file": str(out_music.name),
            "voice_lufs": v_lufs,
            "music_lufs": m_lufs,
            "elapsed_sec": elapsed
        }
        print(f"[A/B Separate] {backend}: {out_voice.name} ({v_lufs} LUFS) in {elapsed}s")

    report_path = output_dir / "ab_comparison.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description="A/B compare Demucs vs BS-RoFormer vocal separation on the same clip.")
    parser.add_argument("input", type=str, help="Path to video or audio file")
    parser.add_argument("-o", "--output-dir", type=str, default="./ab_output", help="Output directory for A/B WAV files")
    parser.add_argument("--device", type=str, default="auto", choices=["auto", "cuda", "cpu"])
    parser.add_argument("--fast", action="store_true", help="Use fast model variant")
    parser.add_argument("--denoise", action="store_true", help="Apply afftdn spectral denoise to voice outputs")
    parser.add_argument("--loudnorm", action="store_true", help="Apply EBU R128 loudnorm to voice outputs")
    args = parser.parse_args(argv)
    run_ab_separation(
        input_path=Path(args.input),
        output_dir=Path(args.output_dir),
        device=args.device,
        fast=args.fast,
        denoise=args.denoise,
        loudnorm=args.loudnorm
    )


if __name__ == "__main__":
    main()
