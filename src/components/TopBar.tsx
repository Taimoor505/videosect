import React from 'react';
import { Play, Download, Terminal, CheckCircle2 } from 'lucide-react';

export type TabId = 'timeline' | 'clips' | 'audio' | 'frames' | 'transcript' | 'colab' | 'tests';

interface TopBarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenDissectModal: () => void;
  onOpenTestModal: () => void;
  onOpenExportModal: () => void;
  currentProjectId?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenDissectModal,
  onOpenTestModal,
  onOpenExportModal,
  currentProjectId,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-40">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a href="/" className="text-base font-semibold tracking-tight text-slate-900 whitespace-nowrap">
          Video Dissection Studio
        </a>
      </div>

      {/* Zone 2: Concise single-line navigation links */}
      <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-600">
        <button
          onClick={() => onSelectTab('timeline')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'timeline' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 -mb-[2px]' : ''
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => onSelectTab('clips')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'clips' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 -mb-[2px]' : ''
          }`}
        >
          Silent Clips
        </button>
        <button
          onClick={() => onSelectTab('audio')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'audio' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 -mb-[2px]' : ''
          }`}
        >
          Audio Stems
        </button>
        <button
          onClick={() => onSelectTab('frames')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'frames' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 -mb-[2px]' : ''
          }`}
        >
          Frames Inspector
        </button>
        <button
          onClick={() => onSelectTab('transcript')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'transcript' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 -mb-[2px]' : ''
          }`}
        >
          Transcript
        </button>
        <button
          onClick={() => onSelectTab('colab')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'colab' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 -mb-[2px]' : ''
          }`}
        >
          Colab & CLI
        </button>
        <button
          onClick={() => onSelectTab('tests')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'tests' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 -mb-[2px]' : ''
          }`}
        >
          Test Suite
        </button>
      </nav>

      {/* Zone 3: Primary action button + quick action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onOpenExportModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
          title="Custom selective export or export ready CapCut project"
        >
          <Download className="w-3.5 h-3.5 text-indigo-600" />
          <span>Export & CapCut</span>
        </button>

        <button
          onClick={onOpenDissectModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>New Dissection</span>
        </button>
      </div>
    </header>
  );
};
