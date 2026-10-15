import React from 'react';
import { ProjectSummary } from '../types';
import { Film, SlidersHorizontal, FolderArchive } from 'lucide-react';

interface ProjectPickerProps {
  projects: ProjectSummary[];
  selectedId: string;
  onSelectProject: (id: string) => void;
  onOpenDissectModal: () => void;
}

export const ProjectPicker: React.FC<ProjectPickerProps> = ({
  projects,
  selectedId,
  onSelectProject,
  onOpenDissectModal,
}) => {
  const current = projects.find(p => p.id === selectedId) || projects[0];

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Project Selector Segmented Control */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap mr-1">
            Projects:
          </span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
            {projects.map((proj) => {
              const isActive = proj.id === selectedId;
              let label = proj.name;
              if (proj.id === 'interview_demo') label = 'Interview Cut (2 scenes)';
              else if (proj.id === 'single_shot') label = 'Single Shot (Fallback test)';
              else if (proj.id === 'talking_head_subtitled') label = 'Burned-in Subtitles & Music';

              return (
                <button
                  key={proj.id}
                  onClick={() => onSelectProject(proj.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Unboxed Metadata Strip (Zero-Pill discipline) */}
        {current && (
          <div className="flex items-center gap-2 text-xs text-slate-500 overflow-x-auto">
            <span className="font-mono tabular-nums text-slate-800 font-medium">
              {current.sourceFile}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{current.totalDuration.toFixed(2)}s</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{current.fps} fps</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {current.clipCount} {current.clipCount === 1 ? 'scene clip' : 'scene clips'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Demucs {current.models.demucs}</span>
            <span aria-hidden="true">·</span>
            <span>Whisper {current.models.whisper}</span>
          </div>
        )}
      </div>
    </div>
  );
};
