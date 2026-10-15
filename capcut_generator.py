#!/usr/bin/env python3
"""
CapCut and NLE Timeline Project Generator
=========================================
Generates:
1. CapCut Desktop & Web Draft Project:
   - draft_content.json (multi-track timeline with silent clips, isolated voice stem, music stem, subtitles)
   - draft_meta_info.json (CapCut project metadata)
2. Final Cut Pro / Premiere XML (timeline.xml)
3. HOW_TO_IMPORT_IN_CAPCUT.md guide
"""

import json
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional


def generate_capcut_draft_content(
    scenes_data: Dict[str, Any],
    transcript_data: Optional[Dict[str, Any]] = None,
    media_relative_prefix: str = ""
) -> Dict[str, Any]:
    """
    Build CapCut draft_content.json multi-track timeline structure.
    Time units in CapCut are in microseconds (1 second = 1,000,000 us).
    """
    total_duration_sec = float(scenes_data.get("total_duration", 0.0))
    total_duration_us = int(total_duration_sec * 1_000_000)
    fps = float(scenes_data.get("fps", 30.0))

    canvas_width = 1920
    canvas_height = 1080

    scenes: List[Dict[str, Any]] = scenes_data.get("scenes", [])

    videos_materials: List[Dict[str, Any]] = []
    audios_materials: List[Dict[str, Any]] = []
    texts_materials: List[Dict[str, Any]] = []
    speeds_materials: List[Dict[str, Any]] = []

    # Default 1.0x speed material
    speed_id = str(uuid.uuid4()).upper()
    speeds_materials.append({
        "curve_speed": None,
        "id": speed_id,
        "mode": 0,
        "speed": 1.0,
        "type": "speed"
    })

    # Track 0: Video Track (Sequenced silent scene clips)
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
            "volume": 0.0  # Silent clip
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
                                "solid": { "alpha": 1.0, "color": [1.0, 1.0, 1.0] }
                            }
                        },
                        "font": { "id": "", "path": "" },
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

    # Assemble CapCut Tracks
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
            "app_version": "5.0.0",
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
        "new_version": "100.0.0",
        "platform": {
            "app_id": 3704,
            "app_source": "capcut",
            "app_version": "5.0.0",
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
    Build CapCut draft_meta_info.json project envelope.
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
    Generate standard Final Cut Pro / Premiere XML (timeline.xml)
    Compatible with CapCut, Adobe Premiere Pro, DaVinci Resolve, and Final Cut Pro.
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

    # Video Track Clips
    current_in = 0
    for idx, sc in enumerate(scenes, 1):
        clip_id = sc.get("clip_id", f"clip_{idx:03d}")
        dur_frames = int(float(sc.get("duration", 1.0)) * fps)
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
    return f"""# How to Import into CapCut Desktop & Web 🎬

This archive contains a ready-to-run CapCut project draft configured with:
- **Track 1 (Video)**: All silent scene clips sequenced consecutively with frame-accurate cuts
- **Track 2 (Audio)**: Isolated voice stem (`voice.wav` - background music removed)
- **Track 3 (Audio)**: Isolated background music & ambient track (`music.wav`)
- **Track 4 (Subtitles)**: Spoken dialogue synced to time ranges

---

### Method A: Direct Import in CapCut Desktop (Instant 1-Click Open)

CapCut stores draft projects in its user data folder:

#### On Windows:
1. Extract or copy this entire project folder into your CapCut Drafts folder:
   `%LOCALAPPDATA%\\CapCut\\User Data\\Projects\\com.lveditor.draft\\`
   *(Press Win + R, paste `%LOCALAPPDATA%\\CapCut\\User Data\\Projects\\com.lveditor.draft\\` and hit Enter)*
2. Launch CapCut Desktop.
3. You will immediately see **"{project_name}"** on your project home screen. Click it to open the ready-cut timeline!

#### On macOS:
1. Open Finder, press `Cmd + Shift + G`, and navigate to:
   `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/`
2. Copy this project folder into that directory.
3. Launch CapCut Desktop. The project will appear in your project list with all tracks aligned.

---

### Method B: Universal XML / FCPXML Import
If you prefer standard NLE import (CapCut, Adobe Premiere, DaVinci Resolve, Final Cut):
1. In CapCut Desktop or Premiere Pro, go to **File** → **Import** (or Import XML).
2. Select `timeline.xml` from this folder.
3. The video and audio tracks will automatically populate into your sequence.

---

### Method C: CapCut Web & Manual Media
1. In CapCut Web (capcut.com), create a new project.
2. Drag and drop all files from `clips/` onto the video timeline.
3. Drag `audio/voice.wav` and `audio/music.wav` onto the audio tracks.
4. Go to **Captions** → **Upload Subtitle** and upload `transcript/transcript.srt`.
"""


def export_capcut_project_bundle(
    project_source_dir: Path,
    target_output_dir: Path
) -> Path:
    """
    Creates a full CapCut draft folder containing draft_content.json, draft_meta_info.json,
    timeline.xml, clips/, audio/, transcript/, and instructions.
    """
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

    # 1. Generate CapCut draft_content.json
    draft_content = generate_capcut_draft_content(scenes_data, transcript_data)
    draft_content_path = target_output_dir / "draft_content.json"
    draft_content_path.write_text(json.dumps(draft_content, indent=2), encoding="utf-8")

    # 2. Generate CapCut draft_meta_info.json
    draft_meta = generate_capcut_draft_meta_info(scenes_data, draft_content["id"])
    draft_meta_path = target_output_dir / "draft_meta_info.json"
    draft_meta_path.write_text(json.dumps(draft_meta, indent=2), encoding="utf-8")

    # 3. Generate universal timeline.xml
    xml_content = generate_universal_fcpxml(scenes_data, transcript_data)
    xml_path = target_output_dir / "timeline.xml"
    xml_path.write_text(xml_content, encoding="utf-8")

    # 4. Generate import guide
    guide_content = generate_capcut_import_instructions(scenes_data.get("video_name", "Dissected_Video"))
    guide_path = target_output_dir / "HOW_TO_IMPORT_IN_CAPCUT.md"
    guide_path.write_text(guide_content, encoding="utf-8")

    # 5. Copy clips, audio, transcript
    for folder_name in ("clips", "audio", "transcript"):
        src_folder = project_source_dir / folder_name
        if src_folder.exists():
            dest_folder = target_output_dir / folder_name
            shutil.copytree(src_folder, dest_folder, dirs_exist_ok=True)

    # 6. Copy scenes.json
    shutil.copy2(scenes_json_path, target_output_dir / "scenes.json")

    return target_output_dir


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        src = Path(sys.argv[1])
        out = Path(sys.argv[2]) if len(sys.argv) > 2 else src / "capcut_draft"
        export_capcut_project_bundle(src, out)
        print(f"Generated CapCut draft project at {out}")
