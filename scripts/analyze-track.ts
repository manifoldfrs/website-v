#!/usr/bin/env node
/**
 * Offline FFT analysis for the music visualizer.
 *
 * Decodes an audio file (WAV/MP3/...) with ffmpeg, runs a short-time FFT, and
 * writes a compact per-track spectrum timeline that the player reads at runtime
 * and renders synced to Spotify's reported playback position.
 *
 * Usage:
 *   node scripts/analyze-track.ts <audio-file> <spotify-track-id|url|uri>
 *
 * Example:
 *   node scripts/analyze-track.ts public/_raw/song.wav 1BxfuPKGuaTgP7aM0Bbdwr
 *
 * Output: public/waveforms/<trackId>.json  ({ fps, bins, frames: number[][] })
 * The audio file itself is never shipped, only the derived numbers.
 */

import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const SAMPLE_RATE = 22050
const FPS = 30
const FFT_SIZE = 2048
const HOP = Math.round(SAMPLE_RATE / FPS)
const BINS = 32
const MIN_FREQ = 30
const MAX_FREQ = 11025
const SILENCE_THRESHOLD = 0.012

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

function extractTrackId(input: string): string {
  const m = input.match(/track[/:]([A-Za-z0-9]{22})/) ?? input.match(/^([A-Za-z0-9]{22})$/)
  if (!m) fail(`Could not parse a Spotify track id from "${input}"`)
  return m[1]
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len >> 1; k++) {
        const a = i + k
        const b = a + (len >> 1)
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

function decodePcm(input: string): Float32Array {
  const proc = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", input, "-ac", "1", "-ar", String(SAMPLE_RATE), "-f", "f32le", "-"],
    { maxBuffer: Infinity },
  )

  if (proc.error || proc.status !== 0) {
    fail(`ffmpeg failed:\n${proc.error?.message ?? proc.stderr.toString()}`)
  }

  const buf = proc.stdout
  const samples = new Float32Array(buf.length >> 2)
  // copy bytes into an aligned Float32Array (ffmpeg emits little-endian f32)
  const view = new DataView(buf.buffer, buf.byteOffset, samples.length * 4)
  for (let i = 0; i < samples.length; i++) samples[i] = view.getFloat32(i * 4, true)
  return samples
}

function analyze(samples: Float32Array) {
  // trim leading silence so frame 0 lines up with the song's start
  let start = 0
  while (start < samples.length && Math.abs(samples[start]) < SILENCE_THRESHOLD) start++
  start = Math.max(0, start - HOP) // keep a tiny pre-roll

  // log-spaced bin edges (in FFT bin indices)
  const nyquistBins = FFT_SIZE >> 1
  const hzPerBin = SAMPLE_RATE / FFT_SIZE
  const edges: number[] = []
  for (let b = 0; b <= BINS; b++) {
    const f = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, b / BINS)
    edges.push(Math.min(nyquistBins - 1, Math.max(1, Math.round(f / hzPerBin))))
  }

  // Hann window
  const win = new Float64Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1))

  const re = new Float64Array(FFT_SIZE)
  const im = new Float64Array(FFT_SIZE)
  const rawFrames: Float64Array[] = []
  let globalMax = 1e-9

  for (let pos = start; pos + FFT_SIZE <= samples.length; pos += HOP) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = samples[pos + i] * win[i]
      im[i] = 0
    }
    fft(re, im)

    const frame = new Float64Array(BINS)
    for (let b = 0; b < BINS; b++) {
      const lo = edges[b]
      const hi = Math.max(lo + 1, edges[b + 1])
      let sum = 0
      for (let k = lo; k < hi; k++) sum += Math.hypot(re[k], im[k])
      const mag = sum / (hi - lo)
      frame[b] = mag
      if (mag > globalMax) globalMax = mag
    }
    rawFrames.push(frame)
  }

  // log-normalize to 0..255 against the global peak
  const logMax = Math.log1p(globalMax)
  const frames: number[][] = rawFrames.map((f) => {
    const out = new Array<number>(BINS)
    for (let b = 0; b < BINS; b++) {
      out[b] = Math.max(0, Math.min(255, Math.round((Math.log1p(f[b]) / logMax) * 255)))
    }
    return out
  })

  return frames
}

// --- main ---
const [, , inputArg, idArg] = process.argv
if (!inputArg || !idArg) {
  fail("Usage: node scripts/analyze-track.ts <audio-file> <spotify-track-id|url|uri>")
}

if (spawnSync("ffmpeg", ["-version"]).status !== 0) {
  fail("ffmpeg not found. Install it: brew install ffmpeg")
}

const trackId = extractTrackId(idArg)
console.log(`Analyzing ${inputArg} → track ${trackId}`)

const samples = decodePcm(inputArg)
const seconds = samples.length / SAMPLE_RATE
const frames = analyze(samples)

const outPath = join("public", "waveforms", `${trackId}.json`)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify({ fps: FPS, bins: BINS, frames }))

const sizeKb = (Buffer.byteLength(JSON.stringify({ fps: FPS, bins: BINS, frames })) / 1024).toFixed(0)
console.log(`✓ ${frames.length} frames over ${seconds.toFixed(1)}s → ${outPath} (${sizeKb} KB)`)
