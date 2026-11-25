// Mannequin robot original : segments rigides fixés sur le squelette Mixamo (aucun maillage Mixamo utilisé).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const HEIGHT = 1.8;

function capsule(len, r0, r1, seg = 24) {
  // profil le long de +Y de 0 à len, extrémités arrondies
  const pts = [];
  const n = 8;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0)); }
  // léger galbe au milieu (muscle)
  for (let i = 1; i < 6; i++) { const t = i / 6; const r = r0 + (r1 - r0) * t + Math.sin(t * Math.PI) * (r0 + r1) * 0.06; pts.push(new THREE.Vector2(r, t * len)); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r1, len + Math.sin(a) * r1)); }
  return new THREE.LatheGeometry(pts, seg);
}

export async function loadMannequin(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const rig = gltf.scene;
  const bones = {};
  rig.traverse(o => { const k = o.name.replace(/^mixamorig[:_]?/, ''); if (o.name.startsWith('mixamorig')) bones[k] = o; });
  rig.updateMatrixWorld(true);
  const wp = k => bones[k].getWorldPosition(new THREE.Vector3());
  const top = wp('HeadTop_End').y, foot = Math.min(wp('LeftToe_End').y, wp('LeftFoot').y - 0.0001);
  const S = HEIGHT / (top - foot + (top - foot) * 0.0);
  rig.scale.setScalar(S);
  rig.updateMatrixWorld(true);
  // pieds au sol : on mesure le point le plus bas
  const groundOffset = -Math.min(wp('LeftToe_End').y, wp('RightToe_End').y) + 0.03;

  // ---------- matériaux (plastique satiné gris + articulations graphite + visière)
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xb9bcc1, roughness: 0.34, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 1.0 });
  const joint = new THREE.MeshPhysicalMaterial({ color: 0x2a2c30, roughness: 0.42, metalness: 0.6, envMapIntensity: 0.9 });
  const visor = new THREE.MeshPhysicalMaterial({ color: 0x0b0d10, roughness: 0.06, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.4 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: new THREE.Color(0.25, 0.7, 1.0), emissiveIntensity: 2.2 });

  const parts = [];
  const add = (boneKey, geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parts.push([boneKey, m]); return m; };
  const Y = new THREE.Vector3(0, 1, 0);
  const limb = (a, b, r0, r1, mat = shell, inset = 0) => {
    const A = wp(a), Bp = wp(b), d = Bp.clone().sub(A), L = d.length();
    const m = add(a, capsule(Math.max(0.001, L - inset * 2 - r0 - r1), r0, r1), mat);
    m.quaternion.setFromUnitVectors(Y, d.clone().normalize());
    m.position.copy(A).addScaledVector(d.normalize(), inset + r0);
    return m;
  };
  const ball = (k, r, mat = joint, off = null) => { const m = add(k, new THREE.SphereGeometry(r, 32, 20), mat); m.position.copy(wp(k)); if (off) m.position.add(off); return m; };

  // tronc
  const hips = wp('Hips'), sp = wp('Spine'), sp1 = wp('Spine1'), sp2 = wp('Spine2'), neck = wp('Neck'), head = wp('Head');
  const pelvis = add('Hips', new RoundedBoxGeometry(0.32, 0.2, 0.21, 6, 0.08), shell); pelvis.position.copy(hips).add(new THREE.Vector3(0, -0.02, 0));
  const abdomen = add('Spine', capsule(sp1.distanceTo(sp) + 0.02, 0.105, 0.115), joint); abdomen.position.copy(sp).add(new THREE.Vector3(0, -0.06, 0));
  abdomen.scale.set(1.25, 1, 0.9);
  const chest = add('Spine2', new RoundedBoxGeometry(0.36, 0.3, 0.22, 8, 0.1), shell); chest.position.copy(sp2).add(new THREE.Vector3(0, 0.05, 0.01));
  const chestPlate = add('Spine2', new RoundedBoxGeometry(0.24, 0.13, 0.04, 4, 0.02), shell); chestPlate.position.copy(sp2).add(new THREE.Vector3(0, 0.09, 0.115));
  const core = add('Spine2', new THREE.CylinderGeometry(0.022, 0.022, 0.012, 32), accent); core.rotation.x = Math.PI / 2; core.position.copy(sp2).add(new THREE.Vector3(0, 0.09, 0.138));
  const back = add('Spine2', new RoundedBoxGeometry(0.22, 0.2, 0.06, 4, 0.025), joint); back.position.copy(sp2).add(new THREE.Vector3(0, 0.06, -0.12));
  limb('Neck', 'Head', 0.045, 0.045, joint);
  // tête : œuf + visière
  const hd = add('Head', new THREE.SphereGeometry(0.1, 48, 32), shell); hd.scale.set(1, 1.22, 1.08); hd.position.copy(head).add(new THREE.Vector3(0, 0.1, 0.005));
  const vg = new THREE.SphereGeometry(0.101, 48, 24, -0.85, 1.7, 1.2, 0.55);
  const vs = add('Head', vg, visor); vs.scale.set(1.02, 1.22, 1.1); vs.position.copy(hd.position); vs.rotation.y = Math.PI / 2 - Math.PI / 2;
  vs.rotation.y = 0; vs.geometry.rotateY(Math.PI / 2);
  for (const s of [-1, 1]) { const ear = add('Head', new THREE.CylinderGeometry(0.03, 0.03, 0.02, 24), joint); ear.rotation.z = Math.PI / 2; ear.position.copy(hd.position).add(new THREE.Vector3(s * 0.1, -0.01, 0)); }

  // bras
  for (const s of ['Left', 'Right']) {
    ball(s + 'Arm', 0.062);
    const sh = add(s + 'Arm', new THREE.SphereGeometry(0.075, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), shell); sh.position.copy(wp(s + 'Arm')).add(new THREE.Vector3(0, 0.005, 0));
    limb(s + 'Arm', s + 'ForeArm', 0.052, 0.042, shell, 0.03);
    ball(s + 'ForeArm', 0.042);
    limb(s + 'ForeArm', s + 'Hand', 0.042, 0.032, shell, 0.03);
    ball(s + 'Hand', 0.03);
    // paume orientée vers le majeur
    const H0 = wp(s + 'Hand'), H1 = wp(s + 'HandMiddle1'), d = H1.clone().sub(H0);
    const palm = add(s + 'Hand', new RoundedBoxGeometry(0.085, d.length() + 0.01, 0.032, 3, 0.012), shell);
    palm.quaternion.setFromUnitVectors(Y, d.clone().normalize()); palm.position.copy(H0).addScaledVector(d, 0.55);
    for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let i = 1; i <= 3; i++) {
      const a = s + 'Hand' + f + i, b = s + 'Hand' + f + (i + 1); if (!bones[a] || !bones[b]) continue;
      limb(a, b, 0.011, 0.0095, i === 1 ? joint : shell);
    }
  }
  // jambes
  for (const s of ['Left', 'Right']) {
    ball(s + 'UpLeg', 0.078);
    limb(s + 'UpLeg', s + 'Leg', 0.082, 0.06, shell, 0.04);
    ball(s + 'Leg', 0.056);
    const kneeCap = add(s + 'Leg', new THREE.SphereGeometry(0.045, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), shell); kneeCap.rotation.x = Math.PI / 2; kneeCap.position.copy(wp(s + 'Leg')).add(new THREE.Vector3(0, 0.01, 0.03));
    limb(s + 'Leg', s + 'Foot', 0.058, 0.042, shell, 0.04);
    ball(s + 'Foot', 0.042);
    const F = wp(s + 'Foot'), T = wp(s + 'ToeBase'), E = wp(s + 'Toe_End');
    const footLen = E.z - F.z + 0.07;
    const foot = add(s + 'Foot', new RoundedBoxGeometry(0.1, 0.075, footLen, 4, 0.03), shell);
    foot.position.set(F.x, Math.max(T.y, 0.04) + 0.0, (F.z + E.z) / 2 - 0.01);
    const sole = add(s + 'Foot', new RoundedBoxGeometry(0.105, 0.022, footLen + 0.01, 3, 0.01), joint); sole.position.set(foot.position.x, foot.position.y - 0.045, foot.position.z);
  }

  for (const [k, m] of parts) bones[k].attach(m);

  // ---------- animations : on retire le déplacement horizontal des hanches (déplacement piloté par le jeu)
  const clips = {}, speeds = {};
  for (const c of gltf.animations) {
    const t = c.tracks.find(t => /Hips\.position$/.test(t.name));
    if (t) {
      const v = t.values, n = v.length / 3;
      const dz = (v[(n - 1) * 3 + 2] - v[2]) * S, dx = (v[(n - 1) * 3] - v[0]) * S;
      speeds[c.name] = Math.hypot(dx, dz) / c.duration;
      const x0 = v[0], z0 = v[2];
      for (let i = 0; i < n; i++) { v[i * 3] = x0; v[i * 3 + 2] = z0; }
    }
    clips[c.name] = c;
  }

  const root = new THREE.Group(); root.add(rig); rig.position.y = groundOffset;
  return { root, rig, bones, clips, speeds, S };
}
