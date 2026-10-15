import React, { useState } from 'react';
import { ProjectDetails } from '../types';
import { Trash2, RotateCcw, ChevronLeft, ChevronRight, Image as ImageIcon, Film, Download, Check } from 'lucide-react';

interface FramesInspectorProps {
  project: ProjectDetails;
  initialClipId?: string;
}

export const FramesInspector: React.FC<FramesInspectorProps> = ({
  project,
  initialClipId = 'clip_001',
}) => {
  const scenes = project.scenesData.scenes || [];
  const [selectedClipId, setSelectedClipId] = useState<string>(initialClipId);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [deletedFrames, setDeletedFrames] = useState<Set<string>>(new Set());

  const activeScene = scenes.find(s => s.clip_id === selectedClipId) || scenes[0];
  const allFrames = project.frameFolders[selectedClipId] || [];

  // Filter remaining active frames
  const remainingFrames = allFrames.filter(f => !deletedFrames.has(f));
  const currentFrameName = remainingFrames[currentFrameIdx] || remainingFrames[0] || allFrames[0];

  const fps = project.scenesData.fps || 25;
  const originalDuration = (allFrames.length / fps);
  const rebuiltDuration = (remainingFrames.length / fps);

  const toggleDeleteFrame = (frameName: string) => {
    const next = new Set(deletedFrames);
    if (next.has(frameName)) {
      next.delete(frameName);
    } else {
      next.add(frameName);
    }
    setDeletedFrames(next);
  };

  const resetDeleted = () => {
    setDeletedFrames(new Set());
    setCurrentFrameIdx(0);
  };

  const nextFrame = () => {
    if (currentFrameIdx < remainingFrames.length - 1) {
      setCurrentFrameIdx(currentFrameIdx + 1);
    }
  };

  const prevFrame = () => {
    if (currentFrameIdx > 0) {
      setCurrentFrameIdx(currentFrameIdx - 1);
    }
  };

  const currentFrameUrl = currentFrameName
    ? `/output/${project.id}/frames/${selectedClipId}/${currentFrameName}`
    : '';

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Frame-by-Frame Inspector & Rebuild Studio
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Frame-accurate image sequences extracted to <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">frames/{selectedClipId}/000001.jpg</code>.
            Delete or prune unwanted frames to rebuild new videos with exact frame count control.
          </p>
        </div>

        {/* Clip Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Target Clip:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
            {scenes.map((s) => (
              <button
                key={s.clip_id}
                onClick={() => {
                  setSelectedClipId(s.clip_id);
                  setCurrentFrameIdx(0);
                  setDeletedFrames(new Set());
                }}
                className={`px-3 py-1 text-xs font-mono font-medium rounded-md transition-colors ${
                  selectedClipId === s.clip_id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s.clip_id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Frame Viewer & Rebuild Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Canvas & Scrub Area */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-mono font-medium text-slate-900">
                {currentFrameName || 'No frames'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Index {currentFrameIdx + 1} of {remainingFrames.length}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {((currentFrameIdx / fps)).toFixed(3)}s
              </span>
            </div>

            {deletedFrames.size > 0 && (
              <button
                onClick={resetDeleted}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore ({deletedFrames.size}) Deleted</span>
              </button>
            )}
          </div>

          {/* Large Image Frame Display */}
          <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
            {currentFrameUrl ? (
              <img
                src={currentFrameUrl}
                alt={currentFrameName}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-slate-500 text-xs flex flex-col items-center gap-2">
                <ImageIcon className="w-8 h-8 opacity-40" />
                <span>No frame available</span>
              </div>
            )}

            {/* Overlay badge with frame exact filename */}
            <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded font-mono">
              frames/{selectedClipId}/{currentFrameName}
            </div>

            {/* Overlay delete button on current frame */}
            {currentFrameName && (
              <button
                onClick={() => toggleDeleteFrame(currentFrameName)}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-md transition-colors"
                title="Mark this frame as deleted"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete This Frame</span>
              </button>
            )}
          </div>

          {/* Scrubber & Step Controls */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={prevFrame}
                disabled={currentFrameIdx <= 0}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                title="Previous Frame"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextFrame}
                disabled={currentFrameIdx >= remainingFrames.length - 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                title="Next Frame"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-slate-500 ml-1">
                Step frame-by-frame
              </span>
            </div>

            {/* Slider */}
            <div className="flex-1 max-w-md flex items-center gap-2">
              <input
                type="range"
                min="0"
                max={Math.max(0, remainingFrames.length - 1)}
                value={currentFrameIdx}
                onChange={(e) => setCurrentFrameIdx(parseInt(e.target.value, 10))}
                className="w-full accent-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Rebuild & Pruning Stats */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">
              Rebuild Video Calculator
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Original Frames:</span>
                <span className="font-mono tabular-nums text-slate-800 font-medium">
                  {allFrames.length} frames
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Deleted Frames:</span>
                <span className="font-mono tabular-nums text-rose-600 font-medium">
                  -{deletedFrames.size} frames
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-700 font-medium">Remaining For Rebuild:</span>
                <span className="font-mono tabular-nums text-slate-950 font-bold text-sm">
                  {remainingFrames.length} frames
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Rebuilt Duration (@ {fps} fps):</span>
                <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                  {rebuiltDuration.toFixed(3)}s (was {originalDuration.toFixed(3)}s)
                </span>
              </div>
            </div>

            {/* FFmpeg Rebuild Command */}
            <div className="p-3 bg-slate-900 rounded-lg text-slate-200 space-y-1.5">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                FFmpeg Rebuild Command:
              </div>
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-amber-300">
                ffmpeg -framerate {fps} -i frames/{selectedClipId}/%06d.jpg -c:v libx264 -crf 18 -pix_fmt yuv420p rebuilt_{selectedClipId}.mp4
              </pre>
            </div>
          </div>

          {/* Quick Frame Jump Grid */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-900">
                Frame Strip ({allFrames.length})
              </h4>
              <span className="text-[11px] text-slate-500">
                Click to preview or delete
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-64 overflow-y-auto pr-1">
              {allFrames.map((frameName, idx) => {
                const isDeleted = deletedFrames.has(frameName);
                const isCurrent = currentFrameName === frameName;

                return (
                  <div
                    key={frameName}
                    onClick={() => {
                      const remainIdx = remainingFrames.indexOf(frameName);
                      if (remainIdx !== -1) {
                        setCurrentFrameIdx(remainIdx);
                      }
                    }}
                    className={`relative aspect-video rounded cursor-pointer border overflow-hidden transition-all ${
                      isCurrent
                        ? 'border-amber-500 ring-2 ring-amber-400/50'
                        : isDeleted
                        ? 'border-rose-300 opacity-40 bg-rose-50'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img
                      src={`/output/${project.id}/frames/${selectedClipId}/${frameName}`}
                      alt={frameName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] font-mono text-white text-center py-0.5">
                      {frameName.replace('.jpg', '')}
                    </div>
                    {isDeleted && (
                      <div className="absolute inset-0 bg-rose-600/50 flex items-center justify-center">
                        <Trash2 className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
