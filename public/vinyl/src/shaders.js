// GLSL. Physically based shading (GGX + Fresnel) in a dark room at night: one shadowed tungsten lamp
// overhead, a fire low to the left, a little window light from behind, a faint fill. The disc shader
// additionally draws the actual spiral (from the lathe's radius table) and scatters light according to
// how hard each revolution is modulated (from the cut groove data).

const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
export const KEY = unit([-0.38, 0.30, 0.87]);
export const FIRE = unit([-0.90, 0.16, 0.24]);   // the hearth, when its flames stand still (main.js makes it flicker)
const RIM = unit([0.55, 0.78, 0.30]), FILL = unit([0.30, -0.80, 0.50]);
const v3 = (v) => `vec3(${v.map((x) => x.toFixed(5)).join(', ')})`;

const COMMON = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
uniform sampler2DShadow uShadow; uniform mat4 uLVP; uniform vec3 uEye; uniform vec4 uLamp;   // lamp: xyz, on
uniform vec4 uFire;                                                                           // firelight: direction, brightness
const vec3 L1 = ${v3(KEY)}, L2 = ${v3(FILL)}, L3 = ${v3(RIM)};
const vec3 KEYC = vec3(2.6, 2.22, 1.72), RIMC = vec3(0.20, 0.22, 0.27), FILLC = vec3(0.05, 0.045, 0.044);   // tungsten key, window rim
const vec3 FIREC = vec3(1.7, 0.66, 0.17);
float gFire = 1.0;                                    // how much of the fire this surface sees (the table sets it)
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float disc(vec3 r, vec3 d, float rad, float s) {
  float t = dot(r, d); if (t <= 0.02) return 0.0;
  return smoothstep(rad + s, rad - s, length(r / t - d));
}
float softbox(vec3 r, vec3 d, vec3 u, vec2 half_, float s) {
  float t = dot(r, d); if (t <= 0.02) return 0.0;
  u = normalize(u - d * dot(u, d)); vec3 w = cross(d, u), p = r / t - d;
  vec2 e = smoothstep(half_ + s, half_ - s, abs(vec2(dot(p, u), dot(p, w))));
  return e.x * e.y;
}
vec3 env(vec3 r, float rough) {                      // what a reflection sees: a dark room, a lamp shade, the fire, a window
  float s = 0.02 + 0.9 * rough, k = 1.0 / (1.0 + 7.0 * rough * rough);
  vec3 c = vec3(0.008, 0.0065, 0.0055) + vec3(0.016, 0.013, 0.010) * smoothstep(-0.3, 0.7, r.z);
  c += 7.0 * k * disc(r, L1, 0.36, s) * vec3(1.0, 0.86, 0.66);
  c += 5.0 * k * uFire.w * softbox(r, uFire.xyz, vec3(0.0, 0.0, 1.0), vec2(0.20, 0.30), s + 0.07) * vec3(1.0, 0.45, 0.12);
  c += 1.4 * k * softbox(r, L3, vec3(0.0, 0.0, 1.0), vec2(0.34, 0.10), s) * vec3(0.62, 0.74, 1.0);
  return c;
}
float shadow(vec3 P, vec3 N) {
  vec4 q = uLVP * vec4(P + N * 0.0012, 1.0); vec3 s = q.xyz / q.w * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0) return 1.0;
  float a = 0.0, t = 1.4 / 2048.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) a += texture(uShadow, vec3(s.xy + vec2(float(i), float(j)) * t, s.z - 0.0009));
  return a / 9.0;
}
float pool(vec3 P) { return mix(0.03, 1.0, smoothstep(0.72, 0.16, length(P.xy - vec2(0.04, 0.0)))); }   // the key is a spot
vec3 brdf(vec3 N, vec3 V, vec3 L, vec3 F0, vec3 diff, float rough) {
  float nl = max(dot(N, L), 0.0); if (nl <= 0.0) return vec3(0.0);
  vec3 H = normalize(L + V); float nh = max(dot(N, H), 0.0), nv = max(dot(N, V), 1e-3), a = rough * rough, a2 = a * a;
  float d = nh * nh * (a2 - 1.0) + 1.0, D = min(a2 / (3.14159 * d * d), 40.0), k = (rough + 1.0) * (rough + 1.0) / 8.0;
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  return (diff + D * F / (4.0 * (nl * (1.0 - k) + k) * (nv * (1.0 - k) + k))) * nl;
}
vec3 shade(vec3 P, vec3 N, vec3 alb, float rough, float metal, float ao) {
  vec3 V = normalize(uEye - P), F0 = mix(vec3(0.04), alb, metal), diff = alb * (1.0 - metal);
  float sh = shadow(P, N), nv = max(dot(N, V), 1e-3);
  vec3 c = brdf(N, V, L1, F0, diff, rough) * KEYC * sh * pool(P) + brdf(N, V, L3, F0, diff, rough) * RIMC * ao + brdf(N, V, L2, F0, diff, rough) * FILLC;
  c += brdf(N, V, uFire.xyz, F0, diff, rough) * FIREC * uFire.w * ao * gFire;
  vec3 lp = uLamp.xyz - P; float ld = length(lp);
  c += brdf(N, V, lp / ld, F0, diff, max(rough, 0.3)) * vec3(1.0, 0.10, 0.04) * uLamp.w * 1.6 / (1.0 + ld * ld / 0.0012);
  vec3 F = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - nv, 5.0);
  return c + env(reflect(-V, N), rough) * F * ao * (0.45 + 0.55 * sh) + diff * 0.015 * ao;
}
vec3 tone(vec3 x) {
  x = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  return pow(x, vec3(1.0 / 2.2)) + (hash(gl_FragCoord.xy) - 0.5) / 255.0;
}
// alpha is how much of the pixel blooms in the post pass: lamps, and highlights too bright for the film
float glow(vec3 lit, vec3 em) { return clamp(0.22 * lum(em) + smoothstep(2.5, 9.0, lum(lit)), 0.0, 1.0); }
`;

export const STD_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN;
uniform mat4 uVP, uM; out vec3 vP, vN, vO;
void main() { vec4 w = uM * vec4(aP, 1.0); vP = w.xyz; vN = mat3(uM) * aN; vO = aP; gl_Position = uVP * w; }`;

export const DEPTH_FS = `#version 300 es
precision mediump float;
void main() {}`;

// uMode: 0 plain, 1 turned metal, 2 deck plate, 3 platter with strobe dots, 5 table top, 6 VU meter face
export const STD_FS = COMMON + `
in vec3 vP, vN, vO; out vec4 o;
uniform mat4 uM; uniform vec3 uCol, uEmis; uniform float uRough, uMetal; uniform int uMode; uniform vec2 uPivot;
uniform vec4 uVu;   // VU meter window: x0 y0 x1 y1
// the plinth's shadow on the table in the firelight: is the way to the fire blocked, at four heights up the plinth?
float fireShadow(vec3 P) {
  vec2 d = uFire.xy / max(uFire.z, 0.05); float o = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.0145 * float(i); vec2 q = abs(P.xy + d * h - vec2(0.0425, 0.0)) - vec2(0.2275, 0.19);
    o = min(o, smoothstep(-0.004, 0.004 + 0.4 * h, max(q.x, q.y)));
  }
  return o;
}
float plateAo(vec3 P) {
  return mix(0.35, 1.0, smoothstep(0.163, 0.205, length(P.xy))) * mix(0.45, 1.0, smoothstep(0.028, 0.060, length(P.xy - uPivot)));
}
void main() {
  vec3 N = normalize(vN), alb = uCol, em = uEmis; float rough = uRough, metal = uMetal, ao = 1.0, fade = 1.0;
  float ro = length(vO.xy), px = fwidth(vO.x) + fwidth(vO.y) + fwidth(vO.z);
  if (uMode == 1 || uMode == 3) {                       // lathe-turned: fine concentric brushing
    float b = hash(vec2(floor(ro * 5000.0), 3.0)) - 0.5, fade = 1.0 - smoothstep(1e-4, 6e-4, px);
    if (abs(N.z) > 0.5) { N = normalize(N + mat3(uM) * vec3(vO.xy / max(ro, 1e-4), 0.0) * b * 0.10 * fade); rough += b * 0.10 * fade; }
  }
  if (uMode == 3 && ro > 0.160 && abs(N.z) < 0.4) {     // strobe dots around the platter rim
    float row = clamp(floor((vO.z + 0.0200) / 0.003125), 0.0, 3.0), n = 180.0 - 6.0 * row;
    vec2 cell = vec2((fract(atan(vO.y, vO.x) / 6.2831853 * n) - 0.5) * 1.0336 / n, (fract((vO.z + 0.0200) / 0.003125) - 0.5) * 0.003125);
    float dot_ = 1.0 - smoothstep(0.0008, 0.0010 + px, length(cell));
    alb = mix(vec3(0.02), vec3(0.80, 0.80, 0.82), dot_); rough = mix(0.5, 0.22, dot_);
  }
  if (uMode == 2 && N.z > 0.5) {                        // deck plate: paint texture + contact occlusion
    alb *= 0.88 + 0.24 * hash(floor(vP.xy * 2500.0)) * (1.0 - smoothstep(2e-4, 1e-3, px));
    ao *= plateAo(vP);
  }
  if (uMode == 6) {                                     // VU meter face: backlit cream card, scale arc, red zone
    vec2 q = vP.xy - vec2(0.5 * (uVu.x + uVu.z), uVu.y + 0.004);
    float r = length(q), a = atan(q.x, q.y), aa = fwidth(r) + 1e-5, inScale = step(abs(a), 0.87);
    float tick = inScale * step(0.0186, r) * step(r, 0.0222) * smoothstep(0.00028 + aa, 0.00028, abs(fract(a / 0.1309 + 0.5) - 0.5) * 0.1309 * r);
    float arc = inScale * smoothstep(0.00022 + aa, 0.00022, abs(r - 0.0186));
    float red = step(0.35, a) * inScale * step(0.0186, r) * step(r, 0.0204);
    float ink = max(max(tick, arc), red);
    alb = mix(vec3(0.62, 0.50, 0.32), mix(vec3(0.012), vec3(0.30, 0.015, 0.008), red), ink);
    em = uEmis * (1.0 - ink) + uEmis * red * vec3(0.6, 0.05, 0.02);
    rough = 0.55;
  }
  if (uMode == 5) {                                     // table: matt black, occlusion under the plinth
    vec2 q = abs(vP.xy - vec2(0.0425, 0.0)) - vec2(0.2275, 0.19);
    ao *= mix(0.15, 1.0, smoothstep(-0.01, 0.07, length(max(q, 0.0)) + min(max(q.x, q.y), 0.0)));
    alb *= 0.9 + 0.2 * hash(floor(vP.xy * 900.0)) * (1.0 - smoothstep(5e-4, 3e-3, px));
    gFire = fireShadow(vP);
    fade = 1.0 - smoothstep(0.7, 2.6, length(vP.xy - vec2(0.04, 0.0)));   // the room is dark beyond the lamp
  }
  vec3 lit = shade(vP, N, alb, clamp(rough, 0.06, 1.0), metal, ao) * fade;
  o = vec4(tone(lit + em), glow(lit, em));
}`;

export const REC_VS = `#version 300 es
layout(location=0) in vec3 aP;
uniform mat4 uVP, uM; uniform vec3 uWarp[3];   // (harmonic k, amplitude m, phase)
out vec3 vP, vN; out vec2 vQ;
void main() {
  float r = length(aP.xy), phi = atan(aP.y, aP.x), t = max(0.0, (r - 0.0532) / (0.1508 - 0.0532));
  float z = 0.0, dzr = 0.0, dzp = 0.0;
  for (int i = 0; i < 3; i++) {
    float a = uWarp[i].x * phi + uWarp[i].z;
    z += uWarp[i].y * t * t * cos(a); dzr += uWarp[i].y * 2.0 * t / 0.0976 * cos(a); dzp -= uWarp[i].y * t * t * uWarp[i].x * sin(a);
  }
  vec2 er = aP.xy / max(r, 1e-5), ep = vec2(-er.y, er.x);
  vec3 n = normalize(vec3(-dzr * er - dzp / max(r, 1e-3) * ep, 1.0));
  vec4 w = uM * vec4(aP.xy, z, 1.0);
  vP = w.xyz; vN = mat3(uM) * n; vQ = aP.xy; gl_Position = uVP * w;
}`;

export const REC_FS = COMMON + `
in vec3 vP, vN; in vec2 vQ; out vec4 o;
uniform mat4 uM; uniform sampler2D uLut, uVis, uLabel;
uniform float uRLo, uRHi, uRows, uRevEnd, uW, uDust; uniform vec4 uScr[12]; uniform int uNScr;
float lut(float r) {
  float x = clamp((r - uRLo) / (uRHi - uRLo), 0.0, 1.0) * 2047.0; int i = int(floor(x));
  return mix(texelFetch(uLut, ivec2(i, 0), 0).r, texelFetch(uLut, ivec2(min(i + 1, 2047), 0), 0).r, x - float(i));
}
void main() {
  float r = length(vQ), phi = atan(vQ.y, vQ.x), ph = phi / 6.28318531;
  vec3 N = normalize(vN), V = normalize(uEye - vP);
  vec3 Tw = normalize(mat3(uM) * vec3(-sin(phi), cos(phi), 0.0));
  float px = fwidth(vQ.x) + fwidth(vQ.y), sh = shadow(vP, N), key = sh * pool(vP);
  vec3 c;
  if (r < 0.05) {                                              // paper label
    vec3 lab = texture(uLabel, vQ / 0.1 + 0.5).rgb;
    c = shade(vP, N, lab * lab, 0.75, 0.0, 1.0);
  } else {
    float revs = lut(r);
    float pitch = 2e-4 / max(1e-5, abs(lut(r - 1e-4) - lut(r + 1e-4)));   // metres between neighbouring grooves
    float g = revs - ph, n = floor(g + 0.5);                   // g is an integer on a groove centreline
    float inside = step(0.01, revs) * step(revs, uRevEnd - 0.01) * step(r, 0.1492);
    float dist = abs(fract(g + 0.5) - 0.5) * pitch;            // metres to the nearest groove centre
    float sharp = clamp((uW - dist) / max(px, 1e-7) + 0.5, 0.0, 1.0);
    float cover = inside * mix(sharp, min(1.0, 2.0 * uW / pitch), smoothstep(0.25, 0.9, px / pitch));
    float vis = texture(uVis, vec2(fract(ph), (n + floor(ph) + 0.5) / uRows)).r;   // modulation of this revolution
    // groove walls: a radial fan of 45-degree mirrors -> anisotropic streaks, widened by modulation
    float sig = 0.014 + 0.085 * vis, glint = 0.0; vec3 groove = vec3(0.0016) + vis * 0.003;
    for (int i = 0; i < 3; i++) {
      vec3 L = i == 0 ? L1 : (i == 1 ? L3 : uFire.xyz), H = normalize(L + V);
      vec3 lc = i == 0 ? KEYC * key : (i == 1 ? RIMC * 1.6 : FIREC * uFire.w);
      float th = dot(Tw, H), s = exp(-th * th / (2.0 * sig * sig)) * 0.0085 / sig * (0.3 + 0.7 * max(dot(N, H), 0.0));
      groove += s * lc * (vec3(0.92, 0.90, 0.86) + 0.08 * cos(6.2832 * (th * 9.0 + r * 55.0 + vec3(0.0, 0.33, 0.67))));   // a hint of diffraction
      glint += s * lum(lc);
    }
    float fr = pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 land = vec3(0.0012) + env(reflect(-V, N), 0.07) * (0.045 + 0.955 * fr) * (0.5 + 0.5 * sh) + brdf(N, V, L1, vec3(0.045), vec3(0.002), 0.12) * KEYC * key;
    c = mix(land, groove, cover);
    for (int i = 0; i < uNScr; i++) {                          // scratches catch the light
      vec4 s = uScr[i];
      if (r > s.x && r < s.y) {
        float d = abs(mod(phi - mix(s.z, s.w, (r - s.x) / (s.y - s.x)) + 3.14159265, 6.28318531) - 3.14159265) * r;
        c += 0.03 * (0.3 + key) * (1.0 - smoothstep(0.0, 40e-6 + px, d));
      }
    }
    // dust: it shows where the light glances off the grooves and all but vanishes elsewhere
    float seen = 0.15 + 0.45 * key + 1.5 * min(glint * cover, 1.5);
    vec2 dq = vQ / 4e-4, cell = floor(dq);                     // specks: most are tiny
    if (hash(cell) < uDust * 0.0016) {
      float size = mix(1.2e-5, 7e-5, pow(hash(cell + 5.1), 3.0)); vec2 at = 0.2 + 0.6 * vec2(hash(cell + 17.3), hash(cell + 41.7));
      c += (0.02 + 0.05 * hash(cell + 9.4)) * seen * clamp(1.5 * size / max(px, 1e-7), 0.15, 1.0) * (1.0 - smoothstep(0.0, size + px, length(dq - cell - at) * 4e-4));
    }
    vec2 fq = vQ / 2.5e-3, fc = floor(fq);                     // fibres: a few short curled hairs
    if (hash(fc + 3.7) < uDust * 0.012) {
      float an = 6.2832 * hash(fc + 31.3), len = 0.10 + 0.18 * hash(fc + 47.0);
      vec2 dir = vec2(cos(an), sin(an)), p = fq - fc - 0.3 - 0.4 * vec2(hash(fc + 11.1), hash(fc + 23.9));
      float t = clamp(dot(p, dir), -len, len), curl = 0.3 * len * (t * t / (len * len) - 0.5);
      float d = length(p - dir * t - vec2(-dir.y, dir.x) * curl) * 2.5e-3;
      c += 0.035 * seen * clamp(2.7e-5 / max(px, 1e-7), 0.2, 1.0) * (1.0 - smoothstep(0.0, 9e-6 + px, d));
    }
  }
  o = vec4(tone(c), glow(c, vec3(0.0)));
}`;

// ---------- post: bloom around the lamps and the brightest glints, and film grain ----------
export const POST_VS = `#version 300 es
out vec2 vUv;
void main() { vUv = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0); }`;

// quarter-size copy of what blooms (colour x the glow written to alpha); uStep is one source texel
export const BRIGHT_FS = `#version 300 es
precision mediump float;
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uStep;
void main() {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 4; i++) { vec4 t = texture(uTex, vUv + (vec2(float(i & 1), float(i >> 1)) * 2.0 - 1.0) * uStep); s += t.rgb * t.a; }
  o = vec4(s * 0.25, 1.0);
}`;

// one direction of a 9-tap Gaussian (5 bilinear fetches)
export const BLUR_FS = `#version 300 es
precision mediump float;
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uStep;
void main() {
  vec3 c = texture(uTex, vUv).rgb * 0.2270270;
  c += (texture(uTex, vUv + uStep * 1.3846154).rgb + texture(uTex, vUv - uStep * 1.3846154).rgb) * 0.3162162;
  c += (texture(uTex, vUv + uStep * 3.2307692).rgb + texture(uTex, vUv - uStep * 3.2307692).rgb) * 0.0702703;
  o = vec4(c, 1.0);
}`;

export const FINAL_FS = `#version 300 es
precision mediump float;
in vec2 vUv; out vec4 o; uniform sampler2D uTex, uBloom; uniform float uBloomK; uniform vec4 uGrain;   // seed xy, amount, pixels per grain
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec3 c = texture(uTex, vUv).rgb + texture(uBloom, vUv).rgb * uBloomK;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)), n = hash(floor(gl_FragCoord.xy / uGrain.w) + uGrain.xy) - 0.5;
  o = vec4(c + n * uGrain.z * mix(0.35, 1.0, smoothstep(0.0, 0.3, l)), 1.0);   // grain shows least in the blacks
}`;
