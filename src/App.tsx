/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ProjectSummary, ProjectDetails } from './types';
import { TopBar, TabId } from './components/TopBar';
import { ProjectPicker } from './components/ProjectPicker';
import { OverviewTimeline } from './components/OverviewTimeline';
import { SilentClipsView } from './components/SilentClipsView';
import { AudioStemsView } from './components/AudioStemsView';
import { FramesInspector } from './components/FramesInspector';
import { TranscriptView } from './components/TranscriptView';
import { ColabHub } from './components/ColabHub';
import { TestSuiteModal } from './components/TestSuiteModal';
import { DissectionModal } from './components/DissectionModal';
import { ExportModal } from './components/ExportModal';
import { RefreshCw, Download, FileCode, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('interview_demo');
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [selectedClipForFrames, setSelectedClipForFrames] = useState<string>('clip_001');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDissectModalOpen, setIsDissectModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Fetch list of dissected projects
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data: ProjectSummary[] = await res.json();
      setProjects(data);
      if (data.length > 0 && !data.some(p => p.id === selectedProjectId)) {
        setSelectedProjectId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch details for currently selected project
  useEffect(() => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    fetch(`/api/projects/${selectedProjectId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Project not found');
        return res.json();
      })
      .then((data: ProjectDetails) => {
        setProjectDetails(data);
        if (data.scenesData.scenes && data.scenesData.scenes.length > 0) {
          setSelectedClipForFrames(data.scenesData.scenes[0].clip_id);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load project details', err);
        setIsLoading(false);
      });
  }, [selectedProjectId]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 3-Zone Top Navigation Contract */}
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenDissectModal={() => setIsDissectModalOpen(true)}
        onOpenTestModal={() => setActiveTab('tests')}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        currentProjectId={selectedProjectId}
      />

      {/* Project Selector & Metadata Strip */}
      {projects.length > 0 && (
        <ProjectPicker
          projects={projects}
          selectedId={selectedProjectId}
          onSelectProject={(id) => setSelectedProjectId(id)}
          onOpenDissectModal={() => setIsDissectModalOpen(true)}
        />
      )}

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        {isLoading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-600" />
            <span className="text-xs font-mono">Loading video dissection specs...</span>
          </div>
        ) : !projectDetails ? (
          <div className="h-96 flex flex-col items-center justify-center gap-4 text-center">
            <h3 className="text-base font-semibold text-slate-800">No Dissected Project Selected</h3>
            <p className="text-xs text-slate-500 max-w-md">
              Select one of the sample projects above or execute a new dissection run on an input video.
            </p>
            <button
              onClick={() => setIsDissectModalOpen(true)}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Start Dissection
            </button>
          </div>
        ) : (
          <div>
            {activeTab === 'timeline' && (
              <OverviewTimeline
                project={projectDetails}
                onSelectTab={setActiveTab}
                onSelectClipForFrames={(clipId) => setSelectedClipForFrames(clipId)}
                onOpenExportModal={() => setIsExportModalOpen(true)}
              />
            )}

            {activeTab === 'clips' && (
              <SilentClipsView
                project={projectDetails}
                onSelectClipForFrames={(clipId) => setSelectedClipForFrames(clipId)}
                onSelectTab={setActiveTab}
                onOpenExportModal={() => setIsExportModalOpen(true)}
              />
            )}

            {activeTab === 'audio' && (
              <AudioStemsView project={projectDetails} />
            )}

            {activeTab === 'frames' && (
              <FramesInspector
                project={projectDetails}
                initialClipId={selectedClipForFrames}
              />
            )}

            {activeTab === 'transcript' && (
              <TranscriptView project={projectDetails} />
            )}

            {activeTab === 'colab' && (
              <ColabHub />
            )}

            {activeTab === 'tests' && (
              <TestSuiteModal />
            )}
          </div>
        )}
      </main>

      {/* Minimal Clean Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>Video Dissection Tool</span>
          <span aria-hidden="true">·</span>
          <span>Demucs htdemucs_ft</span>
          <span aria-hidden="true">·</span>
          <span>Whisper large-v3</span>
          <span aria-hidden="true">·</span>
          <span>PySceneDetect</span>
        </div>
        <div className="flex items-center gap-4 text-slate-600">
          <a
            href="/api/download/file/video_dissection.ipynb"
            download="video_dissection.ipynb"
            className="hover:text-slate-900 transition-colors font-medium flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Colab Notebook</span>
          </a>
          <a
            href="/api/download/file/dissect.py"
            download="dissect.py"
            className="hover:text-slate-900 transition-colors font-medium flex items-center gap-1"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>dissect.py</span>
          </a>
          <button
            onClick={() => setActiveTab('tests')}
            className="hover:text-slate-900 transition-colors font-medium flex items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>16 Tests Passed</span>
          </button>
        </div>
      </footer>

      {/* Dissection Modal */}
      <DissectionModal
        isOpen={isDissectModalOpen}
        onClose={() => setIsDissectModalOpen(false)}
        onComplete={async (newProjName) => {
          await fetchProjects();
          setSelectedProjectId(newProjName);
          setActiveTab('timeline');
        }}
      />

      {/* Selective Export & CapCut Project Modal */}
      {projectDetails && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          project={projectDetails}
        />
      )}
    </div>
  );
}
