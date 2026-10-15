# How to Import into CapCut Desktop & Web 🎬

This archive contains a ready-to-run CapCut project draft configured with:
- **Track 1 (Video)**: All silent scene clips sequenced consecutively with frame-accurate cuts
- **Track 2 (Audio)**: Isolated voice stem (`voice.wav` - background music removed)
- **Track 3 (Audio)**: Isolated background music & ambient track (`music.wav`)
- **Track 4 (Subtitles)**: Spoken dialogue synced to time ranges

---

### Method A: Direct Import in CapCut Desktop (Instant 1-Click Open)

CapCut stores draft projects in its user data folder:

#### On Windows:
1. Extract or copy this entire project folder into your CapCut Drafts folder:
   `%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft\`
   *(Press Win + R, paste `%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft\` and hit Enter)*
2. Launch CapCut Desktop.
3. You will immediately see **"interview_demo"** on your project home screen. Click it to open the ready-cut timeline!

#### On macOS:
1. Open Finder, press `Cmd + Shift + G`, and navigate to:
   `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/`
2. Copy this project folder into that directory.
3. Launch CapCut Desktop. The project will appear in your project list with all tracks aligned.

---

### Method B: Universal XML / FCPXML Import
If you prefer standard NLE import (CapCut, Adobe Premiere, DaVinci Resolve, Final Cut):
1. In CapCut Desktop or Premiere Pro, go to **File** → **Import** (or Import XML).
2. Select `timeline.xml` from this folder.
3. The video and audio tracks will automatically populate into your sequence.

---

### Method C: CapCut Web & Manual Media
1. In CapCut Web (capcut.com), create a new project.
2. Drag and drop all files from `clips/` onto the video timeline.
3. Drag `audio/voice.wav` and `audio/music.wav` onto the audio tracks.
4. Go to **Captions** → **Upload Subtitle** and upload `transcript/transcript.srt`.
