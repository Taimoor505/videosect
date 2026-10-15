import React, { useState, useEffect } from 'react';
import { ProjectDetails } from '../types';
import {
  X,
  Download,
  Check,
  Film,
  Mic,
  Music2,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Layers,
  HelpCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectDetails;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const scenes = project.scenesData.scenes || [];
  const clips = project.clips || [];

  // Selections
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [includeVoice, setIncludeVoice] = useState(true);
  const [includeMusic, setIncludeMusic] = useState(true);
  const [includeTxt, setIncludeTxt] = useState(true);
  const [includeSrt, setIncludeSrt] = useState(true);
  const [includeJson, setIncludeJson] = useState(true);
  const [selectedFrames, setSelectedFrames] = useState<string[]>([]);
  const [includeScenesJson, setIncludeScenesJson] = useState(true);
  const [includeCapCut, setIncludeCapCut] = useState(true);
  const [includeXmlTimeline, setIncludeXmlTimeline] = useState(true);
  const [customPackageName, setCustomPackageName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showCapCutGuide, setShowCapCutGuide] = useState(false);

  // Initialize all clips selected by default
  useEffect(() => {
    if (clips.length > 0) {
      setSelectedClips(clips);
      setCustomPackageName(`CapCut_${project.id}`);
    }
  }, [project, clips]);

  if (!isOpen) return null;

  // Preset Handlers
  const applyPreset = (preset: 'capcut' | 'selective_clips' | 'audio_subs' | 'frames_rebuild' | 'all') => {
    if (preset === 'capcut') {
      setSelectedClips(clips);
      setIncludeVoice(true);
      setIncludeMusic(true);
      setIncludeTxt(false);
      setIncludeSrt(true);
      setIncludeJson(true);
      setSelectedFrames([]);
      setIncludeScenesJson(true);
      setIncludeCapCut(true);
      setIncludeXmlTimeline(true);
      setCustomPackageName(`CapCut_Project_${project.id}`);
    } else if (preset === 'selective_clips') {
      setSelectedClips(clips.slice(0, 1));
      setIncludeVoice(false);
      setIncludeMusic(false);
      setIncludeTxt(false);
      setIncludeSrt(false);
      setIncludeJson(false);
      setSelectedFrames([]);
      setIncludeScenesJson(false);
      setIncludeCapCut(false);
      setIncludeXmlTimeline(false);
      setCustomPackageName(`clips_${project.id}`);
    } else if (preset === 'audio_subs') {
      setSelectedClips([]);
      setIncludeVoice(true);
      setIncludeMusic(true);
      setIncludeTxt(true);
      setIncludeSrt(true);
      setIncludeJson(true);
      setSelectedFrames([]);
      setIncludeScenesJson(false);
      setIncludeCapCut(false);
      setIncludeXmlTimeline(false);
      setCustomPackageName(`audio_and_transcripts_${project.id}`);
    } else if (preset === 'frames_rebuild') {
      setSelectedClips(clips);
      setIncludeVoice(false);
      setIncludeMusic(false);
      setIncludeTxt(false);
      setIncludeSrt(false);
      setIncludeJson(false);
      setSelectedFrames(Object.keys(project.frameFolders));
      setIncludeScenesJson(true);
      setIncludeCapCut(false);
      setIncludeXmlTimeline(false);
      setCustomPackageName(`rebuild_kit_${project.id}`);
    } else if (preset === 'all') {
      setSelectedClips(clips);
      setIncludeVoice(true);
      setIncludeMusic(true);
      setIncludeTxt(true);
      setIncludeSrt(true);
      setIncludeJson(true);
      setSelectedFrames(Object.keys(project.frameFolders));
      setIncludeScenesJson(true);
      setIncludeCapCut(true);
      setIncludeXmlTimeline(true);
      setCustomPackageName(`full_dissection_${project.id}`);
    }
  };

  const toggleClip = (clipName: string) => {
    setSelectedClips((prev) =>
      prev.includes(clipName) ? prev.filter((c) => c !== clipName) : [...prev, clipName]
    );
  };

  const toggleFrameFolder = (folder: string) => {
    setSelectedFrames((prev) =>
      prev.includes(folder) ? prev.filter((f) => f !== folder) : [...prev, folder]
    );
  };

  const handleCustomZipExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/export/custom-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          selectedClips,
          includeAudioVoice: includeVoice,
          includeAudioMusic: includeMusic,
          includeTranscriptTxt: includeTxt,
          includeTranscriptSrt: includeSrt,
          includeTranscriptJson: includeJson,
          selectedFrames,
          includeScenesJson,
          includeCapCut,
          includeXmlTimeline,
          packageName: customPackageName || `custom_${project.id}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Trigger download from blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${customPackageName || `custom_${project.id}`}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setIsExporting(false);
      onClose();
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
      setIsExporting(false);
    }
  };

  // Selected count calculation
  const totalSelectedItems =
    selectedClips.length +
    (includeVoice ? 1 : 0) +
    (includeMusic ? 1 : 0) +
    (includeTxt ? 1 : 0) +
    (includeSrt ? 1 : 0) +
    (includeJson ? 1 : 0) +
    selectedFrames.length +
    (includeScenesJson ? 1 : 0) +
    (includeCapCut ? 1 : 0) +
    (includeXmlTimeline ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                Custom Export & CapCut Project Package
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select specific clips, audio stems, transcripts, or export a ready-to-import CapCut draft project.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Quick Presets Bar */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Export Presets
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('capcut')}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>CapCut Ready Project</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('selective_clips')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Clips Only
              </button>
              <button
                type="button"
                onClick={() => applyPreset('audio_subs')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Voice & Subtitles Only
              </button>
              <button
                type="button"
                onClick={() => applyPreset('frames_rebuild')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Frames Rebuild Kit
              </button>
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Select All
              </button>
            </div>
          </div>

          {/* CapCut Integration Highlight Box */}
          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-700" />
                <span className="text-xs font-semibold text-indigo-950">
                  CapCut Desktop & Web Draft Integration
                </span>
              </div>
              <button
                onClick={() => setShowCapCutGuide(!showCapCutGuide)}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-medium flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showCapCutGuide ? 'Hide Instructions' : 'How to import'}</span>
              </button>
            </div>

            <p className="text-xs text-indigo-900/80 leading-relaxed">
              Generates a native CapCut draft (<code className="font-mono text-indigo-950 font-medium">draft_content.json</code> + <code className="font-mono text-indigo-950 font-medium">draft_meta_info.json</code>).
              When opened in CapCut, your video track will be pre-cut into silent scene shots, with isolated voice on audio track 1, background music on audio track 2, and synchronized subtitle captions!
            </p>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={includeCapCut}
                  onChange={(e) => setIncludeCapCut(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 w-4 h-4"
                />
                <span>Include CapCut Draft (<code className="font-mono text-[11px]">draft_content.json</code>)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={includeXmlTimeline}
                  onChange={(e) => setIncludeXmlTimeline(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 w-4 h-4"
                />
                <span>Include Universal XML (<code className="font-mono text-[11px]">timeline.xml</code>)</span>
              </label>
            </div>

            {/* Expandable Import Instructions */}
            {showCapCutGuide && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-indigo-200 text-xs text-slate-700 space-y-2">
                <div className="font-semibold text-slate-900">How to open in CapCut:</div>
                <div className="space-y-1 font-mono text-[11px] bg-slate-50 p-2 rounded">
                  <div><strong>Windows:</strong> Extract into <code className="text-indigo-800">%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft\</code></div>
                  <div><strong>Mac:</strong> Extract into <code className="text-indigo-800">~/Movies/CapCut/User Data/Projects/com.lveditor.draft/</code></div>
                  <div><strong>Universal / Premiere / Resolve:</strong> Import <code className="text-indigo-800">timeline.xml</code> via File → Import</div>
                </div>
              </div>
            )}
          </div>

          {/* Section 1: Specific Video Clips */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                <Film className="w-3.5 h-3.5 text-slate-500" />
                <span>1. Silent Video Clips ({selectedClips.length}/{clips.length} selected)</span>
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedClips(clips)}
                  className="text-slate-600 hover:text-slate-900 font-medium"
                >
                  All
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedClips([])}
                  className="text-slate-600 hover:text-slate-900 font-medium"
                >
                  None
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {clips.map((clipName) => {
                const isSelected = selectedClips.includes(clipName);
                const scene = scenes.find((s) => s.file.includes(clipName) || clipName.includes(s.clip_id));
                return (
                  <label
                    key={clipName}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50/80'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleClip(clipName)}
                      className="mt-0.5 rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
                    />
                    <div className="flex-1 truncate">
                      <div className="font-mono font-medium text-slate-900 truncate">
                        {clipName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {scene ? `${scene.duration.toFixed(2)}s · ${scene.frame_count} frames` : 'Silent clip'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 2: Audio Stems & Transcripts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
            {/* Audio Stems */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Mic className="w-3.5 h-3.5 text-slate-500" />
                <span>2. Audio Stems</span>
              </span>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={includeVoice}
                  onChange={(e) => setIncludeVoice(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
                />
                <div>
                  <div className="font-mono font-medium text-slate-900">voice.wav</div>
                  <div className="text-[11px] text-slate-500">Isolated vocals (speech only)</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={includeMusic}
                  onChange={(e) => setIncludeMusic(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
                />
                <div>
                  <div className="font-mono font-medium text-slate-900">music.wav</div>
                  <div className="text-[11px] text-slate-500">Background music & ambient</div>
                </div>
              </label>
            </div>

            {/* Transcripts */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>3. Transcripts</span>
              </span>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={includeSrt}
                  onChange={(e) => setIncludeSrt(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
                />
                <div>
                  <div className="font-mono font-medium text-slate-900">transcript.srt</div>
                  <div className="text-[11px] text-slate-500">SubRip subtitles for video editors</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={includeJson}
                  onChange={(e) => setIncludeJson(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
                />
                <div>
                  <div className="font-mono font-medium text-slate-900">transcript.json</div>
                  <div className="text-[11px] text-slate-500">Word-level timestamps & probabilities</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={includeTxt}
                  onChange={(e) => setIncludeTxt(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
                />
                <div>
                  <div className="font-mono font-medium text-slate-900">transcript.txt</div>
                  <div className="text-[11px] text-slate-500">Bracketed plain text</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Frames & Metadata */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>4. Frame Sequences & Scene Index</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.keys(project.frameFolders).map((folder) => {
                const count = project.frameFolders[folder]?.length || 0;
                const isChecked = selectedFrames.includes(folder);
                return (
                  <label
                    key={folder}
                    className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleFrameFolder(folder)}
                      className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
                    />
                    <div className="truncate">
                      <span className="font-mono font-medium text-slate-900">frames/{folder}/</span>
                      <span className="text-[11px] text-slate-500 ml-1.5 font-mono tabular-nums">({count} JPEGs)</span>
                    </div>
                  </label>
                );
              })}

              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={includeScenesJson}
                  onChange={(e) => setIncludeScenesJson(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
                />
                <div>
                  <span className="font-mono font-medium text-slate-900">scenes.json</span>
                  <span className="text-[11px] text-slate-500 ml-1.5">Full timing & spoken text index</span>
                </div>
              </label>
            </div>
          </div>

          {/* Package Name Input */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Package Archive Filename:
            </label>
            <div className="flex items-center">
              <input
                type="text"
                value={customPackageName}
                onChange={(e) => setCustomPackageName(e.target.value)}
                className="flex-1 text-xs font-mono px-3 py-2 rounded-l-lg border border-slate-200 focus:outline-hidden focus:border-slate-900"
                placeholder="my_package"
              />
              <span className="px-3 py-2 bg-slate-100 text-xs font-mono text-slate-600 border border-l-0 border-slate-200 rounded-r-lg">
                .zip
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-mono">
            Selected: <strong className="text-slate-900">{totalSelectedItems} items</strong>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <a
              href={`/api/download/capcut-zip/${project.id}`}
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
              title="Download capcut_ready/ package with numbered silent clips, voice.wav, music.wav, captions.srt, and IMPORT.md"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-700" />
              <span>CapCut Ready ZIP</span>
            </a>

            <button
              onClick={handleCustomZipExport}
              disabled={isExporting || totalSelectedItems === 0}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs whitespace-nowrap"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Packaging ZIP...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Custom Package</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
