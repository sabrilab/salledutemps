import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, NoiseEffect, BlendFunction, SMAAEffect, Effect, EffectAttribute } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { buildWorld, groundHeight, colliders, occluders, lights, FLOOR_IN, surfaceU } from './world.js';
import { loadMannequin } from './mannequin.js';

const params = new URLSearchParams(location.search);
const Q = params.get('q') || (matchMedia('(pointer: coarse)').matches ? 'low' : 'high');

// ------------------------------------------------------------------ rendu
const renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q === 'low' ? 1 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 3000);

// ciel : dégradé + nuages procéduraux + éclair
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, cloud: { value: 0 }, flash: { value: 0 }, time: { value: 0 }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 64, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z = gl_Position.w; }`,
  fragmentShader: `uniform vec3 top,hor,sunCol,sunDir; uniform float cloud,flash,time; varying vec3 vD;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
  float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}
  void main(){ vec3 d=normalize(vD); float y=max(d.y,0.); vec3 c=mix(hor,top,pow(y,.55));
    vec2 uv=d.xz/(d.y+.12)*1.6+vec2(time*.004,time*.002); float cl=fbm(uv); float cl2=fbm(uv*2.3+3.1);
    float k=smoothstep(.35,.85,cl)*cloud*smoothstep(-.02,.25,d.y); c=mix(c,c*.45+vec3(.012),k*.85); c+=c*cl2*.15*cloud;
    c+=vec3(.75,.8,1.)*flash*(.35+cl*1.2)*smoothstep(-.05,.3,d.y);
    float s=max(dot(d,sunDir),0.); c+=sunCol*(pow(s,600.)*6.+pow(s,12.)*.25);
    gl_FragColor=vec4(c,1.); }`,
}));
scene.add(sky);

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true; sun.shadow.mapSize.set(Q === 'low' ? 2048 : 4096, Q === 'low' ? 2048 : 4096);
const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035; sun.shadow.radius = 4;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.4); scene.add(hemi);

const { M, dust } = buildWorld(scene, renderer);

// lampadaires sur le parvis (lanternes en laiton sur fûts de pierre) : en mode nuit ils deviennent la source principale
const lampPosts = [];
{
  const postMat = M.ashlar, cageMat = M.iron;
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  for (const [x, z] of [[-6.2, 6.2], [6.2, 6.2], [-7, 13], [7, 13], [-7, 20], [7, 20], [-15, 5], [15, 5], [-17, 18], [17, 18], [-20, -12], [20, -12]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.5, 24), postMat); base.position.y = 0.25; g.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.6, 16), cageMat); shaft.position.y = 2.2; g.add(shaft);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.5, 6, 1, true), cageMat); cage.position.y = 4.25; g.add(cage);
    const capM = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 6), cageMat); capM.position.y = 4.65; g.add(capM);
    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.6, 1.6) });
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.42, 6), bulbMat); bulb.position.y = 4.25; g.add(bulb);
    g.traverse(o => { if (o.isMesh) { o.castShadow = o !== bulb; o.receiveShadow = true; } });
    const L = new THREE.PointLight(0xffa35a, 0, 26, 2); L.position.y = 4.1; g.add(L);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    halo.scale.setScalar(1.7); halo.position.y = 4.25; g.add(halo);
    scene.add(g); lampPosts.push({ L, halo, bulb, bulbMat }); colliders.circles.push([x, z, 0.4]);
  }
}

// faisceau lumineux de l'oculus (cône additif à dégradé)
const shaftMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { col: { value: new THREE.Color(1, 0.95, 0.85) }, k: { value: 0.12 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 w=modelViewMatrix*vec4(position,1.); vV=normalize(-w.xyz); vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*w; }`,
  fragmentShader: `uniform vec3 col; uniform float k; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(abs(dot(vN,vV)),2.); float g=smoothstep(0.,.25,vUv.y)*smoothstep(1.,.6,vUv.y); gl_FragColor=vec4(col*k*f*g,1.); }`,
});
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.95, 1, 48, 1, true), shaftMat); scene.add(shaft);


// pluie (ambiance nuit) : traits fins autour de la caméra
const RAIN_N = Q === 'low' ? 2500 : 6000;
const rainPos = new Float32Array(RAIN_N * 6), rainSeed = new Float32Array(RAIN_N * 3);
for (let i = 0; i < RAIN_N; i++) { rainSeed[i * 3] = (Math.random() - 0.5) * 36; rainSeed[i * 3 + 1] = Math.random() * 18; rainSeed[i * 3 + 2] = (Math.random() - 0.5) * 36; }
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x8a96a4, transparent: true, opacity: 0.16, depthWrite: false, fog: true }));
rain.frustumCulled = false; scene.add(rain);
function updateRain(dt, cx, cz) {
  const vis = mood === 'nuit'; rain.visible = vis; if (!vis) return;
  for (let i = 0; i < RAIN_N; i++) {
    let y = rainSeed[i * 3 + 1] - dt * 13; if (y < -0.3) y += 18; rainSeed[i * 3 + 1] = y;
    const x = cx + ((rainSeed[i * 3] - cx * 0) % 36), z = cz + rainSeed[i * 3 + 2];
    const wx = cx + (((rainSeed[i * 3] - cx) % 36) + 54) % 36 - 18, wz = cz + (((rainSeed[i * 3 + 2] - cz) % 36) + 54) % 36 - 18;
    // pas de pluie sous le toit
    const inside = wx > -8.6 && wx < 8.6 && wz > -12.6 && wz < 3.9 && y < 7;
    const yy = inside ? -50 : y;
    rainPos[i * 6] = wx; rainPos[i * 6 + 1] = yy; rainPos[i * 6 + 2] = wz;
    rainPos[i * 6 + 3] = wx + 0.03; rainPos[i * 6 + 4] = yy + 0.3; rainPos[i * 6 + 5] = wz + 0.02;
  }
  rainGeo.attributes.position.needsUpdate = true;
}

// ------------------------------------------------------------------ ambiances
// « nuit » : ambiance sombre et dramatique (orage dans le vide), « jour » : vide blanc éclatant canonique
const MOODS = {
  nuit: {
    top: 0x05070b, hor: 0x1b1f26, cloud: 1, fog: 0x1c2027, fogD: 0.03, sun: 0x9fb4d6, sunI: 0.9, sunDir: [-0.35, 1, -0.55],
    hemiS: 0x3a4250, hemiG: 0x0a0b0c, hemiI: 0.18, env: 0.35, exposure: 1.15, lamps: 1, wet: 0.22, shaft: [0.55, 0.65, 0.85, 0.07], bloom: 1.1,
  },
  jour: {
    top: 0xf2f1ee, hor: 0xffffff, cloud: 0, fog: 0xf7f6f3, fogD: 0.0035, sun: 0xfff3e2, sunI: 4.2, sunDir: [0.16, 1, 0.24],
    hemiS: 0xffffff, hemiG: 0xe8e4dc, hemiI: 0.55, env: 1.0, exposure: 0.82, lamps: 0, wet: 1, shaft: [1, 0.95, 0.85, 0.16], bloom: 0.7,
  },
};
let mood = params.get('mood') === 'jour' ? 'jour' : 'nuit';
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
const baseRough = new Map();
scene.traverse(o => { if (o.isMesh && o.material && !baseRough.has(o.material)) baseRough.set(o.material, o.material.roughness); });

function applyMood(name) {
  mood = name; const m = MOODS[name];
  skyU.top.value.set(m.top); skyU.hor.value.set(m.hor); skyU.cloud.value = m.cloud;
  const d = new THREE.Vector3(...m.sunDir).normalize(); skyU.sunDir.value.copy(d); skyU.sunCol.value.set(name === 'nuit' ? 0x000000 : 0x000000);
  scene.fog = new THREE.FogExp2(m.fog, m.fogD);
  sun.color.set(m.sun); sun.intensity = m.sunI; sun.userData.dir = d;
  hemi.color.set(m.hemiS); hemi.groundColor.set(m.hemiG); hemi.intensity = m.hemiI;
  // environnement IBL généré à partir du ciel seul
  const envScene = new THREE.Scene(); const s2 = sky.clone(); s2.scale.setScalar(0.01); envScene.add(s2);
  if (name === 'jour') { envScene.background = null; }
  if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, 0.02); scene.environment = envRT.texture; scene.environmentIntensity = m.env;
  // sol mouillé la nuit : rugosité réduite sur dalles et pierre
  surfaceU.uWet.value = name === 'nuit' ? 1 : 0;
  for (const p of lampPosts) { p.L.intensity = 16 * m.lamps; p.halo.material.opacity = 0.3 * m.lamps; p.bulbMat.color.setRGB(6 * m.lamps + 0.05, 3.6 * m.lamps + 0.05, 1.6 * m.lamps + 0.05); }
  shaftMat.uniforms.col.value.setRGB(m.shaft[0], m.shaft[1], m.shaft[2]); shaftMat.uniforms.k.value = m.shaft[3];
  for (const l of lights) l.base = l.L.userData.b0 ?? (l.L.userData.b0 = l.base), l.base = l.L.userData.b0 * (name === 'nuit' ? 1.6 : 0.9);
  if (bloom) bloom.intensity = m.bloom;
  if (tone) tone.exposure = m.exposure;
  document.body.dataset.mood = name;
}

// ------------------------------------------------------------------ post-process
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
composer.addPass(new RenderPass(scene, camera));
const ao = new N8AOPostPass(scene, camera, innerWidth, innerHeight);
ao.configuration.aoRadius = 1.2; ao.configuration.distanceFalloff = 0.6; ao.configuration.intensity = 2.6; ao.configuration.halfRes = Q === 'low'; ao.configuration.gammaCorrection = false;
ao.setQualityMode(Q === 'low' ? 'Low' : 'High');
composer.addPass(ao);
const bloom = new BloomEffect({ intensity: 1, luminanceThreshold: 0.85, luminanceSmoothing: 0.3, mipmapBlur: true, radius: 0.75 });
const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false }); noise.blendMode.opacity.value = 0.11;
composer.addPass(new EffectPass(camera, bloom, tone));
// objectif : légère distorsion en barillet + aberration chromatique sur les bords
class DistortEffect extends Effect {
  constructor() { super('Distort', `uniform float k; void mainUv(inout vec2 uv){ vec2 c=uv-.5; float r2=dot(c,c); uv=.5+c*(1.+k*r2)/(1.+k*.25); }`, { uniforms: new Map([['k', new THREE.Uniform(0.1)]]) }); }
}
class ChromaEffect extends Effect {
  constructor() {
    super('Chroma', `uniform float ca; void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){ vec2 c=uv-.5; vec2 o=c*dot(c,c)*ca;
      outputColor=vec4(texture2D(inputBuffer,uv+o).r,inputColor.g,texture2D(inputBuffer,uv-o).b,inputColor.a); }`,
      { attributes: EffectAttribute.CONVOLUTION, uniforms: new Map([['ca', new THREE.Uniform(0.012)]]) });
  }
}
composer.addPass(new EffectPass(camera, new SMAAEffect()));
composer.addPass(new EffectPass(camera, new ChromaEffect()));
composer.addPass(new EffectPass(camera, new DistortEffect(), vignette, noise));

// ------------------------------------------------------------------ personnage
const hero = await loadMannequin('assets/mannequin-anims.glb');
scene.add(hero.root);
hero.root.position.set(0, 0, 14); hero.root.rotation.y = Math.PI;
const mixer = new THREE.AnimationMixer(hero.rig);
const act = {};
for (const k of ['idle', 'walk', 'run', 'jump']) { act[k] = mixer.clipAction(hero.clips[k]); }
act.jump.setLoop(THREE.LoopOnce, 1); act.jump.clampWhenFinished = true;
for (const k of ['idle', 'walk', 'run']) { act[k].play(); act[k].setEffectiveWeight(k === 'idle' ? 1 : 0); }
const SPEED = { walk: 1.7, run: 5.2 };
const nat = { walk: hero.speeds.walk || 1.4, run: hero.speeds.run || 3.5 };
console.log('vitesses natives', hero.speeds, 'échelle', hero.S);

// ------------------------------------------------------------------ contrôles
const keys = new Set();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyN') applyMood(mood === 'nuit' ? 'jour' : 'nuit');
  if (e.code === 'KeyH') document.getElementById('help').classList.toggle('hide');
  if (e.code === 'Space') jump();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
let yaw = Math.PI, pitch = 0.18, dist = 3.6;
const cnv = renderer.domElement;
cnv.addEventListener('click', () => { if (!matchMedia('(pointer: coarse)').matches) cnv.requestPointerLock?.(); });
let dragging = false, lx = 0, ly = 0;
cnv.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; });
addEventListener('pointerup', () => dragging = false);
addEventListener('pointermove', e => {
  let dx = 0, dy = 0;
  if (document.pointerLockElement === cnv) { dx = e.movementX; dy = e.movementY; } else if (dragging && e.pointerType === 'mouse') { dx = e.clientX - lx; dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; } else return;
  yaw -= dx * 0.0028; pitch = THREE.MathUtils.clamp(pitch + dy * 0.0024, -0.6, 1.2);
});
addEventListener('wheel', e => { dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.002, 1.6, 9); }, { passive: true });

// joystick tactile minimal
const touch = { x: 0, y: 0, id: null, cx: 0, cy: 0, look: null, lx: 0, ly: 0 };
addEventListener('touchstart', e => { for (const t of e.changedTouches) { if (t.clientX < innerWidth / 2 && touch.id === null) { touch.id = t.identifier; touch.cx = t.clientX; touch.cy = t.clientY; } else if (touch.look === null) { touch.look = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; } } }, { passive: true });
addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (t.identifier === touch.id) { touch.x = THREE.MathUtils.clamp((t.clientX - touch.cx) / 60, -1, 1); touch.y = THREE.MathUtils.clamp((t.clientY - touch.cy) / 60, -1, 1); } if (t.identifier === touch.look) { yaw -= (t.clientX - touch.lx) * 0.005; pitch = THREE.MathUtils.clamp(pitch + (t.clientY - touch.ly) * 0.004, -0.6, 1.2); touch.lx = t.clientX; touch.ly = t.clientY; } } }, { passive: true });
addEventListener('touchend', e => { for (const t of e.changedTouches) { if (t.identifier === touch.id) { touch.id = null; touch.x = touch.y = 0; } if (t.identifier === touch.look) touch.look = null; } });

let jumping = 0;
function jump() { if (jumping > 0) return; jumping = hero.clips.jump.duration; act.jump.reset().setEffectiveWeight(1).fadeIn(0.15).play(); }

const R = 0.32;
function collide(p) {
  for (let it = 0; it < 3; it++) {
    for (const [ax, az, bx, bz] of colliders.segs) {
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = THREE.MathUtils.clamp(((p.x - ax) * dx + (p.z - az) * dz) / l2, 0, 1);
      const cx = ax + dx * t, cz = az + dz * t, ex = p.x - cx, ez = p.z - cz, d = Math.hypot(ex, ez);
      if (d < R && d > 1e-6) { p.x = cx + ex / d * R; p.z = cz + ez / d * R; }
    }
    for (const [cx, cz, r] of colliders.circles) {
      const ex = p.x - cx, ez = p.z - cz, d = Math.hypot(ex, ez);
      if (d < r + R && d > 1e-6) { p.x = cx + ex / d * (r + R); p.z = cz + ez / d * (r + R); }
    }
  }
}

const vel = new THREE.Vector3(); let speedNow = 0, groundY = 0;
const ray = new THREE.Raycaster(); const camTarget = new THREE.Vector3(); const camPos = new THREE.Vector3();
let camDist = dist, flash = 0, nextFlash = 4;

function update(dt, t) {
  // entrée
  let ix = 0, iz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  ix += touch.x; iz -= touch.y;
  const mag = Math.min(1, Math.hypot(ix, iz));
  const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || mag > 0.95 && touch.id !== null;
  const target = mag > 0.05 ? (running ? SPEED.run : SPEED.walk) * mag : 0;
  speedNow = THREE.MathUtils.damp(speedNow, target, 6, dt);
  const p = hero.root.position;
  if (mag > 0.05) {
    // direction relative à la caméra
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const dx = fx * iz + -fz * ix * -1, dz = fz * iz + fx * ix * -1;
    const wx = -Math.sin(yaw) * iz + Math.cos(yaw) * ix, wz = -Math.cos(yaw) * iz - Math.sin(yaw) * ix;
    const ang = Math.atan2(wx, wz);
    let da = ang - hero.root.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
    hero.root.rotation.y += da * (1 - Math.exp(-12 * dt));
  }
  const dirY = hero.root.rotation.y;
  p.x += Math.sin(dirY) * speedNow * dt; p.z += Math.cos(dirY) * speedNow * dt;
  collide(p);
  groundY = THREE.MathUtils.damp(groundY, groundHeight(p.x, p.z), 14, dt); p.y = groundY;

  // mélange d'animations selon la vitesse
  const w = speedNow;
  const wWalk = THREE.MathUtils.clamp(w / SPEED.walk, 0, 1) * (1 - THREE.MathUtils.clamp((w - SPEED.walk) / (SPEED.run - SPEED.walk), 0, 1));
  const wRun = THREE.MathUtils.clamp((w - SPEED.walk) / (SPEED.run - SPEED.walk), 0, 1);
  const wIdle = 1 - THREE.MathUtils.clamp(w / SPEED.walk, 0, 1);
  const jw = jumping > 0 ? Math.min(1, act.jump.getEffectiveWeight()) : 0;
  act.idle.setEffectiveWeight(wIdle * (1 - jw)); act.walk.setEffectiveWeight(wWalk * (1 - jw)); act.run.setEffectiveWeight(wRun * (1 - jw));
  act.walk.timeScale = THREE.MathUtils.clamp(Math.max(w, 0.6) / nat.walk, 0.5, 1.6);
  act.run.timeScale = THREE.MathUtils.clamp(Math.max(w, 2) / nat.run, 0.7, 1.5);
  if (jumping > 0) { jumping -= dt; if (jumping < 0.35) act.jump.fadeOut(0.3); }
  mixer.update(dt);

  // caméra 3e personne avec anti-collision
  camTarget.set(p.x, p.y + 1.55, p.z);
  const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(0.45);
  const tgt = camTarget.clone().add(side);
  ray.set(tgt, off); ray.far = dist + 0.3;
  const hit = ray.intersectObjects(occluders, false)[0];
  const want = hit ? Math.max(0.6, hit.distance - 0.3) : dist;
  camDist = want < camDist ? want : THREE.MathUtils.damp(camDist, want, 4, dt);
  camPos.copy(tgt).addScaledVector(off, camDist);
  camPos.y = Math.max(camPos.y, groundHeight(camPos.x, camPos.z) + 0.25);
  camera.position.copy(camPos); camera.lookAt(tgt);

  // ombre du soleil centrée sur le joueur
  const d = sun.userData.dir; sun.position.set(p.x + d.x * 80, d.y * 80, p.z + d.z * 80); sun.target.position.set(p.x, 0, p.z);

  // flammes
  for (const l of lights) { if (l.steady) { l.L.intensity = l.base; continue; } const f = 0.85 + Math.sin(t * 11 + l.ph) * 0.06 + Math.sin(t * 23.7 + l.ph * 2) * 0.05 + (Math.random() - 0.5) * 0.06; l.L.intensity = l.base * f; if (l.fl) l.fl.scale.y = 2.4 * (0.9 + f * 0.15); }
  // poussière
  const pa = dust.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { let y = pa.getY(i) + dt * 0.03; if (y > FLOOR_IN + 5.6) y = FLOOR_IN; pa.setY(i, y); pa.setX(i, pa.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.02); } pa.needsUpdate = true;
  updateRain(dt, camera.position.x, camera.position.z);
  // éclairs (nuit)
  skyU.time.value = t;
  if (mood === 'nuit') {
    if (t > nextFlash) { flash = 1; nextFlash = t + 6 + Math.random() * 12; }
    flash = Math.max(0, flash - dt * (flash > 0.5 ? 6 : 2.2));
    const fl = flash > 0 ? flash * (0.6 + 0.4 * Math.sin(t * 60)) : 0;
    skyU.flash.value = fl; sun.intensity = MOODS.nuit.sunI + fl * 6; hemi.intensity = MOODS.nuit.hemiI + fl * 0.8;
  } else skyU.flash.value = 0;
}

// faisceau orienté selon le soleil, passant par l'oculus
function placeShaft() {
  const d = sun.userData.dir, top = new THREE.Vector3(0, 12.0, -5), len = (top.y - FLOOR_IN) / d.y;
  const bot = top.clone().addScaledVector(d, -len);
  shaft.position.copy(top).add(bot).multiplyScalar(0.5); shaft.scale.set(1, top.distanceTo(bot), 1);
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bot).normalize());
}

applyMood(mood); placeShaft();
addEventListener('keydown', e => { if (e.code === 'KeyN') placeShaft(); });

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// vues prédéfinies pour les captures (?shot=1&view=…)
const VIEWS = {
  front: { p: [0, 0, 14], yaw: 0.0, pitch: 0.12, dist: 6 },
  wide: { p: [3, 0, 26], yaw: 0.25, pitch: 0.12, dist: 9 },
  hall: { p: [1.2, FLOOR_IN, -1.0], yaw: 0.2, pitch: 0.1, dist: 3.2 },
  bed: { p: [-5.0, FLOOR_IN, -5.2], yaw: -0.9, pitch: 0.2, dist: 2.6 },
  kitchen: { p: [5.2, FLOOR_IN, -0.6], yaw: 2.6, pitch: 0.2, dist: 2.4 },
  bath: { p: [4.8, FLOOR_IN, -6.4], yaw: 0.6, pitch: 0.3, dist: 2.2 },
  tower: { p: [-12, 0, 6], yaw: -0.4, pitch: -0.3, dist: 4 },
};
const v = VIEWS[params.get('view')];
if (v) { hero.root.position.set(...v.p); groundY = v.p[1]; yaw = v.yaw; pitch = v.pitch; dist = v.dist; camDist = dist; hero.root.rotation.y = yaw + Math.PI; }

const clock = new THREE.Clock(); let T = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20); T += dt;
  update(dt, T); composer.render(dt);
}
if (params.has('shot')) {
  // capture déterministe : on simule quelques secondes puis on signale
  for (let i = 0; i < (+params.get('n') || 90); i++) { T += 1 / 30; update(1 / 30, T); }
  if (mood === 'nuit') { flash = 0; nextFlash = 1e9; skyU.flash.value = 0; sun.intensity = MOODS.nuit.sunI; hemi.intensity = MOODS.nuit.hemiI; }
  for (let i = 0; i < 4; i++) composer.render(1 / 30);
  window.__ready = true;
} else {
  renderer.setAnimationLoop(frame);
}
document.getElementById('loading')?.remove();
if (params.has('shot')) document.getElementById('help').remove();
