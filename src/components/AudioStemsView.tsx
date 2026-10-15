import React, { useState, useRef, useEffect } from 'react';
import { ProjectDetails } from '../types';
import { Play, Pause, RotateCcw, Download, Volume2, VolumeX, Mic, Music2 } from 'lucide-react';

interface AudioStemsViewProps {
  project: ProjectDetails;
}

export const AudioStemsView: React.FC<AudioStemsViewProps> = ({ project }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Stems controls
  const [voiceVol, setVoiceVol] = useState(1.0);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceSolo, setVoiceSolo] = useState(false);

  const [musicVol, setMusicVol] = useState(0.7);
  const [musicMuted, setMusicMuted] = useState(false);
  const [musicSolo, setMusicSolo] = useState(false);

  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);

  const duration = project.scenesData.total_duration || 4.0;

  // Handle Solo logic
  useEffect(() => {
    if (voiceRef.current && musicRef.current) {
      if (voiceSolo) {
        voiceRef.current.muted = false;
        musicRef.current.muted = true;
      } else if (musicSolo) {
        voiceRef.current.muted = true;
        musicRef.current.muted = false;
      } else {
        voiceRef.current.muted = voiceMuted;
        musicRef.current.muted = musicMuted;
      }
    }
  }, [voiceSolo, musicSolo, voiceMuted, musicMuted]);

  // Sync play / pause
  useEffect(() => {
    let frameId: number;
    const syncTime = () => {
      if (voiceRef.current && isPlaying) {
        setCurrentTime(voiceRef.current.currentTime);
        if (voiceRef.current.ended) {
          setIsPlaying(false);
        }
      }
      frameId = requestAnimationFrame(syncTime);
    };
    frameId = requestAnimationFrame(syncTime);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!voiceRef.current) return;
    if (isPlaying) {
      voiceRef.current.pause();
      musicRef.current?.pause();
      setIsPlaying(false);
    } else {
      voiceRef.current.play().catch(() => {});
      musicRef.current?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(newTime, duration));
    setCurrentTime(clamped);
    if (voiceRef.current) voiceRef.current.currentTime = clamped;
    if (musicRef.current) musicRef.current.currentTime = clamped;
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec - Math.floor(sec)) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Audio tags */}
      <audio ref={voiceRef} src={project.audio.voiceUrl} preload="auto" />
      <audio ref={musicRef} src={project.audio.musicUrl} preload="auto" />

      {/* Header Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Audio Stem Isolation (`audio/voice.wav` & `audio/music.wav`)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Speech isolated with Demucs (<code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">htdemucs_ft</code> two-stems=vocals mode).
            Background music and ambient noise are cleanly preserved in a separate file so nothing is lost.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={project.audio.voiceUrl}
            download={`${project.id}_voice.wav`}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>voice.wav</span>
          </a>
          <a
            href={project.audio.musicUrl}
            download={`${project.id}_music.wav`}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>music.wav</span>
          </a>
        </div>
      </div>

      {/* Mixer & Waveform Console */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        {/* Master Controls */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button
              onClick={() => handleSeek(0)}
              className="p-2 text-slate-600 hover:text-slate-900 transition-colors"
              title="Return to start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="text-sm font-mono tabular-nums text-slate-800">
              <span className="font-semibold">{formatSecs(currentTime)}</span>
              <span className="text-slate-400"> / </span>
              <span>{formatSecs(duration)}</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Demucs Stem Engine: 44.1kHz 16-bit PCM WAV
          </div>
        </div>

        {/* Stem Track 1: Voice (Isolated Speech) */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Voice Track (<code className="font-mono text-emerald-700">voice.wav</code>)
                </div>
                <div className="text-[11px] text-slate-500">
                  Isolated speech only · Background noise and music removed
                </div>
              </div>
            </div>

            {/* Fader & Toggles */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setVoiceSolo(!voiceSolo);
                  if (musicSolo) setMusicSolo(false);
                }}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  voiceSolo ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                SOLO
              </button>
              <button
                onClick={() => setVoiceMuted(!voiceMuted)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  voiceMuted ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                MUTE
              </button>
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={voiceVol}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVoiceVol(v);
                    if (voiceRef.current) voiceRef.current.volume = v;
                  }}
                  className="w-24 accent-slate-900"
                />
                <span className="text-xs font-mono tabular-nums text-slate-600 w-8 text-right">
                  {Math.round(voiceVol * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Waveform Graphic */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              handleSeek(ratio * duration);
            }}
            className="h-14 bg-slate-900 rounded-lg p-2 flex items-center gap-0.5 cursor-pointer relative overflow-hidden"
          >
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />
            {Array.from({ length: 64 }).map((_, i) => {
              const height = (Math.sin(i * 0.4) * 0.4 + Math.cos(i * 0.9) * 0.3 + 0.5) * 85;
              const isPast = (i / 64) <= (currentTime / duration);
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-xs transition-colors ${
                    isPast ? 'bg-emerald-400' : 'bg-emerald-600/50'
                  }`}
                  style={{ height: `${Math.max(12, height)}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Stem Track 2: Music & Background */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center">
                <Music2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Music & Background Track (<code className="font-mono text-cyan-700">music.wav</code>)
                </div>
                <div className="text-[11px] text-slate-500">
                  Background instruments, soundtrack, and room tone preserved
                </div>
              </div>
            </div>

            {/* Fader & Toggles */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setMusicSolo(!musicSolo);
                  if (voiceSolo) setVoiceSolo(false);
                }}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  musicSolo ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                SOLO
              </button>
              <button
                onClick={() => setMusicMuted(!musicMuted)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  musicMuted ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                MUTE
              </button>
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVol}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setMusicVol(v);
                    if (musicRef.current) musicRef.current.volume = v;
                  }}
                  className="w-24 accent-slate-900"
                />
                <span className="text-xs font-mono tabular-nums text-slate-600 w-8 text-right">
                  {Math.round(musicVol * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Waveform Graphic */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              handleSeek(ratio * duration);
            }}
            className="h-14 bg-slate-900 rounded-lg p-2 flex items-center gap-0.5 cursor-pointer relative overflow-hidden"
          >
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />
            {Array.from({ length: 64 }).map((_, i) => {
              const height = (Math.cos(i * 0.3) * 0.3 + Math.sin(i * 0.6) * 0.3 + 0.4) * 70;
              const isPast = (i / 64) <= (currentTime / duration);
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-xs transition-colors ${
                    isPast ? 'bg-cyan-400' : 'bg-cyan-600/50'
                  }`}
                  style={{ height: `${Math.max(10, height)}%` }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
