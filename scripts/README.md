# Music player + visualizer scripts

Run these commands from the repository root with Node.js 24. The audio scripts require `ffmpeg`.

## Playlist track list — `fetch-tracks.ts`

Spotify returns 403 on playlist items for new apps (even with a user token), so the
track list is read from Spotify's **public embed page** and committed as static data
(`src/lib/spotify/tracks.json`). No credentials, no login. Re-run after editing the
playlist:

```bash
node scripts/fetch-tracks.ts
```

It writes `tracks.json`; the dev server hot-reloads it. (The parser depends on
Spotify's embed markup — if it ever changes, the script will say so.)

---

# Music visualizer — waveform precompute

The player streams from Spotify (DRM, so the browser can't read the audio).
To get *real* synced waves for a full song, we analyze the audio **offline** and
ship only the derived numbers. The runtime reads `public/waveforms/<trackId>.json`
and renders it synced to Spotify's reported playback position. Tracks without a
JSON fall back to procedural waves automatically (and previews always do).

## 1. Get the audio (macOS)

Spotify Premium downloads are DRM-encrypted, not usable files. Capture the
**decoded** audio once via a virtual loopback device:

```bash
brew install blackhole-2ch ffmpeg
```

- In **Audio MIDI Setup**, create a *Multi-Output Device* = your speakers + BlackHole
  (so you still hear it), and select it as system output.
- Find BlackHole's input index, then record while you play the song **from 0:00**:

```bash
ffmpeg -f avfoundation -list_devices true -i ""          # find the ":N" index for BlackHole
ffmpeg -f avfoundation -i ":N" -t 240 public/_raw/song.wav
```

(Audacity/QuickTime work too — pick BlackHole as the input.) If you already own the
track elsewhere (purchased MP3, CD rip), use that file and skip recording.

> Personal use only: you're shipping derived numbers, not the audio. Don't commit
> or redistribute the recordings. `public/_raw/` is a scratch dir — keep it gitignored.

## 2. Analyze

```bash
node scripts/analyze-track.ts public/_raw/song.wav <spotify-track-id-or-url>
```

Writes `public/waveforms/<trackId>.json` (32 bins, 30 fps, ~50–100 KB). Leading
silence is trimmed so frame 0 lines up with the song's start. Repeat per song —
do your favorites first.
