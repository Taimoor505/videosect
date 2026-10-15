import React, { useState } from 'react';
import { ProjectDetails, WordTiming } from '../types';
import { Copy, Check, FileText, Code2, Download } from 'lucide-react';

interface TranscriptViewProps {
  project: ProjectDetails;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({ project }) => {
  const [activeFormat, setActiveFormat] = useState<'interactive' | 'txt' | 'srt' | 'json'>('interactive');
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const segments = project.transcriptJson?.segments || [];
  const allWords: WordTiming[] = segments.flatMap(s => s.words || []);

  const getActiveContent = () => {
    switch (activeFormat) {
      case 'txt':
        return project.transcriptTxt;
      case 'srt':
        return project.transcriptSrt;
      case 'json':
        return JSON.stringify(project.transcriptJson, null, 2);
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Timestamped Speech Transcripts (`transcript/`)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Transcribed using faster-whisper <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">large-v3</code> with word timestamps and voice-activity filtering (VAD).
            Derived purely from the isolated <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">voice.wav</code> track (burned-in subtitles left untouched).
          </p>
        </div>

        {/* Format Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveFormat('interactive')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeFormat === 'interactive'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Word Timestamps
          </button>
          <button
            onClick={() => setActiveFormat('txt')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeFormat === 'txt'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            transcript.txt
          </button>
          <button
            onClick={() => setActiveFormat('srt')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeFormat === 'srt'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            transcript.srt
          </button>
          <button
            onClick={() => setActiveFormat('json')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeFormat === 'json'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            transcript.json
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {activeFormat === 'interactive' ? (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="text-xs text-slate-500">
                <span>Segments: <strong>{segments.length}</strong></span>
                <span className="mx-2">·</span>
                <span>Total Words: <strong>{allWords.length}</strong></span>
                <span className="mx-2">·</span>
                <span>Model: <code className="font-mono">{project.scenesData.models.whisper}</code></span>
              </div>
              <button
                onClick={() => handleCopy(project.transcriptTxt)}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>

            {/* Segment Rows */}
            <div className="space-y-6">
              {segments.map((seg) => (
                <div key={seg.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-500">
                      [{seg.start.toFixed(3)}s → {seg.end.toFixed(3)}s]
                    </span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      Duration: {(seg.end - seg.start).toFixed(2)}s
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-900 leading-relaxed">
                    {seg.text}
                  </p>

                  {/* Word-level pill cloud */}
                  {seg.words && seg.words.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-2">
                      {seg.words.map((w, wIdx) => (
                        <div
                          key={wIdx}
                          className="px-2.5 py-1 rounded bg-white border border-slate-200 text-xs flex items-center gap-1.5 shadow-2xs"
                        >
                          <span className="font-medium text-slate-900">{w.word}</span>
                          <span className="text-[10px] font-mono tabular-nums text-slate-400">
                            {w.start.toFixed(2)}s - {w.end.toFixed(2)}s
                          </span>
                          <span className="text-[9px] font-mono text-emerald-600 font-semibold">
                            {Math.round(w.probability * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-600">
                output/{project.id}/transcript/{activeFormat === 'txt' ? 'transcript.txt' : activeFormat === 'srt' ? 'transcript.srt' : 'transcript.json'}
              </span>
              <button
                onClick={() => handleCopy(getActiveContent())}
                className="text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1.5 font-medium px-2.5 py-1 rounded bg-white border border-slate-200 shadow-2xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-5 font-mono text-xs text-slate-800 leading-relaxed overflow-x-auto max-h-[500px]">
              {getActiveContent()}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
