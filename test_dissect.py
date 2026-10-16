#!/usr/bin/env python3
"""
Comprehensive End-to-End & Unit Test Suite (`test_dissect.py`)
==============================================================
Tests Phase 1, Phase 2, and Phase 3 features using real FFmpeg-generated
synthetic videos (multi-scene, VFR, zero-cut, silent, music-only, no-audio,
fade-to-black, and burned-in subtitle videos).
"""

import csv
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import ab_separate
import benchmark_detectors
import capcut_generator
import dissect

# Optional dependency detection for test skipping
try:
    import rapidocr_onnxruntime  # noqa: F401
    HAS_RAPIDOCR = True
except ImportError:
    HAS_RAPIDOCR = False

try:
    import audio_separator  # noqa: F401
    HAS_AUDIO_SEPARATOR = True
except ImportError:
    HAS_AUDIO_SEPARATOR = False

try:
    import whisperx  # noqa: F401
    HAS_WHISPERX = True
except ImportError:
    HAS_WHISPERX = False

try:
    import transnetv2_pytorch  # noqa: F401
    HAS_TRANSNET = True
except ImportError:
    HAS_TRANSNET = False


def generate_synthetic_video(
    out_path: Path,
    mode: str = "standard",
    fps: int = 30
) -> Path:
    """
    Generate synthetic test videos with FFmpeg:
      - 'standard': 2.0s two-scene video (1.0s red + 1.0s blue) with amplitude-modulated speech-like bursts
      - 'vfr': variable frame rate video with timestamp jitter
      - 'zero_cut': 1.5s single continuous solid green shot
      - 'silent': 1.5s video with silent audio track (anullsrc)
      - 'music_only': 2.0s video with steady 440Hz sine wave music tone (no speech modulation)
      - 'no_audio': 1.5s video with NO audio stream at all (-an)
      - 'subtitled': 2.0s video with high-contrast burned-in subtitle text in bottom region
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if mode == "standard":
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=red:s=320x240:r={fps}:d=1.0",
            "-f", "lavfi", "-i", f"color=c=blue:s=320x240:r={fps}:d=1.0",
            "-f", "lavfi", "-i", "aevalsrc='0.4*sin(2*PI*300*t)*(gt(sin(2*PI*3*t),0))':s=44100:d=2.0",
            "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
            "-map", "[v]", "-map", "2:a",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            str(out_path)
        ]
    elif mode == "vfr":
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=crimson:s=320x240:r=15:d=1.0",
            "-f", "lavfi", "-i", "color=c=navy:s=320x240:r=30:d=1.0",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=2.0",
            "-filter_complex", "[0:v]settb=AVTB,setpts='N/15/TB'[v0];[1:v]settb=AVTB,setpts='(1.0+N/30)/TB'[v1];[v0][v1]concat=n=2:v=1:a=0[v]",
            "-map", "[v]", "-map", "2:a",
            "-vsync", "vfr", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            str(out_path)
        ]
    elif mode == "zero_cut":
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=seagreen:s=320x240:r={fps}:d=1.5",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=1.5",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            str(out_path)
        ]
    elif mode == "silent":
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=purple:s=320x240:r={fps}:d=1.5",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=1.5",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            str(out_path)
        ]
    elif mode == "music_only":
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=teal:s=320x240:r={fps}:d=2.0",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=2.0",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            str(out_path)
        ]
    elif mode == "no_audio":
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=orange:s=320x240:r={fps}:d=1.5",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an",
            str(out_path)
        ]
    elif mode == "subtitled":
        # Render burned-in subtitle frames using Pillow + OpenCV so it works even without ffmpeg libfreetype
        import cv2
        import numpy as np
        from PIL import Image, ImageDraw, ImageFont

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(out_path), fourcc, float(fps), (640, 360))
        for f_i in range(fps * 2):
            img = Image.new("RGB", (640, 360), color=(20, 25, 40))
            draw = ImageDraw.Draw(img)
            # Draw large clear white text in bottom subtitle zone
            draw.rectangle([100, 275, 540, 335], fill=(0, 0, 0))
            draw.text((140, 295), "HELLO SUBTITLE WORLD 2026", fill=(255, 255, 255))
            bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
            writer.write(bgr)
        writer.release()
        return out_path
    else:
        raise ValueError(f"Unknown synthetic video mode: {mode}")

    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    return out_path


class TestPhase1CoreAndHonesty(unittest.TestCase):
    """Phase 1 tests: CapCut honesty, OpenTimelineIO export, edge-case inputs, frame options, caching."""

    @classmethod
    def setUpClass(cls):
        cls.tmp_root = Path(tempfile.mkdtemp(prefix="videosect_p1_"))
        cls.std_video = generate_synthetic_video(cls.tmp_root / "std_test.mp4", mode="standard")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp_root, ignore_errors=True)

    def test_01_capcut_honesty_and_otio_exports(self):
        """Verify capcut_ready/ default, experimental --capcut-draft warning/notes, and OTIO round-trip."""
        out_dir = self.tmp_root / "out_std"
        proj_dir = dissect.dissect_video(
            video_path=str(self.std_video),
            output_dir=str(out_dir),
            fast=True,
            capcut=True,
            capcut_draft=True,
            export_formats=["fcp7xml", "edl", "fcpxml"],
            watermark="bottom-right"
        )

        # 1. Verify capcut_ready/ default export and honest IMPORT.md
        ready_dir = proj_dir / "capcut_ready"
        self.assertTrue(ready_dir.exists())
        self.assertTrue((ready_dir / "voice.wav").exists())
        self.assertTrue((ready_dir / "music.wav").exists())
        self.assertTrue((ready_dir / "captions.srt").exists())
        self.assertTrue((ready_dir / "clip_001.mp4").exists())
        import_md = (ready_dir / "IMPORT.md").read_text(encoding="utf-8")
        self.assertNotIn("1-Click", import_md)
        self.assertNotIn("1-click", import_md)
        self.assertIn("Manual Assembly Steps", import_md)

        # 2. Verify --capcut-draft creates draft_content.json and capcut_draft_notes
        draft_dir = proj_dir / "capcut_project"
        self.assertTrue((draft_dir / "draft_content.json").exists())
        self.assertTrue((draft_dir / "capcut_draft_notes").exists())
        notes_txt = (draft_dir / "capcut_draft_notes").read_text(encoding="utf-8")
        self.assertIn("NOT Validated Against", notes_txt)

        # 3. Verify OpenTimelineIO exports exist and were round-trip validated
        self.assertTrue((proj_dir / "timeline_fcp7.xml").exists())
        self.assertTrue((proj_dir / "timeline.edl").exists())
        self.assertTrue((proj_dir / "timeline.fcpxml").exists())

        sc_data = json.loads((proj_dir / "scenes.json").read_text(encoding="utf-8"))
        self.assertIn("nle_exports", sc_data)
        for fmt in ("fcp7xml", "edl", "fcpxml"):
            self.assertTrue(sc_data["nle_exports"][fmt]["validated"])

        # 4. Verify frame count in clips/ and frames/ matches scenes.json
        for sc in sc_data["scenes"]:
            clip_frames_dir = proj_dir / sc["frames_dir"]
            jpgs = list(clip_frames_dir.glob("*.jpg"))
            self.assertEqual(sc["frame_count"], len(jpgs))

    def test_02_stage_caching_and_force_redo(self):
        """Verify stage caching skips finished stages and --force recomputes them."""
        out_dir = self.tmp_root / "out_std"
        # Second run without --force should reuse cached stages
        proj_dir = dissect.dissect_video(
            video_path=str(self.std_video),
            output_dir=str(out_dir),
            fast=True,
            keep_temp=True,
            force=False
        )
        sc_data = json.loads((proj_dir / "scenes.json").read_text(encoding="utf-8"))
        self.assertIn("audio_separation", sc_data["stages_cached"])
        self.assertIn("transcription", sc_data["stages_cached"])

        # Run with --force should clear stages_cached
        proj_dir_forced = dissect.dissect_video(
            video_path=str(self.std_video),
            output_dir=str(out_dir),
            fast=True,
            force=True
        )
        sc_forced = json.loads((proj_dir_forced / "scenes.json").read_text(encoding="utf-8"))
        self.assertEqual(sc_forced["stages_cached"], [])

    def test_03_vfr_zero_cut_silent_music_and_no_audio_videos(self):
        """Phase 1.5: Test VFR input, zero-cut video, silent video, music-only video, and no-audio video."""
        # 1. VFR input
        vfr_vid = generate_synthetic_video(self.tmp_root / "vfr.mp4", mode="vfr")
        vfr_out = dissect.dissect_video(str(vfr_vid), str(self.tmp_root / "out_vfr"), fast=True)
        vfr_sc = json.loads((vfr_out / "scenes.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(vfr_sc["clip_count"], 1)
        for sc in vfr_sc["scenes"]:
            self.assertEqual(sc["frame_count"], len(list((vfr_out / sc["frames_dir"]).glob("*.jpg"))))

        # 2. Zero-cut video
        zc_vid = generate_synthetic_video(self.tmp_root / "zero_cut.mp4", mode="zero_cut")
        zc_out = dissect.dissect_video(str(zc_vid), str(self.tmp_root / "out_zc"), fast=True)
        zc_sc = json.loads((zc_out / "scenes.json").read_text(encoding="utf-8"))
        self.assertEqual(zc_sc["clip_count"], 1)

        # 3. Silent video (no speech -> 0 transcript segments)
        sil_vid = generate_synthetic_video(self.tmp_root / "silent.mp4", mode="silent")
        sil_out = dissect.dissect_video(str(sil_vid), str(self.tmp_root / "out_sil"), fast=True)
        sil_tr = json.loads((sil_out / "transcript" / "transcript.json").read_text(encoding="utf-8"))
        self.assertEqual(len(sil_tr["segments"]), 0)

        # 4. Music-only video (sine tone -> 0 transcript segments, no hallucination)
        mus_vid = generate_synthetic_video(self.tmp_root / "music_only.mp4", mode="music_only")
        mus_out = dissect.dissect_video(str(mus_vid), str(self.tmp_root / "out_mus"), fast=True)
        mus_tr = json.loads((mus_out / "transcript" / "transcript.json").read_text(encoding="utf-8"))
        self.assertEqual(len(mus_tr["segments"]), 0)

        # 5. Video with NO audio track at all (-an)
        noa_vid = generate_synthetic_video(self.tmp_root / "no_audio.mp4", mode="no_audio")
        noa_out = dissect.dissect_video(str(noa_vid), str(self.tmp_root / "out_noa"), fast=True)
        noa_sc = json.loads((noa_out / "scenes.json").read_text(encoding="utf-8"))
        self.assertFalse(noa_sc["has_audio"])
        self.assertTrue((noa_out / "audio" / "voice.wav").exists())
        self.assertTrue((noa_out / "audio" / "music.wav").exists())
        noa_tr = json.loads((noa_out / "transcript" / "transcript.json").read_text(encoding="utf-8"))
        self.assertEqual(len(noa_tr["segments"]), 0)

    def test_04_frames_options_and_disk_estimate(self):
        """Test --frames png, --frames none, --frames-every N, --jpg-quality, and disk estimation."""
        est = dissect.estimate_frame_disk_space(10.0, 30.0, 1920, 1080, "png", frames_every=2, output_dir=self.tmp_root)
        self.assertEqual(est["estimated_frames"], 150)
        self.assertTrue(est["sufficient"])

        # Test --frames png & --frames-every 5
        png_out = dissect.dissect_video(
            str(self.std_video), str(self.tmp_root / "out_png"),
            fast=True, frames_format="png", frames_every=5, force=True
        )
        png_sc = json.loads((png_out / "scenes.json").read_text(encoding="utf-8"))
        for sc in png_sc["scenes"]:
            pngs = list((png_out / sc["frames_dir"]).glob("*.png"))
            self.assertEqual(len(pngs), sc["exported_frame_count"])
            self.assertEqual(len(pngs), 6)  # 30 frames / 5 = 6 PNGs

        # Test --frames none
        none_out = dissect.dissect_video(
            str(self.std_video), str(self.tmp_root / "out_none"),
            fast=True, frames_format="none", force=True
        )
        none_sc = json.loads((none_out / "scenes.json").read_text(encoding="utf-8"))
        for sc in none_sc["scenes"]:
            self.assertEqual(sc["exported_frame_count"], 0)


class TestPhase2AndPhase3Features(unittest.TestCase):
    """Phase 2 & 3 tests: Detectors, benchmark, recut, interpolation, assemble, analysis, keyframes, OCR, batch."""

    @classmethod
    def setUpClass(cls):
        cls.tmp_root = Path(tempfile.mkdtemp(prefix="videosect_p23_"))
        cls.std_video = generate_synthetic_video(cls.tmp_root / "std_p23.mp4", mode="standard")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp_root, ignore_errors=True)

    def test_05_word_timestamp_interpolation_and_hallucination_guard(self):
        """Phase 2.3: Missing word timestamps (numbers/symbols) are interpolated and marked interpolated=True."""
        raw_words = [
            {"word": "Revenue", "start": 0.2, "end": 0.6, "probability": 0.98},
            {"word": "grew", "start": 0.65, "end": 0.9, "probability": 0.96},
            {"word": "100%", "start": None, "end": None, "probability": None},
            {"word": "in", "start": 1.3, "end": 1.45, "probability": 0.99},
            {"word": "2026", "start": None, "end": None, "probability": None},
        ]
        interp = dissect.interpolate_missing_word_timestamps(
            raw_words, seg_start=0.2, seg_end=1.9, segment_text="Revenue grew 100% in 2026"
        )
        self.assertEqual(len(interp), 5)
        self.assertFalse(interp[0].interpolated)
        self.assertTrue(interp[2].interpolated)
        self.assertGreaterEqual(interp[2].start, 0.9)
        self.assertLessEqual(interp[2].end, 1.3)
        self.assertTrue(interp[4].interpolated)
        self.assertAlmostEqual(interp[4].end, 1.9, places=2)

        # Hallucination guard test
        self.assertTrue(dissect.is_hallucinated_segment("Thank you for watching!", -38.0))
        self.assertTrue(dissect.is_hallucinated_segment("Normal speech", -52.0))
        self.assertFalse(dissect.is_hallucinated_segment("Welcome to the breakdown", -18.0))

    def test_06_detector_benchmark_and_merge_mode(self):
        """Phase 2.1: Test --detector merge/transnet fallback and benchmark_detectors.py."""
        cuts_txt = self.tmp_root / "cuts.txt"
        cuts_txt.write_text("1.000\n", encoding="utf-8")
        rows = benchmark_detectors.benchmark_video_detectors(
            video_path=self.std_video,
            cuts_file=cuts_txt,
            detectors=["content", "ensemble", "merge"],
            tolerance_sec=0.25
        )
        self.assertEqual(len(rows), 3)
        for r in rows:
            self.assertEqual(r["f1"], 1.0)

    def test_07_review_html_recut_and_assemble_with_frame_dropping(self):
        """Phase 2.2 & 3.1: Test review.html, videosect recut (--merge/--split), and videosect assemble."""
        proj_dir = dissect.dissect_video(
            str(self.std_video), str(self.tmp_root / "out_recut"),
            fast=True, describe=True, shot_type=True, denoise=True, loudnorm=True
        )
        self.assertTrue((proj_dir / "review.html").exists())
        self.assertTrue((proj_dir / "analysis.json").exists())
        self.assertTrue((proj_dir / "analysis.html").exists())
        self.assertTrue((proj_dir / "keyframes" / "storyboard.jpg").exists())

        sc_initial = json.loads((proj_dir / "scenes.json").read_text(encoding="utf-8"))
        self.assertEqual(sc_initial["clip_count"], 2)
        self.assertTrue(sc_initial["scenes"][0]["description"]["experimental"])
        self.assertTrue(sc_initial["scenes"][0]["shot_type"]["experimental"])

        # Recut: merge clips 1 and 2 -> 1 clip
        dissect.recut_project(proj_dir, merge_specs=["1,2"])
        sc_merged = json.loads((proj_dir / "scenes.json").read_text(encoding="utf-8"))
        self.assertEqual(sc_merged["clip_count"], 1)

        # Recut: split clip 1 at 1.0s -> back to 2 clips
        dissect.recut_project(proj_dir, split_specs=["1:1.0"])
        sc_split = json.loads((proj_dir / "scenes.json").read_text(encoding="utf-8"))
        self.assertEqual(sc_split["clip_count"], 2)

        # Assemble with dropped frames from clip_001 + full clip_002
        sel_path = self.tmp_root / "selection.json"
        sel_path.write_text(json.dumps({
            "include_voice": True,
            "include_music": True,
            "clips": [
                {"clip_id": "clip_001", "drop_frames": [1, 2, 3, 4, 5]},
                "clip_002"
            ]
        }), encoding="utf-8")
        rebuilt_mp4 = self.tmp_root / "rebuilt.mp4"
        dissect.assemble_video_from_selection(proj_dir, sel_path, rebuilt_mp4)
        self.assertTrue(rebuilt_mp4.exists())
        info = dissect.get_video_info(rebuilt_mp4)
        self.assertTrue(info["has_video"])
        self.assertAlmostEqual(info["duration"], (25 + 30) / 30.0, delta=0.18)

    def test_08_ab_separate_and_ocr_subs_and_batch_mode(self):
        """Phase 2.4, 3.5 & 3.6: Test ab_separate.py, --ocr-subs, and batch folder mode."""
        # 1. A/B voice separation (Demucs core, Roformer optional)
        ab_dir = self.tmp_root / "ab_out"
        ab_rep = ab_separate.run_ab_separation(self.std_video, ab_dir, fast=True)
        self.assertTrue((ab_dir / "voice_demucs.wav").exists())
        self.assertIn("demucs", ab_rep["models"])
        if HAS_AUDIO_SEPARATOR:
            self.assertTrue((ab_dir / "voice_roformer.wav").exists())
            self.assertIn("roformer", ab_rep["models"])

        # 2. Burned-in subtitle OCR (--ocr-subs, skipped if rapidocr-onnxruntime missing)
        if HAS_RAPIDOCR:
            sub_vid = generate_synthetic_video(self.tmp_root / "subtitled.mp4", mode="subtitled")
            ocr_json, ocr_srt = dissect.detect_and_ocr_burned_subtitles(
                sub_vid, self.tmp_root / "ocr_out", sample_interval_sec=0.5
            )
            self.assertIsNotNone(ocr_json)
            self.assertTrue(ocr_json.exists())
            ocr_data = json.loads(ocr_json.read_text(encoding="utf-8"))
            self.assertFalse(ocr_data["video_modified"])
            self.assertGreaterEqual(ocr_data["subtitle_count"], 1)
            self.assertIn("HELLO", ocr_data["subtitles"][0]["text"].upper())

        # 3. Batch mode folder processing + summary.csv
        batch_in = self.tmp_root / "batch_videos"
        batch_in.mkdir(parents=True, exist_ok=True)
        shutil.copy2(self.std_video, batch_in / "vid_a.mp4")
        summary_csv = dissect.dissect_batch_folder(
            batch_in, self.tmp_root / "batch_out",
            {"fast": True, "capcut": True, "frames_format": "none"}
        )
        self.assertTrue(summary_csv.exists())
        with open(summary_csv, "r", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["status"], "success")

    def test_09_ocr_subtitles(self):
        """Optional feature: Burned-in subtitle detection & OCR (--ocr-subs)."""
        if not HAS_RAPIDOCR:
            self.skipTest("rapidocr-onnxruntime not installed; skipping --ocr-subs test.")
        sub_vid = generate_synthetic_video(self.tmp_root / "subtitled_opt.mp4", mode="subtitled")
        ocr_json, ocr_srt = dissect.detect_and_ocr_burned_subtitles(
            sub_vid, self.tmp_root / "ocr_opt_out", sample_interval_sec=0.5
        )
        self.assertIsNotNone(ocr_json)
        self.assertTrue(ocr_json.exists())
        ocr_data = json.loads(ocr_json.read_text(encoding="utf-8"))
        self.assertFalse(ocr_data["video_modified"])
        self.assertGreaterEqual(ocr_data["subtitle_count"], 1)
        self.assertIn("HELLO", ocr_data["subtitles"][0]["text"].upper())

    def test_10_whisperx_alignment(self):
        """Optional feature: WhisperX forced phoneme alignment (--align)."""
        if not HAS_WHISPERX:
            self.skipTest("whisperx not installed; skipping WhisperX alignment test.")
        v_wav = self.tmp_root / "wx_voice.wav"
        dissect.generate_silent_wav(v_wav, duration=1.0)
        segs, _, _, _ = dissect.transcribe_isolated_voice(
            voice_wav_path=v_wav,
            output_transcript_dir=self.tmp_root / "wx_opt_out",
            align=True,
            fast=True
        )
        self.assertIsNotNone(segs)

    def test_11_transnetv2_detector(self):
        """Optional feature: TransNetV2 3D-CNN shot detector (--detector transnet)."""
        if not HAS_TRANSNET:
            self.skipTest("transnetv2-pytorch not installed; skipping TransNetV2 detector test.")
        scenes = dissect.detect_scenes(
            self.std_video, total_duration=2.0, detector_mode="transnet"
        )
        self.assertGreaterEqual(len(scenes), 1)

    def test_12_roformer_separation(self):
        """Optional feature: BS-RoFormer vocal separation via audio-separator (--separator roformer)."""
        if not HAS_AUDIO_SEPARATOR:
            self.skipTest("audio-separator not installed; skipping Roformer test.")
        ab_dir = self.tmp_root / "ab_opt_roformer"
        ab_rep = ab_separate.run_ab_separation(self.std_video, ab_dir, fast=True)
        self.assertTrue((ab_dir / "voice_roformer.wav").exists())
        self.assertIn("roformer", ab_rep["models"])

    def test_13_ab_separate_missing_roformer_handling(self):
        """Verify ab_separate does not write voice_roformer.wav via fallback when audio-separator is missing."""
        if HAS_AUDIO_SEPARATOR:
            self.skipTest("audio-separator is installed; skipping missing package test.")
        ab_dir = self.tmp_root / "ab_missing_roformer"
        ab_rep = ab_separate.run_ab_separation(self.std_video, ab_dir, fast=True)
        self.assertTrue((ab_dir / "voice_demucs.wav").exists())
        self.assertFalse((ab_dir / "voice_roformer.wav").exists())
        self.assertIn("demucs", ab_rep["models"])
        self.assertNotIn("roformer", ab_rep["models"])

    def test_14_cfr_input_not_reencoded(self):
        """Verify that a constant frame rate (CFR) input is not re-encoded to _cfr.mp4."""
        out_cfr = self.tmp_root / "out_cfr_check"
        proj_dir = dissect.dissect_video(
            video_path=str(self.std_video),
            output_dir=str(out_cfr),
            fast=True,
            keep_temp=True,
            force=True
        )
        sc = json.loads((proj_dir / "scenes.json").read_text(encoding="utf-8"))
        self.assertFalse(sc.get("is_vfr_source", True))
        self.assertFalse(sc.get("conformed_to_cfr", True))
        # Ensure _temp does not contain _cfr.mp4
        cfr_mp4 = proj_dir / "_temp" / f"{self.std_video.stem}_cfr.mp4"
        self.assertFalse(cfr_mp4.exists())

    def test_15_no_speech_gate_flag(self):
        """Verify --no-speech-gate bypasses silence and music-tone checks during transcription."""
        # music_only video has steady tone that speech-gate usually skips
        mus_vid = generate_synthetic_video(self.tmp_root / "gate_music.mp4", mode="music_only")
        out_gated = dissect.dissect_video(
            str(mus_vid), str(self.tmp_root / "out_gated"),
            fast=True, speech_gate=True, force=True
        )
        tr_gated = json.loads((out_gated / "transcript" / "transcript.json").read_text(encoding="utf-8"))
        self.assertEqual(len(tr_gated["segments"]), 0)

        # With speech_gate=False, transcription runs without being dropped by the gate
        out_ungated = dissect.dissect_video(
            str(mus_vid), str(self.tmp_root / "out_ungated"),
            fast=True, speech_gate=False, force=True
        )
        sc_ungated = json.loads((out_ungated / "scenes.json").read_text(encoding="utf-8"))
        self.assertFalse(sc_ungated.get("speech_gate", True))
        self.assertTrue((out_ungated / "transcript" / "transcript.json").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
