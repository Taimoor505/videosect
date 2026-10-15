#!/usr/bin/env python3
"""
CapCut Ready Package & OpenTimelineIO NLE Exporter
==================================================
Provides:
1. Default `capcut_ready/` export:
   - Numbered silent clips (`clip_001.mp4`, `clip_002.mp4`, ...)
   - `voice.wav` (isolated speech track)
   - `music.wav` (isolated music/backing track)
   - `captions.srt` (timestamped subtitles)
   - `IMPORT.md` (concise, honest manual import instructions for CapCut)
2. Experimental `--capcut-draft` generator (`draft_content.json`, `draft_meta_info.json`,
   `capcut_draft_notes`):
   - Explicitly warns that CapCut does not officially support third-party project files
     and newer CapCut builds reject or encrypt draft files.
3. Validated NLE Timeline Export (`--export fcp7xml,edl,fcpxml`) via OpenTimelineIO:
   - Uses `opentimelineio` + installed adapter plugins (`fcp_xml`, `cmx_3600`, `fcpx_xml`)
     for DaVinci Resolve, Adobe Premiere Pro, and Final Cut Pro.
   - Validates every exported timeline by re-reading it with OpenTimelineIO.
"""

import json
import os
import shutil
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional


# ==============================================================================
# 1. Default Honest CapCut Export: capcut_ready/
# ==============================================================================

def generate_capcut_ready_import_md(project_name: str, clip_count: int) -> str:
    """
    Generate honest, step-by-step manual import instructions for CapCut (`IMPORT.md`).
    No '1-click import' or 'import timeline.xml into CapCut' claims.
    """
    return f"""# Importing `{project_name}` into CapCut (Manual Steps)

> **Why manual import?**  
> CapCut does not officially support importing third-party project or XML timeline files, and newer CapCut Desktop builds reject or encrypt externally generated `draft_content.json` files. This `capcut_ready/` folder organizes all dissected stems so you can assemble the exact timeline in under 30 seconds.

## Contents of `capcut_ready/`
- `clip_001.mp4` .. `clip_{clip_count:03d}.mp4` (also in `clips/`) — Frame-accurate silent video clips in chronological order
- `voice.wav` — Isolated vocal/speech stem (full video duration)
- `music.wav` — Isolated background music/ambient stem (full video duration)
- `captions.srt` — Word-aligned SubRip subtitle file

## Manual Assembly Steps (CapCut Desktop, Web, or Mobile)
1. **Create Project**: Open CapCut and click **Create project**, then import all files from `capcut_ready/`.
2. **Place Silent Video Clips**: Select `clip_001.mp4` through `clip_{clip_count:03d}.mp4` in numerical order and drag them onto **Video Track 1**. Because the cuts are frame-quantized, they align end-to-end with zero gap or drift.
3. **Add Audio Stems**: Drag `voice.wav` onto **Audio Track 1** at `00:00:00.000`, and drag `music.wav` onto **Audio Track 2** at `00:00:00.000`.
4. **Load Subtitles**: Open **Text** -> **Local captions** (or **Import captions**) and select `captions.srt`.

## Using DaVinci Resolve, Premiere Pro, or Final Cut Pro Instead?
Run `videosect` with `--export fcp7xml,edl,fcpxml` to generate OpenTimelineIO-validated timelines (`timeline_fcp7.xml`, `timeline.edl`, `timeline.fcpxml`) that NLEs with official XML/EDL support can import directly.
"""


def export_capcut_ready_folder(
    project_source_dir: Path,
    target_ready_dir: Optional[Path] = None
) -> Path:
    """
    Create the default `capcut_ready/` folder containing numbered silent clips,
    `voice.wav`, `music.wav`, `captions.srt`, and `IMPORT.md`.
    """
    if target_ready_dir is None:
        target_ready_dir = project_source_dir / "capcut_ready"
    target_ready_dir.mkdir(parents=True, exist_ok=True)

    scenes_json_path = project_source_dir / "scenes.json"
    video_name = project_source_dir.name
    clip_count = 0
    if scenes_json_path.exists():
        try:
            scenes_data = json.loads(scenes_json_path.read_text(encoding="utf-8"))
            video_name = scenes_data.get("video_name", video_name)
            clip_count = int(scenes_data.get("clip_count", len(scenes_data.get("scenes", []))))
        except Exception:
            pass

    # 1. Copy numbered silent clips to both capcut_ready/clip_XXX.mp4 and capcut_ready/clips/clip_XXX.mp4
    src_clips_dir = project_source_dir / "clips"
    ready_clips_dir = target_ready_dir / "clips"
    ready_clips_dir.mkdir(parents=True, exist_ok=True)
    if src_clips_dir.exists():
        clip_files = sorted(src_clips_dir.glob("clip_*.mp4"))
        if clip_files:
            clip_count = len(clip_files)
        for cf in clip_files:
            shutil.copy2(cf, target_ready_dir / cf.name)
            shutil.copy2(cf, ready_clips_dir / cf.name)

    # 2. Copy voice.wav and music.wav to capcut_ready/voice.wav and capcut_ready/music.wav
    src_audio_dir = project_source_dir / "audio"
    for stem_name in ("voice.wav", "music.wav"):
        src_stem = src_audio_dir / stem_name
        if src_stem.exists():
            shutil.copy2(src_stem, target_ready_dir / stem_name)

    # 3. Copy transcript.srt -> captions.srt
    src_srt = project_source_dir / "transcript" / "transcript.srt"
    dest_srt = target_ready_dir / "captions.srt"
    if src_srt.exists():
        shutil.copy2(src_srt, dest_srt)
    else:
        dest_srt.write_text("", encoding="utf-8")

    # 4. Write IMPORT.md
    import_md = generate_capcut_ready_import_md(video_name, max(clip_count, 1))
    (target_ready_dir / "IMPORT.md").write_text(import_md, encoding="utf-8")

    return target_ready_dir


# ==============================================================================
# 2. Experimental CapCut Draft Generator (--capcut-draft)
# ==============================================================================

CAPCUT_DRAFT_WARNING = (
    "[Warning] --capcut-draft is experimental and version-dependent. "
    "CapCut does not officially support third-party project files, and newer CapCut Desktop builds "
    "reject or encrypt externally written draft_content.json files. "
    "See capcut_draft_notes for details, or use capcut_ready/ for reliable manual import."
)


def generate_capcut_draft_notes(project_name: str) -> str:
    """
    Generate the `capcut_draft_notes` disclosure file listing what schema is written
    and which CapCut versions it was NOT validated against.
    """
    return f"""CapCut Experimental Draft Notes ({project_name})
==================================================
Status: EXPERIMENTAL / UNOFFICIAL / VERSION-DEPENDENT

1. Schema Format Produced:
   - Legacy unencrypted JSON draft structure (`version: 360000`, microsecond timeranges)
     modeled on CapCut Desktop 3.x local draft folders (`draft_content.json` + `draft_meta_info.json`).

2. CapCut Versions NOT Validated Against (Known to Reject or Encrypt Drafts):
   - CapCut Desktop v4.0.0 and newer (macOS / Windows) — introduced encrypted/signed `draft_content.json`
     and stricter schema integrity checks that reject third-party generated drafts.
   - CapCut Desktop v5.x / v6.x+ (2025–2026 builds) — NOT validated; frequently shows
     "Project file corrupted" or ignores unencrypted third-party `draft_content.json`.
   - CapCut Web (capcut.com) & CapCut Mobile (iOS / Android) — do not read local desktop draft folders.

3. Recommended Reliable Alternative:
   - Use the default `capcut_ready/` folder (`clip_001.mp4`..., `voice.wav`, `music.wav`, `captions.srt`)
     and follow `capcut_ready/IMPORT.md` for manual drag-and-drop assembly.
   - For DaVinci Resolve, Adobe Premiere Pro, or Final Cut Pro, use `--export fcp7xml,edl,fcpxml`.
"""


def generate_capcut_draft_content(
    scenes_data: Dict[str, Any],
    transcript_data: Optional[Dict[str, Any]] = None,
    media_relative_prefix: str = ""
) -> Dict[str, Any]:
    """
    Build experimental CapCut draft_content.json multi-track timeline structure.
    Time units in CapCut are in microseconds (1 second = 1,000,000 us).
    """
    total_duration_sec = float(scenes_data.get("total_duration", 0.0))
    total_duration_us = int(total_duration_sec * 1_000_000)
    fps = float(scenes_data.get("fps", 30.0))

    canvas_width = int(scenes_data.get("width", 1920))
    canvas_height = int(scenes_data.get("height", 1080))

    scenes: List[Dict[str, Any]] = scenes_data.get("scenes", [])

    videos_materials: List[Dict[str, Any]] = []
    audios_materials: List[Dict[str, Any]] = []
    texts_materials: List[Dict[str, Any]] = []
    speeds_materials: List[Dict[str, Any]] = []

    speed_id = str(uuid.uuid4()).upper()
    speeds_materials.append({
        "curve_speed": None,
        "id": speed_id,
        "mode": 0,
        "speed": 1.0,
        "type": "speed"
    })

    video_segments: List[Dict[str, Any]] = []
    current_target_start_us = 0

    for sc in scenes:
        clip_id = sc.get("clip_id", "clip_001")
        clip_rel_path = f"clips/{clip_id}.mp4"
        if media_relative_prefix:
            clip_rel_path = f"{media_relative_prefix}/{clip_rel_path}"

        clip_duration_sec = float(sc.get("duration", 0.0))
        clip_duration_us = int(clip_duration_sec * 1_000_000)
        mat_video_id = str(uuid.uuid4()).upper()

        videos_materials.append({
            "audio_fade": None,
            "category_id": "",
            "category_name": "local",
            "check_flag": 63487,
            "crop": None,
            "duration": clip_duration_us,
            "height": canvas_height,
            "id": mat_video_id,
            "initial_scale": 1.0,
            "material_name": f"{clip_id}.mp4",
            "path": clip_rel_path,
            "type": "video",
            "width": canvas_width
        })

        video_segments.append({
            "caption_info": None,
            "clip": None,
            "common_keyframes": [],
            "enable_adjust": True,
            "enable_color_curves": True,
            "enable_color_match_adjust": False,
            "enable_color_wheels": True,
            "enable_lut": True,
            "enable_smart_color_adjust": False,
            "extra_material_refs": [speed_id],
            "id": str(uuid.uuid4()).upper(),
            "material_id": mat_video_id,
            "render_index": 0,
            "responsive_layout": None,
            "source_timerange": {
                "duration": clip_duration_us,
                "start": 0
            },
            "speed": 1.0,
            "target_timerange": {
                "duration": clip_duration_us,
                "start": current_target_start_us
            },
            "template_id": "",
            "track_attribute": 0,
            "track_render_index": 0,
            "visible": True,
            "volume": 0.0
        })

        current_target_start_us += clip_duration_us

    # Track 1: Voice Audio Track (voice.wav)
    audio_voice_id = str(uuid.uuid4()).upper()
    voice_path = "audio/voice.wav"
    if media_relative_prefix:
        voice_path = f"{media_relative_prefix}/{voice_path}"

    audios_materials.append({
        "app_id": 0,
        "category_id": "",
        "category_name": "local",
        "check_flag": 1,
        "duration": total_duration_us,
        "id": audio_voice_id,
        "name": "voice.wav (Isolated Speech)",
        "path": voice_path,
        "source_platform": 0,
        "type": "extract_music"
    })

    voice_segments = [{
        "clip": None,
        "common_keyframes": [],
        "enable_adjust": False,
        "extra_material_refs": [speed_id],
        "id": str(uuid.uuid4()).upper(),
        "material_id": audio_voice_id,
        "render_index": 0,
        "source_timerange": {
            "duration": total_duration_us,
            "start": 0
        },
        "speed": 1.0,
        "target_timerange": {
            "duration": total_duration_us,
            "start": 0
        },
        "track_attribute": 0,
        "track_render_index": 0,
        "visible": True,
        "volume": 1.0
    }]

    # Track 2: Music Audio Track (music.wav)
    audio_music_id = str(uuid.uuid4()).upper()
    music_path = "audio/music.wav"
    if media_relative_prefix:
        music_path = f"{media_relative_prefix}/{music_path}"

    audios_materials.append({
        "app_id": 0,
        "category_id": "",
        "category_name": "local",
        "check_flag": 1,
        "duration": total_duration_us,
        "id": audio_music_id,
        "name": "music.wav (Background Soundtrack)",
        "path": music_path,
        "source_platform": 0,
        "type": "music"
    })

    music_segments = [{
        "clip": None,
        "common_keyframes": [],
        "enable_adjust": False,
        "extra_material_refs": [speed_id],
        "id": str(uuid.uuid4()).upper(),
        "material_id": audio_music_id,
        "render_index": 0,
        "source_timerange": {
            "duration": total_duration_us,
            "start": 0
        },
        "speed": 1.0,
        "target_timerange": {
            "duration": total_duration_us,
            "start": 0
        },
        "track_attribute": 0,
        "track_render_index": 0,
        "visible": True,
        "volume": 0.6
    }]

    # Track 3: Subtitles / Text Track (from transcript)
    text_segments: List[Dict[str, Any]] = []
    if transcript_data and "segments" in transcript_data:
        for seg in transcript_data["segments"]:
            txt = seg.get("text", "").strip()
            if not txt:
                continue
            seg_start_us = int(float(seg.get("start", 0.0)) * 1_000_000)
            seg_end_us = int(float(seg.get("end", 0.0)) * 1_000_000)
            seg_dur_us = max(seg_end_us - seg_start_us, 500_000)

            text_mat_id = str(uuid.uuid4()).upper()
            texts_materials.append({
                "alignment": 1,
                "background_alpha": 1.0,
                "background_color": "",
                "caption_template_info": {
                    "category_id": "",
                    "category_name": "",
                    "effect_id": "",
                    "is_new": False,
                    "path": "",
                    "request_id": "",
                    "resource_id": "",
                    "source_platform": 0
                },
                "check_flag": 7,
                "content": json.dumps({
                    "styles": [{
                        "fill": {
                            "alpha": 1.0,
                            "content": {
                                "render_type": "solid",
                                "solid": {"alpha": 1.0, "color": [1.0, 1.0, 1.0]}
                            }
                        },
                        "font": {"id": "", "path": ""},
                        "range": [0, len(txt)],
                        "size": 7.0
                    }],
                    "text": txt
                }),
                "font_category_id": "",
                "font_category_name": "",
                "font_id": "",
                "font_name": "",
                "font_path": "",
                "font_resource_id": "",
                "font_size": 7.0,
                "font_source_platform": 0,
                "font_team_id": "",
                "font_title": "none",
                "font_url": "",
                "fonts": [],
                "has_shadow": True,
                "id": text_mat_id,
                "initial_scale": 1.0,
                "is_rich_text": False,
                "shadow_alpha": 0.8,
                "shadow_color": "#000000",
                "sub_type": 1,
                "type": "subtitle"
            })

            text_segments.append({
                "caption_info": None,
                "clip": None,
                "common_keyframes": [],
                "enable_adjust": False,
                "extra_material_refs": [],
                "id": str(uuid.uuid4()).upper(),
                "material_id": text_mat_id,
                "render_index": 0,
                "responsive_layout": None,
                "source_timerange": None,
                "speed": 1.0,
                "target_timerange": {
                    "duration": seg_dur_us,
                    "start": seg_start_us
                },
                "template_id": "",
                "track_attribute": 0,
                "track_render_index": 0,
                "visible": True,
                "volume": 1.0
            })

    tracks = [
        {
            "attribute": 0,
            "flag": 0,
            "id": str(uuid.uuid4()).upper(),
            "is_default_name": True,
            "name": "Video Track (Silent Shot Clips)",
            "segments": video_segments,
            "type": "video"
        },
        {
            "attribute": 0,
            "flag": 0,
            "id": str(uuid.uuid4()).upper(),
            "is_default_name": True,
            "name": "Audio Track 1 (Isolated Voice)",
            "segments": voice_segments,
            "type": "audio"
        },
        {
            "attribute": 0,
            "flag": 0,
            "id": str(uuid.uuid4()).upper(),
            "is_default_name": True,
            "name": "Audio Track 2 (Background Music)",
            "segments": music_segments,
            "type": "audio"
        }
    ]

    if text_segments:
        tracks.append({
            "attribute": 0,
            "flag": 0,
            "id": str(uuid.uuid4()).upper(),
            "is_default_name": True,
            "name": "Subtitle Track (Transcript Captions)",
            "segments": text_segments,
            "type": "text"
        })

    return {
        "canvas_config": {
            "height": canvas_height,
            "ratio": "original",
            "width": canvas_width
        },
        "color_space": 0,
        "config": {
            "adjust_max_index": 1,
            "attachment_info": [],
            "combination_max_index": 1,
            "export_range": None,
            "extract_audio_last_index": 1,
            "lyrics_recognition_id": "",
            "lyrics_sync": True,
            "lyrics_taskinfo": [],
            "maintrack_adsorb": True,
            "material_save_mode": 0,
            "original_sound_last_index": 1,
            "record_audio_last_index": 1,
            "sticker_max_index": 1,
            "subtitle_recognition_id": "",
            "subtitle_sync": True,
            "subtitle_taskinfo": [],
            "system_font_list": [],
            "video_mute": False,
            "zoom_info_params": None
        },
        "cover": None,
        "create_time": int(time.time() * 1_000_000),
        "duration": max(current_target_start_us, total_duration_us),
        "extra_info": None,
        "fps": fps,
        "free_render_index_mode_on": False,
        "group_container": None,
        "id": str(uuid.uuid4()).upper(),
        "keyframe_graph_list": [],
        "keyframes": {
            "adjusts": [],
            "audios": [],
            "effects": [],
            "filters": [],
            "handwrites": [],
            "stickers": [],
            "texts": [],
            "videos": []
        },
        "last_modified_platform": {
            "app_id": 3704,
            "app_source": "capcut",
            "app_version": "3.8.0",
            "os": "all"
        },
        "materials": {
            "audio_balances": [],
            "audio_effects": [],
            "audio_fades": [],
            "audio_track_indexes": [],
            "audios": audios_materials,
            "beats": [],
            "canvases": [],
            "chromas": [],
            "color_curves": [],
            "drafts": [],
            "effects": [],
            "flowers": [],
            "green_screens": [],
            "handwrites": [],
            "hsl": [],
            "images": [],
            "log_color_wheels": [],
            "loudnesses": [],
            "manual_deformations": [],
            "masks": [],
            "material_animations": [],
            "material_colors": [],
            "placeholders": [],
            "plugin_effects": [],
            "primary_color_wheels": [],
            "realtime_denoises": [],
            "shapes": [],
            "smart_crops": [],
            "sound_channel_mappings": [],
            "speeds": speeds_materials,
            "stickers": [],
            "tail_leaders": [],
            "text_templates": [],
            "texts": texts_materials,
            "time_marks": [],
            "transitions": [],
            "video_effects": [],
            "video_track_indexes": [],
            "videos": videos_materials,
            "vocal_beautifys": [],
            "vocal_separations": []
        },
        "mutable_config": None,
        "name": scenes_data.get("video_name", "Dissected_Video_Project"),
        "new_version": "85.0.0",
        "platform": {
            "app_id": 3704,
            "app_source": "capcut",
            "app_version": "3.8.0",
            "os": "all"
        },
        "relationships": [],
        "render_index_mode": "canvas_size",
        "retouch_cover": None,
        "source": "default",
        "static_cover_image_info": None,
        "tracks": tracks,
        "update_time": int(time.time() * 1_000_000),
        "version": 360000
    }


def generate_capcut_draft_meta_info(
    scenes_data: Dict[str, Any],
    draft_id: str
) -> Dict[str, Any]:
    """
    Build experimental CapCut draft_meta_info.json project envelope.
    """
    now_us = int(time.time() * 1_000_000)
    dur_sec = float(scenes_data.get("total_duration", 0.0))
    dur_us = int(dur_sec * 1_000_000)

    return {
        "draft_cloud_capcut_id": "",
        "draft_cloud_last_action_download": False,
        "draft_cloud_materials": [],
        "draft_cloud_purchase_info": "",
        "draft_cloud_template_id": "",
        "draft_cloud_tutorial_info": "",
        "draft_cloud_videocut_purchase_info": "",
        "draft_cover": "",
        "draft_fold_path": "",
        "draft_id": draft_id,
        "draft_is_ai_clip": False,
        "draft_is_ai_clone_voice": False,
        "draft_is_ai_shorts": False,
        "draft_is_article_video_draft": False,
        "draft_is_cloud_merge": False,
        "draft_is_copy": False,
        "draft_is_cut_same": False,
        "draft_is_deleted": False,
        "draft_is_enterprise": False,
        "draft_is_fast_story": False,
        "draft_is_flash_animation": False,
        "draft_is_from_deeplink": "false",
        "draft_is_invisible": False,
        "draft_is_mock": False,
        "draft_is_moving_photo": False,
        "draft_is_new_ai_shorts": False,
        "draft_is_news_script": False,
        "draft_is_offline": False,
        "draft_is_onedrive": False,
        "draft_is_package": False,
        "draft_is_rough_cut": False,
        "draft_is_story": False,
        "draft_is_template": False,
        "draft_is_text_to_video": False,
        "draft_materials": [],
        "draft_materials_copied": False,
        "draft_materials_size": 0,
        "draft_name": scenes_data.get("video_name", "CapCut_Dissection_Project"),
        "draft_new_version": "",
        "draft_removable_storage_device": "",
        "draft_rootpath": "",
        "draft_segment_extra_info": [],
        "draft_timeline_materials_size": 0,
        "draft_type": "default",
        "tm_draft_cloud_completed": 0,
        "tm_draft_cloud_modified": 0,
        "tm_draft_create": now_us,
        "tm_draft_modified": now_us,
        "tm_draft_removed": 0,
        "tm_duration": dur_us
    }


def generate_universal_fcpxml(
    scenes_data: Dict[str, Any],
    transcript_data: Optional[Dict[str, Any]] = None
) -> str:
    """
    Generate FCP7 XML (xmeml version 4) for DaVinci Resolve and Adobe Premiere Pro.
    Note: CapCut does NOT support importing FCP7 XML files.
    """
    proj_name = scenes_data.get("video_name", "Dissected_Video")
    fps = int(round(float(scenes_data.get("fps", 30.0))))
    total_dur_sec = float(scenes_data.get("total_duration", 0.0))
    total_frames = int(total_dur_sec * fps)

    scenes: List[Dict[str, Any]] = scenes_data.get("scenes", [])

    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE xmeml>',
        '<xmeml version="4">',
        f'  <sequence id="{proj_name}">',
        f'    <name>{proj_name} - Dissection Timeline</name>',
        f'    <duration>{total_frames}</duration>',
        '    <rate>',
        f'      <timebase>{fps}</timebase>',
        '      <ntsc>FALSE</ntsc>',
        '    </rate>',
        '    <media>',
        '      <video>',
        '        <format>',
        '          <samplecharacteristics>',
        '            <width>1920</width>',
        '            <height>1080</height>',
        '            <pixelaspectratio>square</pixelaspectratio>',
        f'            <rate><timebase>{fps}</timebase></rate>',
        '          </samplecharacteristics>',
        '        </format>',
        '        <track>'
    ]

    current_in = 0
    for idx, sc in enumerate(scenes, 1):
        clip_id = sc.get("clip_id", f"clip_{idx:03d}")
        dur_frames = max(1, int(round(float(sc.get("duration", 1.0)) * fps)))
        current_out = current_in + dur_frames

        xml_lines.extend([
            f'          <clipitem id="{clip_id}">',
            f'            <name>{clip_id}.mp4</name>',
            f'            <duration>{dur_frames}</duration>',
            '            <rate>',
            f'              <timebase>{fps}</timebase>',
            '            </rate>',
            f'            <start>{current_in}</start>',
            f'            <end>{current_out}</end>',
            '            <in>0</in>',
            f'            <out>{dur_frames}</out>',
            '            <file id="file_' + clip_id + '">',
            f'              <name>{clip_id}.mp4</name>',
            f'              <pathurl>file://localhost/clips/{clip_id}.mp4</pathurl>',
            '            </file>',
            '          </clipitem>'
        ])
        current_in = current_out

    xml_lines.extend([
        '        </track>',
        '      </video>',
        '      <audio>',
        '        <track>',
        '          <clipitem id="voice_audio">',
        '            <name>voice.wav (Isolated Speech)</name>',
        f'            <duration>{total_frames}</duration>',
        '            <rate>',
        f'              <timebase>{fps}</timebase>',
        '            </rate>',
        '            <start>0</start>',
        f'            <end>{total_frames}</end>',
        '            <in>0</in>',
        f'            <out>{total_frames}</out>',
        '            <file id="file_voice">',
        '              <name>voice.wav</name>',
        '              <pathurl>file://localhost/audio/voice.wav</pathurl>',
        '            </file>',
        '          </clipitem>',
        '        </track>',
        '        <track>',
        '          <clipitem id="music_audio">',
        '            <name>music.wav (Background Music)</name>',
        f'            <duration>{total_frames}</duration>',
        '            <rate>',
        f'              <timebase>{fps}</timebase>',
        '            </rate>',
        '            <start>0</start>',
        f'            <end>{total_frames}</end>',
        '            <in>0</in>',
        f'            <out>{total_frames}</out>',
        '            <file id="file_music">',
        '              <name>music.wav</name>',
        '              <pathurl>file://localhost/audio/music.wav</pathurl>',
        '            </file>',
        '          </clipitem>',
        '        </track>',
        '      </audio>',
        '    </media>',
        '  </sequence>',
        '</xmeml>'
    ])

    return "\n".join(xml_lines)


def generate_capcut_import_instructions(project_name: str) -> str:
    """
    Generate honest documentation for experimental CapCut draft bundles and manual import.
    """
    return generate_capcut_ready_import_md(project_name, clip_count=1)


def export_capcut_project_bundle(
    project_source_dir: Path,
    target_output_dir: Path
) -> Path:
    """
    Generates the experimental `--capcut-draft` folder containing `draft_content.json`,
    `draft_meta_info.json`, `capcut_draft_notes`, `IMPORT.md`, and copies of media stems.
    Always prints a warning that third-party CapCut drafts are experimental and version-dependent.
    """
    print(CAPCUT_DRAFT_WARNING)
    target_output_dir.mkdir(parents=True, exist_ok=True)

    scenes_json_path = project_source_dir / "scenes.json"
    if not scenes_json_path.exists():
        raise FileNotFoundError(f"scenes.json not found in {project_source_dir}")

    with open(scenes_json_path, "r", encoding="utf-8") as f:
        scenes_data = json.load(f)

    transcript_json_path = project_source_dir / "transcript" / "transcript.json"
    transcript_data = None
    if transcript_json_path.exists():
        try:
            with open(transcript_json_path, "r", encoding="utf-8") as f:
                transcript_data = json.load(f)
        except Exception:
            pass

    video_name = scenes_data.get("video_name", "Dissected_Video")
    clip_count = len(scenes_data.get("scenes", []))

    # 1. Generate experimental CapCut draft_content.json
    draft_content = generate_capcut_draft_content(scenes_data, transcript_data)
    draft_content_path = target_output_dir / "draft_content.json"
    draft_content_path.write_text(json.dumps(draft_content, indent=2), encoding="utf-8")

    # 2. Generate CapCut draft_meta_info.json
    draft_meta = generate_capcut_draft_meta_info(scenes_data, draft_content["id"])
    draft_meta_path = target_output_dir / "draft_meta_info.json"
    draft_meta_path.write_text(json.dumps(draft_meta, indent=2), encoding="utf-8")

    # 3. Write capcut_draft_notes (and .txt) listing unvalidated CapCut versions
    notes_content = generate_capcut_draft_notes(video_name)
    (target_output_dir / "capcut_draft_notes").write_text(notes_content, encoding="utf-8")
    (target_output_dir / "capcut_draft_notes.txt").write_text(notes_content, encoding="utf-8")

    # 4. Write honest IMPORT.md (and legacy filename alias for compatibility)
    guide_content = generate_capcut_ready_import_md(video_name, max(clip_count, 1))
    (target_output_dir / "IMPORT.md").write_text(guide_content, encoding="utf-8")
    (target_output_dir / "HOW_TO_IMPORT_IN_CAPCUT.md").write_text(guide_content, encoding="utf-8")

    # 5. Copy clips, audio, transcript
    for folder_name in ("clips", "audio", "transcript"):
        src_folder = project_source_dir / folder_name
        if src_folder.exists():
            dest_folder = target_output_dir / folder_name
            shutil.copytree(src_folder, dest_folder, dirs_exist_ok=True)

    # 6. Copy scenes.json
    shutil.copy2(scenes_json_path, target_output_dir / "scenes.json")

    return target_output_dir


# ==============================================================================
# 3. OpenTimelineIO NLE Timeline Export & Round-Trip Validation
# ==============================================================================

OTIO_FORMAT_MAP = {
    "fcp7xml": ("fcp_xml", "timeline_fcp7.xml", True),
    "fcp_xml": ("fcp_xml", "timeline_fcp7.xml", True),
    "xml": ("fcp_xml", "timeline_fcp7.xml", True),
    "edl": ("cmx_3600", "timeline.edl", False),       # CMX 3600 EDL is single-video-track
    "cmx_3600": ("cmx_3600", "timeline.edl", False),
    "fcpxml": ("fcpx_xml", "timeline.fcpxml", True),
    "fcpx_xml": ("fcpx_xml", "timeline.fcpxml", True),
    "otio": ("otio_json", "timeline.otio", True),
}


def build_otio_timeline(
    scenes_data: Dict[str, Any],
    include_audio_tracks: bool = True
) -> Any:
    """
    Construct an `opentimelineio.schema.Timeline` from `scenes.json`.
    """
    import opentimelineio as otio

    video_name = scenes_data.get("video_name", "Dissected_Video")
    fps = float(round(float(scenes_data.get("fps", 30.0)), 3))
    if fps <= 0:
        fps = 30.0

    tl = otio.schema.Timeline(name=f"{video_name}_timeline")
    v_track = otio.schema.Track(name="V1_Silent_Clips", kind=otio.schema.TrackKind.Video)

    scenes = scenes_data.get("scenes", [])
    total_frames = 0

    for idx, sc in enumerate(scenes, 1):
        clip_id = sc.get("clip_id", f"clip_{idx:03d}")
        clip_file = sc.get("file", f"clips/{clip_id}.mp4")
        dur_sec = float(sc.get("duration", 1.0))
        frames = max(1, int(round(dur_sec * fps)))
        total_frames += frames

        rt_zero = otio.opentime.RationalTime(0, fps)
        rt_dur = otio.opentime.RationalTime(frames, fps)
        tr = otio.opentime.TimeRange(rt_zero, rt_dur)

        mr = otio.schema.ExternalReference(
            target_url=clip_file,
            available_range=tr
        )
        clip = otio.schema.Clip(
            name=clip_id,
            media_reference=mr,
            source_range=tr
        )
        v_track.append(clip)

    tl.tracks.append(v_track)

    if include_audio_tracks and total_frames > 0:
        total_tr = otio.opentime.TimeRange(
            otio.opentime.RationalTime(0, fps),
            otio.opentime.RationalTime(total_frames, fps)
        )
        for track_name, rel_audio in [
            ("A1_Isolated_Voice", "audio/voice.wav"),
            ("A2_Background_Music", "audio/music.wav")
        ]:
            a_track = otio.schema.Track(name=track_name, kind=otio.schema.TrackKind.Audio)
            a_ref = otio.schema.ExternalReference(
                target_url=rel_audio,
                available_range=total_tr
            )
            a_clip = otio.schema.Clip(
                name=track_name,
                media_reference=a_ref,
                source_range=total_tr
            )
            a_track.append(a_clip)
            tl.tracks.append(a_track)

    return tl


def export_otio_timelines(
    project_source_dir: Path,
    formats: List[str],
    output_dir: Optional[Path] = None
) -> Dict[str, Dict[str, Any]]:
    """
    Export NLE timelines (`fcp7xml`, `edl`, `fcpxml`, `otio`) using OpenTimelineIO
    and validate every exported file by re-reading it with OpenTimelineIO.
    """
    import opentimelineio as otio

    if output_dir is None:
        output_dir = project_source_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    scenes_json_path = project_source_dir / "scenes.json"
    if not scenes_json_path.exists():
        raise FileNotFoundError(f"scenes.json not found in {project_source_dir}")

    scenes_data = json.loads(scenes_json_path.read_text(encoding="utf-8"))
    expected_video_clips = len(scenes_data.get("scenes", []))

    available_adapters = set(otio.adapters.available_adapter_names())
    results: Dict[str, Dict[str, Any]] = {}

    # Normalize requested formats (allow comma-separated strings)
    normalized_formats: List[str] = []
    for f in formats:
        for part in f.split(","):
            clean = part.strip().lower()
            if clean and clean not in normalized_formats:
                normalized_formats.append(clean)

    for fmt in normalized_formats:
        if fmt not in OTIO_FORMAT_MAP:
            raise ValueError(
                f"Unsupported --export format '{fmt}'. Supported formats: fcp7xml, edl, fcpxml, otio"
            )
        adapter_name, filename, include_audio = OTIO_FORMAT_MAP[fmt]
        if adapter_name not in available_adapters:
            raise RuntimeError(
                f"OpenTimelineIO adapter '{adapter_name}' for '{fmt}' is not installed. "
                f"Installed adapters: {sorted(available_adapters)}. "
                f"Install plugin packages: pip install otio-fcp-adapter otio-cmx3600-adapter otio-fcpx-xml-adapter"
            )

        out_path = output_dir / filename
        tl = build_otio_timeline(scenes_data, include_audio_tracks=include_audio)
        otio.adapters.write_to_file(tl, str(out_path), adapter_name=adapter_name)

        # Validate by re-reading the exported file with OpenTimelineIO
        read_back = otio.adapters.read_from_file(str(out_path), adapter_name=adapter_name)
        read_clips = list(read_back.find_clips())
        if len(read_clips) < expected_video_clips:
            raise RuntimeError(
                f"OTIO validation failed for {fmt} ({out_path.name}): "
                f"expected at least {expected_video_clips} clips, read back {len(read_clips)}"
            )

        print(
            f"[NLE Export] Exported & OTIO-validated {fmt} ({adapter_name}) -> {out_path.name} "
            f"({len(read_clips)} clips verified)"
        )
        results[fmt] = {
            "format": fmt,
            "adapter": adapter_name,
            "path": str(out_path),
            "filename": out_path.name,
            "validated": True,
            "clip_count_read_back": len(read_clips)
        }

    return results


if __name__ == "__main__":
    if len(sys.argv) > 1:
        src = Path(sys.argv[1])
        out = Path(sys.argv[2]) if len(sys.argv) > 2 else src / "capcut_ready"
        export_capcut_ready_folder(src, out)
        print(f"Generated CapCut ready folder at {out}")
