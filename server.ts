import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Setup upload folder for user custom video inputs
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB max for short videos
});

// Output root
const outputRoot = path.join(__dirname, 'public', 'output');
if (!fs.existsSync(outputRoot)) {
  fs.mkdirSync(outputRoot, { recursive: true });
}

// Static directories
app.use('/output', express.static(outputRoot));
app.use('/sample_videos', express.static(path.join(__dirname, 'sample_videos')));

// =============================================================================
// API Routes
// =============================================================================

// List all dissected projects
app.get('/api/projects', (_req, res) => {
  try {
    if (!fs.existsSync(outputRoot)) {
      return res.json([]);
    }
    const entries = fs.readdirSync(outputRoot, { withFileTypes: true });
    const projects = [];

    for (const ent of entries) {
      if (ent.isDirectory()) {
        const projDir = path.join(outputRoot, ent.name);
        const scenesJsonPath = path.join(projDir, 'scenes.json');
        let scenesData = null;
        if (fs.existsSync(scenesJsonPath)) {
          try {
            scenesData = JSON.parse(fs.readFileSync(scenesJsonPath, 'utf-8'));
          } catch {
            // Ignore bad json
          }
        }

        const clipsDir = path.join(projDir, 'clips');
        const clips = fs.existsSync(clipsDir)
          ? fs.readdirSync(clipsDir).filter(f => f.endsWith('.mp4'))
          : [];

        const audioDir = path.join(projDir, 'audio');
        const hasVoice = fs.existsSync(path.join(audioDir, 'voice.wav'));
        const hasMusic = fs.existsSync(path.join(audioDir, 'music.wav'));

        projects.push({
          id: ent.name,
          name: scenesData?.video_name || ent.name,
          sourceFile: scenesData?.source_file || `${ent.name}.mp4`,
          totalDuration: scenesData?.total_duration || 0,
          fps: scenesData?.fps || 30,
          clipCount: scenesData?.clip_count || clips.length,
          models: scenesData?.models || { whisper: 'large-v3', demucs: 'htdemucs_ft', device: 'cpu' },
          hasVoice,
          hasMusic,
          scenes: scenesData?.scenes || []
        });
      }
    }
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single project details including transcript files
app.get('/api/projects/:id', (req, res) => {
  const projName = req.params.id;
  const projDir = path.join(outputRoot, projName);
  if (!fs.existsSync(projDir)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const scenesJsonPath = path.join(projDir, 'scenes.json');
    let scenesData: any = {};
    if (fs.existsSync(scenesJsonPath)) {
      scenesData = JSON.parse(fs.readFileSync(scenesJsonPath, 'utf-8'));
    }

    const transcriptDir = path.join(projDir, 'transcript');
    const txtPath = path.join(transcriptDir, 'transcript.txt');
    const srtPath = path.join(transcriptDir, 'transcript.srt');
    const jsonPath = path.join(transcriptDir, 'transcript.json');

    const transcriptTxt = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf-8') : '';
    const transcriptSrt = fs.existsSync(srtPath) ? fs.readFileSync(srtPath, 'utf-8') : '';
    let transcriptJson: any = null;
    if (fs.existsSync(jsonPath)) {
      try {
        transcriptJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      } catch {
        transcriptJson = null;
      }
    }

    // List clips
    const clipsDir = path.join(projDir, 'clips');
    const clips = fs.existsSync(clipsDir)
      ? fs.readdirSync(clipsDir).filter(f => f.endsWith('.mp4')).sort()
      : [];

    // List frame directories and sample counts
    const framesDir = path.join(projDir, 'frames');
    const frameFolders: Record<string, string[]> = {};
    if (fs.existsSync(framesDir)) {
      const subdirs = fs.readdirSync(framesDir);
      for (const sd of subdirs) {
        const fullSd = path.join(framesDir, sd);
        if (fs.statSync(fullSd).isDirectory()) {
          frameFolders[sd] = fs.readdirSync(fullSd).filter(f => f.endsWith('.jpg')).sort();
        }
      }
    }

    res.json({
      id: projName,
      scenesData,
      transcriptTxt,
      transcriptSrt,
      transcriptJson,
      clips,
      frameFolders,
      audio: {
        voiceUrl: `/output/${projName}/audio/voice.wav`,
        musicUrl: `/output/${projName}/audio/music.wav`
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run dissection on sample or custom file
app.post('/api/dissect', (req, res) => {
  const { videoPath, threshold = 27.0, fast = false, device = 'auto' } = req.body;
  if (!videoPath) {
    return res.status(400).json({ error: 'videoPath is required' });
  }

  const resolvedVideo = path.isAbsolute(videoPath)
    ? videoPath
    : path.join(__dirname, videoPath);

  if (!fs.existsSync(resolvedVideo)) {
    return res.status(404).json({ error: `Video file not found: ${videoPath}` });
  }

  const args = [
    'dissect.py',
    resolvedVideo,
    '--output-dir', outputRoot,
    '--threshold', String(threshold),
    '--device', device
  ];
  if (fast) {
    args.push('--fast');
  }

  const proc = spawn('python3', args, { cwd: __dirname });
  let stdoutLogs = '';
  let stderrLogs = '';

  proc.stdout.on('data', data => {
    stdoutLogs += data.toString();
  });
  proc.stderr.on('data', data => {
    stderrLogs += data.toString();
  });

  proc.on('close', code => {
    if (code === 0) {
      const stem = path.basename(resolvedVideo, path.extname(resolvedVideo));
      res.json({
        success: true,
        projectName: stem,
        stdout: stdoutLogs,
        stderr: stderrLogs
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Dissection process exited with code ${code}`,
        stdout: stdoutLogs,
        stderr: stderrLogs
      });
    }
  });
});

// Upload and dissect endpoint
app.post('/api/upload-and-dissect', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded' });
  }

  const threshold = req.body.threshold || '27.0';
  const fast = req.body.fast === 'true' || req.body.fast === true;
  const device = req.body.device || 'auto';

  const uploadedPath = req.file.path;
  const args = [
    'dissect.py',
    uploadedPath,
    '--output-dir', outputRoot,
    '--threshold', threshold,
    '--device', device
  ];
  if (fast) {
    args.push('--fast');
  }

  const proc = spawn('python3', args, { cwd: __dirname });
  let stdoutLogs = '';
  let stderrLogs = '';

  proc.stdout.on('data', data => {
    stdoutLogs += data.toString();
  });
  proc.stderr.on('data', data => {
    stderrLogs += data.toString();
  });

  proc.on('close', code => {
    const stem = path.basename(uploadedPath, path.extname(uploadedPath));
    if (code === 0) {
      res.json({
        success: true,
        projectName: stem,
        stdout: stdoutLogs,
        stderr: stderrLogs
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Dissection failed with exit code ${code}`,
        stdout: stdoutLogs,
        stderr: stderrLogs
      });
    }
  });
});

// Download individual code assets (dissect.py, video_dissection.ipynb, test_dissect.py, README.md, requirements.txt)
app.get('/api/download/file/:filename', (req, res) => {
  const allowed = ['dissect.py', 'video_dissection.ipynb', 'test_dissect.py', 'README.md', 'requirements.txt'];
  const filename = req.params.filename;
  if (!allowed.includes(filename)) {
    return res.status(403).json({ error: 'File not permitted for download' });
  }

  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

// Download output folder as zip archive
app.get('/api/download/zip/:name', (req, res) => {
  const projName = req.params.name;
  const projDir = path.join(outputRoot, projName);
  if (!fs.existsSync(projDir)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const zipName = `output_${projName}.zip`;
  const zipPath = path.join(outputRoot, zipName);

  // Use python's zipfile module to zip output folder reliably
  const pythonCmd = `python3 -m zipfile -c "${zipPath}" "${projDir}"`;
  exec(pythonCmd, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to create zip archive: ' + err.message });
    }
    res.download(zipPath, zipName, () => {
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      } catch {}
    });
  });
});

// Download full CapCut Ready Project bundle
app.get('/api/download/capcut-zip/:name', (req, res) => {
  const projName = req.params.name;
  const projDir = path.join(outputRoot, projName);
  if (!fs.existsSync(projDir)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const tempStaging = path.join(__dirname, 'uploads', `capcut_${Date.now()}_${projName}`);
  const zipPath = path.join(outputRoot, `CapCut_Project_${projName}.zip`);

  const genCmd = `python3 capcut_generator.py "${projDir}" "${tempStaging}" && python3 -m zipfile -c "${zipPath}" "${tempStaging}"`;
  exec(genCmd, { cwd: __dirname }, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to generate CapCut project: ' + err.message });
    }
    res.download(zipPath, `CapCut_Project_${projName}.zip`, () => {
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        if (fs.existsSync(tempStaging)) fs.rmSync(tempStaging, { recursive: true, force: true });
      } catch {}
    });
  });
});

// Selective custom export endpoint
app.post('/api/export/custom-zip', (req, res) => {
  const {
    projectId,
    selectedClips = [],
    includeAudioVoice = false,
    includeAudioMusic = false,
    includeTranscriptTxt = false,
    includeTranscriptSrt = false,
    includeTranscriptJson = false,
    selectedFrames = [],
    includeScenesJson = true,
    includeCapCut = false,
    includeXmlTimeline = false,
    packageName
  } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  const projDir = path.join(outputRoot, projectId);
  if (!fs.existsSync(projDir)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const finalName = packageName || `custom_export_${projectId}`;
  const stagingDir = path.join(__dirname, 'uploads', `staging_${Date.now()}_${projectId}`);
  const targetSubdir = path.join(stagingDir, finalName);
  fs.mkdirSync(targetSubdir, { recursive: true });

  try {
    // 1. Copy Selected Clips
    if (selectedClips.length > 0) {
      const clipsDest = path.join(targetSubdir, 'clips');
      fs.mkdirSync(clipsDest, { recursive: true });
      for (const clipName of selectedClips) {
        const srcClip = path.join(projDir, 'clips', clipName);
        if (fs.existsSync(srcClip)) {
          fs.copyFileSync(srcClip, path.join(clipsDest, clipName));
        }
      }
    }

    // 2. Copy Audio Stems
    if (includeAudioVoice || includeAudioMusic) {
      const audioDest = path.join(targetSubdir, 'audio');
      fs.mkdirSync(audioDest, { recursive: true });
      if (includeAudioVoice) {
        const voiceSrc = path.join(projDir, 'audio', 'voice.wav');
        if (fs.existsSync(voiceSrc)) fs.copyFileSync(voiceSrc, path.join(audioDest, 'voice.wav'));
      }
      if (includeAudioMusic) {
        const musicSrc = path.join(projDir, 'audio', 'music.wav');
        if (fs.existsSync(musicSrc)) fs.copyFileSync(musicSrc, path.join(audioDest, 'music.wav'));
      }
    }

    // 3. Copy Transcripts
    if (includeTranscriptTxt || includeTranscriptSrt || includeTranscriptJson) {
      const transDest = path.join(targetSubdir, 'transcript');
      fs.mkdirSync(transDest, { recursive: true });
      if (includeTranscriptTxt) {
        const p = path.join(projDir, 'transcript', 'transcript.txt');
        if (fs.existsSync(p)) fs.copyFileSync(p, path.join(transDest, 'transcript.txt'));
      }
      if (includeTranscriptSrt) {
        const p = path.join(projDir, 'transcript', 'transcript.srt');
        if (fs.existsSync(p)) fs.copyFileSync(p, path.join(transDest, 'transcript.srt'));
      }
      if (includeTranscriptJson) {
        const p = path.join(projDir, 'transcript', 'transcript.json');
        if (fs.existsSync(p)) fs.copyFileSync(p, path.join(transDest, 'transcript.json'));
      }
    }

    // 4. Copy Selected Frames folders
    if (selectedFrames.length > 0) {
      const framesDest = path.join(targetSubdir, 'frames');
      fs.mkdirSync(framesDest, { recursive: true });
      for (const folder of selectedFrames) {
        const srcFolder = path.join(projDir, 'frames', folder);
        if (fs.existsSync(srcFolder)) {
          fs.cpSync(srcFolder, path.join(framesDest, folder), { recursive: true });
        }
      }
    }

    // 5. Copy scenes.json
    const scenesJsonSrc = path.join(projDir, 'scenes.json');
    if (includeScenesJson && fs.existsSync(scenesJsonSrc)) {
      fs.copyFileSync(scenesJsonSrc, path.join(targetSubdir, 'scenes.json'));
    }

    // 6. Generate CapCut draft files or XML if requested
    if (includeCapCut || includeXmlTimeline) {
      // Execute capcut generator script
      const capcutGenCmd = `python3 capcut_generator.py "${projDir}" "${targetSubdir}"`;
      exec(capcutGenCmd, { cwd: __dirname }, (capcutErr) => {
        if (capcutErr) {
          console.error('CapCut generator error:', capcutErr);
        }
        buildAndSendZip();
      });
    } else {
      buildAndSendZip();
    }

    function buildAndSendZip() {
      const zipPath = path.join(stagingDir, `${finalName}.zip`);
      const zipCmd = `python3 -m zipfile -c "${zipPath}" "${targetSubdir}"`;
      exec(zipCmd, (zipErr) => {
        if (zipErr) {
          return res.status(500).json({ error: 'Zip creation failed: ' + zipErr.message });
        }
        res.download(zipPath, `${finalName}.zip`, () => {
          try {
            fs.rmSync(stagingDir, { recursive: true, force: true });
          } catch {}
        });
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run automated test suite
app.post('/api/run-tests', (_req, res) => {
  exec('python3 test_dissect.py', { cwd: __dirname }, (error, stdout, stderr) => {
    res.json({
      success: !error,
      exitCode: error ? error.code : 0,
      stdout,
      stderr
    });
  });
});

// =============================================================================
// Vite Middlewares in Dev or Dist Serving in Production
// =============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Video Dissection Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
