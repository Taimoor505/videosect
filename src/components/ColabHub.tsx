import React, { useState } from 'react';
import { Download, Copy, Check, Terminal, Cpu, Zap, FileCode, BookOpen } from 'lucide-react';

export const ColabHub: React.FC = () => {
  const [fastMode, setFastMode] = useState(false);
  const [capcutMode, setCapcutMode] = useState(true);
  const [detectorMode, setDetectorMode] = useState<'ensemble' | 'adaptive' | 'content'>('ensemble');
  const [watermarkMode, setWatermarkMode] = useState<string>('auto');
  const [threshold, setThreshold] = useState(27.0);
  const [device, setDevice] = useState<'auto' | 'cuda' | 'cpu'>('auto');
  const [videoFile, setVideoFile] = useState('input.mp4');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedColab, setCopiedColab] = useState(false);

  const generatedCliCmd = `python3 dissect.py ${videoFile} --detector ${detectorMode} --threshold ${threshold.toFixed(1)} --watermark ${watermarkMode}${
    fastMode ? ' --fast' : ''
  }${!capcutMode ? ' --no-capcut' : ''}${device !== 'auto' ? ` --device ${device}` : ''}`;

  const colabQuickSnippet = `# 1. Install dependencies on Google Colab (with T4 GPU):
!apt-get update -qq && apt-get install -y -qq ffmpeg
!pip install -q faster-whisper demucs "scenedetect[opencv]" tqdm torch torchaudio

# 2. Run Dissection (High-accuracy Ensemble Clipping + Auto Watermark Removal + Default CapCut Draft)
!python3 dissect.py /content/input.mp4 --detector ensemble --threshold 27.0 --watermark auto

# 3. Download Default CapCut Project ZIP & Full Dissected Output ZIP
import shutil
from google.colab import files
files.download("./output/input/CapCut_Project_input.zip")
shutil.make_archive("output_input", "zip", root_dir="./output", base_dir="input")
files.download("output_input.zip")`;

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(generatedCliCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleCopyColab = () => {
    navigator.clipboard.writeText(colabQuickSnippet);
    setCopiedColab(true);
    setTimeout(() => setCopiedColab(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Google Colab Notebook & CLI Hub
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Ready-to-run Jupyter notebook for Google Colab GPU runtime (exports & downloads a CapCut project by default), plus single-command CLI for CPU (AMD Ryzen 5600) and CUDA GPUs.
          </p>
        </div>

        {/* 1-Click Notebook Download */}
        <a
          href="/api/download/file/video_dissection.ipynb"
          download="video_dissection.ipynb"
          className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 shrink-0 shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Download video_dissection.ipynb</span>
        </a>
      </div>

      {/* Two Column Grid: Hardware & Command Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive CLI Generator */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Terminal className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900">CLI Command Builder (`dissect.py`)</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Input Video Filename:
              </label>
              <input
                type="text"
                value={videoFile}
                onChange={(e) => setVideoFile(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-slate-900"
                placeholder="my_video.mp4"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Scene Cut Detector Mode:
                </label>
                <select
                  value={detectorMode}
                  onChange={(e) => setDetectorMode(e.target.value as any)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-slate-900 bg-white"
                >
                  <option value="ensemble">ensemble (Adaptive+Content+Fade+Speech)</option>
                  <option value="adaptive">adaptive (Motion & Lighting Resilient)</option>
                  <option value="content">content (Standard HSV Detector)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Watermark Removal (`--watermark`):
                </label>
                <select
                  value={watermarkMode}
                  onChange={(e) => setWatermarkMode(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-slate-900 bg-white"
                >
                  <option value="auto">auto (Auto-detect corner watermark)</option>
                  <option value="bottom-right">bottom-right</option>
                  <option value="top-right">top-right</option>
                  <option value="top-left">top-left</option>
                  <option value="bottom-left">bottom-left</option>
                  <option value="none">none (Off)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Scene Cut Threshold ({threshold.toFixed(1)}):
                </label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="1"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full accent-slate-900"
                />
                <span className="text-[11px] text-slate-400">Default: 27.0 (Ensemble + Speech Snapping)</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Device:
                </label>
                <select
                  value={device}
                  onChange={(e) => setDevice(e.target.value as any)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-slate-900 bg-white"
                >
                  <option value="auto">auto (Detect CUDA vs CPU)</option>
                  <option value="cpu">cpu (Ryzen 5600 / Intel, int8)</option>
                  <option value="cuda">cuda (NVIDIA GPU, float16)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={capcutMode}
                  onChange={(e) => setCapcutMode(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 w-4 h-4"
                />
                <span className="text-xs text-slate-800 font-medium">
                  Generate CapCut Project Bundle by default (<code className="font-mono bg-indigo-50 text-indigo-900 border border-indigo-200 px-1 py-0.5 rounded">capcut_project/</code> + <code className="font-mono bg-indigo-50 text-indigo-900 border border-indigo-200 px-1 py-0.5 rounded">CapCut_Project_*.zip</code>)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fastMode}
                  onChange={(e) => setFastMode(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-0 w-4 h-4"
                />
                <span className="text-xs text-slate-800 font-medium">
                  Enable <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">--fast</code> mode (Faster-Whisper base, standard Demucs)
                </span>
              </label>
            </div>

            {/* Generated Command Box */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>Run this command in terminal:</span>
                <button
                  onClick={handleCopyCmd}
                  className="text-slate-700 hover:text-slate-900 flex items-center gap-1 font-medium"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-amber-300 font-mono text-xs rounded-lg overflow-x-auto">
                {generatedCliCmd}
              </pre>
            </div>
          </div>
        </div>

        {/* Right: Hardware Settings & Colab Instructions */}
        <div className="lg:col-span-5 space-y-6">
          {/* Hardware Specs Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Cpu className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-900">Auto Hardware Adaptation</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Google Colab / NVIDIA GPU</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Automatic CUDA detection. Demucs runs on GPU, Faster-Whisper uses <code className="font-mono text-slate-800 font-semibold">float16</code> compute for fastest large-v3 inference.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                  <span>CPU-Only (AMD Ryzen 5600)</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Auto-allocates physical threads (<code className="font-mono text-slate-800">os.cpu_count()</code>) and switches Faster-Whisper to <code className="font-mono text-slate-800 font-semibold">int8</code> quantization for high CPU throughput.
                </p>
              </div>
            </div>
          </div>

          {/* Quick File Downloads */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
              Standalone Script Downloads
            </h3>
            <div className="space-y-2">
              <a
                href="/api/download/file/dissect.py"
                download="dissect.py"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors text-xs text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-slate-500" />
                  <span className="font-mono font-medium">dissect.py</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <a
                href="/api/download/file/test_dissect.py"
                download="test_dissect.py"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors text-xs text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-slate-500" />
                  <span className="font-mono font-medium">test_dissect.py</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <a
                href="/api/download/file/requirements.txt"
                download="requirements.txt"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors text-xs text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-slate-500" />
                  <span className="font-mono font-medium">requirements.txt</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <a
                href="/api/download/file/README.md"
                download="README.md"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors text-xs text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-500" />
                  <span className="font-mono font-medium">README.md</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Ready-to-paste Colab Code Block */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800">
            Google Colab 3-Step Execution Snippet
          </span>
          <button
            onClick={handleCopyColab}
            className="text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1.5 font-medium px-2.5 py-1 rounded bg-white border border-slate-200 shadow-2xs"
          >
            {copiedColab ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedColab ? 'Copied' : 'Copy All'}</span>
          </button>
        </div>
        <pre className="p-5 font-mono text-xs text-slate-800 leading-relaxed overflow-x-auto bg-slate-900 text-slate-200">
          {colabQuickSnippet}
        </pre>
      </div>
    </div>
  );
};
