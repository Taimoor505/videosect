import React from 'react';
import { ProjectDetails, SceneClip } from '../types';
import { Download, Eye, Film, VolumeX, CheckCircle } from 'lucide-react';

interface SilentClipsViewProps {
  project: ProjectDetails;
  onSelectClipForFrames: (clipId: string) => void;
  onSelectTab: (tab: any) => void;
  onOpenExportModal?: () => void;
}

export const SilentClipsView: React.FC<SilentClipsViewProps> = ({
  project,
  onSelectClipForFrames,
  onSelectTab,
  onOpenExportModal,
}) => {
  const scenes = project.scenesData.scenes || [];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Silent Video Clips (`clips/clip_XXX.mp4`)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Split at exact scene boundaries via CFR re-encoding (no keyframe-snapped copy drift).
            Every clip has no audio track (<code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">-an</code>).
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-mono">
            <VolumeX className="w-4 h-4 text-slate-500" />
            <span>0 Audio Tracks</span>
          </div>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{scenes.length} clips</span>
          {onOpenExportModal && (
            <button
              onClick={onOpenExportModal}
              className="ml-2 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Selective Export & CapCut</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Silent Clips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {scenes.map((scene) => {
          const clipUrl = `/output/${project.id}/clips/${scene.clip_id}.mp4`;
          const frameCount = scene.frame_count || project.frameFolders[scene.clip_id]?.length || 0;

          return (
            <div
              key={scene.clip_id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-xs transition-shadow"
            >
              {/* Card Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-slate-600" />
                  <span className="font-mono text-sm font-semibold text-slate-900">
                    {scene.clip_id}.mp4
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-500">
                  <span>{scene.start_timestamp}</span>
                  <span>→</span>
                  <span>{scene.end_timestamp}</span>
                </div>
              </div>

              {/* Video Player */}
              <div className="relative aspect-video bg-black flex items-center justify-center">
                <video
                  src={clipUrl}
                  controls
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded font-mono flex items-center gap-1 pointer-events-none">
                  <VolumeX className="w-3 h-3 text-amber-400" />
                  <span>SILENT</span>
                </div>
              </div>

              {/* Clip Metadata & Spoken Text */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                    <span>Duration: <strong className="text-slate-800 font-mono tabular-nums">{scene.duration.toFixed(2)}s</strong></span>
                    <span>Frames: <strong className="text-slate-800 font-mono tabular-nums">{frameCount}</strong></span>
                    <span>Path: <span className="font-mono">{scene.file}</span></span>
                  </div>

                  {/* Spoken Text in Clip */}
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Spoken Speech inside Shot:
                    </span>
                    <p className="text-xs text-slate-800 italic bg-slate-50 p-2.5 rounded border border-slate-100 leading-relaxed">
                      {scene.spoken_text ? `"${scene.spoken_text}"` : <span className="text-slate-400">Silent shot · No spoken words</span>}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSelectClipForFrames(scene.clip_id);
                      onSelectTab('frames');
                    }}
                    className="flex-1 py-1.5 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Frames ({frameCount})</span>
                  </button>
                  <a
                    href={clipUrl}
                    download={`${project.id}_${scene.clip_id}.mp4`}
                    className="py-1.5 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    title="Download silent MP4"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
