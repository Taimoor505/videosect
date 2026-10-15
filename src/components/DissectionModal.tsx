import React, { useState } from 'react';
import { X, Play, Upload, RefreshCw, CheckCircle2, AlertCircle, Sliders } from 'lucide-react';

interface DissectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (projectName: string) => void;
}

export const DissectionModal: React.FC<DissectionModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [sourceType, setSourceType] = useState<'sample' | 'upload'>('sample');
  const [selectedSample, setSelectedSample] = useState('sample_videos/interview_demo.mp4');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [threshold, setThreshold] = useState('27.0');
  const [detector, setDetector] = useState<'ensemble' | 'adaptive' | 'content'>('ensemble');
  const [snapToSpeech, setSnapToSpeech] = useState(true);
  const [watermarkMode, setWatermarkMode] = useState<string>('auto');
  const [customWatermarkBox, setCustomWatermarkBox] = useState<string>('480,300,120,40');
  const [fast, setFast] = useState(false);
  const [device, setDevice] = useState<'auto' | 'cpu' | 'cuda'>('auto');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [logs, setLogs] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resolvedWatermark = watermarkMode === 'custom' ? customWatermarkBox : watermarkMode;

  const handleStartDissection = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    setLogs('');
    setProgressStep('Conforming video to Constant Frame Rate (CFR) & processing watermark filter...');

    try {
      if (sourceType === 'upload' && fileToUpload) {
        setProgressStep('Uploading video and running high-accuracy dissection pipeline...');
        const formData = new FormData();
        formData.append('video', fileToUpload);
        formData.append('threshold', threshold);
        formData.append('detector', detector);
        formData.append('snapToSpeech', String(snapToSpeech));
        formData.append('watermark', resolvedWatermark);
        formData.append('fast', String(fast));
        formData.append('device', device);

        const res = await fetch('/api/upload-and-dissect', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Dissection failed');
        }
        setLogs(data.stdout || '');
        setProgressStep('Dissection & CapCut project export complete!');
        setTimeout(() => {
          onComplete(data.projectName);
          onClose();
        }, 1200);
      } else {
        setProgressStep('Running dissect.py with Ensemble Scene Detection & Speech Snapping...');
        const res = await fetch('/api/dissect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoPath: selectedSample,
            threshold: parseFloat(threshold),
            detector,
            snapToSpeech,
            watermark: resolvedWatermark,
            fast,
            device,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Dissection failed');
        }
        setLogs(data.stdout || '');
        setProgressStep('Dissection & CapCut project export complete!');
        setTimeout(() => {
          onComplete(data.projectName);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Run Video Dissection</h3>
            <p className="text-xs text-slate-500">Deconstruct video into silent clips, audio stems, frames, transcript & CapCut project</p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Input Source Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
              1. Input Video
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSourceType('sample')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                  sourceType === 'sample'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Use Built-in Sample Video
              </button>
              <button
                type="button"
                onClick={() => setSourceType('upload')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                  sourceType === 'upload'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Upload Video (.mp4 / .mov)
              </button>
            </div>

            {sourceType === 'sample' ? (
              <select
                value={selectedSample}
                onChange={(e) => setSelectedSample(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-slate-900"
              >
                <option value="sample_videos/interview_demo.mp4">
                  interview_demo.mp4 (Multi-scene interview cut)
                </option>
                <option value="sample_videos/single_shot.mp4">
                  single_shot.mp4 (Tests fallback: treats entire video as 1 clip)
                </option>
                <option value="sample_videos/talking_head_subtitled.mp4">
                  talking_head_subtitled.mp4 (Burned-in subtitles + background music)
                </option>
              </select>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center space-y-2 bg-slate-50">
                <input
                  type="file"
                  accept="video/*,.mp4,.mov,.mkv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFileToUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                  id="video-upload-input"
                />
                <label
                  htmlFor="video-upload-input"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer shadow-2xs text-slate-800"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Video File</span>
                </label>
                <div className="text-[11px] text-slate-500 font-mono">
                  {fileToUpload ? fileToUpload.name : 'MP4, MOV, up to 200MB'}
                </div>
              </div>
            )}
          </div>

          {/* Configuration Parameters */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              2. High-Precision Clipping & Watermark Removal
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Scene Cut Detector Mode:</label>
                <select
                  value={detector}
                  onChange={(e) => setDetector(e.target.value as any)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="ensemble">ensemble (Adaptive + Content + Fade)</option>
                  <option value="adaptive">adaptive (Motion & Lighting Resilient)</option>
                  <option value="content">content (Standard HSV Cut Detector)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Corner Watermark Removal:</label>
                <select
                  value={watermarkMode}
                  onChange={(e) => setWatermarkMode(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="auto">auto (Auto-detect static corner logo)</option>
                  <option value="bottom-right">bottom-right corner delogo</option>
                  <option value="top-right">top-right corner delogo</option>
                  <option value="top-left">top-left corner delogo</option>
                  <option value="bottom-left">bottom-left corner delogo</option>
                  <option value="custom">custom coordinates (x,y,w,h)</option>
                  <option value="none">none (Disable watermark filter)</option>
                </select>
              </div>
            </div>

            {watermarkMode === 'custom' && (
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Watermark Bounding Box (<code className="font-mono">x,y,w,h</code> in pixels):
                </label>
                <input
                  type="text"
                  value={customWatermarkBox}
                  onChange={(e) => setCustomWatermarkBox(e.target.value)}
                  placeholder="480,300,120,40"
                  className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-200"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Scene Cut Threshold: <strong className="font-mono text-slate-900">{threshold}</strong>
                </label>
                <input
                  type="range"
                  min="15"
                  max="50"
                  step="1"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full accent-slate-900"
                />
                <span className="text-[10px] text-slate-400">Default: 27.0</span>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Compute Device:</label>
                <select
                  value={device}
                  onChange={(e) => setDevice(e.target.value as any)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="auto">auto (Auto-detect)</option>
                  <option value="cpu">cpu (Ryzen 5600, int8)</option>
                  <option value="cuda">cuda (NVIDIA GPU)</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={snapToSpeech}
                onChange={(e) => setSnapToSpeech(e.target.checked)}
                className="rounded text-slate-900 focus:ring-0 w-4 h-4"
              />
              <div>
                <div className="text-xs font-medium text-slate-900">
                  Audio-Aware Speech-Boundary Snapping & Frame Quantization
                </div>
                <div className="text-[11px] text-slate-500">
                  Nudges visual cuts within 220ms of spoken word edges so syllables are never cut mid-word
                </div>
              </div>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={fast}
                onChange={(e) => setFast(e.target.checked)}
                className="rounded text-slate-900 focus:ring-0 w-4 h-4"
              />
              <div>
                <div className="text-xs font-medium text-slate-900">
                  Enable <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">--fast</code> mode
                </div>
                <div className="text-[11px] text-slate-500">
                  Uses Faster-Whisper base and standard Demucs for quicker iteration
                </div>
              </div>
            </label>
          </div>

          {/* Progress / Status Display */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-slate-900 text-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{progressStep}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Executing Demucs vocal separation, Faster-Whisper transcription, and FFmpeg CFR cut...
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {logs && !isProcessing && (
            <div className="p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded-lg max-h-40 overflow-y-auto">
              {logs}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartDissection}
            disabled={isProcessing || (sourceType === 'upload' && !fileToUpload)}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 shadow-xs"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Dissection</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
