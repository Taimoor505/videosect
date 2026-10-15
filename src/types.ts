export interface WordTiming {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
}

export interface TranscriptJson {
  model: string;
  device: string;
  vad_filter: boolean;
  segments: TranscriptSegment[];
}

export interface SceneClip {
  clip_id: string;
  file: string;
  frames_dir: string;
  start_time: number;
  end_time: number;
  start_timestamp: string;
  end_timestamp: string;
  duration: number;
  frame_count: number;
  spoken_text: string;
  spoken_words: WordTiming[];
}

export interface ScenesData {
  video_name: string;
  source_file: string;
  total_duration: number;
  fps: number;
  clip_count: number;
  watermark_removed?: {
    mode: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
  clipping_settings?: {
    detector_mode: string;
    threshold: number;
    snap_to_speech: boolean;
  };
  models: {
    whisper: string;
    demucs: string;
    device: string;
  };
  scenes: SceneClip[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  sourceFile: string;
  totalDuration: number;
  fps: number;
  clipCount: number;
  models: {
    whisper: string;
    demucs: string;
    device: string;
  };
  hasVoice: boolean;
  hasMusic: boolean;
  scenes: SceneClip[];
}

export interface ProjectDetails {
  id: string;
  scenesData: ScenesData;
  transcriptTxt: string;
  transcriptSrt: string;
  transcriptJson: TranscriptJson | null;
  clips: string[];
  frameFolders: Record<string, string[]>;
  audio: {
    voiceUrl: string;
    musicUrl: string;
  };
}
