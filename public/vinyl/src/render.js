// WebGL2 scene: a dark direct-drive style deck, the disc (drawn from the cut geometry) and the tonearm.
// World = physics world: origin at the spindle, +x right, +y away from the viewer, +z up, metres.
import * as G from './gl-util.js';
import { STD_VS, STD_FS, REC_VS, REC_FS, DEPTH_FS, POST_VS, BRIGHT_FS, BLUR_FS, FINAL_FS, KEY } from './shaders.js';
import { TAU } from './dsp.js';
import { drawLabel } from './label.js';
import {
  ARM_LE, ARM_BETA, PIVOT_X, PIVOT_Y, ALPHA_REST, R_DISC, R_LOCK, R_LEADIN, GROOVE_W, thetaForRadius, stylusXY,
} from './geometry.js';

const PIVOT_H = 0.030, DECK_Z = -0.022, FLOOR_Z = -0.080, FOV = 30 * Math.PI / 180, SHADOW = 2048;
const CB = Math.cos(ARM_BETA), SB = Math.sin(ARM_BETA), lerp = (a, b, t) => a + (b - a) * t;
// arm tube: a J-shaped bend from the pivot to the headshell collar, in the arm frame (+x = pivot -> stylus)
const P3 = [ARM_LE - 0.040 * CB, 0.040 * SB, -0.0125];
const TUBE = G.bezier([0, 0, 0], [0.075 * Math.cos(0.28), 0.075 * Math.sin(0.28), -0.003], [P3[0] - 0.075 * CB, P3[1] + 0.075 * SB, -0.0085], P3, 32);
const REST_PT = TUBE[20];
const STROBE = [-0.158, -0.160], LAMP = [STROBE[0] + 0.7026 * 0.024, STROBE[1] + 0.7115 * 0.024, -0.013];

// VU meter window on the plate, front right (x0, y0, x1, y1); the needle pivots just inside its front edge
const VU = [0.140, -0.184, 0.228, -0.152], VU_PIVOT = [(VU[0] + VU[2]) / 2, VU[1] + 0.004], VU_SWING = 0.85;

const BLACK = [0.012, 0.012, 0.013], CHROME = [0.62, 0.63, 0.66], AMBER = [1.0, 0.55, 0.12];
// the stylus cantilever hinges in the cartridge here (headshell frame) and reaches CANT_L forward to the tip
const CANT = [-0.0045, 0, -0.0270], CANT_L = 0.0045;
const BLOOM = 1.6, GRAIN = 0.022;

export { DECK_Z };

export class Renderer {
  constructor(canvas) {
    const gl = this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false });   // the scene is antialiased in its own buffer (see target)
    if (!gl) throw new Error('WebGL2 is required');
    this.canvas = canvas;
    this.std = G.program(gl, STD_VS, STD_FS); this.rec = G.program(gl, REC_VS, REC_FS); this.dep = G.program(gl, STD_VS, DEPTH_FS);
    this.bright = G.program(gl, POST_VS, BRIGHT_FS); this.blur = G.program(gl, POST_VS, BLUR_FS); this.final = G.program(gl, POST_VS, FINAL_FS);
    const m = (d) => G.mesh(gl, d), L = G.lathe, at = (d, x, y, z = 0) => [d, [x, y, z]];
    const foot = L([[0, FLOOR_Z], [0.026, FLOOR_Z], [0.028, FLOOR_Z + 0.002], [0.028, -0.066], [0.024, -0.062], [0, -0.062]], 32);
    const led = L([[0.0016, 0], [0.0016, 0.0006], [0, 0.0006]], 12);
    const [rx, ry] = [PIVOT_X + REST_PT[0] * Math.cos(ALPHA_REST) - REST_PT[1] * Math.sin(ALPHA_REST), PIVOT_Y + REST_PT[0] * Math.sin(ALPHA_REST) + REST_PT[1] * Math.cos(ALPHA_REST)];
    const restZ = PIVOT_H + REST_PT[2] + 0.005 * REST_PT[0] / ARM_LE - 0.0042;
    this.m = {
      floor: m(G.box(-60, -60, FLOOR_Z - 0.02, 60, 60, FLOOR_Z)),
      feet: m(G.merge(at(foot, -0.150, -0.155), at(foot, 0.235, -0.155), at(foot, -0.150, 0.155), at(foot, 0.235, 0.155))),
      body: m(G.rbox(-0.185, -0.19, 0.27, 0.19, -0.062, -0.030, 0.014, 0.002)),
      plate: m(G.rbox(-0.183, -0.188, 0.268, 0.188, -0.030, DECK_Z, 0.012, 0.0018)),
      platter: m(L([[0, -0.0215], [0.164, -0.0215], [0.1645, -0.0205], [0.1645, -0.0072], [0.1625, -0.0045], [0.1535, -0.0036], [0.1535, -0.0025], [0, -0.0025]], 160)),
      mat: m(L([[0.1495, -0.0025], [0.1495, -0.0013], [0, -0.0013]], 96)),
      spindle: m(L([[0.0036, -0.003], [0.0036, 0.009], [0.003, 0.0108], [0.0015, 0.0115], [0, 0.0115]], 24)),
      edge: m(G.cyl(R_DISC, R_DISC, -0.0013, 0, 128, false)), disc: m(G.annulus(0.0036, R_DISC, 56, 192)),
      strobe: m(G.merge(at(L([[0.019, DECK_Z], [0.019, -0.006], [0.0175, -0.0045], [0, -0.0045]], 32), STROBE[0], STROBE[1]))),
      lens: m(G.box(-0.0015, -0.006, -0.018, 0.0015, 0.006, -0.008)),
      buttons: m(G.merge(G.rbox(-0.139, -0.184, -0.097, -0.158, DECK_Z, DECK_Z + 0.004, 0.003, 0.0008),
        G.rbox(-0.088, -0.186, -0.066, -0.174, DECK_Z, DECK_Z + 0.003, 0.002, 0.0006), G.rbox(-0.060, -0.186, -0.038, -0.174, DECK_Z, DECK_Z + 0.003, 0.002, 0.0006),
        G.rbox(0.2335, -0.118, 0.2545, -0.102, DECK_Z, DECK_Z + 0.009, 0.002, 0.001),
        G.rbox(-0.125, 0.172, -0.085, 0.1885, DECK_Z, DECK_Z + 0.011, 0.002, 0.001), G.rbox(0.130, 0.172, 0.170, 0.1885, DECK_Z, DECK_Z + 0.011, 0.002, 0.001))),
      slot: m(G.rbox(0.2385, -0.170, 0.2495, -0.050, DECK_Z, DECK_Z + 0.0005, 0.002, 0.0002)),
      ledStart: m(G.merge(at(led, -0.132, -0.1635, DECK_Z + 0.004))), led33: m(G.merge(at(led, -0.084, -0.180, DECK_Z + 0.003))),
      led45: m(G.merge(at(led, -0.056, -0.180, DECK_Z + 0.003))), ledPitch: m(G.merge(at(led, 0.229, -0.110, DECK_Z))),
      tower: m(G.merge(at(L([[0.034, DECK_Z], [0.034, -0.0195], [0.031, -0.018], [0.021, -0.018], [0.021, 0.008], [0.0185, 0.010], [0.0185, 0.045], [0.017, 0.0465], [0, 0.0465]], 48), PIVOT_X, PIVOT_Y),
        at(L([[0.0095, DECK_Z], [0.0095, -0.012], [0.0085, -0.011], [0, -0.011]], 24), PIVOT_X + 0.047, PIVOT_Y + 0.012),
        at(L([[0.006, DECK_Z], [0.006, -0.015], [0, -0.015]], 20), PIVOT_X + 0.042, PIVOT_Y - 0.046),
        at(L([[0.0035, DECK_Z], [0.0035, restZ - 0.003], [0.007, restZ - 0.003], [0.007, restZ], [0, restZ]], 20), rx, ry))),
      towerCap: m(G.merge(at(L([[0.012, 0.0466], [0.012, 0.0476], [0, 0.0476]], 32), PIVOT_X, PIVOT_Y),
        G.tube([[PIVOT_X + 0.042, PIVOT_Y - 0.046, -0.016], [PIVOT_X + 0.056, PIVOT_Y - 0.058, -0.004]], 0.0017, 10))),
      // arm frame
      tube: m(G.merge(G.tube(TUBE, 0.0042, 20), G.cylX(0.0050, -0.054, 0.002))),
      weight: m(G.alongX(L([[0, -0.094], [0.0160, -0.094], [0.0172, -0.0925], [0.0172, -0.062], [0.0160, -0.0605], [0, -0.0605]], 40))),
      dial: m(G.alongX(L([[0.0135, -0.0605], [0.0135, -0.054], [0.0125, -0.053], [0, -0.053]], 40))),
      // headshell frame (+x = direction of groove travel, stylus tip at z = -PIVOT_H)
      collar: m(G.merge(at(G.alongX(L([[0.0042, -0.047], [0.0060, -0.047], [0.0060, -0.036], [0.0042, -0.036]], 24)), 0, 0, -0.0125),
        at(G.cyl(0.0014, 0.0014, -0.0122, -0.0116, 10), -0.012, 0.0045), at(G.cyl(0.0014, 0.0014, -0.0122, -0.0116, 10), -0.012, -0.0045),
        at(G.cyl(0.0007, 0.0007, -0.0274, -0.0266, 10), CANT[0], 0))),
      cantilever: m(G.merge(G.tube([CANT, [-0.0002, 0, -0.0296]], 0.00021, 8), G.cyl(0.00002, 0.00027, -0.0300, -0.0295, 8))),
      shell: m(G.merge(G.rbox(-0.037, -0.0095, 0.012, 0.0095, -0.0142, -0.0122, 0.003, 0.0005),
        G.tube([[-0.002, 0.0090, -0.0132], [0.000, 0.022, -0.0130], [0.002, 0.032, -0.0108], [0.003, 0.036, -0.006]], 0.0013, 10),
        G.rbox(-0.0225, -0.0068, 0.0035, 0.0068, -0.0246, -0.0142, 0.0016, 0.0002))),
      holder: m(G.box(-0.0075, -0.0052, -0.0272, 0.0050, 0.0052, -0.0246)),
      vuBezel: m(G.rbox(VU[0], VU[1], VU[2], VU[3], DECK_Z, DECK_Z + 0.0028, 0.003, 0.0006)),
      vuFace: m(G.box(VU[0] + 0.003, VU[1] + 0.003, DECK_Z + 0.0024, VU[2] - 0.003, VU[3] - 0.003, DECK_Z + 0.0031)),
      needle: m(G.merge(G.box(-0.00022, 0, 0, 0.00022, 0.0212, 0.0003), G.cyl(0.0011, 0.0011, 0, 0.0006, 16))),
    };
    this.tex = { lut: gl.createTexture(), vis: gl.createTexture(), label: gl.createTexture(), shadow: gl.createTexture() };
    gl.bindTexture(gl.TEXTURE_2D, this.tex.shadow);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW, SHADOW, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE], [gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.tex.shadow, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const c = [0.04, 0, -0.02], eye = c.map((v, i) => v + KEY[i]);
    this.lvp = G.mul(G.ortho(-0.46, 0.46, -0.46, 0.46, 0.3, 1.7), G.lookAt(eye, c).m);
    this.info = null; this.cam = null;
    this.setLabel(['']);
    gl.enable(gl.DEPTH_TEST);
  }

  // art: the record's cover image, or null for the printed paper label
  setArt(art) { this.art = art; this.setLabel(this.titles); }

  // Where the scene is drawn before the post pass: a multisampled buffer, the texture it resolves to,
  // and two quarter-size textures for the bloom. Remade when the canvas changes size.
  target(w, h) {
    const gl = this.gl, old = this.rt;
    if (old && old.w === w && old.h === h) return old;
    if (old) {
      for (const f of [old.scene, old.flat, ...old.bloom.map((b) => b.fbo)]) gl.deleteFramebuffer(f);
      for (const r of [old.color, old.depth]) gl.deleteRenderbuffer(r);
      for (const t of [old.tex, ...old.bloom.map((b) => b.tex)]) gl.deleteTexture(t);
    }
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    const buffer = (format, attach) => {
      const r = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, r); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, format, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attach, gl.RENDERBUFFER, r);
      return r;
    };
    const texture = (tw, th) => {
      const t = gl.createTexture(), fbo = gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { tex: t, fbo, w: tw, h: th };
    };
    const scene = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene);
    const color = buffer(gl.RGBA8, gl.COLOR_ATTACHMENT0), depth = buffer(gl.DEPTH_COMPONENT24, gl.DEPTH_ATTACHMENT);
    const flat = texture(w, h), bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
    this.rt = { w, h, scene, color, depth, flat: flat.fbo, tex: flat.tex, bloom: [texture(bw, bh), texture(bw, bh)] };
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.rt;
  }

  setLabel(titles) {
    this.titles = titles;
    const c = drawLabel(titles, this.art);       // the artwork is in label.js
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex.label);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  }

  // rec: record metadata (rTab, thetaEnd, warp, ecc, scratches, condition, tracks); vis: { data, cols, rows }
  setRecord(rec, vis) {
    const gl = this.gl, lut = new Float32Array(2048), rLo = R_LOCK - 0.002, rHi = R_LEADIN + 0.002;
    for (let i = 0; i < 2048; i++) lut[i] = thetaForRadius(rec.rTab, rLo + (rHi - rLo) * i / 2047) / TAU;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.lut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 2048, 1, 0, gl.RED, gl.FLOAT, lut);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.vis);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, vis.cols, vis.rows, 0, gl.RED, gl.UNSIGNED_BYTE, vis.data);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const warp = new Float32Array(9), scr = new Float32Array(48);
    (rec.warp || []).slice(0, 3).forEach((w, i) => warp.set([w.k, w.amp, w.ph], i * 3));
    (rec.scratches || []).slice(0, 12).forEach((s, i) => scr.set([s.r0, s.r1, s.phi0, s.phi1], i * 4));
    this.info = { rLo, rHi, rows: vis.rows, revEnd: rec.thetaEnd / TAU, warp, scr, nScr: Math.min(12, (rec.scratches || []).length), dust: rec.condition?.dust ?? 0, ecc: rec.ecc || [0, 0] };
    this.setLabel(rec.tracks.map((t) => t.title || 'Untitled'));
  }

  // orbit camera: st.az (around the deck), st.el (elevation), st.zoom (0 = whole deck, 1 = at the stylus, < 0 = further away)
  camera(st) {
    const c = this.canvas, asp = c.width / c.height, z = st.zoom, zi = Math.max(0, z), [sx, sy] = stylusXY(st.al);
    const at = st.at || [lerp(0.042, sx, zi), lerp(0, sy, zi), lerp(-0.015, 0, zi)], base = Math.max(0.95, 0.95 * 1.5 / asp);
    const dist = st.dist || (z >= 0 ? lerp(base, 0.06, z) : base * Math.exp(-0.9 * z)), ce = Math.cos(st.el);   // z < 0 pulls back
    const eye = [at[0] + dist * ce * Math.sin(st.az), at[1] - dist * ce * Math.cos(st.az), at[2] + dist * Math.sin(st.el)];
    const v = G.lookAt(eye, at);
    this.cam = { eye, asp, ...v, vp: G.mul(G.perspective(FOV, asp, lerp(0.05, 0.004, zi), 150), v.m) };
    return this.cam;
  }

  // world (x, y) on the horizontal plane at height z under a pointer position
  pick(clientX, clientY, z = 0) {
    const cam = this.cam; if (!cam) return null;
    const b = this.canvas.getBoundingClientRect(), t = Math.tan(FOV / 2);
    const nx = ((clientX - b.left) / b.width * 2 - 1) * t * cam.asp, ny = (1 - (clientY - b.top) / b.height * 2) * t;
    const d = [0, 1, 2].map((i) => cam.fwd[i] + nx * cam.right[i] + ny * cam.up[i]);
    if (d[2] >= -1e-6) return null;
    const k = (z - cam.eye[2]) / d[2];
    return [cam.eye[0] + k * d[0], cam.eye[1] + k * d[1]];
  }

  // distance (m) from a point on the arm's plane to the tonearm (tube or headshell), for grabbing it
  armDistance(p, al) {
    const ca = Math.cos(al), sa = Math.sin(al), [sx, sy] = stylusXY(al);
    let best = Math.hypot(p[0] - sx, p[1] - sy) - 0.02;
    for (let i = 8; i < TUBE.length; i++) {
      const x = PIVOT_X + TUBE[i][0] * ca - TUBE[i][1] * sa, y = PIVOT_Y + TUBE[i][0] * sa + TUBE[i][1] * ca;
      best = Math.min(best, Math.hypot(p[0] - x, p[1] - y));
    }
    return best;
  }

  // st: { thp, al, zt (stylus height above the disc), ze + xi (how far the tip is pushed up / sideways in the cartridge),
  //       zoom, az, el, motor, rpm, vu (0..1), warm (0..1, the lamps coming on),
  //       fire ([x, y, z, brightness]), grain (seed, changes when the grain should), bare }
  draw(st) {
    const gl = this.gl, c = this.canvas, m = this.m, I = G.ident(), info = this.info, ecc = info ? info.ecc : [0, 0];
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const cam = this.camera(st), rt = this.target(w, h);
    const spin = G.Rz(-st.thp), discM = G.chain(spin, G.T(ecc[0], ecc[1], 0));
    // the arm carries the cartridge body; the tip rides ze higher than that, bending the cantilever up
    const ze = st.ze || 0, arm = G.chain(G.T(PIVOT_X, PIVOT_Y, PIVOT_H), G.Rz(st.al), G.Ry(-Math.asin(Math.max(-0.2, Math.min(0.2, (st.zt - ze) / ARM_LE)))));
    const head = G.chain(arm, G.T(ARM_LE, 0, 0), G.Rz(-ARM_BETA));
    const bend = (v) => Math.max(-0.25, Math.min(0.25, v / CANT_L));
    const cant = G.chain(head, G.T(...CANT), G.Ry(-bend(ze)), G.Rz(bend(st.xi || 0)), G.T(-CANT[0], -CANT[1], -CANT[2]));
    const lit = st.warm;
    const lensM = G.chain(G.T(STROBE[0] + 0.7026 * 0.0185, STROBE[1] + 0.7115 * 0.0185, 0), G.Rz(0.7917));
    const on = st.motor ? 1 : 0, r33 = st.rpm < 40 || st.rpm > 70, r45 = st.rpm > 40, off = [0, 0, 0];
    const glow = (k, col = AMBER) => col.map((v) => v * 2.2 * k);
    const needleM = G.chain(G.T(VU_PIVOT[0], VU_PIVOT[1], DECK_Z + 0.0032), G.Rz(VU_SWING - 2 * VU_SWING * (st.vu || 0)));
    // [mesh, model, albedo, roughness, metalness, mode, emissive]
    const items = [
      [m.floor, I, [0.007, 0.0068, 0.0066], 0.5, 0, 5, off], [m.feet, I, BLACK, 0.8, 0, 0, off],
      [m.body, I, BLACK, 0.62, 0, 0, off], [m.plate, I, [0.045, 0.047, 0.052], 0.46, 0.75, 2, off],
      [m.platter, spin, [0.075, 0.075, 0.08], 0.36, 1, 3, off], [m.mat, spin, [0.010, 0.010, 0.010], 0.9, 0, 0, off],
      [m.spindle, I, CHROME, 0.14, 1, 1, off],
      [m.strobe, I, [0.02, 0.02, 0.022], 0.4, 0.5, 0, off], [m.lens, lensM, [0.15, 0.01, 0.01], 0.3, 0, 0, [2.4 * on, 0.16 * on, 0.05 * on]],
      [m.buttons, I, [0.028, 0.028, 0.030], 0.42, 0.3, 0, off], [m.slot, I, [0.004, 0.004, 0.004], 0.25, 0, 0, off],
      [m.ledStart, I, [0.05, 0.03, 0.01], 0.3, 0, 0, glow(on)], [m.led33, I, [0.05, 0.03, 0.01], 0.3, 0, 0, glow(r33 ? lit : 0)],
      [m.led45, I, [0.05, 0.03, 0.01], 0.3, 0, 0, glow(r45 ? lit : 0)], [m.ledPitch, I, [0.01, 0.05, 0.02], 0.3, 0, 0, glow(lit, [0.2, 1.0, 0.35])],
      [m.tower, I, [0.020, 0.020, 0.022], 0.38, 0.6, 0, off], [m.towerCap, I, CHROME, 0.16, 1, 0, off],
      [m.tube, arm, [0.30, 0.30, 0.32], 0.16, 1, 0, off], [m.weight, arm, [0.022, 0.022, 0.024], 0.42, 0.7, 0, off], [m.dial, arm, CHROME, 0.28, 1, 0, off],
      [m.collar, head, CHROME, 0.2, 1, 0, off], [m.cantilever, cant, [0.55, 0.55, 0.58], 0.3, 1, 0, off], [m.shell, head, [0.014, 0.014, 0.015], 0.4, 0.2, 0, off], [m.holder, head, [0.80, 0.36, 0.05], 0.42, 0, 0, off],
    ];

    items.push([m.vuBezel, I, [0.018, 0.018, 0.019], 0.4, 0.4, 0, off], [m.vuFace, I, [0.62, 0.5, 0.32], 0.55, 0, 6, glow(0.16 * lit * lit, [1.0, 0.62 * (0.5 + 0.5 * lit), 0.26 * lit])],   // a filament: redder while it is still coming on
      [m.needle, needleM, [0.012, 0.010, 0.009], 0.4, 0, 0, off]);

    if (info) items.push([m.edge, discM, [0.008, 0.008, 0.008], 0.22, 0, 0, off]);

    // 1. shadow map from the key light
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); gl.viewport(0, 0, SHADOW, SHADOW); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.dep.p); gl.uniformMatrix4fv(this.dep.u.uVP, false, this.lvp);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
    for (let i = 1; i < items.length; i++) { gl.uniformMatrix4fv(this.dep.u.uM, false, items[i][1]); gl.bindVertexArray(items[i][0].vao); gl.drawArrays(gl.TRIANGLES, 0, items[i][0].count); }
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // 2. beauty pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.scene); gl.viewport(0, 0, w, h);
    if (st.bare) gl.clearColor(0, 0, 0, 0); else gl.clearColor(0.004, 0.004, 0.005, 0);   // alpha is the bloom (shaders.js glow)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tex.shadow);
    const common = (u) => {
      gl.uniformMatrix4fv(u.uVP, false, cam.vp); gl.uniformMatrix4fv(u.uLVP, false, this.lvp); gl.uniform3fv(u.uEye, cam.eye);
      gl.uniform1i(u.uShadow, 3); gl.uniform4f(u.uLamp, LAMP[0], LAMP[1], LAMP[2], on); gl.uniform4fv(u.uFire, st.fire);
    };
    let u = this.std.u;
    gl.useProgram(this.std.p); common(u); gl.uniform2f(u.uPivot, PIVOT_X, PIVOT_Y); gl.uniform4f(u.uVu, ...VU);
    for (const [mesh, M, col, rough, metal, mode, emis] of st.bare ? items.slice(1) : items) {      // bare: no table under the deck
      gl.uniformMatrix4fv(u.uM, false, M); gl.uniform3fv(u.uCol, col); gl.uniform3fv(u.uEmis, emis);
      gl.uniform1f(u.uRough, rough); gl.uniform1f(u.uMetal, metal); gl.uniform1i(u.uMode, mode);
      gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }

    if (info) this.drawDisc(info, discM, common);
    this.post(rt, st);
  }

  // resolve the scene, blur what blooms at quarter size, then lay bloom and grain over the picture
  post(rt, st) {
    const gl = this.gl, [a, b] = rt.bloom;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rt.scene); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, rt.flat);
    gl.blitFramebuffer(0, 0, rt.w, rt.h, 0, 0, rt.w, rt.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
    const pass = (prog, to, from, sx, sy) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, to.fbo); gl.viewport(0, 0, to.w, to.h);
      gl.useProgram(prog.p); gl.bindTexture(gl.TEXTURE_2D, from); gl.uniform1i(prog.u.uTex, 0); gl.uniform2f(prog.u.uStep, sx, sy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    pass(this.bright, a, rt.tex, 1 / rt.w, 1 / rt.h);
    for (const k of [1, 2]) { pass(this.blur, b, a.tex, k / a.w, 0); pass(this.blur, a, b.tex, 0, k / a.h); }   // a tight glow, then a wide one
    const u = this.final.u, dpr = Math.min(2, window.devicePixelRatio || 1), seed = st.grain;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, rt.w, rt.h);
    gl.useProgram(this.final.p); gl.bindTexture(gl.TEXTURE_2D, rt.tex); gl.uniform1i(u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, a.tex); gl.uniform1i(u.uBloom, 1);
    gl.uniform1f(u.uBloomK, BLOOM); gl.uniform4f(u.uGrain, seed * 0.618 % 1 * 97, seed * 0.414 % 1 * 61, st.bare ? 0 : GRAIN, dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
  }

  drawDisc(info, discM, common) {
    const gl = this.gl, m = this.m, u = this.rec.u;
    gl.useProgram(this.rec.p); common(u); gl.uniformMatrix4fv(u.uM, false, discM);
    gl.uniform3fv(u.uWarp, info.warp); gl.uniform4fv(u.uScr, info.scr); gl.uniform1i(u.uNScr, info.nScr);
    gl.uniform1f(u.uRLo, info.rLo); gl.uniform1f(u.uRHi, info.rHi); gl.uniform1f(u.uRows, info.rows);
    gl.uniform1f(u.uRevEnd, info.revEnd); gl.uniform1f(u.uW, GROOVE_W); gl.uniform1f(u.uDust, info.dust);
    [['uLut', this.tex.lut], ['uVis', this.tex.vis], ['uLabel', this.tex.label]].forEach(([name, tex], i) => {
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u[name], i);
    });
    gl.bindVertexArray(m.disc.vao); gl.drawArrays(gl.TRIANGLES, 0, m.disc.count);
  }
}
