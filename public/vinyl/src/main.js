// UI: wires the renderer, the mastering worker and the audio-thread physics engine together.
import { Renderer, DECK_Z } from './render.js';
import { TAU, onePole, rng } from './dsp.js';
import { FIRE } from './shaders.js';
import { RECORDS } from './records.js';
import { press, makeVis } from './press.js';
import { PIVOT_X, PIVOT_Y, ALPHA_REST, R_DISC, R_LABEL, R_LEADIN, W33, alphaForRadius, stylusXY } from './geometry.js';

const $ = (id) => document.getElementById(id);
const ASSETS = new URL('../assets/', import.meta.url).href;

// The deck stays mounted while the visitor reads other pages; there it is hidden and only the now-playing pill shows.
const deckShown = () => $('gl').getClientRects().length > 0;
const canvas = $('gl'), renderer = makeRenderer();

function makeRenderer() {
  try { return new Renderer(canvas); }
  catch (err) { $('power').hidden = true; $('status').textContent = 'This browser cannot draw the record player.'; throw err; }
}
let masterWorker = null;      // the lathe + pressing plant; only started if something has to be mastered in the browser
const worker = { postMessage: (m, transfer) => { busy(); (masterWorker ||= startWorker()).postMessage(m, transfer || []); } };
// The progress bar (index.html) shows window.__load: a download with got/total, or just "busy" when the size is unknown.
const busy = (h = { got: 0, total: 0 }) => (window.__load = h);
const idle = () => { if (window.__load) window.__load.done = true; };
const AZ0 = -0.5, EL0 = 0.6;   // default camera

const FIRE_REST = 0.85;   // the fire's brightness when no music is playing

const S = {
  tel: null, tRecv: 0, zoom: 0, zoomT: 0, az: AZ0, el: EL0, rpm: 33.3333, rec: null, pending: null, motor: false, cue: true, ready: false,
  side: 'playing', runout: null, stopTimer: 0, vu: 0, warm: 0, level: 0, levelAvg: 0, fireK: FIRE_REST, drift: 0, driftAmt: 0, lastInput: performance.now(), introT0: 0,
};

const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;

let ctx = null, node = null, drag = null, analyser = null, levelBuf = null, room = null;
// ?og renders just the deck on black, with no interface and no audio: it is how og.png (the share image) is made
const OG = new URLSearchParams(location.search).has('og');
if (OG) document.documentElement.classList.add('og');
let pick = 0;   // bumps each time a record is chosen, so an older, slower cut cannot land on top of a newer choice
const send = (m, transfer) => { if (node) node.port.postMessage(m, transfer || []); };
const status = (msg) => { $('status').textContent = msg; };   // empty when nothing is happening

// ---------- mastering ----------
const condition = () => Object.fromEntries(['noise', 'dust', 'scratches', 'warp', 'offCenter'].map((k) => [k, +$('c-' + k).value]));
function startWorker() {
  const w = new Worker(new URL('./master-worker.js', import.meta.url), { type: 'module' });
  w.onmessage = ({ data: m }) => {
    if (m.t === 'status') status(m.msg + '...');
    else if (m.t === 'error') { idle(); status('Mastering failed: ' + m.msg); console.error(m.msg); }
    else if (m.t === 'done') { if (m.id == null || m.id === pick) gotRecord(m.rec, m.vis); }
  };
  return w;
}
function gotRecord(rec, vis) {
  renderer.setRecord(rec, vis);
  idle();
  if (!S.shown) {            // first record: fade the deck and the disc in together, a frame after it has been drawn
    S.shown = true;
    requestAnimationFrame(() => requestAnimationFrame(() => { document.documentElement.classList.add('ready'); S.introT0 = performance.now(); }));
  }
  S.pending = rec; S.pendingPick = pick;          // gotRecord only ever runs for the current pick
  status(rec.truncated ? 'Programme was too long for one side and was cut short.' : '');
  loadRecord();
}
function loadRecord() {
  if (!S.ready || !S.pending) return;
  const rec = S.pending; S.pending = null;
  // what the track readout maps the needle onto; seq comes back in the telemetry once the audio thread has it,
  // so a packet about the previous record can't be read against this one
  S.rec = { tracks: rec.tracks, thetaLock: rec.thetaLock, pick: S.pendingPick, seq: S.recSeq = (S.recSeq || 0) + 1 };
  send({ t: 'cue', up: true });
  send({ t: 'record', rec, seq: S.rec.seq }, [rec.wallIn.buffer, rec.wallOut.buffer]);
  S.loaded = true;
  if (S.started) play(); else start();
}
const play = () => { sidePlaying(); setMotor(true); setTimeout(() => send({ t: 'cueTo', al: alphaForRadius(R_LEADIN - 0.0012) }), 400); };
// Nothing moves until all three are true: the user powered on, the engine is warm, and a record is in it.
// Then the amplifier's relay closes, its output comes up, and the platter starts.
function start() {
  if (!S.on || !S.ready || !S.loaded || S.started) return;
  S.started = true; $('power').hidden = true; document.documentElement.classList.add('turntable-on');
  relayClick();
  room.out.gain.setTargetAtTime(1, ctx.currentTime + 0.2, 0.18);
  setTimeout(play, 550);
}

// ---------- precompiled record (lathe.mjs): the clean cut ships as DPCM; decode it, press it here, go ----------
const decodeAudio = async (url, fs) => new OfflineAudioContext(2, 1, fs).decodeAudioData(await (await fetch(url)).arrayBuffer());   // for mastering here
// Start every download for a record at once and expose how far the big one is.
function fetchRecord(dir) {
  const h = { dir, got: 0, total: 0 };
  h.man = fetch(dir + 'record.json', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('no precompiled record'); return r.json(); });
  h.audio = h.man.then(async (man) => {
    const r = await fetch(dir + man.walls);
    if (!r.ok) throw new Error('no precompiled record');
    h.total = +r.headers.get('content-length') || 0;
    let buf;
    if (r.body) {
      const reader = r.body.getReader(), chunks = [];
      for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); h.got += value.length; }
      buf = await new Blob(chunks).arrayBuffer();
    } else buf = await r.arrayBuffer();
    return new OfflineAudioContext(2, 1, man.fs).decodeAudioData(buf);
  });
  h.vis = h.man.then((man) => fetch(dir + man.vis.file).then((r) => r.arrayBuffer()));
  for (const k of ['man', 'audio', 'vis']) h[k].catch(() => {});
  return h;
}
// The opening record is already on its way: index.html starts these fetches before any module loads.
function takeBoot(dir) {
  const b = window.__boot;
  if (!b || b.dir !== dir || b.used) return null;
  b.used = true; return b;
}

async function loadPrecompiled(dir = ASSETS, me = pick, pressing = null) {     // dir: assets/ (house record) or assets/<id>/ (a shelf record)
  let h = takeBoot(dir) || fetchRecord(dir), man = await h.man;
  if (man.version !== 2) throw new Error('precompiled record is in an old format');
  if (h === window.__boot && man.walls !== 'record.flac') { h = fetchRecord(dir); man = await h.man; }
  S.load = busy(h);
  const [audio, visData] = await Promise.all([h.audio, h.vis]);
  if (me !== pick) return;                      // another record was chosen meanwhile
  if (audio.length < man.n || audio.sampleRate !== man.fs) throw new Error('precompiled record does not match its manifest');
  const unpack = (q) => {                       // 16-bit DPCM of the wall slope -> wall displacement (m)
    const w = new Float32Array(man.n); let d = 0;
    for (let i = 0; i < 4096; i++) { const x = q[i] * 32768; if (Math.abs(x - Math.round(x)) > 0.01) throw new Error('this browser did not decode the record losslessly'); }
    for (let i = 0; i < man.n; i++) { d += Math.round(q[i] * 32768) * man.gain; w[i] = d; }
    return w;
  };
  const rec = { ...man.rec, rTab: Float64Array.from(man.rTab), wallIn: unpack(audio.getChannelData(0)), wallOut: unpack(audio.getChannelData(1)) };
  // the pressing plant: roughness, dust, scratches and echo are seeded, so they are made here instead of downloaded
  press(rec, pressing?.cond ?? man.press.cond, pressing?.seed ?? man.press.seed);
  S.man = man; S.manDir = dir; S.load = null;
  gotRecord(rec, pressing ? makeVis(rec) : { data: new Uint8Array(visData), cols: man.vis.cols, rows: man.vis.rows });
}
function houseRecord() {                        // "Demo EP" on the shelf: assets/, or synthesised and mastered here
  S.workerHasSource = false;
  return loadPrecompiled().catch((err) => {     // not built (or stale): master it here instead
    console.info((err.message || err) + '; mastering in the browser');
    S.man = null; worker.postMessage({ t: 'demo', fs: 48000, cond: condition() });
  });
}
// Pressing again: a precompiled record is pressed here from the same cut (re-read from the browser cache);
// one mastered in the browser goes back to the worker, which still has the tape.
async function pressAgain() {
  const cond = condition(), seed = 1 + Math.floor(Math.random() * 1e6);
  if (!S.man) return worker.postMessage({ t: 'press', cond, seed });
  const me = ++pick;
  try { await loadPrecompiled(S.manDir, me, { cond, seed }); }
  catch (err) { console.error(err); if (me === pick) { idle(); status('Could not press that record again.'); } }
}

// ---------- audio ----------
// The engine is created (and its JIT warm-up runs) as soon as the page loads. The context just stays
// suspended until the first click, so "power on" is normally instant.
let audioInit = null;
function initAudio() {
  return audioInit ||= (async () => {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule(new URL('./worklet.js', import.meta.url));
    node = new AudioWorkletNode(ctx, 'turntable', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    node.port.onmessage = ({ data: m }) => {
      if (m.t === 'tel') { S.tel = m; S.tRecv = performance.now(); if (m.view) S.view = m.view; S.cue = m.cueUp; }
      else if (m.t === 'ready') {
        S.ready = true; pushParams(); loadRecord(); start();
      } else if (m.t === 'log') console.warn(m.msg);
    };
    room = listeningRoom(); node.connect(room.in); setRoom();
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; node.connect(analyser);
    if (!S.on && ctx.state === 'running') await ctx.suspend();   // some browsers start it unasked; stay silent until power-on
  })().catch((err) => { audioInit = null; ctx = null; node = null; throw err; });
}
const POWER_MSG = matchMedia('(pointer: coarse)').matches ? 'tap to power on' : 'click to power on';
async function powerOn() {
  if (S.on) return;
  S.on = true; $('power').classList.add('busy');      // a spinner until the engine is warm AND the record is in it
  powerMsg();

  // iOS Safari plays Web Audio as "ambient" by default, which the ring/silent switch mutes; this marks it as music
  if ('audioSession' in navigator) navigator.audioSession.type = 'playback';

  try {
    if (ctx) ctx.resume().catch(() => {});            // straight away, inside the gesture: iOS only honours it there
    await initAudio();
    // If the browser did not count this event as a user gesture, resume() never settles. Do not hang on it:
    // give up after a moment and go back to waiting, so the next tap can try again.
    if (ctx.state !== 'running') await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 3000))]);
    if (ctx.state !== 'running') throw new Error('not started');
    start();
  } catch (err) {
    S.on = false; $('power')?.classList.remove('busy');
    if ($('power-msg')) $('power-msg').textContent = err.message === 'not started' ? POWER_MSG : 'audio failed: ' + err.message;
    if (err.message !== 'not started') console.error(err);
  }
}
// ---------- the listening room ----------
// What comes after the preamp: an amplifier that rounds off the peaks a little, a pair of speakers that roll
// off at both ends, and the room they stand in. The Room slider mixes that in; at 0 none of it is in the path.
function listeningRoom() {
  const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filter = (type, f, q, db = 0) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = db; return b; };
  const input = gain(1), out = gain(0), direct = gain(1), speakers = gain(0), air = gain(0);   // out is faded up at power-on
  const amp = ctx.createWaveShaper(), walls = ctx.createConvolver(), curve = new Float32Array(1025);
  const sat = (x) => Math.tanh(0.9 * (x + 0.06)), slope = 0.9 * (1 - sat(0) ** 2);   // slightly lopsided, like a valve; unity gain for small signals
  for (let i = 0; i < curve.length; i++) curve[i] = (sat(i / 512 - 1) - sat(0)) / slope;
  amp.curve = curve;
  walls.normalize = false; walls.buffer = roomResponse();
  const chain = [amp, filter('highpass', 36, 0.7), filter('lowshelf', 140, 0, 1.5), filter('lowpass', 15500, 0.6)];
  chain.reduce((a, b) => (a.connect(b), b), input).connect(speakers);
  chain[chain.length - 1].connect(walls); walls.connect(air);
  input.connect(direct);
  for (const g of [direct, speakers, air]) g.connect(out);
  out.connect(ctx.destination);
  return { in: input, out, direct, speakers, air };
}
// A furnished room's impulse response: a few early reflections, then a short tail that gets duller as it decays.
function roomResponse() {
  const fs = ctx.sampleRate, n = Math.round(0.55 * fs), buf = ctx.createBuffer(2, n, fs), R = rng(2024);
  const early = [[[7.9, 0.5], [13.3, 0.38], [24.1, -0.3], [31.3, 0.22]], [[9.5, 0.5], [15.1, -0.36], [22.7, 0.3], [34.9, 0.2]]];
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0, energy = 0;
    for (const [ms, g] of early[ch]) d[Math.round(ms * 1e-3 * fs)] += g;
    for (let i = Math.round(0.012 * fs); i < n; i++) {
      const t = i / fs;
      lp += onePole(900 + 6000 * Math.exp(-t / 0.12), fs) * (R.gauss() - lp);
      d[i] += 0.35 * lp * Math.exp(-t / 0.085) * Math.min(1, (t - 0.012) / 0.02);
    }
    for (let i = 0; i < n; i++) energy += d[i] * d[i];
    const k = 1 / Math.sqrt(energy);
    for (let i = 0; i < n; i++) d[i] *= k;
  }
  return buf;
}
function setRoom() {
  if (!room) return;
  const a = +$('p-room').value, t = ctx.currentTime;
  room.direct.gain.setTargetAtTime(1 - a, t, 0.03); room.speakers.gain.setTargetAtTime(a, t, 0.03); room.air.gain.setTargetAtTime(0.4 * a, t, 0.03);
}
// The amplifier's output relay closing: two contact ticks a few milliseconds apart.
function relayClick() {
  const fs = ctx.sampleRate, n = Math.round(0.04 * fs), buf = ctx.createBuffer(1, n, fs), d = buf.getChannelData(0), R = rng(5);
  for (const [t0, g] of [[0, 0.11], [0.009, 0.045]]) {
    for (let i = Math.round(t0 * fs); i < n; i++) {
      const t = i / fs - t0;
      d[i] += g * ((R() * 2 - 1) * Math.exp(-t / 0.0012) + 0.5 * Math.sin(TAU * 2300 * t) * Math.exp(-t / 0.004));
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.connect(ctx.destination); src.start();
}

// What the power button says while we wait (the progress bar itself is driven from index.html).
function powerMsg() {
  const el = $('power-msg');
  if (el && S.on && !S.started) el.textContent = $('status').textContent.replace(/\.+$/, '') || (S.loaded ? (S.ready ? 'starting' : 'warming up') : 'loading the record');
}
$('power').addEventListener('click', powerOn);       // the pill; a tap on the scene powers on too (see the pointer handlers)
$('power-msg').textContent = POWER_MSG;
if (!OG) initAudio().catch(() => {});   // best effort before any gesture; the click retries if the browser refused

// ---------- controls ----------
function setMotor(on) {
  S.motor = on; send({ t: 'motor', on }); $('b-start').textContent = on ? 'Stop' : 'Start'; $('b-start').classList.toggle('on', on);
  $('t-play').dataset.state = on ? 'playing' : 'paused'; $('t-play').setAttribute('aria-label', on ? 'Pause' : 'Play');
}
function pushParams() {
  // 100% on the slider is 2 dB under unity: the cartridge lifts the treble by up to 1.9 dB, and bright peaks would clip
  send({ t: 'set', volume: 0.8 * +$('p-volume').value, stylus: $('p-stylus').value, vtf: +$('p-vtf').value, antiskate: +$('p-antiskate').value, hum: +$('p-hum').value });
}
for (const el of document.querySelectorAll('#ctl input[type=range]')) {
  const out = el.parentElement.querySelector('output'), show = () => { out.textContent = el.id === 'p-volume' || el.id === 'p-room' ? Math.round(el.value * 100) + '%' : (+el.value).toFixed(2); };
  el.addEventListener('input', () => { show(); if (el.id === 'p-room') setRoom(); else if (el.id.startsWith('p-')) pushParams(); }); show();
}
$('p-stylus').addEventListener('change', pushParams);
const toggle = (btn, panel, onChange) => $(btn).addEventListener('click', () => {
  const open = $(panel).hidden; $(panel).hidden = !open; $(btn).setAttribute('aria-pressed', String(open)); if (onChange) onChange(open);
});
toggle('t-ctl', 'ctl', (open) => { if (open && !$('shelf').hidden) $('t-records').click(); });      // one panel in that corner at a time
toggle('t-records', 'shelf', (open) => { if (open && !$('ctl').hidden) $('t-ctl').click(); });
// tapping anywhere outside an open panel closes it, and that tap does nothing else (it won't drop the needle
// or grab the record), so the toggles and a tap on the scene both work as open / close; so does Escape
const PANELS = [['ctl', 't-ctl'], ['shelf', 't-records']];
addEventListener('pointerdown', (e) => {
  if (!deckShown()) return;
  let closed = false;
  for (const [panel, btn] of PANELS) if (!$(panel).hidden && !$(panel).contains(e.target) && !$(btn).contains(e.target)) { $(btn).click(); closed = true; }
  if (closed && e.target === canvas) e.stopPropagation();
}, true);
addEventListener('keydown', (e) => { if (e.key === 'Escape') for (const [panel, btn] of PANELS) if (!$(panel).hidden) $(btn).click(); });
$('t-reset').addEventListener('click', () => {      // ease the camera back to where it started
  S.zoomT = 0; S.resetting = true;
  S.az = AZ0 + ((((S.az - AZ0 + Math.PI) % TAU) + TAU) % TAU) - Math.PI;   // unwind full turns first
});
// Start / stop. Once the side has finished and the arm has gone home, starting plays it again from the top.
const toggleMotor = () => { if (!S.motor && S.side === 'ended') play(); else setMotor(!S.motor); };
$('b-start').addEventListener('click', toggleMotor);
// the now-playing pill on other pages: the needle stays down, so the record winds down and back up in pitch

$('t-play').addEventListener('click', toggleMotor);
$('b-cue').addEventListener('click', () => send({ t: 'cue', up: !S.cue }));
$('b-bump').addEventListener('click', () => send({ t: 'bump', s: 1 }));
$('b-press').addEventListener('click', pressAgain);
for (const b of document.querySelectorAll('[data-rpm]')) {
  b.addEventListener('click', () => { document.querySelectorAll('[data-rpm]').forEach((x) => x.classList.toggle('on', x === b)); S.rpm = +b.dataset.rpm; send({ t: 'speed', rpm: S.rpm }); });
}
async function cutFiles(files) {
  const list = [...files].filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|flac|m4a|ogg|aiff?)$/i.test(f.name));
  if (!list.length) return;
  status('Decoding...');
  const tracks = [], transfer = [];
  for (const f of list) {
    try {
      const ab = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(await f.arrayBuffer());
      const L = ab.getChannelData(0).slice(), R = ab.numberOfChannels > 1 ? ab.getChannelData(1).slice() : L.slice();
      tracks.push({ L, R, title: f.name.replace(/\.[^.]+$/, '') }); transfer.push(L.buffer, R.buffer);
    } catch (err) { console.error(err); }
  }
  if (!tracks.length) return status('Could not decode that audio.');
  S.workerHasSource = true; S.man = null; pick++; markRecord(null);
  worker.postMessage({ t: 'tracks', tracks, fs: 48000, cond: condition() }, transfer);
}

// ---------- record shelf: free-to-ship recordings (src/records.js, audio in records/), precompiled into assets/<id>/ ----------
const shelf = $('shelf');
// The Records toggle shows what is on the platter: the record, or while a track plays its title and time.
function nowPlaying(title, time = '', playing = false) {
  if (title === S.nowTitle && time === S.nowTime && playing === S.nowPlaying) return;
  S.nowTitle = title; S.nowTime = time; S.nowPlaying = playing;
  $('now-title').textContent = title; $('now-time').textContent = time;
  $('t-records').classList.toggle('playing', playing);
  $('t-records').title = `Records: ${title}${time ? ' ' + time : ''}`;
}
function markRecord(r) {
  S.shelf = r?.tracks ? r : null;
  S.recTitle = r ? r.title : 'Your audio'; nowPlaying(S.recTitle);
  for (const b of shelf.querySelectorAll('button')) b.setAttribute('aria-current', String(b.dataset.id === r?.id));
  showCover(r);
}

// The label and the now-playing thumbnail show the record's cover once it has loaded;
// until then, and without one, the paper label and no thumbnail.
function showCover(r) {
  const me = pick, thumb = $('now-cover');
  renderer.setArt(null); thumb.hidden = true;

  if (!r?.cover) return;
  const img = new Image();
  img.onload = () => {
    if (me !== pick) return;
    renderer.setArt(img);
    thumb.style.backgroundImage = `url("${r.cover}")`; thumb.hidden = false;
  };

  img.onerror = () => console.warn('could not load the cover art', r.cover);
  img.src = r.cover;
}

async function pickRecord(r) {
  const me = ++pick;
  markRecord(r);
  if (!r.tracks) return houseRecord();
  S.workerHasSource = false;

  try { await loadPrecompiled(`${ASSETS}${r.id}/`, me); }
  catch (err) {                                 // not built (or stale): cut and press it here instead, which takes a while
    console.info(`${r.title}: ${err.message || err}; mastering in the browser`);
    if (me === pick) { S.man = null; master(r, me); }
  }
}
async function master(r, me, seed) {            // the slow way: fetch the audio, then lathe and pressing plant in the worker
  try {
    busy();
    const tracks = [], transfer = [];
    for (const k of r.tracks) {
      status(`Fetching ${k.title}...`);
      const ab = await decodeAudio(new URL('../records/' + k.file, import.meta.url), 48000);
      if (me !== pick) return;
      const L = ab.getChannelData(0).slice(), R = ab.numberOfChannels > 1 ? ab.getChannelData(1).slice() : L.slice();
      tracks.push({ L, R, title: k.title }); transfer.push(L.buffer, R.buffer);
    }
    S.workerHasSource = true;
    worker.postMessage({ t: 'tracks', id: me, tracks, fs: 48000, opts: r.cut, cond: condition(), seed }, transfer);
  } catch (err) { console.error(err); if (me === pick) { idle(); status(`Could not load ${r.title}.`); } }
}
for (const r of RECORDS) {
  const b = document.createElement('button');
  b.dataset.id = r.id;
  b.append(Object.assign(document.createElement('b'), { textContent: r.title }), Object.assign(document.createElement('span'), { textContent: r.by }));
  b.addEventListener('click', () => { pickRecord(r); b.blur(); });
  shelf.append(b);
}
pickRecord(RECORDS.find((r) => r.id === (window.__boot?.id || 'rhapsody')) || RECORDS[0]);   // the record on the platter when the page opens
$('f-audio').addEventListener('change', (e) => cutFiles(e.target.files));

addEventListener('dragover', (e) => { if (deckShown()) e.preventDefault(); });

addEventListener('drop', (e) => { if (!deckShown()) return; e.preventDefault(); cutFiles(e.dataTransfer.files); });
addEventListener('keydown', (e) => {
  if (!deckShown()) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  noteInput();
  if (e.code === 'Space') { e.preventDefault(); toggleMotor(); }
  else if (e.key === 'c') send({ t: 'cue', up: !S.cue });
  else if (e.key === 'b') send({ t: 'bump', s: 1 });
  else if (e.key === 'z') S.zoomT = S.zoomT > 0.5 ? 0 : 0.92;
});

// ---------- pointer: grab the headshell, spin the record, or click to drop the needle ----------
const armAngle = (p) => { const a = Math.atan2(p[1] - PIVOT_Y, p[0] - PIVOT_X); return a < 0 ? a + TAU : a; };
const curAl = () => (S.tel ? S.tel.al : ALPHA_REST);
const touches = new Map();   // active pointers, for two-finger pinch zoom

// Any input stops the idle drift; the view stays where the drift had taken it.
function noteInput() {
  S.az += S.drift; S.drift = 0; S.driftAmt = 0; S.lastInput = performance.now();
}

canvas.addEventListener('pointerdown', (e) => {
  noteInput();

  try { canvas.setPointerCapture(e.pointerId); } catch {}
  touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size === 2) {                     // a second finger: stop what the first was doing and pinch
    if (drag) drag.tap = false;
    release();
    const [a, b] = [...touches.values()];
    drag = { type: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: S.zoomT };
    return;
  }
  const pa = renderer.pick(e.clientX, e.clientY, 0.018), p = renderer.pick(e.clientX, e.clientY, 0);
  // until it is powered on the scene can only be looked around; a tap that doesn't drag powers it on
  const plain = S.started && S.ready && e.button === 0 && !e.shiftKey && !e.altKey;
  if (plain && pa && renderer.armDistance(pa, curAl()) < (e.pointerType === 'touch' ? 0.03 : 0.011)) {
    drag = { type: 'arm', off: curAl() - armAngle(pa) };
    send({ t: 'hand', on: true, al: curAl() });
  } else if (plain && p && Math.hypot(p[0], p[1]) < R_DISC) {
    drag = { type: 'platter', ang: Math.atan2(p[1], p[0]), moved: 0, t0: performance.now(), p };
    send({ t: 'platter', on: true });
  } else drag = { type: 'orbit', x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, tap: !S.on && e.button === 0 };   // anywhere else: turn the camera
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);

  if (!drag) return;
  if (drag.type === 'pinch') {
    const [a, b] = [...touches.values()];
    if (b) S.zoomT = Math.max(-0.8, Math.min(0.985, drag.z0 + 0.6 * Math.log(Math.hypot(a[0] - b[0], a[1] - b[1]) / drag.d0)));
  } else if (drag.type === 'orbit') {
    S.az -= (e.clientX - drag.x) * 0.006; S.el = Math.max(0.02, Math.min(1.55, S.el + (e.clientY - drag.y) * 0.006)); S.resetting = false;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.tap = false;
  } else if (drag.type === 'arm') {
    const pa = renderer.pick(e.clientX, e.clientY, 0.018);
    if (pa) send({ t: 'hand', on: true, al: armAngle(pa) + drag.off });
  } else {
    const p = renderer.pick(e.clientX, e.clientY, 0); if (!p) return;
    const a = Math.atan2(p[1], p[0]);
    let d = a - drag.ang; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
    drag.ang = a; drag.moved += Math.abs(d) * Math.hypot(p[0], p[1]);
    send({ t: 'platterMove', d: -d });            // platter angle is clockwise-positive
  }
});
const release = () => {
  if (!drag) return;
  if (drag.type === 'arm') send({ t: 'hand', on: false });
  else if (drag.type === 'orbit' && drag.tap) S.tapped = performance.now();   // powers on in the click / touchend that follows
  else if (drag.type === 'platter') {
    send({ t: 'platter', on: false });
    const r = Math.hypot(drag.p[0], drag.p[1]);
    if (drag.moved < 0.003 && performance.now() - drag.t0 < 400 && r > R_LABEL + 0.002) send({ t: 'cueTo', al: alphaForRadius(r) });
  }
  drag = null; canvas.style.cursor = 'grab';
};
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, (e) => { touches.delete(e.pointerId); release(); });
// A tap on the scene powers on. It has to happen in `touchend` or `click`: iOS Safari does not accept
// `pointerup` as a gesture that may start audio, and the context would stay suspended forever.
for (const type of ['touchend', 'click']) canvas.addEventListener(type, () => {
  if (!S.on && S.tapped && performance.now() - S.tapped < 800 && document.documentElement.classList.contains('ready')) { S.tapped = 0; powerOn(); }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('wheel', (e) => { e.preventDefault(); noteInput(); S.zoomT = Math.max(-0.8, Math.min(0.985, S.zoomT - e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); }, { passive: false });

// ---------- now playing ----------
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function drawStats() {
  const t = S.tel; if (!t) return;
  const down = t.hc < 40e-6;
  // in a track: its title and time, bars moving while the record turns; anywhere else: the record's name
  // only while the platter holds the record that was picked last: switching shows the new name straight away,
  // and never a track of the previous record while the new one loads
  // (a new record is put on with the needle lifted: until it has been up once, it is still settling on the old radius)
  const rec = S.rec && S.rec.pick === pick && t.recSeq === S.rec.seq && (S.rec.lifted ||= !down) ? S.rec : null;
  endOfSide(t, rec, down);
  const k = rec && down && t.xg === t.xg ? rec.tracks.find((k) => t.theta >= k.theta0 && t.theta < k.theta1) : null;
  if (k) nowPlaying(k.title, `${fmt((t.theta - k.theta0) / W33)} / ${fmt((k.theta1 - k.theta0) / W33)}`, Math.abs(t.wp) * 60 / TAU > 5);
  else if (!rec) nowPlaying(S.recTitle || 'Records');
  else nowPlaying(S.recTitle || 'Records', !down ? '' : t.xg !== t.xg ? 'off the groove'
    : t.theta >= S.rec.thetaLock ? 'run-out' : t.theta > S.rec.tracks[S.rec.tracks.length - 1].theta1 ? 'lead-out' : t.theta < S.rec.tracks[0].theta0 ? 'lead-in' : 'between tracks');
}

// The end of the side: after ten turns in the run-out groove the arm lifts and goes home, then the platter stops.
// S.side is 'playing', then 'lifting' until the needle has left the record, then 'ended' until one is put down again.
const RUNOUT_TURNS = 10;
function endOfSide(t, rec, down) {
  if (S.side === 'lifting') { if (!down) S.side = 'ended'; return; }
  if (S.side === 'ended' && down) sidePlaying();
  if (!rec || !down || !S.motor || !(t.theta >= rec.thetaLock)) { S.runout = null; return; }
  S.runout ??= t.thp;
  if (t.thp - S.runout < RUNOUT_TURNS * TAU) return;
  S.runout = null; S.side = 'lifting';
  send({ t: 'cueTo', al: ALPHA_REST });
  S.stopTimer = setTimeout(() => setMotor(false), 3500);
}
function sidePlaying() { S.side = 'playing'; clearTimeout(S.stopTimer); }

// ---------- frame loop ----------
let frame = 0;
// One failing part must never stop the frame loop: that froze the picture while the sound carried on.
// The first error is shown in the status line so it can be read off a phone.
const seen = new Set();
function guard(name, fn) {
  try { fn(); } catch (err) {
    if (seen.has(name)) return;
    seen.add(name); console.error(name, err); status(`${name} error: ${(err && err.message) || err}`);
  }
}
addEventListener('error', (e) => { if (!seen.size) { seen.add('page'); status(`error: ${e.message}`); } });
function tick() {
  requestAnimationFrame(tick);      // first, so nothing below can end the loop
  const t = S.tel, dt = t ? Math.min(0.1, (performance.now() - S.tRecv) / 1000) : 0;
  S.zoom += (S.zoomT - S.zoom) * 0.12;
  if (frame % 6 === 0 && S.on && !S.started) powerMsg();
  if (S.resetting) {
    S.az += (AZ0 - S.az) * 0.12; S.el += (EL0 - S.el) * 0.12;
    if (Math.abs(S.az - AZ0) < 1e-3 && Math.abs(S.el - EL0) < 1e-3) { S.az = AZ0; S.el = EL0; S.resetting = false; }
  }
  const moved = Math.abs(S.zoomT) > 0.01 || Math.abs(S.az - AZ0) > 0.01 || Math.abs(S.el - EL0) > 0.01;
  if (moved !== S.moved) { S.moved = moved; $('t-reset').hidden = !moved; }

  if (deckShown()) guard('render', () => {
    if (OG) renderer.draw({ thp: 2.2, al: alphaForRadius(0.108), zt: 0, zoom: 0, az: -0.5, el: 0.6, motor: true, rpm: 33.3333, bare: true, dist: 1.1, at: [0.021, -0.07, -0.093], vu: 0, warm: 1, fire: [...FIRE, 1], grain: 0, ...window.__og });   // deck high in the frame: X overlays the bottom
    else {
      const now = performance.now(), cam = cameraMotion(now);
      animate();
      renderer.draw({
        thp: t ? t.thp + t.wp * dt : 0, al: t ? t.al : ALPHA_REST, zt: t ? t.zb + t.ze : 5e-3, ze: t ? t.ze : 0, xi: t ? t.xi : 0,
        motor: S.motor, rpm: S.rpm, zoom: S.zoom + cam.zoom, az: S.az + cam.az, el: Math.min(1.55, S.el + cam.el),
        vu: S.vu, warm: S.warm, fire: firelight(), grain: STILL ? 0 : Math.floor(now / 42),   // grain changes 24 times a second
      });
    }
  });

  if (deckShown() && !OG) guard('links', printLinks);
  frame++;
  if (frame % 6 === 0) guard('readout', drawStats);
  guard('loader', drawLoader);
}

// The camera's own motion on top of where the visitor put it: a slow pull-in when the deck first appears, and
// a gentle sway after a while without input. Neither counts as moving the view (no Reset view).
function cameraMotion(now) {
  if (STILL) return { az: 0, el: 0, zoom: 0 };
  const intro = S.introT0 ? (1 - Math.min(1, (now - S.introT0) / 2600)) ** 3 : 1;
  const idle = !drag && !S.resetting && now - S.lastInput > 7000;
  S.driftAmt += ((idle ? 1 : 0) - S.driftAmt) * 0.01;
  S.drift = S.driftAmt * 0.12 * Math.sin(now / 1000 * TAU / 36);

  return { az: S.drift + 0.35 * intro, el: 0.22 * intro, zoom: -0.55 * intro };
}

// How loud the record is right now (RMS of the output).
function readLevel() {
  if (!analyser || !S.started) return 0;
  levelBuf ||= new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(levelBuf);
  let sum = 0;

  for (const v of levelBuf) sum += v * v;

  return Math.sqrt(sum / levelBuf.length);
}

// VU ballistics (about 300 ms), the level the fire follows, and the lamps coming on after power-on.
function animate() {
  const rms = readLevel(), db = 20 * Math.log10(rms + 1e-9);
  S.vu += (Math.min(1, Math.max(0, (db + 45) / 33)) - S.vu) * 0.16;   // -45 dB at rest, -12 dB pinned
  S.level += (rms - S.level) * (rms > S.level ? 0.6 : 0.12);          // jumps with a hit, falls back in about 150 ms
  S.levelAvg += (rms - S.levelAvg) * 0.008;                           // how loud the song has been over the last two seconds
  S.warm += ((S.started ? 1 : 0) - S.warm) * (STILL ? 1 : 0.04);
}

// The fire burns in time with the record: it flares when the music jumps above its recent average and sinks
// back between hits, so it follows the beat at any volume. With no music it glows steadily, and the flames
// lean with the level, which moves the shadows a little. Steady for visitors who asked for less motion.
function firelight() {
  if (STILL) return [...FIRE, 1];
  const playing = S.levelAvg > 1e-4, hit = playing ? Math.min(2.2, S.level / S.levelAvg) : 1;
  const to = playing ? 0.62 + 0.4 * hit : FIRE_REST;
  S.fireK += (to - S.fireK) * 0.35;
  const lean = S.fireK - FIRE_REST, d = [FIRE[0], FIRE[1] + 0.06 * lean, FIRE[2] + 0.05 * lean], l = Math.hypot(...d);
  return [d[0] / l, d[1] / l, d[2] / l, S.fireK];
}

// ---------- site links printed on the deck ----------
// The nav and social links stay real links, but are projected onto the top plate so they look printed on it
// and follow the camera. When they would be too small or off screen (phones, zoomed in or out) they go back
// to the corners of the page.

const LINK_M_PER_PX = 0.00042;     // metres of plate per CSS pixel of link text
const LINK_MIN_SCALE = 0.25;       // smallest on-screen size, as a fraction of the links' own size

const PRINTS = [
  { el: $('deck-nav'), x: -0.180, y: 0.171, align: 'left' },     // back-left corner, beside the platter
  { el: $('credit'), x: 0.226, y: -0.120, align: 'right' },      // right side, between the platter and the pitch slider
];

const clipOf = (vp, x, y, z, w) => [0, 1, 2, 3].map((i) => vp[i] * x + vp[4 + i] * y + vp[8 + i] * z + vp[12 + i] * w);

function linkSize(p) {
  if (p.size?.w) return p.size;
  const root = document.documentElement, had = root.classList.contains('on-deck');
  root.classList.add('on-deck'); p.el.style.transform = '';
  p.size = { w: p.el.offsetWidth, h: p.el.offsetHeight };

  if (!had) root.classList.remove('on-deck');

  return p.size;
}

// The CSS matrix3d that maps the element's own pixels onto the plate, or null when it should not be printed.
function plateMatrix(p, vp, W, H) {
  const { w, h } = linkSize(p), s = LINK_M_PER_PX;
  const A = clipOf(vp, s, 0, 0, 0), B = clipOf(vp, 0, -s, 0, 0);          // element +x = world +x, element +y = toward the viewer
  const C = clipOf(vp, p.align === 'right' ? p.x - w * s : p.x, p.y, DECK_Z, 1);

  const screen = (x, y) => {
    const c = [0, 1, 3].map((i) => x * A[i] + y * B[i] + C[i]);

    return c[2] > 1e-6 ? [(c[0] / c[2] + 1) / 2 * W, (1 - c[1] / c[2]) / 2 * H] : null;
  };

  const corners = [screen(0, 0), screen(w, 0), screen(0, h), screen(w, h)];

  if (corners.some((q) => !q || q[0] < 0 || q[0] > W || q[1] < 0 || q[1] > H)) return null;
  const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

  if (Math.min(len(corners[0], corners[1]) / w, len(corners[0], corners[2]) / h) < LINK_MIN_SCALE) return null;
  const col = (v) => [(v[0] + v[3]) * W / 2, (v[3] - v[1]) * H / 2, 0, v[3]].map((k) => k / C[3]);

  return `matrix3d(${[...col(A), ...col(B), 0, 0, 1, 0, ...col(C)].join(',')})`;
}

function printLinks() {
  const cam = renderer.cam, root = document.documentElement;
  const ms = cam && root.classList.contains('ready') ? PRINTS.map((p) => plateMatrix(p, cam.vp, innerWidth, innerHeight)) : [];
  const onDeck = ms.length > 0 && ms.every(Boolean);
  root.classList.toggle('on-deck', onDeck);
  PRINTS.forEach((p, i) => { p.el.style.transform = onDeck ? ms[i] : ''; });
}

// The progress bar shows window.__load: a download with got / total, or just "busy" when the size is unknown.
// It only appears when a load takes more than 300 ms.
function drawLoader() {
  const h = window.__load, root = document.documentElement;

  if (!h || h.done) return root.classList.remove('loading');
  const now = performance.now();

  if (!h.t0) h.t0 = now;

  if (now - h.t0 > 300) root.classList.add('loading');
  const frac = h.total > 0 ? Math.min(1, h.got / h.total) : 0, moving = frac > 0 && frac < 1;
  $('loader').classList.toggle('wait', !moving);
  $('loader-fill').style.width = (frac * 100) + '%';
  $('loader-pct').textContent = moving ? Math.round(frac * 100) + '%' : '';
}
tick();
window.__rp = { S, get ctx() { return ctx; }, send, renderer, stylusXY };   // debugging handle
