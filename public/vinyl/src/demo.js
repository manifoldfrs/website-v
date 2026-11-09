// A small procedurally synthesised EP so there is something to cut into vinyl without shipping audio.
// Track 2 is a test band (reference tone, channel ID, sweep, silence) to make the physics audible.
import { TAU, rng } from './dsp.js';

const hz = (n) => 440 * 2 ** ((n - 69) / 12);
const buf = (fs, secs) => { const n = Math.round(fs * secs); return { L: new Float32Array(n), R: new Float32Array(n), fs, n }; };
const pan = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

function voice(b, t0, dur, tail, p, fn) {
  const i0 = Math.round(t0 * b.fs), n = Math.round((dur + tail) * b.fs), [gl, gr] = pan(p);
  for (let i = 0; i < n && i0 + i < b.n; i++) {
    if (i0 + i < 0) continue;
    const t = i / b.fs, s = fn(t) * (t > dur ? Math.exp(-(t - dur) * 5 / tail) : 1) * Math.min(1, t * 400);
    b.L[i0 + i] += s * gl; b.R[i0 + i] += s * gr;
  }
}
const epiano = (b, t0, note, dur, v, p = 0) => {
  const f = hz(note);
  voice(b, t0, dur, 0.5, p, (t) => v * Math.exp(-t * 1.8) * Math.sin(TAU * f * t
    + (1.5 * Math.exp(-t * 5) + 0.3) * Math.sin(TAU * f * t) + 0.5 * Math.exp(-t * 25) * Math.sin(TAU * f * 14 * t)));
};
const bass = (b, t0, note, dur, v) => {
  const f = hz(note);
  voice(b, t0, dur, 0.08, 0, (t) => v * Math.exp(-t * 1.2) * (Math.sin(TAU * f * t + 0.6 * Math.exp(-t * 9) * Math.sin(TAU * 2 * f * t))));
};
const kick = (b, t0, v) => voice(b, t0, 0.35, 0.05, 0, (t) => v * Math.exp(-t * 8) * Math.sin(TAU * (47 * t - 110 / 28 * (Math.exp(-t * 28) - 1))));
const snare = (b, t0, v, R) => { let lp = 0; voice(b, t0, 0.2, 0.05, 0.1, (t) => { const w = R() * 2 - 1; lp += 0.35 * (w - lp); return v * (0.8 * (w - lp) * Math.exp(-t * 20) + 0.6 * Math.sin(TAU * 185 * t) * Math.exp(-t * 28)); }); };
const hat = (b, t0, v, R, p) => { let z = 0; voice(b, t0, 0.05, 0.03, p, (t) => { const w = R() * 2 - 1, d = w - z; z = w; return v * d * Math.exp(-t * 70); }); };
const pluck = (b, t0, note, dur, v, p) => {
  const f = hz(note);
  voice(b, t0, dur, 0.4, p, (t) => { let s = 0; for (let h = 1; h <= 6; h++) s += Math.sin(TAU * f * h * t) * Math.exp(-t * (2 + 2.2 * h)) / h; return v * s; });
};
const pad = (b, t0, note, dur, v, p) => {
  const f = hz(note);
  voice(b, t0, dur, 1.2, p, (t) => v * Math.min(1, t / 0.8) * (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 1.005 * t + 1) + 0.3 * Math.sin(TAU * f * 2.003 * t)) / 1.8);
};
function finish(b, title) {
  let pk = 1e-9;
  for (let i = 0; i < b.n; i++) pk = Math.max(pk, Math.abs(b.L[i]), Math.abs(b.R[i]));
  const g = 0.9 / pk, f = Math.round(0.02 * b.fs);
  for (let i = 0; i < b.n; i++) { const w = Math.min(1, i / f, (b.n - 1 - i) / f); b.L[i] *= g * w; b.R[i] *= g * w; }
  return { L: b.L, R: b.R, title };
}

function slowGroove(fs) {
  const bpm = 84, beat = 60 / bpm, bars = 22, b = buf(fs, bars * 4 * beat + 2), R = rng(3);
  const prog = [[50, [62, 65, 69, 72, 76]], [43, [59, 62, 65, 69, 76]], [48, [60, 64, 67, 71, 74]], [45, [61, 64, 67, 70, 73]]];
  for (let bar = 0; bar < bars; bar++) {
    const t = bar * 4 * beat, [root, ch] = prog[bar % 4], sw = beat * 0.16;
    ch.forEach((n, i) => epiano(b, t + i * 0.012, n, beat * 1.8, 0.16, (i - 2) * 0.3));
    ch.slice(1).forEach((n, i) => epiano(b, t + beat * 2.5 + sw + i * 0.01, n, beat * 1.2, 0.11, (1 - i) * 0.4));
    if (bar >= 2) {
      bass(b, t, root - 12, beat * 1.4, 0.5); bass(b, t + beat * 1.5 + sw, root - 12, beat * 0.4, 0.35);
      bass(b, t + beat * 2.5 + sw, root - 5, beat * 0.9, 0.4); bass(b, t + beat * 3.5 + sw, root - 10, beat * 0.4, 0.3);
    }
    if (bar >= 4 && bar < bars - 1) {
      kick(b, t, 0.9); kick(b, t + beat * 2.5 + sw, 0.75); snare(b, t + beat, 0.5, R); snare(b, t + beat * 3, 0.55, R);
      for (let h = 0; h < 8; h++) hat(b, t + h * beat / 2 + (h % 2 ? sw : 0), h % 2 ? 0.25 : 0.4, R, 0.35);
    }
    if (bar >= 8 && bar % 2 === 0) [81, 84, 88, 86].forEach((n, i) => pluck(b, t + beat * (1 + i * 0.75), n - (bar % 4 ? 2 : 0), 0.5, 0.14, i % 2 ? 0.6 : -0.6));
  }
  return finish(b, 'Slow Groove');
}

function testBand(fs) {
  const b = buf(fs, 30);
  const seg = (t0, t1, fn) => {
    for (let i = Math.round(t0 * fs); i < t1 * fs && i < b.n; i++) {
      const t = i / fs - t0, w = Math.min(1, t / 0.01, (t1 - t0 - t) / 0.01), [l, r] = fn(t);
      b.L[i] += l * w; b.R[i] += r * w;
    }
  };
  const A = 0.35;
  seg(0.5, 5, (t) => { const s = A * Math.sin(TAU * 1000 * t); return [s, s]; });           // 1 kHz reference
  seg(5.5, 8, (t) => [A * Math.sin(TAU * 1000 * t), 0]);                                    // left only
  seg(8.5, 11, (t) => [0, A * Math.sin(TAU * 1000 * t)]);                                   // right only
  seg(11.5, 21.5, (t) => { const k = Math.log(1000) / 10, s = 0.2 * Math.sin(TAU * 20 * (Math.exp(k * t) - 1) / k); return [s, s]; }); // 20 Hz - 20 kHz
  seg(22, 25, (t) => { const s = 0.5 * Math.sin(TAU * 315 * t); return [s, -s]; });         // vertical (out of phase)
  // 25 - 30 s: silent groove (surface noise only)
  return { L: b.L, R: b.R, title: 'Test Band' };
}

function arps(fs) {
  const bpm = 112, beat = 60 / bpm, bars = 28, b = buf(fs, bars * 4 * beat + 3), R = rng(9);
  const prog = [[45, [57, 60, 64, 67, 71]], [41, [57, 60, 65, 69, 72]], [48, [55, 60, 64, 67, 74]], [43, [55, 59, 62, 67, 71]]];
  for (let bar = 0; bar < bars; bar++) {
    const t = bar * 4 * beat, [root, ch] = prog[bar % 4];
    ch.slice(0, 4).forEach((n, i) => pad(b, t, n, beat * 4, 0.07, (i - 1.5) * 0.5));
    for (let s = 0; s < 16; s++) {
      const n = ch[[0, 2, 4, 1, 3, 4, 2, 1][s % 8]] + (s % 8 > 4 ? 12 : 0) + (bar >= 12 ? 12 : 0);
      if (bar >= 2) pluck(b, t + s * beat / 4, n, 0.22, 0.2, Math.sin(s * 1.3 + bar));
    }
    if (bar >= 6) { bass(b, t, root - 12, beat * 1.9, 0.5); bass(b, t + beat * 2, root - 12, beat * 0.9, 0.4); bass(b, t + beat * 3, root, beat * 0.9, 0.35); }
    if (bar >= 10 && bar < bars - 2) {
      for (let q = 0; q < 4; q++) { kick(b, t + q * beat, 0.8); hat(b, t + (q + 0.5) * beat, 0.45, R, -0.3); }
      snare(b, t + beat, 0.4, R); snare(b, t + 3 * beat, 0.45, R);
    }
  }
  return finish(b, 'Arps');
}

export function demoTracks(fs) { return [slowGroove(fs), testBand(fs), arps(fs)]; }
