// Textures procédurales (aucune image externe) : bruit fBm, carrelage, plâtre, bois, tissu.
import * as THREE from 'three';

// ---------- bruit de valeur tuilable ----------
function makeNoise(seed = 1) {
  const P = 256, perm = new Uint8Array(P * 2), val = new Float32Array(P);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < P; i++) { perm[i] = i; val[i] = rnd(); }
  for (let i = P - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < P; i++) perm[i + P] = perm[i];
  const h = (x, y) => val[perm[(perm[x & 255] + y) & 255]];
  const sm = t => t * t * (3 - 2 * t);
  // période p (cellules) pour que la texture se répète sans couture
  const n2 = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const u = sm(xf), v = sm(yf);
    return (h(x0, y0) * (1 - u) + h(x1, y0) * u) * (1 - v) + (h(x0, y1) * (1 - u) + h(x1, y1) * u) * v;
  };
  return (x, y, oct = 5, base = 4) => { // x,y dans [0,1)
    let a = 0.5, f = base, t = 0, n = 0;
    for (let o = 0; o < oct; o++) { t += a * n2(x * f, y * f, f); n += a; a *= 0.5; f *= 2; }
    return t / n;
  };
}

function canvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }

// à partir d'une carte de hauteur Float32 → normal map
function heightToNormal(H, size, strength = 2) {
  const c = canvas(size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = H[y * size + ((x - 1 + size) % size)], r = H[y * size + ((x + 1) % size)];
    const u = H[((y - 1 + size) % size) * size + x], b = H[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (u - b) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * size + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}

function toTex(c, srgb, rep = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  t.anisotropy = 16; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  return t;
}

// génère color / roughness / normal à partir d'une fonction par pixel
function build(size, fn, normalStrength) {
  const cc = canvas(size), rc = canvas(size);
  const ci = cc.getContext('2d').createImageData(size, size), ri = rc.getContext('2d').createImageData(size, size);
  const H = new Float32Array(size * size), out = { r: 0, g: 0, b: 0, rough: 0.5, h: 0 };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    fn(x / size, y / size, out);
    const i = (y * size + x) * 4;
    ci.data[i] = out.r * 255; ci.data[i + 1] = out.g * 255; ci.data[i + 2] = out.b * 255; ci.data[i + 3] = 255;
    const rv = out.rough * 255; ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = rv; ri.data[i + 3] = 255;
    H[y * size + x] = out.h;
  }
  cc.getContext('2d').putImageData(ci, 0, 0); rc.getContext('2d').putImageData(ri, 0, 0);
  return { color: cc, rough: rc, normal: heightToNormal(H, size, normalStrength) };
}

const cache = {};
function material(key, size, fn, ns, opts = {}) {
  if (cache[key]) return cache[key];
  const m = build(size, fn, ns);
  return (cache[key] = {
    map: toTex(m.color, true), roughnessMap: toTex(m.rough, false), normalMap: toTex(m.normal, false),
  });
}

export function setRepeat(set, rx, ry = rx) {
  const out = {};
  for (const k in set) { out[k] = set[k].clone(); out[k].repeat.set(rx, ry); out[k].needsUpdate = true; }
  return out;
}

// ---------- carrelage du parvis : grandes dalles de pierre blanche, joints fins ----------
// une texture = 2x2 dalles
export function tileSet() {
  const N = makeNoise(7), M = makeNoise(13), V = makeNoise(29);
  return material('tile', 1024, (u, v, o) => {
    const gu = (u * 2) % 1, gv = (v * 2) % 1, ti = Math.floor(u * 2) + Math.floor(v * 2) * 2;
    const dx = Math.min(gu, 1 - gu), dy = Math.min(gv, 1 - gv), e = Math.min(dx, dy);
    const grout = e < 0.006 ? 1 : e < 0.011 ? (0.011 - e) / 0.005 : 0;
    const bevel = Math.min(1, e / 0.02);
    const n = N(u, v, 6, 4), m = M(u + ti * 0.13, v, 4, 2);
    // veines légères de marbre
    const vein = Math.pow(1 - Math.abs(Math.sin((u * 3 + v * 1.3 + V(u, v, 5, 2) * 2.5 + ti) * Math.PI)), 18) * 0.25;
    const tone = 0.93 + (m - 0.5) * 0.05 + (n - 0.5) * 0.03 - vein * 0.6 + (ti % 3) * 0.008;
    const g = 0.62 + n * 0.08;
    const c = tone * (1 - grout) + g * grout;
    o.r = c * 0.995; o.g = c * 0.99; o.b = c * 0.975;
    o.rough = 0.16 + (n - 0.5) * 0.12 + m * 0.08 + grout * 0.6 + vein * 0.2;
    o.h = bevel * 0.8 + n * 0.04 - grout * 0.2;
  }, 3);
}

// ---------- sol infini du vide : blanc mat très légèrement poudreux ----------
export function voidGroundSet() {
  const N = makeNoise(3);
  return material('void', 512, (u, v, o) => {
    const n = N(u, v, 6, 3);
    const c = 0.95 + (n - 0.5) * 0.04;
    o.r = c; o.g = c; o.b = c * 0.995; o.rough = 0.85 + (n - 0.5) * 0.1; o.h = n * 0.5;
  }, 1.5);
}

// ---------- enduit / pierre blanche des façades ----------
export function plasterSet() {
  const N = makeNoise(11), M = makeNoise(17);
  return material('plaster', 1024, (u, v, o) => {
    const n = N(u, v, 7, 4), m = M(u, v, 3, 2);
    const blot = Math.max(0, m - 0.55) * 0.25;
    const c = 0.9 + (n - 0.5) * 0.05 - blot * 0.4;
    o.r = c; o.g = c * 0.985; o.b = c * 0.955; o.rough = 0.78 + (n - 0.5) * 0.15; o.h = n * 0.9 + m * 0.3;
  }, 2.5);
}

// ---------- pierre de taille (soubassement, colonnes) : assises horizontales ----------
export function ashlarSet() {
  const N = makeNoise(5);
  return material('ashlar', 1024, (u, v, o) => {
    const rows = 4, row = Math.floor(v * rows), off = (row % 2) * 0.5;
    const bu = ((u * 2 + off) % 1), bv = (v * rows) % 1;
    const e = Math.min(Math.min(bu, 1 - bu) * 2 / rows * 2, Math.min(bv, 1 - bv) / rows);
    const joint = e < 0.004 ? 1 : 0;
    const n = N(u, v, 6, 4);
    const c = (0.87 + (n - 0.5) * 0.06 + (row % 3) * 0.01) * (1 - joint * 0.35);
    o.r = c; o.g = c * 0.98; o.b = c * 0.95; o.rough = 0.7 + n * 0.2 + joint * 0.2;
    o.h = Math.min(1, e / 0.012) * 0.7 + n * 0.2;
  }, 3);
}

// ---------- parquet / bois sombre ----------
export function woodSet(seed = 21, tint = [0.42, 0.27, 0.16]) {
  const N = makeNoise(seed), G = makeNoise(seed + 4);
  return material('wood' + seed, 1024, (u, v, o) => {
    const planks = 6, p = Math.floor(u * planks), pu = (u * planks) % 1;
    const len = ((v + p * 0.37) % 1);
    const edge = Math.min(pu, 1 - pu) < 0.015 || Math.min(len, 1 - len) < 0.004 ? 1 : 0;
    const g = G(u * 0.2 + p * 0.1, v * 4, 4, 2);
    const ring = 0.5 + 0.5 * Math.sin((pu * 3 + g * 6 + p) * 6.283 * 2);
    const n = N(u, v, 5, 8);
    const k = (0.75 + ring * 0.2 + (n - 0.5) * 0.2 + ((p * 7) % 5) * 0.04) * (1 - edge * 0.55);
    o.r = tint[0] * k; o.g = tint[1] * k; o.b = tint[2] * k;
    o.rough = 0.48 + ring * 0.12 + edge * 0.3; o.h = ring * 0.2 - edge * 0.6 + n * 0.1;
  }, 2.5);
}

// ---------- tissu (draps, couvertures) : trame fine ----------
export function fabricSet(key, col) {
  const N = makeNoise(41);
  return material('fab' + key, 512, (u, v, o) => {
    const w = 0.5 + 0.25 * (Math.sin(u * 6.283 * 96) + Math.sin(v * 6.283 * 96));
    const n = N(u, v, 5, 4);
    const k = 0.86 + w * 0.1 + (n - 0.5) * 0.12;
    o.r = col[0] * k; o.g = col[1] * k; o.b = col[2] * k; o.rough = 0.9; o.h = w * 0.6 + n * 0.3;
  }, 1.2);
}

// ---------- tapis à motifs géométriques (original) ----------
export function rugSet() {
  const N = makeNoise(51);
  return material('rug', 1024, (u, v, o) => {
    const cx = Math.abs(u - 0.5) * 2, cy = Math.abs(v - 0.5) * 2, r = Math.max(cx, cy), d = cx + cy;
    let c = [0.42, 0.08, 0.06];
    if (r > 0.9) c = [0.12, 0.06, 0.05]; else if (r > 0.84) c = [0.78, 0.58, 0.28];
    else if (r > 0.78) c = [0.12, 0.1, 0.18];
    else if (d < 0.5) c = (d < 0.38 ? [0.78, 0.58, 0.28] : [0.12, 0.1, 0.18]);
    else if (Math.abs(((d * 8) % 1) - 0.5) < 0.08) c = [0.66, 0.42, 0.2];
    const w = 0.5 + 0.5 * Math.sin(u * 6.283 * 220) * Math.sin(v * 6.283 * 220);
    const n = N(u, v, 5, 6), k = 0.8 + w * 0.15 + (n - 0.5) * 0.2;
    o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k; o.rough = 0.95; o.h = w * 0.5 + n * 0.5;
  }, 2);
}

// ---------- métal brossé/laiton ----------
export function brushedSet() {
  const N = makeNoise(61);
  return material('brush', 512, (u, v, o) => {
    const s = N(u * 0.05, v, 6, 32), n = N(u, v, 4, 4);
    o.r = o.g = o.b = 1; o.rough = 0.28 + s * 0.18 + (n - 0.5) * 0.1; o.h = s * 0.3;
  }, 0.5);
}
