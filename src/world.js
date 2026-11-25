// Environnement : vide blanc infini, parvis dallé, bâtiment d'habitation (intérieur aménagé), deux tours.
// Toute la géométrie est construite ici à partir de primitives ; textures procédurales (textures.js).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TX from './textures.js';

export const FLOOR_IN = 0.36;      // niveau du sol intérieur (3 marches au-dessus du parvis)
export const VOID_Y = -0.22;       // sol du vide, sous le parvis
const H = 6.2;                      // hauteur des murs (plafond intérieur)
const PLAT = { x0: -24, x1: 24, z0: -22, z1: 30 };

export const colliders = { segs: [], circles: [] };
export const occluders = [];        // meshes que la caméra ne doit pas traverser
export const lights = [];           // lampes (pour l'animation de flamme)

const seg = (ax, az, bx, bz) => colliders.segs.push([ax, az, bx, bz]);
const box2 = (x0, z0, x1, z1) => { seg(x0, z0, x1, z0); seg(x1, z0, x1, z1); seg(x1, z1, x0, z1); seg(x0, z1, x0, z0); };
const circ = (x, z, r) => colliders.circles.push([x, z, r]);

// hauteur du sol sous le personnage
export function groundHeight(x, z) {
  if (x > -8 && x < 8 && z > -12 && z < 2.05) return FLOOR_IN;
  if (x > -5.2 && x < 5.2 && z >= 2.05 && z < 4.6) {
    if (z < 3.4) return FLOOR_IN; if (z < 4.0) return 0.24; return 0.12;
  }
  if (x > PLAT.x0 && x < PLAT.x1 && z > PLAT.z0 && z < PLAT.z1) return 0;
  return VOID_Y;
}

// ------------------------------------------------------------------ matériaux
function mats(maxAniso) {
  const tile = TX.tileSet(), plaster = TX.plasterSet(), ashlar = TX.ashlarSet(), voidG = TX.voidGroundSet();
  const wood = TX.woodSet(21, [0.36, 0.22, 0.13]), woodDark = TX.woodSet(23, [0.2, 0.12, 0.07]);
  const M = {};
  const std = (o) => new THREE.MeshStandardMaterial(o);
  M.tile = std({ ...TX.setRepeat(tile, 1 / 4), roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.6, 0.6) });
  M.void = std({ ...TX.setRepeat(voidG, 1 / 12), roughness: 1, color: 0xf4f4f2 });
  M.plasterOut = std({ ...TX.setRepeat(plaster, 1 / 5), roughness: 1, normalScale: new THREE.Vector2(0.5, 0.5) });
  M.plasterIn = std({ ...TX.setRepeat(plaster, 1 / 4), roughness: 1, color: 0xc9c2b6, envMapIntensity: 0.2, normalScale: new THREE.Vector2(0.4, 0.4) });
  M.ashlar = std({ ...TX.setRepeat(ashlar, 1 / 3), roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8) });
  M.trim = std({ ...TX.setRepeat(plaster, 1 / 2), roughness: 0.9, color: 0xf3efe6 });
  M.floorIn = std({ ...TX.setRepeat(tile, 1 / 1.6), roughness: 0.55, color: 0x8f877c, envMapIntensity: 0.35 });
  M.parquet = std({ ...TX.setRepeat(wood, 1 / 3), roughness: 1, envMapIntensity: 0.3 });
  M.wood = std({ ...TX.setRepeat(wood, 1 / 1.5), roughness: 1, envMapIntensity: 0.3 });
  M.woodDark = std({ ...TX.setRepeat(woodDark, 1 / 1.5), roughness: 1, envMapIntensity: 0.3 });
  M.ceiling = std({ ...TX.setRepeat(woodDark, 1 / 3), roughness: 1, envMapIntensity: 0.15 });
  M.brass = std({ ...TX.brushedSet(), color: 0xc9a35a, metalness: 1, roughness: 1, envMapIntensity: 0.6 });
  M.iron = std({ color: 0x2b2a28, metalness: 0.8, roughness: 0.55, envMapIntensity: 0.4 });
  M.linen = std({ ...TX.fabricSet('linen', [0.93, 0.9, 0.84]), roughness: 1, envMapIntensity: 0.25 });
  M.blanket = std({ ...TX.fabricSet('blk', [0.45, 0.1, 0.08]), roughness: 1, envMapIntensity: 0.2 });
  M.blanket2 = std({ ...TX.fabricSet('blk2', [0.16, 0.2, 0.32]), roughness: 1, envMapIntensity: 0.2 });
  M.sack = std({ ...TX.fabricSet('sack', [0.62, 0.5, 0.34]), roughness: 1, envMapIntensity: 0.25 });
  M.rug = std({ ...TX.rugSet(), roughness: 1, envMapIntensity: 0.2 });
  M.ceramic = std({ color: 0x8a4a2e, roughness: 0.35, envMapIntensity: 0.5 });
  M.ceramicW = std({ color: 0xe8e1d4, roughness: 0.18, envMapIntensity: 0.6 });
  M.stoneDark = std({ ...TX.setRepeat(ashlar, 1 / 1.5), color: 0x6e6a64, roughness: 1, envMapIntensity: 0.3 });
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.05, ior: 1.5, envMapIntensity: 1, transparent: true });
  M.pane = new THREE.MeshPhysicalMaterial({ color: 0xf4f8ff, roughness: 0.05, transmission: 0.95, thickness: 0.01, transparent: true, opacity: 1 });
  M.sand = std({ color: 0xd9b77e, roughness: 0.95, envMapIntensity: 0.4 });
  M.water = new THREE.MeshPhysicalMaterial({ color: 0x9fc2c8, roughness: 0.02, transmission: 0.9, thickness: 0.4, ior: 1.33, envMapIntensity: 0.8 });
  M.flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.1, 0.7), toneMapped: true });
  M.ember = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.9, 0.2) });
  patchSurface(M.tile, { wet: true }); patchSurface(M.void, { wet: true }); patchSurface(M.ashlar, { wet: true, grime: 0.8 });
  patchSurface(M.plasterOut, { grime: 1 }); patchSurface(M.trim, { grime: 0.6 });
  for (const k in M) for (const t of ['map', 'roughnessMap', 'normalMap']) if (M[k][t]) M[k][t].anisotropy = maxAniso;
  return M;
}


// ------------------------------------------------------------------ shaders additionnels : sol mouillé (flaques) et salissures
export const surfaceU = { uWet: { value: 0 } };
const GLSL_NOISE = `
  float sh_h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float sh_n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(sh_h(i),sh_h(i+vec2(1,0)),f.x),mix(sh_h(i+vec2(0,1)),sh_h(i+1.),f.x),f.y);}
  float sh_fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*sh_n(p);p*=2.07;a*=.5;}return s;}
`;
function patchSurface(mat, { wet = false, grime = 0 } = {}) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWet = surfaceU.uWet;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform float uWet;\n' + GLSL_NOISE)
      .replace('#include <map_fragment>', `#include <map_fragment>
        ${grime > 0 ? `{ float g = smoothstep(0.0, 2.2, vWP.y + 0.2); float st = sh_fbm(vec2(vWP.x * 2.5 + vWP.z * 2.5, vWP.y * 0.25)); 
          float k = mix(0.45, 1.0, g) * mix(1.0, 0.86 + st * 0.2, ${grime.toFixed(2)}); diffuseColor.rgb *= mix(1.0, k, ${grime.toFixed(2)}); }` : ''}
        ${wet ? `float puddle = smoothstep(0.52, 0.62, sh_fbm(vWP.xz * 0.16 + 3.7)); float wetK = uWet;
          diffuseColor.rgb *= mix(1.0, mix(0.32, 0.12, puddle), wetK);` : ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        ${wet ? `roughnessFactor = mix(roughnessFactor, mix(0.16, 0.02, puddle), wetK);` : ''}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        ${wet ? `normal = normalize(mix(normal, normalize(vNormal), puddle * wetK));` : ''}`);
  };
  mat.customProgramCacheKey = () => 'surf' + (wet ? 'w' : '') + grime;
}

// UV « monde » pour boîtes : chaque face reçoit des UV en mètres → tuilage cohérent
function worldUV(geo) {
  geo.computeBoundingBox();
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay >= ax && ay >= az) uv.setXY(i, x, z); else if (ax >= az) uv.setXY(i, z, y); else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true; return geo;
}

function mesh(geo, mat, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m;
}
// boîte positionnée par ses bornes, UV en mètres (translatés pour un tuilage continu)
function boxAt(x0, y0, z0, x1, y1, z1, mat, opts = {}) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); worldUV(g);
  const m = mesh(g, mat, opts.cast !== false, true);
  if (opts.occ) occluders.push(m);
  return m;
}

// mur selon X (à z constant) ou selon Z (à x constant), avec ouvertures {a,b,y0,y1}
function wall(group, axis, c, a0, a1, t, mats2, openings = [], h = H, occ = true) {
  const [mIn, mOut] = Array.isArray(mats2) ? mats2 : [mats2, mats2];
  const ops = openings.slice().sort((p, q) => p.a - q.a);
  const pieces = []; let cur = a0;
  for (const o of ops) { if (o.a > cur) pieces.push([cur, o.a, 0, h, true]); pieces.push([o.a, o.b, o.y1, h, false]); if (o.y0 > 0) pieces.push([o.a, o.b, 0, o.y0, false]); cur = o.b; }
  if (cur < a1) pieces.push([cur, a1, 0, h, true]);
  for (const [s, e, y0, y1, solid] of pieces) {
    if (y1 - y0 < 0.001) continue;
    // deux demi-épaisseurs : face intérieure / extérieure avec matériaux distincts
    for (const side of [-1, 1]) {
      const m = side < 0 ? mIn : mOut;
      const b = axis === 'x'
        ? boxAt(s, y0, side < 0 ? c - t / 2 : c, e, y1, side < 0 ? c : c + t / 2, m, { occ })
        : boxAt(side < 0 ? c - t / 2 : c, y0, s, side < 0 ? c : c + t / 2, y1, e, m, { occ });
      group.add(b);
    }
    if (solid) { if (axis === 'x') box2(s, c - t / 2, e, c + t / 2); else box2(c - t / 2, s, c + t / 2, e); }
    else if (y0 > 0.5) { if (axis === 'x') box2(s, c - t / 2, e, c + t / 2); else box2(c - t / 2, s, c + t / 2, e); } // fenêtre : infranchissable
  }
}

// cadre + vitre d'une fenêtre, avec arc décoratif extérieur
function windowFrame(group, M, axis, c, a, b, y0, y1, outward) {
  const t = 0.07, d = 0.18;
  const add = (x0, y0_, z0, x1, y1_, z1) => group.add(boxAt(x0, y0_, z0, x1, y1_, z1, M.woodDark));
  const mid = (a + b) / 2;
  if (axis === 'x') {
    add(a, y0, c - d / 2, a + t, y1, c + d / 2); add(b - t, y0, c - d / 2, b, y1, c + d / 2);
    add(a, y0, c - d / 2, b, y0 + t, c + d / 2); add(a, y1 - t, c - d / 2, b, y1, c + d / 2);
    add(mid - t / 3, y0, c - 0.03, mid + t / 3, y1, c + 0.03); add(a, (y0 + y1) / 2 - t / 3, c - 0.03, b, (y0 + y1) / 2 + t / 3, c + 0.03);
    const p = mesh(new THREE.PlaneGeometry(b - a, y1 - y0), M.pane, false, false); p.position.set(mid, (y0 + y1) / 2, c); group.add(p);
    group.add(boxAt(a - 0.12, y0 - 0.12, c + outward * 0.25, b + 0.12, y0, c + outward * 0.42, M.trim)); // appui
    group.add(boxAt(a - 0.18, y1, c + outward * 0.25, b + 0.18, y1 + 0.22, c + outward * 0.38, M.trim)); // linteau
  } else {
    add(c - d / 2, y0, a, c + d / 2, y1, a + t); add(c - d / 2, y0, b - t, c + d / 2, y1, b);
    add(c - d / 2, y0, a, c + d / 2, y0 + t, b); add(c - d / 2, y1 - t, a, c + d / 2, y1, b);
    add(c - 0.03, y0, mid - t / 3, c + 0.03, y1, mid + t / 3); add(c - 0.03, (y0 + y1) / 2 - t / 3, a, c + 0.03, (y0 + y1) / 2 + t / 3, b);
    const p = mesh(new THREE.PlaneGeometry(b - a, y1 - y0), M.pane, false, false); p.rotation.y = Math.PI / 2; p.position.set(c, (y0 + y1) / 2, mid); group.add(p);
    group.add(boxAt(c + outward * 0.25, y0 - 0.12, a - 0.12, c + outward * 0.42, y0, b + 0.12, M.trim));
    group.add(boxAt(c + outward * 0.25, y1, a - 0.18, c + outward * 0.38, y1 + 0.22, b + 0.18, M.trim));
  }
}

function lathe(points, mat, seg = 48) {
  const g = new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), seg);
  return mesh(g, mat);
}

// lampe à huile en laiton + flamme + lumière ponctuelle chaude
function oilLamp(group, M, x, y, z, power = 1, shadow = false) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(lathe([[0, 0], [0.09, 0], [0.1, 0.02], [0.05, 0.05], [0.03, 0.12], [0.08, 0.16], [0.09, 0.2], [0.04, 0.24], [0.02, 0.26], [0, 0.26]], M.brass, 32));
  const glass = lathe([[0.02, 0.26], [0.06, 0.3], [0.065, 0.38], [0.035, 0.46], [0.03, 0.5]], M.glass, 32); glass.castShadow = false; g.add(glass);
  const fl = mesh(new THREE.SphereGeometry(0.018, 12, 8), M.flame, false, false); fl.scale.set(1, 2.4, 1); fl.position.y = 0.31; g.add(fl);
  const L = new THREE.PointLight(0xffb070, 5 * power, 9, 2); L.position.y = 0.34; L.castShadow = shadow;
  if (shadow) { L.shadow.mapSize.set(512, 512); L.shadow.bias = -0.002; L.shadow.radius = 6; }
  g.add(L); lights.push({ L, base: L.intensity, fl, ph: Math.random() * 10 });
  group.add(g); return g;
}

function sconce(group, M, x, y, z, ry, power = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  g.add(boxAt(-0.08, -0.15, 0, 0.08, 0.15, 0.03, M.brass));
  const arm = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), M.brass); arm.rotation.x = Math.PI / 2; arm.position.set(0, -0.05, 0.12); g.add(arm);
  const cup = lathe([[0, 0], [0.05, 0], [0.07, 0.05], [0.07, 0.07]], M.brass, 24); cup.position.set(0, -0.06, 0.22); g.add(cup);
  const c = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 12), M.ceramicW); c.position.set(0, 0.04, 0.22); g.add(c);
  const fl = mesh(new THREE.SphereGeometry(0.014, 10, 8), M.flame, false, false); fl.scale.set(1, 2.6, 1); fl.position.set(0, 0.13, 0.22); g.add(fl);
  const L = new THREE.PointLight(0xffa860, 3.5 * power, 7, 2); L.position.set(0, 0.18, 0.3); g.add(L);
  lights.push({ L, base: L.intensity, fl, ph: Math.random() * 10 });
  group.add(g);
}


// suspension : chaîne + abat-jour conique en laiton, ampoule chaude, spot vers le bas
function pendant(group, M, x, z, drop = 2.2, shadow = false, power = 1) {
  const g = new THREE.Group(); g.position.set(x, H, z);
  const ch = mesh(new THREE.CylinderGeometry(0.006, 0.006, drop, 6), M.iron, false); ch.position.y = -drop / 2; g.add(ch);
  const shade = lathe([[0.03, 0], [0.05, -0.02], [0.12, -0.08], [0.26, -0.22], [0.28, -0.26], [0.27, -0.26], [0.25, -0.22], [0.11, -0.085], [0.04, -0.03], [0.025, -0.01]], M.brass, 48);
  shade.material = M.brass.clone(); shade.material.side = THREE.DoubleSide; shade.position.y = -drop; g.add(shade);
  const bulb = mesh(new THREE.SphereGeometry(0.045, 16, 12), M.flame, false, false); bulb.position.y = -drop - 0.12; g.add(bulb);
  const sp = new THREE.SpotLight(0xffb46a, 22 * power, 9, 0.95, 0.6, 2); sp.position.y = -drop - 0.1; sp.target.position.set(0, -drop - 3, 0); g.add(sp, sp.target);
  sp.castShadow = shadow; if (shadow) { sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0008; sp.shadow.radius = 5; sp.shadow.camera.near = 0.1; }
  const fill = new THREE.PointLight(0xffa45a, 1.2 * power, 4, 2); fill.position.y = -drop - 0.05; g.add(fill);
  lights.push({ L: sp, base: sp.intensity, fl: null, ph: 0, steady: true });
  group.add(g); return g;
}
function bottle(group, x, y, z, h, col) {
  const m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.72, envMapIntensity: 1.2, clearcoat: 1 });
  const b = lathe([[0, 0], [0.035, 0], [0.037, 0.01], [0.037, h * 0.62], [0.02, h * 0.78], [0.011, h * 0.84], [0.011, h], [0, h]], m, 20);
  b.castShadow = true; b.position.set(x, y, z); group.add(b);
}

function bed(group, M, x, z, ry, blanket) {
  const g = new THREE.Group(); g.position.set(x, FLOOR_IN, z); g.rotation.y = ry;
  const L = 2.15, W = 1.15;
  g.add(boxAt(-W / 2, 0.12, -L / 2, W / 2, 0.36, L / 2, M.woodDark));
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(boxAt(a * W / 2 - (a > 0 ? 0.08 : 0), 0, b * L / 2 - (b > 0 ? 0.08 : 0), a * W / 2 + (a < 0 ? 0.08 : 0), 0.45, b * L / 2 + (b < 0 ? 0.08 : 0), M.woodDark));
  g.add(boxAt(-W / 2, 0.36, -L / 2 - 0.02, W / 2, 1.05, -L / 2 + 0.07, M.woodDark)); // tête de lit
  const mat = mesh(new RoundedBoxGeometry(W - 0.08, 0.24, L - 0.12, 4, 0.08), M.linen); mat.position.set(0, 0.48, 0.02); g.add(mat);
  const bl = mesh(new RoundedBoxGeometry(W - 0.02, 0.08, L * 0.62, 4, 0.04), blanket); bl.position.set(0, 0.62, L * 0.18); g.add(bl);
  const fold = mesh(new RoundedBoxGeometry(W - 0.02, 0.1, 0.22, 4, 0.05), M.linen); fold.position.set(0, 0.64, -L * 0.13); g.add(fold);
  const pil = mesh(new RoundedBoxGeometry(0.7, 0.16, 0.38, 5, 0.08), M.linen); pil.position.set(0, 0.68, -L / 2 + 0.32); pil.rotation.x = -0.2; g.add(pil);
  group.add(g);
  const c = Math.cos(ry), s = Math.sin(ry), hw = W / 2 + 0.05, hl = L / 2 + 0.05;
  const pts = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([a, b]) => [x + a * c + b * s, z - a * s + b * c]);
  for (let i = 0; i < 4; i++) seg(pts[i][0], pts[i][1], pts[(i + 1) % 4][0], pts[(i + 1) % 4][1]);
}

function table(group, M, x, z, w, d, h = 0.78) {
  const y = FLOOR_IN;
  group.add(boxAt(x - w / 2, y + h - 0.06, z - d / 2, x + w / 2, y + h, z + d / 2, M.wood));
  group.add(boxAt(x - w / 2 + 0.06, y + h - 0.16, z - d / 2 + 0.06, x + w / 2 - 0.06, y + h - 0.06, z + d / 2 - 0.06, M.woodDark));
  for (const a of [-1, 1]) for (const b of [-1, 1]) group.add(boxAt(x + a * (w / 2 - 0.08) - 0.05, y, z + b * (d / 2 - 0.08) - 0.05, x + a * (w / 2 - 0.08) + 0.05, y + h - 0.06, z + b * (d / 2 - 0.08) + 0.05, M.woodDark));
  box2(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
}

function stool(group, M, x, z) {
  const y = FLOOR_IN;
  const top = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), M.wood); top.position.set(x, y + 0.46, z); group.add(top);
  for (let i = 0; i < 3; i++) { const a = i * 2.094; const l = mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.46, 8), M.woodDark); l.position.set(x + Math.cos(a) * 0.13, y + 0.23, z + Math.sin(a) * 0.13); l.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); group.add(l); }
}

function jar(group, M, x, y, z, s = 1, mat) {
  const j = lathe([[0, 0], [0.08, 0], [0.12, 0.06], [0.13, 0.15], [0.1, 0.24], [0.06, 0.28], [0.065, 0.31], [0, 0.31]].map(p => [p[0] * s, p[1] * s]), mat || M.ceramic, 28);
  j.position.set(x, y, z); group.add(j);
}
function sack(group, M, x, y, z, s = 1) {
  const g = new THREE.SphereGeometry(0.28 * s, 24, 16); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { let yy = p.getY(i); const k = yy < 0 ? 1.15 : 0.8; p.setXYZ(i, p.getX(i) * k, (yy < -0.18 * s ? -0.18 * s : yy) * 1.2, p.getZ(i) * k); }
  g.computeVertexNormals(); const m = mesh(g, M.sack); m.position.set(x, y + 0.22 * s, z); m.rotation.y = x * 3; group.add(m);
}
function barrel(group, M, x, z, s = 1) {
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([0.3 + Math.sin(t * Math.PI) * 0.05, t * 0.9]); }
  const b = lathe([[0, 0], ...pts, [0, 0.9]].map(p => [p[0] * s, p[1] * s]), M.wood, 32); b.position.set(x, FLOOR_IN, z); group.add(b);
  for (const t of [0.12, 0.78]) { const r = mesh(new THREE.TorusGeometry((0.315 + Math.sin(t * Math.PI) * 0.05) * s, 0.012, 6, 40), M.iron); r.rotation.x = Math.PI / 2; r.position.set(x, FLOOR_IN + t * 0.9 * s, z); group.add(r); }
  circ(x, z, 0.36 * s);
}

// sablier monumental (repère du temps qui passe)
function hourglass(group, M, x, z) {
  const g = new THREE.Group(); g.position.set(x, FLOOR_IN, z);
  const disc = (y, r, h) => { const d = mesh(new THREE.CylinderGeometry(r, r * 1.04, h, 64), M.woodDark); d.position.y = y; g.add(d); };
  disc(0.12, 1.15, 0.24); disc(0.29, 1.0, 0.1); disc(3.36, 1.0, 0.1); disc(3.5, 1.15, 0.2);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const c = lathe([[0.07, 0], [0.09, 0.05], [0.06, 0.15], [0.06, 2.85], [0.09, 2.95], [0.07, 3.0]], M.brass, 24); c.position.set(Math.cos(a) * 0.82, 0.34, Math.sin(a) * 0.82); g.add(c); }
  const prof = []; for (let i = 0; i <= 40; i++) { const t = i / 40, y = 0.34 + t * 3.0; const k = Math.abs(t - 0.5) * 2; prof.push([0.06 + Math.pow(Math.sin(Math.acos(1 - k)), 1) * 0.66 * (k > 0.98 ? (1 - k) * 50 * 0.66 + 0.34 : 1), y]); }
  const glass = lathe(prof, M.glass, 64); glass.castShadow = false; g.add(glass);
  const sandTop = lathe([[0, 2.05], [0.5, 2.5], [0.6, 2.75], [0, 2.75]], M.sand, 48); g.add(sandTop);
  const sandBot = lathe([[0, 0.36], [0.62, 0.36], [0.6, 0.58], [0.3, 0.82], [0, 0.95]], M.sand, 48); g.add(sandBot);
  const stream = mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.1, 6), M.sand); stream.position.y = 1.5; g.add(stream);
  group.add(g); circ(x, z, 1.25);
}

// ------------------------------------------------------------------ construction
export function buildWorld(scene, renderer) {
  const M = mats(renderer.capabilities.getMaxAnisotropy());
  const W = new THREE.Group(); scene.add(W);

  // sol du vide (immense) + parvis dallé
  const voidG = mesh(new THREE.PlaneGeometry(6000, 6000), M.void, false, true);
  voidG.rotation.x = -Math.PI / 2; voidG.position.y = VOID_Y;
  { const uv = voidG.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6000, uv.getY(i) * 6000); }
  W.add(voidG);
  W.add(boxAt(PLAT.x0, VOID_Y - 0.1, PLAT.z0, PLAT.x1, 0, PLAT.z1, M.tile, { cast: false }));
  // bordure en pierre du parvis
  const curb = 0.35;
  W.add(boxAt(PLAT.x0 - curb, VOID_Y, PLAT.z0 - curb, PLAT.x1 + curb, 0.02, PLAT.z0, M.ashlar));
  W.add(boxAt(PLAT.x0 - curb, VOID_Y, PLAT.z1, PLAT.x1 + curb, 0.02, PLAT.z1 + curb, M.ashlar));
  W.add(boxAt(PLAT.x0 - curb, VOID_Y, PLAT.z0, PLAT.x0, 0.02, PLAT.z1, M.ashlar));
  W.add(boxAt(PLAT.x1, VOID_Y, PLAT.z0, PLAT.x1 + curb, 0.02, PLAT.z1, M.ashlar));

  const B = new THREE.Group(); W.add(B);
  // socle du bâtiment
  B.add(boxAt(-8.4, 0, -12.4, 8.4, FLOOR_IN, 2.4, M.ashlar, { cast: false }));
  // sols intérieurs : hall en dalles, chambre en parquet, cuisine/bain en dalles
  B.add(boxAt(-4, FLOOR_IN, -11.75, 4, FLOOR_IN + 0.005, 1.75, M.floorIn, { cast: false }));
  B.add(boxAt(-7.75, FLOOR_IN, -11.75, -4, FLOOR_IN + 0.005, 1.75, M.parquet, { cast: false }));
  B.add(boxAt(4, FLOOR_IN, -11.75, 7.75, FLOOR_IN + 0.005, 1.75, M.floorIn, { cast: false }));

  const T = 0.5, inOut = [M.plasterIn, M.plasterOut];
  const Y0 = FLOOR_IN;
  const win = (a, b) => ({ a, b, y0: Y0 + 1.25, y1: Y0 + 4.0 });
  // murs extérieurs (face intérieure en enduit chaud, extérieure en blanc)
  wall(B, 'x', 2, -8, 8, T, [M.plasterIn, M.plasterOut], [{ a: -1.35, b: 1.35, y0: 0, y1: Y0 + 3.9 }, win(-6.7, -5.3), win(5.3, 6.7)]);
  wall(B, 'x', -12, -8, 8, T, [M.plasterOut, M.plasterIn].reverse(), [win(-0.8, 0.8), win(-6.6, -5.4), win(5.4, 6.6)]);
  wall(B, 'z', -8, -12.25, 2.25, T, [M.plasterOut, M.plasterIn], [win(-9.9, -8.7), win(-2.6, -1.4)]);
  wall(B, 'z', 8, -12.25, 2.25, T, [M.plasterIn, M.plasterOut], [win(-2.6, -1.4), { a: -9.2, b: -8.0, y0: Y0 + 2.4, y1: Y0 + 3.8 }]);
  // cadres de fenêtres
  windowFrame(B, M, 'x', 2, -6.7, -5.3, Y0 + 1.25, Y0 + 4.0, 1); windowFrame(B, M, 'x', 2, 5.3, 6.7, Y0 + 1.25, Y0 + 4.0, 1);
  windowFrame(B, M, 'x', -12, -0.8, 0.8, Y0 + 1.25, Y0 + 4.0, -1); windowFrame(B, M, 'x', -12, -6.6, -5.4, Y0 + 1.25, Y0 + 4.0, -1); windowFrame(B, M, 'x', -12, 5.4, 6.6, Y0 + 1.25, Y0 + 4.0, -1);
  windowFrame(B, M, 'z', -8, -9.9, -8.7, Y0 + 1.25, Y0 + 4.0, -1); windowFrame(B, M, 'z', -8, -2.6, -1.4, Y0 + 1.25, Y0 + 4.0, -1);
  windowFrame(B, M, 'z', 8, -2.6, -1.4, Y0 + 1.25, Y0 + 4.0, 1); windowFrame(B, M, 'z', 8, -9.2, -8.0, Y0 + 2.4, Y0 + 3.8, 1);
  // cloisons intérieures
  const IN = M.plasterIn, door = (a, b) => ({ a, b, y0: 0, y1: Y0 + 2.6 });
  wall(B, 'z', -4, -11.75, 1.75, 0.3, IN, [door(-6.2, -4.8), door(-0.2, 1.0)]);
  wall(B, 'z', 4, -11.75, 1.75, 0.3, IN, [door(-1.6, -0.2), door(-9.4, -8.0)]);
  wall(B, 'x', -5, 4.15, 7.75, 0.3, IN);
  // chambranles de portes intérieures
  const jamb = (axis, c, a, b) => { const h = Y0 + 2.6; if (axis === 'z') { B.add(boxAt(c - 0.2, 0, a - 0.08, c + 0.2, h + 0.12, a, M.woodDark)); B.add(boxAt(c - 0.2, 0, b, c + 0.2, h + 0.12, b + 0.08, M.woodDark)); B.add(boxAt(c - 0.2, h, a - 0.08, c + 0.2, h + 0.12, b + 0.08, M.woodDark)); } };
  jamb('z', -4, -6.2, -4.8); jamb('z', -4, -0.2, 1.0); jamb('z', 4, -1.6, -0.2); jamb('z', 4, -9.4, -8.0);

  // lambris bois sombre (1,1 m) + cimaise sur les faces intérieures des murs
  const wain = (x0, z0, x1, z1) => { I0.add(boxAt(x0, FLOOR_IN, z0, x1, FLOOR_IN + 1.1, z1, M.woodDark, { cast: false })); };
  const I0 = new THREE.Group(); B.add(I0);
  const e = 0.04, rails = [
    // [axe, coord, début, fin, côté(+1 = vers +), trous]
    ['x', 1.75, -7.75, 7.75, -1, [[-1.35, 1.35]]], ['x', -11.75, -7.75, 7.75, 1, []],
    ['z', -7.75, -11.75, 1.75, 1, []], ['z', 7.75, -11.75, 1.75, -1, []],
    ['z', -4.15, -11.75, 1.75, -1, [[-6.2, -4.8], [-0.2, 1.0]]], ['z', -3.85, -11.75, 1.75, 1, [[-6.2, -4.8], [-0.2, 1.0]]],
    ['z', 3.85, -11.75, 1.75, -1, [[-1.6, -0.2], [-9.4, -8.0]]], ['z', 4.15, -11.75, 1.75, 1, [[-1.6, -0.2], [-9.4, -8.0]]],
  ];
  for (const [ax, c, a0, a1, sd, holes] of rails) {
    let cur = a0; const segs2 = [];
    for (const [ha, hb] of holes) { segs2.push([cur, ha]); cur = hb; } segs2.push([cur, a1]);
    for (const [sa, sb] of segs2) { if (sb - sa < 0.05) continue;
      if (ax === 'x') { wain(sa, Math.min(c, c + sd * e), sb, Math.max(c, c + sd * e)); I0.add(boxAt(sa, FLOOR_IN + 1.1, Math.min(c, c + sd * e * 2), sb, FLOOR_IN + 1.16, Math.max(c, c + sd * e * 2), M.wood, { cast: false })); }
      else { wain(Math.min(c, c + sd * e), sa, Math.max(c, c + sd * e), sb); I0.add(boxAt(Math.min(c, c + sd * e * 2), FLOOR_IN + 1.1, sa, Math.max(c, c + sd * e * 2), FLOOR_IN + 1.16, sb, M.wood, { cast: false })); }
    }
  }

  // plafond (dalle percée d'un oculus au-dessus du sablier) + poutres
  const shape = new THREE.Shape(); shape.moveTo(-8.25, -2.25); shape.lineTo(8.25, -2.25); shape.lineTo(8.25, 12.25); shape.lineTo(-8.25, 12.25); shape.lineTo(-8.25, -2.25);
  const hole = new THREE.Path(); hole.absarc(0, 5, 3.4, 0, Math.PI * 2, true); shape.holes.push(hole);
  const roofG = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false, curveSegments: 64 });
  roofG.rotateX(Math.PI / 2); roofG.translate(0, H + 0.55, 0); worldUV(roofG);
  // la forme est dans le plan XY puis tournée : z = +y_shape → on remet l'oculus à z = -5
  roofG.scale(1, 1, -1); roofG.computeVertexNormals();
  const roof = mesh(roofG, M.plasterOut); B.add(roof); occluders.push(roof);
  // sous-face : plafond bois sombre (sans l'oculus)
  const ceilG = new THREE.ShapeGeometry(shape, 64); ceilG.rotateX(Math.PI / 2); ceilG.scale(1, 1, -1); ceilG.translate(0, H - 0.01, 0); worldUV(ceilG);
  const ceil = mesh(ceilG, M.ceiling, false, true); ceil.material.side = THREE.DoubleSide; B.add(ceil);
  for (const z of [-10.5, -8.4, 0.4, -1.6]) B.add(boxAt(-7.75, H - 0.32, z - 0.13, 7.75, H, z + 0.13, M.woodDark));
  for (const x of [-6, 6]) B.add(boxAt(x - 0.13, H - 0.32, -11.75, x + 0.13, H, 1.75, M.woodDark));
  // corniche et acrotère
  B.add(boxAt(-8.6, H + 0.4, -12.6, 8.6, H + 0.75, 2.6, M.trim));
  B.add(boxAt(-8.6, H + 0.75, -12.6, 8.6, H + 1.25, -12.3, M.plasterOut)); B.add(boxAt(-8.6, H + 0.75, 2.3, 8.6, H + 1.25, 2.6, M.plasterOut));
  B.add(boxAt(-8.6, H + 0.75, -12.6, -8.3, H + 1.25, 2.6, M.plasterOut)); B.add(boxAt(8.3, H + 0.75, -12.6, 8.6, H + 1.25, 2.6, M.plasterOut));
  for (const [x0, z0, x1, z1] of [[-8.55, 2.25, -1.55, 2.55], [1.55, 2.25, 8.55, 2.55], [-8.55, -12.55, 8.55, -12.25], [-8.55, -12.55, -8.25, 2.55], [8.25, -12.55, 8.55, 2.55]]) B.add(boxAt(x0, 1.0, z0, x1, 1.18, z1, M.trim)); // bandeau

  // tambour + coupole percée
  const drumIn = mesh(new THREE.CylinderGeometry(3.4, 3.4, 1.6, 96, 1, true), M.plasterIn); drumIn.material = M.plasterIn.clone(); drumIn.material.side = THREE.BackSide; drumIn.position.set(0, H + 0.55 + 0.8, -5); B.add(drumIn);
  const drumOut = mesh(new THREE.CylinderGeometry(3.8, 3.8, 1.6, 96, 1, true), M.plasterOut); drumOut.position.set(0, H + 0.55 + 0.8, -5); B.add(drumOut);
  const drumTop = mesh(new THREE.RingGeometry(3.4, 4.0, 96), M.trim); drumTop.rotation.x = -Math.PI / 2; drumTop.position.set(0, H + 2.16, -5); B.add(drumTop);
  const dome = mesh(new THREE.SphereGeometry(3.85, 96, 48, 0, Math.PI * 2, 0.2, Math.PI / 2 - 0.2), M.plasterOut); dome.position.set(0, H + 2.15, -5); dome.material = M.plasterOut.clone(); dome.material.side = THREE.DoubleSide; B.add(dome);
  const ocRing = mesh(new THREE.TorusGeometry(0.77, 0.1, 12, 64), M.trim); ocRing.rotation.x = Math.PI / 2; ocRing.position.set(0, H + 2.15 + 3.85 * Math.cos(0.2), -5); B.add(ocRing);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const r = mesh(new THREE.TorusGeometry(3.87, 0.05, 6, 48, Math.PI / 2 - 0.22), M.trim); r.position.set(0, H + 2.15, -5); r.rotation.set(0, a, Math.PI / 2); r.rotation.order = 'YXZ'; B.add(r); }

  // portique d'entrée : 3 marches, 4 colonnes, entablement
  B.add(boxAt(-5.2, 0, 2.0, 5.2, FLOOR_IN, 3.4, M.ashlar, { cast: false }));
  B.add(boxAt(-5.2, 0, 3.4, 5.2, 0.24, 4.0, M.ashlar, { cast: false }));
  B.add(boxAt(-5.2, 0, 4.0, 5.2, 0.12, 4.6, M.ashlar, { cast: false }));
  for (const x of [-4.4, -1.9, 1.9, 4.4]) {
    const col = lathe([[0, 0], [0.46, 0], [0.46, 0.12], [0.38, 0.2], [0.34, 0.32], [0.32, 4.6], [0.38, 4.7], [0.46, 4.82], [0.46, 4.95], [0, 4.95]], M.trim, 48);
    col.position.set(x, FLOOR_IN, 3.0); B.add(col); circ(x, 3.0, 0.5); occluders.push(col);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const fl = mesh(new THREE.CylinderGeometry(0.035, 0.035, 4.2, 6), M.plasterOut); fl.position.set(x + Math.cos(a) * 0.325, FLOOR_IN + 2.45, 3.0 + Math.sin(a) * 0.325); B.add(fl); }
  }
  B.add(boxAt(-5.0, FLOOR_IN + 4.95, 2.0, 5.0, FLOOR_IN + 5.55, 3.65, M.trim));
  B.add(boxAt(-5.2, FLOOR_IN + 5.55, 2.0, 5.2, FLOOR_IN + 5.8, 3.85, M.plasterOut));
  // fronton triangulaire
  const ped = new THREE.Shape(); ped.moveTo(-5.2, 0); ped.lineTo(5.2, 0); ped.lineTo(0, 1.35); ped.lineTo(-5.2, 0);
  const pedG = new THREE.ExtrudeGeometry(ped, { depth: 1.8, bevelEnabled: false }); pedG.translate(0, FLOOR_IN + 5.8, 2.02); worldUV(pedG);
  B.add(mesh(pedG, M.plasterOut));
  // portes ouvertes à double battant
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group(); leaf.position.set(s * 1.3, FLOOR_IN, 1.75); leaf.rotation.y = s * 1.75;
    leaf.add(boxAt(s < 0 ? 0 : -1.28, 0, -0.04, s < 0 ? 1.28 : 0, 3.5, 0.04, M.woodDark));
    for (const y of [0.6, 2.0]) leaf.add(boxAt(s < 0 ? 0.15 : -1.13, y, 0.04, s < 0 ? 1.13 : -0.15, y + 1.1, 0.07, M.wood));
    const ring = mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 24), M.brass); ring.position.set(s < 0 ? 1.1 : -1.1, 1.6, 0.09); leaf.add(ring);
    B.add(leaf);
  }
  B.add(boxAt(-1.55, 0, 1.95, -1.35, FLOOR_IN + 4.1, 2.35, M.trim)); B.add(boxAt(1.35, 0, 1.95, 1.55, FLOOR_IN + 4.1, 2.35, M.trim));
  B.add(boxAt(-1.55, FLOOR_IN + 3.9, 1.95, 1.55, FLOOR_IN + 4.3, 2.35, M.trim));

  // deux tours élancées flanquant le bâtiment
  for (const s of [-1, 1]) {
    const tx = s * 12.5, tz = -7;
    B.add(boxAt(tx - 2.3, 0, tz - 2.3, tx + 2.3, 1.2, tz + 2.3, M.ashlar));
    B.add(boxAt(tx - 2.45, 1.2, tz - 2.45, tx + 2.45, 1.45, tz + 2.45, M.trim));
    const shaft = lathe([[0, 0], [1.85, 0], [1.85, 0.3], [1.7, 0.5], [1.55, 18], [1.75, 18.3], [1.85, 18.6], [1.85, 19.2], [0, 19.2]], M.plasterOut, 96);
    shaft.position.set(tx, 1.45, tz); B.add(shaft); occluders.push(shaft);
    for (const y of [6.5, 12.5]) { const b = mesh(new THREE.TorusGeometry(1.66 - y * 0.0085, 0.09, 10, 96), M.trim); b.rotation.x = Math.PI / 2; b.position.set(tx, 1.45 + y, tz); B.add(b); }
    // fentes de lumière
    for (let k = 0; k < 3; k++) { const ang = Math.PI / 2 * (s < 0 ? 1 : -1) + (k - 1) * 0.0; const y = 4 + k * 5; const sl = boxAt(-0.12, -0.9, -0.05, 0.12, 0.9, 0.05, M.woodDark, { cast: false }); sl.position.set(tx + Math.cos(Math.PI / 2) * 0, 1.45 + y, tz + 1.62 - y * 0.0085 * 0.9); B.add(sl); }
    const cap = lathe([[0, 0], [2.05, 0], [2.05, 0.35], [1.4, 1.4], [0.55, 3.6], [0.18, 5.2], [0, 5.6]], M.plasterOut, 96);
    cap.position.set(tx, 20.65, tz); B.add(cap);
    const fin = lathe([[0, 0], [0.12, 0], [0.18, 0.3], [0.05, 0.6], [0.08, 0.9], [0.02, 1.6], [0, 1.7]], M.brass, 24); fin.position.set(tx, 26.2, tz); B.add(fin);
    circ(tx, tz, 2.4);
  }
  box2(-8.4, -12.4, 8.4, -12.3); // garde-fou arrière (le socle suffit)
  // marches latérales du portique bloquées par le socle
  seg(-5.2, 2.0, -5.2, 4.6); seg(5.2, 2.0, 5.2, 4.6); seg(-8.4, 2.4, -5.2, 2.4); seg(5.2, 2.4, 8.4, 2.4);

  // ------------------------------------------------ intérieur
  const I = new THREE.Group(); B.add(I);
  // hall central : sablier sous l'oculus, 4 piliers, tapis, banquettes
  hourglass(I, M, 0, -5);
  for (const [x, z] of [[-2.7, -7.7], [2.7, -7.7], [-2.7, -2.3], [2.7, -2.3]]) {
    const p = lathe([[0, 0], [0.36, 0], [0.36, 0.15], [0.28, 0.25], [0.26, H - FLOOR_IN - 0.35], [0.34, H - FLOOR_IN - 0.2], [0.34, H - FLOOR_IN], [0, H - FLOOR_IN]], M.plasterIn, 40);
    p.position.set(x, FLOOR_IN, z); I.add(p); circ(x, z, 0.4); sconce(I, M, x, FLOOR_IN + 2.4, z + (z < -5 ? 0.27 : -0.27), z < -5 ? 0 : Math.PI, 0.9);
  }
  const rug = mesh(new THREE.PlaneGeometry(5.6, 7.6), M.rug, false, true); rug.rotation.x = -Math.PI / 2; rug.position.set(0, FLOOR_IN + 0.012, -5); I.add(rug);
  for (const z of [-10.6]) { const bench = mesh(new RoundedBoxGeometry(4.2, 0.45, 0.8, 4, 0.06), M.woodDark); bench.position.set(0, FLOOR_IN + 0.225, z); I.add(bench); const cush = mesh(new RoundedBoxGeometry(4.0, 0.14, 0.7, 4, 0.06), M.blanket); cush.position.set(0, FLOOR_IN + 0.52, z); I.add(cush); box2(-2.1, z - 0.4, 2.1, z + 0.4); }
  // chambre (aile gauche)
  bed(I, M, -6.6, -10.3, Math.PI / 2, M.blanket); bed(I, M, -6.6, -7.3, Math.PI / 2, M.blanket2);
  table(I, M, -7.3, -8.8, 0.5, 0.5, 0.62); oilLamp(I, M, -7.3, FLOOR_IN + 0.62, -8.8, 1.1, true);
  // armoire
  I.add(boxAt(-7.75, FLOOR_IN, 0.2, -6.9, FLOOR_IN + 2.3, 1.7, M.woodDark)); box2(-7.75, 0.2, -6.9, 1.7);
  I.add(boxAt(-6.92, FLOOR_IN + 0.15, 0.3, -6.88, FLOOR_IN + 2.15, 0.93, M.wood)); I.add(boxAt(-6.92, FLOOR_IN + 0.15, 0.97, -6.88, FLOOR_IN + 2.15, 1.6, M.wood));
  const brug = mesh(new THREE.PlaneGeometry(2.4, 3.4), M.rug, false, true); brug.rotation.x = -Math.PI / 2; brug.position.set(-5.4, FLOOR_IN + 0.012, -4.2); I.add(brug);
  sconce(I, M, -4.17, FLOOR_IN + 2.2, -2.2, -Math.PI / 2, 0.8);
  // cuisine / réserve (aile droite, avant)
  I.add(boxAt(7.1, FLOOR_IN, -4.8, 7.75, FLOOR_IN + 0.9, 1.6, M.woodDark)); box2(7.1, -4.8, 7.75, 1.6);
  I.add(boxAt(7.0, FLOOR_IN + 0.9, -4.85, 7.75, FLOOR_IN + 0.98, 1.65, M.stoneDark));
  // foyer en pierre avec braises
  I.add(boxAt(4.3, FLOOR_IN, -4.85, 5.9, FLOOR_IN + 0.9, -4.15, M.stoneDark)); box2(4.3, -4.85, 5.9, -4.15);
  I.add(boxAt(4.5, FLOOR_IN + 0.9, -4.85, 5.7, FLOOR_IN + 1.0, -4.3, M.iron));
  const em = mesh(new THREE.BoxGeometry(1.0, 0.04, 0.4), M.ember, false, false); em.position.set(5.1, FLOOR_IN + 0.88, -4.5); I.add(em);
  const fire = new THREE.PointLight(0xff6a20, 7, 6, 2); fire.position.set(5.1, FLOOR_IN + 1.2, -4.2); I.add(fire); lights.push({ L: fire, base: 7, fl: null, ph: 3 });
  const pot = lathe([[0, 0], [0.2, 0], [0.24, 0.1], [0.24, 0.3], [0.22, 0.32]], M.iron, 32); pot.position.set(5.1, FLOOR_IN + 1.0, -4.55); I.add(pot);
  // étagères de provisions contre la cloison bain/cuisine
  for (const y of [0.5, 1.2, 1.9]) I.add(boxAt(4.3, FLOOR_IN + y, -4.85 + 0.0, 4.32, FLOOR_IN + y + 0.04, -4.84, M.wood));
  for (let k = 0; k < 6; k++) jar(I, M, 7.35, FLOOR_IN + 0.98, -4.4 + k * 0.55, 0.8 + (k % 3) * 0.15, k % 2 ? M.ceramic : M.ceramicW);
  for (const [x, z, s] of [[7.3, 1.25, 1], [6.75, 1.35, 0.85], [7.3, 0.7, 0.9]]) sack(I, M, x - 0.8, FLOOR_IN, z, s);
  barrel(I, M, 4.7, 1.2, 1); barrel(I, M, 5.45, 1.35, 0.9);
  table(I, M, 5.7, -2.6, 1.3, 0.8); stool(I, M, 5.0, -2.6); stool(I, M, 6.4, -2.6); oilLamp(I, M, 5.85, FLOOR_IN + 0.78, -2.5, 1.0, false);
  jar(I, M, 5.4, FLOOR_IN + 0.78, -2.75, 0.6, M.ceramicW);

  // appliques extérieures de part et d'autre de la porte
  sconce(B, M, -2.2, FLOOR_IN + 2.7, 2.27, 0, 3.2); sconce(B, M, 2.2, FLOOR_IN + 2.7, 2.27, 0, 3.2);
  // suspensions
  pendant(I, M, 5.7, -2.6, 2.6, true, 1); pendant(I, M, 0, -10.3, 2.9, false, 0.8); pendant(I, M, -5.6, -4.0, 3.1, false, 0.6);
  // étagères murales chargées de bouteilles et bocaux au-dessus du plan de travail
  for (const y of [1.55, 2.05, 2.55]) {
    I.add(boxAt(7.42, FLOOR_IN + y, -4.6, 7.75, FLOOR_IN + y + 0.035, 1.4, M.wood));
    for (let zz = -4.45; zz < 1.3; zz += 0.11 + ((zz * 13.7) % 1 + 1) % 1 * 0.08) {
      const r = ((zz * 91.3 + y * 7) % 1 + 1) % 1;
      if (r < 0.62) bottle(I, 7.6, FLOOR_IN + y + 0.035, zz, 0.24 + r * 0.16, [0x5a3a12, 0x1f4a2a, 0x7a1e14, 0xb5904a, 0x2a2a35][Math.floor(r * 8) % 5]);
      else jar(I, M, 7.6, FLOOR_IN + y + 0.035, zz, 0.55, r > 0.8 ? M.ceramicW : M.ceramic);
    }
  }
  for (const z of [-4.5, -1.5, 1.3]) I.add(boxAt(7.68, FLOOR_IN + 1.4, z - 0.02, 7.75, FLOOR_IN + 2.6, z + 0.02, M.woodDark));
  // bain (aile droite, arrière)
  const tub = lathe([[0, 0], [1.25, 0], [1.3, 0.1], [1.3, 0.62], [1.38, 0.68], [1.36, 0.74], [1.15, 0.74], [1.1, 0.68], [1.1, 0.1], [0, 0.1]], M.stoneDark, 96); tub.position.set(6.0, FLOOR_IN, -9.0); I.add(tub); circ(6.0, -9.0, 1.4);
  const water = mesh(new THREE.CircleGeometry(1.1, 64), M.water, false, true); water.rotation.x = -Math.PI / 2; water.position.set(6.0, FLOOR_IN + 0.55, -9.0); I.add(water);
  I.add(boxAt(4.15, FLOOR_IN, -11.75, 7.75, FLOOR_IN + 1.3, -11.6, M.stoneDark, { cast: false }));
  oilLamp(I, M, 7.45, FLOOR_IN + 0.98, -6.0, 0.8, false); I.add(boxAt(7.2, FLOOR_IN, -6.3, 7.75, FLOOR_IN + 0.98, -5.7, M.woodDark)); box2(7.2, -6.3, 7.75, -5.7);
  const towel = mesh(new RoundedBoxGeometry(0.5, 0.06, 0.4, 3, 0.03), M.linen); towel.position.set(7.45, FLOOR_IN + 1.01, -6.1); I.add(towel);

  // lumière d'ambiance très faible à l'intérieur (lueur chaude rebondie)
  const bounce = new THREE.PointLight(0xffd8b0, 1.2, 14, 1.5); bounce.position.set(0, FLOOR_IN + 4.5, -5); I.add(bounce);

  // poussière en suspension (dans le faisceau de l'oculus et dans le hall)
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 8; pos[i * 3 + 1] = FLOOR_IN + Math.random() * 5.6; pos[i * 3 + 2] = -5 + (Math.random() - 0.5) * 12; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff0d8, size: 0.005, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
  I.add(dust);

  return { M, dust };
}
