import React, { useState, useRef, useEffect } from 'react';
import { ProjectDetails, SceneClip } from '../types';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Eye, FastForward } from 'lucide-react';

interface OverviewTimelineProps {
  project: ProjectDetails;
  onSelectTab: (tab: any) => void;
  onSelectClipForFrames?: (clipId: string) => void;
  onOpenExportModal?: () => void;
}

export const OverviewTimeline: React.FC<OverviewTimelineProps> = ({
  project,
  onSelectTab,
  onSelectClipForFrames,
  onOpenExportModal,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [voiceVolume, setVoiceVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string>('clip_001');

  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const duration = project.scenesData.total_duration || 4.0;
  const scenes = project.scenesData.scenes || [];

  // Update active clip based on currentTime
  useEffect(() => {
    const active = scenes.find(s => currentTime >= s.start_time && currentTime <= s.end_time);
    if (active) {
      setActiveClipId(active.clip_id);
    }
  }, [currentTime, scenes]);

  // Audio synchronization loop
  useEffect(() => {
    let animId: number;
    const checkAudioTime = () => {
      if (voiceAudioRef.current && isPlaying) {
        setCurrentTime(voiceAudioRef.current.currentTime);
        if (voiceAudioRef.current.ended) {
          setIsPlaying(false);
        }
      }
      animId = requestAnimationFrame(checkAudioTime);
    };
    animId = requestAnimationFrame(checkAudioTime);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!voiceAudioRef.current) return;
    if (isPlaying) {
      voiceAudioRef.current.pause();
      musicAudioRef.current?.pause();
      setIsPlaying(false);
    } else {
      voiceAudioRef.current.play().catch(() => {});
      musicAudioRef.current?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(newTime, duration));
    setCurrentTime(clamped);
    if (voiceAudioRef.current) voiceAudioRef.current.currentTime = clamped;
    if (musicAudioRef.current) musicAudioRef.current.currentTime = clamped;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(clickX / rect.width, 1));
    handleSeek(ratio * duration);
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec - Math.floor(sec)) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Hidden Audio Elements for isolated stem mixing */}
      <audio
        ref={voiceAudioRef}
        src={project.audio.voiceUrl}
        preload="auto"
        muted={isMuted}
      />
      <audio
        ref={musicAudioRef}
        src={project.audio.musicUrl}
        preload="auto"
        muted={isMuted}
      />

      {/* Top Player & Shot Preview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Video Preview */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">Video Canvas</span>
              <span aria-hidden="true">·</span>
              <span>Subtitles & Video Intact</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{project.scenesData.fps} FPS</span>
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-600">
              Active: {activeClipId}
            </div>
          </div>

          {/* Video Container */}
          <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
            <video
              key={`/output/${project.id}/clips/${activeClipId}.mp4`}
              src={`/output/${project.id}/clips/${activeClipId}.mp4`}
              className="w-full h-full object-contain"
              muted
              playsInline
              autoPlay={isPlaying}
              loop
            />
            {/* Overlay badge indicating silent clip */}
            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded font-mono">
              SILENT CLIP (-an)
            </div>
          </div>

          {/* Playback Controls Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <button
                onClick={() => handleSeek(0)}
                className="p-2 text-slate-600 hover:text-slate-900 transition-colors"
                title="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="text-xs font-mono tabular-nums text-slate-700">
                <span className="font-semibold">{formatSecs(currentTime)}</span>
                <span className="text-slate-400"> / </span>
                <span>{formatSecs(duration)}</span>
              </div>
            </div>

            {/* Quick Stem Volumes */}
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">Voice:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={voiceVolume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVoiceVolume(v);
                    if (voiceAudioRef.current) voiceAudioRef.current.volume = v;
                  }}
                  className="w-16 accent-slate-900"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">Music:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setMusicVolume(v);
                    if (musicAudioRef.current) musicAudioRef.current.volume = v;
                  }}
                  className="w-16 accent-slate-900"
                />
              </div>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-slate-500 hover:text-slate-800"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Active Scene & Output Inspector */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Scene Dissection Spec</h3>
              <span className="text-xs font-mono text-slate-500">output/{project.id}/</span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="flex items-start justify-between text-xs">
                <span className="text-slate-500">Active Clip:</span>
                <span className="font-mono text-slate-900 font-medium">clips/{activeClipId}.mp4</span>
              </div>
              <div className="flex items-start justify-between text-xs">
                <span className="text-slate-500">Frame Directory:</span>
                <span className="font-mono text-slate-900">frames/{activeClipId}/</span>
              </div>
              <div className="flex items-start justify-between text-xs">
                <span className="text-slate-500">Extracted Frames:</span>
                <span className="font-mono tabular-nums text-slate-900 font-medium">
                  {project.frameFolders[activeClipId]?.length || 0} frames (.jpg)
                </span>
              </div>
              <div className="flex items-start justify-between text-xs">
                <span className="text-slate-500">Speech Isolation:</span>
                <span className="text-slate-900">voice.wav (vocals) · music.wav (backing)</span>
              </div>
            </div>

            {/* Spoken Text Box for Active Scene */}
            <div className="mt-5 p-3.5 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                Spoken Inside This Scene
              </div>
              <p className="text-xs text-slate-800 italic leading-relaxed">
                "{scenes.find(s => s.clip_id === activeClipId)?.spoken_text || 'No spoken dialogue in this scene.'}"
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
            <button
              onClick={() => {
                if (onSelectClipForFrames) onSelectClipForFrames(activeClipId);
                onSelectTab('frames');
              }}
              className="py-2 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Frames</span>
            </button>
            <button
              onClick={() => onSelectTab('clips')}
              className="flex-1 py-2 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-center"
            >
              Browse Clips
            </button>
            {onOpenExportModal && (
              <button
                onClick={onOpenExportModal}
                className="flex-1 py-2 px-3 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors text-center"
              >
                Export to CapCut
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Track Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Synchronized Multi-Track Timeline</h3>
            <span className="text-xs text-slate-400">· Click to scrub anywhere</span>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500">
            {formatSecs(currentTime)} / {formatSecs(duration)}
          </div>
        </div>

        {/* Timeline Interactive Area */}
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative bg-slate-900 rounded-lg p-3 cursor-pointer select-none space-y-2.5 overflow-hidden"
        >
          {/* Playhead Vertical Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-30 pointer-events-none transition-all duration-75"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          >
            <div className="w-2.5 h-2.5 -ml-1 bg-amber-400 rounded-full shadow-sm" />
          </div>

          {/* Track 1: Scene Clips */}
          <div className="relative h-10 bg-slate-800/80 rounded flex overflow-hidden border border-slate-700/50">
            <div className="absolute left-2 top-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider z-10">
              TRACK 1: SILENT SCENE CLIPS
            </div>
            {scenes.map((scene, idx) => {
              const widthPct = (scene.duration / duration) * 100;
              const isSelected = activeClipId === scene.clip_id;
              return (
                <div
                  key={scene.clip_id}
                  style={{ width: `${widthPct}%` }}
                  className={`h-full border-r border-slate-700 flex flex-col justify-end p-1.5 transition-colors ${
                    isSelected ? 'bg-indigo-950/70 border-amber-400/80' : 'bg-slate-800 hover:bg-slate-750'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeek(scene.start_time);
                  }}
                >
                  <div className="text-[11px] font-mono font-medium text-slate-200 truncate">
                    {scene.clip_id}.mp4
                  </div>
                  <div className="text-[9px] font-mono tabular-nums text-slate-400">
                    {scene.duration.toFixed(2)}s · {scene.frame_count} frames
                  </div>
                </div>
              );
            })}
          </div>

          {/* Track 2: Voice Audio (voice.wav) */}
          <div className="h-8 bg-slate-800/60 rounded flex items-center px-3 relative overflow-hidden border border-slate-700/30">
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider shrink-0 mr-3">
              VOICE (htdemucs_ft)
            </span>
            <div className="flex-1 h-3 flex items-center gap-0.5 opacity-80">
              {Array.from({ length: 48 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-emerald-500 rounded-xs"
                  style={{ height: `${20 + Math.sin(i * 0.8) * 60 + Math.cos(i * 1.5) * 20}%` }}
                />
              ))}
            </div>
          </div>

          {/* Track 3: Music Audio (music.wav) */}
          <div className="h-8 bg-slate-800/60 rounded flex items-center px-3 relative overflow-hidden border border-slate-700/30">
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider shrink-0 mr-3">
              MUSIC (Demucs)
            </span>
            <div className="flex-1 h-3 flex items-center gap-0.5 opacity-70">
              {Array.from({ length: 48 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-cyan-500 rounded-xs"
                  style={{ height: `${15 + Math.cos(i * 0.5) * 50}%` }}
                />
              ))}
            </div>
          </div>

          {/* Track 4: Words Alignment */}
          <div className="h-7 bg-slate-800/40 rounded flex items-center relative px-2 overflow-hidden">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mr-2 shrink-0">
              TRANSCRIPT
            </span>
            {project.transcriptJson?.segments.flatMap(s => s.words).map((w, idx) => {
              const leftPct = (w.start / duration) * 100;
              const widthPct = Math.max(((w.end - w.start) / duration) * 100, 2);
              const isActive = currentTime >= w.start && currentTime <= w.end;
              return (
                <div
                  key={idx}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className={`absolute top-1 bottom-1 text-[10px] rounded px-1 flex items-center justify-center truncate ${
                    isActive ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-700 text-slate-300'
                  }`}
                  title={`${w.word} (${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s)`}
                >
                  {w.word}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scene Index Table (scenes.json data) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Scene Index Table (`scenes.json`)</h3>
            <p className="text-xs text-slate-500">Frame-accurate start, end, duration, and spoken text</p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {scenes.length} {scenes.length === 1 ? 'scene cut' : 'scene cuts'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 font-medium">Clip ID</th>
                <th className="py-2.5 px-4 font-medium">Start Time</th>
                <th className="py-2.5 px-4 font-medium">End Time</th>
                <th className="py-2.5 px-4 font-medium text-right">Duration</th>
                <th className="py-2.5 px-4 font-medium text-right">Frame Count</th>
                <th className="py-2.5 px-4 font-medium">Spoken Text</th>
                <th className="py-2.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scenes.map((sc) => {
                const isSelected = activeClipId === sc.clip_id;
                return (
                  <tr
                    key={sc.clip_id}
                    className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-slate-50/80 font-medium' : ''}`}
                  >
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      {sc.clip_id}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {sc.start_timestamp}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {sc.end_timestamp}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700 text-right">
                      {sc.duration.toFixed(2)}s
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700 text-right">
                      {sc.frame_count}
                    </td>
                    <td className="py-3 px-4 text-slate-800 max-w-md truncate">
                      {sc.spoken_text || <span className="text-slate-400 italic">No speech in scene</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          if (onSelectClipForFrames) onSelectClipForFrames(sc.clip_id);
                          onSelectTab('frames');
                        }}
                        className="text-xs text-slate-700 hover:text-slate-900 font-medium px-2 py-1 rounded hover:bg-slate-200 transition-colors"
                      >
                        Frames
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
