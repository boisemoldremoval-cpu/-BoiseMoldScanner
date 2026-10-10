// Boise Mold Removal — 24s 3D diorama promo: intro → find mold (scan) → remove it (HEPA) → mold-free → outro.
import {
  THREE, P, FACE, createStage, groundDisc, tree, card, burst, pop, onFrame, ev, mesh, RB, M,
  cameraRig, captions, outro, run, liveCanvas, canvasTex, pillTex, sprite, rrect, check, font,
  spring, seg, eOut, eIO, clamp, lerp, beatGrid, makeRng, countUp,
} from './lib.js';

for (const w of [600, 700, 800, 900]) { await document.fonts.load(`${w} 40px Nunito`); }

// ---- CONFIG ----
const DUR = 24;
const BPM = 100, B = beatGrid(BPM);
const [W, H] = [1920, 1080];
const C = { brand: 0x14506A, brand2: 0x2E8B95, accent: 0xE8692E, hi: 0xF2C230, ok: 0x1FA971, wall: 0xF4ECDD, roof: 0x3B4A5A };

const stage = createStage({ W, H });
const { scene, camera } = stage;

groundDisc(scene, { t0: 0.05 });

// ---- HOUSE (local +z = front wall) ----
const house = new THREE.Group();
house.position.copy(P(-0.6, -1.2)); house.rotation.y = FACE - 0.4; scene.add(house);
const HW = 5, HD = 3.6, HH = 2.6, RISE = 1.4;
house.add(mesh(RB(HW + 0.2, 0.3, HD + 0.2, 0.05), 0xB9B4AE, { y: 0.15 }));
house.add(mesh(RB(HW, HH, HD, 0.04), C.wall, { y: HH / 2 }));
const gable = new THREE.Shape([new THREE.Vector2(-HD / 2, 0), new THREE.Vector2(HD / 2, 0), new THREE.Vector2(0, RISE)]);
house.add(mesh(new THREE.ExtrudeGeometry(gable, { depth: HW - 0.02, bevelEnabled: false }), C.wall, { x: -(HW - 0.02) / 2, y: HH - 0.01, ry: Math.PI / 2 }));
const ang = Math.atan2(RISE, HD / 2), slope = Math.hypot(RISE, HD / 2) + 0.35;
for (const s of [1, -1]) {
  house.add(mesh(RB(HW + 0.5, 0.18, slope, 0.05), C.roof, { y: HH + RISE / 2 + 0.1, z: s * (HD / 4 + 0.05), rx: s * ang }));
}
house.add(mesh(RB(0.55, 1.3, 0.55, 0.04), 0xB5563F, { x: 1.5, y: HH + 1.1, z: -0.7 }));
house.add(mesh(RB(0.82, 1.5, 0.1, 0.04), C.brand2, { x: 1.55, y: 0.95, z: HD / 2 }));
house.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), C.hi, { x: 1.82, y: 0.95, z: HD / 2 + 0.07 }));
const windowAt = (x, y, z, ry = 0) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  g.add(mesh(RB(1.0, 0.86, 0.1, 0.03), 0xFFFFFF));
  g.add(mesh(RB(0.84, 0.7, 0.04, 0.02), 0xBFE3F0, { z: 0.04 }));
  g.add(mesh(RB(0.05, 0.7, 0.05, 0.01), 0xFFFFFF, { z: 0.06 }));
  house.add(g);
};
windowAt(-1.4, 1.55, HD / 2); windowAt(0.0, 1.55, HD / 2); windowAt(HW / 2, 1.5, 0, Math.PI / 2);
house.updateMatrixWorld(true);
pop(house, 0.35, { dur: 0.85, pitch: 0 });

// ---- MOLD SPOTS ----
const blobTex = seed => canvasTex(256, 256, g => {
  const r = makeRng(seed);
  const halo = g.createRadialGradient(128, 128, 20, 128, 128, 120);
  halo.addColorStop(0, 'rgba(70,84,52,.35)'); halo.addColorStop(1, 'rgba(70,84,52,0)');
  g.fillStyle = halo; g.fillRect(0, 0, 256, 256);
  const cols = ['#2B3526', '#3E4D33', '#1F261B', '#56633F'];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.8) * 92, rad = 5 + r() * 18 * (1 - d / 130);
    g.globalAlpha = 0.82 + r() * 0.18; g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, rad, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
const BLOBS = [blobTex(3), blobTex(11), blobTex(29)];
// [wall, a, y, size]: front wall a = x; side wall a = z
const SPOTS = [['f', -2.0, 0.6, 0.9], ['f', -0.75, 0.45, 0.7], ['f', -1.9, 2.32, 0.5], ['f', -0.55, 2.3, 0.45],
  ['f', 0.55, 0.55, 0.6], ['f', 0.75, 2.2, 0.8], ['s', 1.0, 0.65, 0.8], ['s', -0.95, 2.1, 0.6]];
const SC0 = 3.8, SC1 = 6.8, SS1 = 7.6;                // front scan, then side scan
const scanTime = ([w, a]) => w === 'f' ? SC0 + (a + HW / 2) / HW * (SC1 - SC0) + 0.05 : SC1 + (HD / 2 - a) / HD * (SS1 - SC1) + 0.05;
const RM0 = 10.9, RMSTEP = 0.42;
const sparkleCols = [0xFFFFFF, 0x9FE3E8, C.brand2, C.hi];
SPOTS.forEach((s, i) => {
  const [w, a, y, size] = s;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.45, size * 1.45),
    new THREE.MeshBasicMaterial({ map: BLOBS[i % 3], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  if (w === 'f') { m.position.set(a, y, HD / 2 + 0.012); } else { m.position.set(HW / 2 + 0.012, y, a); m.rotation.y = Math.PI / 2; }
  m.rotation.z = i * 1.3; house.add(m);
  const tOut = RM0 + i * RMSTEP;
  pop(m, scanTime(s), { dur: 0.5, out: tOut, outDur: 0.3, pitch: -2 + i * 0.5 });
  ev(tOut, 'sparkle', { pitch: i });
  burst(scene, tOut, house.localToWorld(m.position.clone()), { n: 10, colors: sparkleCols, life: 0.8 });
});

// scan bar sweeping the front wall, then the side wall
const glowTex = canvasTex(128, 8, g => {
  const gr = g.createLinearGradient(0, 0, 128, 0);
  gr.addColorStop(0, 'rgba(255,138,61,0)'); gr.addColorStop(0.5, 'rgba(255,138,61,1)'); gr.addColorStop(1, 'rgba(255,138,61,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 8);
});
const scanBar = new THREE.Group(); house.add(scanBar);
scanBar.add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, HH - 0.1), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.45, depthWrite: false })));
scanBar.add(new THREE.Mesh(new THREE.PlaneGeometry(0.07, HH - 0.1), new THREE.MeshBasicMaterial({ color: 0xFF7A2E, transparent: true, opacity: 0.95, depthWrite: false })));
for (let t = SC0; t < SS1; t += 0.5) { ev(t, 'scan'); }

// ---- WORKER ----
const worker = new THREE.Group(); worker.position.copy(P(3.5, 1.5)); worker.rotation.y = FACE - 1.0; scene.add(worker);
const body = new THREE.Group(); worker.add(body);
const SUIT = 0x1F6F86, SKIN = 0xE5B48F;
for (const x of [-0.14, 0.14]) {
  body.add(mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.7, 12), 0x23324A, { x, y: 0.35 }));
  body.add(mesh(RB(0.2, 0.12, 0.32, 0.04), 0x1E1B22, { x, y: 0.06, z: 0.05 }));
}
body.add(mesh(new THREE.CapsuleGeometry(0.3, 0.5, 6, 16), SUIT, { y: 1.02 }));
body.add(mesh(RB(0.62, 0.08, 0.05, 0.02), C.hi, { y: 1.12, z: 0.27 }));
body.add(mesh(new THREE.SphereGeometry(0.24, 20, 16), SKIN, { y: 1.62 }));
body.add(mesh(new THREE.SphereGeometry(0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), C.hi, { y: 1.7 }));
body.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20), C.hi, { y: 1.71, z: 0.04 }));
body.add(mesh(RB(0.26, 0.15, 0.12, 0.04), 0x8C97A0, { y: 1.53, z: 0.2 }));
for (const x of [-0.13, 0.13]) { body.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 12), 0x55606A, { x, y: 1.5, z: 0.22, rx: Math.PI / 2 })); }
for (const x of [-0.08, 0.08]) { body.add(mesh(new THREE.SphereGeometry(0.035, 8, 8), 0x1E1B22, { x, y: 1.67, z: 0.215 })); }
const arm = side => {
  const p = new THREE.Group(); p.position.set(side * 0.38, 1.3, 0);
  p.add(mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.6, 10), SUIT, { y: -0.3 }));
  p.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), 0x2B2B30, { y: -0.62 }));
  body.add(p); return p;
};
const armL = arm(1), armR = arm(-1);
const scanner = new THREE.Group(); scanner.position.set(0, -0.68, 0.05); armR.add(scanner);
scanner.add(mesh(RB(0.24, 0.1, 0.36, 0.03), 0x26303A));
scanner.add(mesh(RB(0.18, 0.03, 0.2, 0.01), 0x7FE0E6, { y: 0.055, z: -0.04 }));
scanner.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), 0xFF7A2E, { z: 0.2, rx: Math.PI / 2 }));
worker.scale.setScalar(1.25);
pop(worker, 1.3, { dur: 0.75, pitch: 3 });

// moisture readout floating beside the worker
const READ = liveCanvas(440, 230, (g, t, w, h) => {
  g.clearRect(0, 0, w, h);
  const drying = t > 10.6, v = drying ? 38 - 27 * eIO(seg(t, 10.8, 14.4)) : 12 + 26 * eOut(seg(t, 4.0, 6.8));
  const high = v > 20, col = high ? '#D9541A' : '#1FA971';
  rrect(g, 6, 6, w - 12, h - 12, 34, '#fff', '#D9E6E9', 5);
  g.fillStyle = '#5E7480'; g.font = font(800, 30); g.textBaseline = 'alphabetic'; g.fillText('MOISTURE', 36, 62);
  g.fillStyle = col; g.font = font(900, 96); g.fillText(`${Math.round(v)}%`, 32, 170);
  rrect(g, 268, 112, 140, 64, 32, col);
  g.fillStyle = '#fff'; g.font = font(900, 32); g.textAlign = 'center'; g.fillText(high ? 'HIGH' : 'DRY', 338, 156); g.textAlign = 'left';
});
const readS = sprite(READ.tex, 1.15, 440 / 230); scene.add(readS);
const READ_POS = worker.position.clone().add(new THREE.Vector3(0, 3.35, 0)).add(P(1.0, 0.2));
pop(readS, 3.6, { pitch: 5, out: 15.0, outDur: 0.3 });

// ---- AIR SCRUBBER ----
const scrub = new THREE.Group(); scrub.position.copy(P(-4.9, 1.6)); scrub.rotation.y = FACE + 0.25; scene.add(scrub);
scrub.add(mesh(RB(1.3, 1.1, 1.0, 0.1), 0x5E7480, { y: 0.68 }));
scrub.add(mesh(RB(1.34, 0.12, 1.04, 0.05), C.brand2, { y: 1.2 }));
for (const [x, z] of [[-0.5, -0.38], [0.5, -0.38], [-0.5, 0.38], [0.5, 0.38]]) {
  scrub.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), 0x1E1B22, { x, y: 0.1, z, rz: Math.PI / 2 }));
}
scrub.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 28), 0x2F3A44, { y: 0.68, z: 0.51, rx: Math.PI / 2 }));
const blades = new THREE.Group(); blades.position.set(0, 0.68, 0.54); scrub.add(blades);
for (let i = 0; i < 5; i++) { const b = mesh(RB(0.12, 0.34, 0.02, 0.01), 0xC9D4DA, { rz: i * Math.PI * 2 / 5 }); b.geometry.translate(0, 0.17, 0); blades.add(b); }
blades.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12), C.hi, { rx: Math.PI / 2 }));
const SCRUB_T = 9.7;
pop(scrub, SCRUB_T, { dur: 0.75, pitch: 1 });
const puffs = Array.from({ length: 7 }, () => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, depthWrite: false }));
  scene.add(m); return m;
});
const PUFF0 = scrub.position.clone().add(new THREE.Vector3(0, 1.35, 0));

const tagHepa = pillTex('HEPA air scrubbing', { icon: '#2E8B95', fs: 60, fg: '#14506A' });
const hepaS = sprite(tagHepa.tex, 0.62, tagHepa.aspect); hepaS.position.copy(scrub.position).add(new THREE.Vector3(0, 2.4, 0)); scene.add(hepaS);
pop(hepaS, SCRUB_T + 0.45, { pitch: 6, out: 15.0, outDur: 0.3 });

const tagMold = pillTex('Mold detected', { bg: '#FDECE4', fg: '#B23A0E', border: '#F6C9B3', fs: 60 });
const moldS = sprite(tagMold.tex, 0.66, tagMold.aspect); scene.add(moldS);
const MOLD_POS = house.position.clone().add(new THREE.Vector3(0, 5.0, 0)).add(P(-1.4, 0.6));
pop(moldS, 7.8, { pitch: -3, out: 9.1, outDur: 0.3 });

// ---- MOLD-FREE ----
const freeTex = canvasTex(820, 250, (g, w, h) => {
  rrect(g, 8, 8, w - 16, h - 16, 70, '#1FA971');
  g.beginPath(); g.arc(122, h / 2, 66, 0, 7); g.fillStyle = '#fff'; g.fill(); check(g, 122, h / 2, 78, '#1FA971', 18);
  g.fillStyle = '#fff'; let fs = 110; do { g.font = font(900, fs); fs -= 4; } while (g.measureText('MOLD-FREE').width > w - 270);
  g.textBaseline = 'middle'; g.fillText('MOLD-FREE', 222, h / 2 + 6);
});
const free = card(freeTex, 3.4, 1.04, { slab: C.ok, depth: 0.22 }); free.rotation.y = FACE; scene.add(free);
const FREE_T = 16.0;
const FREE_POS = house.position.clone().add(new THREE.Vector3(0, 5.6, 0));
pop(free, FREE_T, { dur: 0.75, sfx: 'stamp' });
ev(FREE_T + 0.08, 'celebrate');
burst(scene, FREE_T + 0.05, FREE_POS, { n: 24, colors: [C.hi, C.accent, C.brand2, C.ok] });
const tagAir = pillTex('Air quality: Good', { icon: '#1FA971', fs: 60, fg: '#14506A' });
const airS = sprite(tagAir.tex, 0.62, tagAir.aspect); scene.add(airS);
const AIR_POS = worker.position.clone().add(new THREE.Vector3(0, 3.5, 0)).add(P(1.3, 0));
pop(airS, FREE_T + 0.55, { pitch: 7 });
const CHEER = FREE_T + 0.25;
ev(CHEER + 0.1, 'chime');

// ---- TREES ----
[[-6.6, -4.4, 1.1], [5.6, -4.8, 0.9], [-7.6, 0.2, 0.8], [6.9, -1.6, 0.75], [1.6, -6.4, 0.7]].forEach(([u, v, s], i) => {
  const tr = tree(s); tr.position.copy(P(u, v)); scene.add(tr); pop(tr, 0.8 + i * 0.12, { pitch: 1 + i });
});

onFrame(t => {
  READ.update(t);
  // scan bar
  const onFront = t >= SC0 && t < SC1, onSide = t >= SC1 && t < SS1;
  scanBar.visible = onFront || onSide;
  if (onFront) { scanBar.position.set(lerp(-HW / 2 + 0.1, HW / 2 - 0.1, seg(t, SC0, SC1)), HH / 2, HD / 2 + 0.03); scanBar.rotation.y = 0; }
  if (onSide) { scanBar.position.set(HW / 2 + 0.03, HH / 2, lerp(HD / 2 - 0.1, -HD / 2 + 0.1, seg(t, SC1, SS1))); scanBar.rotation.y = Math.PI / 2; }
  // worker: scanner arm up while scanning, cheer at the end
  const aim = seg(t, 3.2, 3.7) * (1 - seg(t, 8.4, 8.9));
  const ch = spring(seg(t, CHEER, CHEER + 0.6)) * (1 - seg(t, 19.0, 19.4));
  armR.rotation.x = -1.25 * aim * (1 - ch) + Math.sin(t * 6) * 0.03 * aim;
  armR.rotation.z = -2.6 * ch;
  armL.rotation.z = 0.15 + 2.45 * ch;
  const jump = t > CHEER && t < CHEER + 1.6 ? Math.abs(Math.sin((t - CHEER) * Math.PI * 2 / 0.8)) * 0.3 : 0;
  body.position.y = Math.sin(t * 2.2) * 0.02 + jump;
  // scrubber fan + puffs
  blades.rotation.z = -Math.max(0, t - SCRUB_T) * 14;
  puffs.forEach((m, i) => {
    const k = ((t - SCRUB_T - 0.6 - i * 0.2) % 1.4 + 1.4) % 1.4 / 1.4, live = t > SCRUB_T + 0.6 + i * 0.2 && t < 15.3;
    m.visible = live;
    m.position.copy(PUFF0).add(new THREE.Vector3(Math.sin(i * 2.1) * 0.35 * k, k * 1.6, Math.cos(i * 2.1) * 0.35 * k));
    m.scale.setScalar(0.6 + k * 1.2); m.material.opacity = 0.55 * Math.sin(Math.PI * k);
  });
  // floating labels
  readS.position.copy(READ_POS); readS.position.y += Math.sin(t * 2.6) * 0.06;
  moldS.position.copy(MOLD_POS); moldS.position.y += Math.sin(t * 2.4) * 0.06;
  hepaS.position.y = scrub.position.y + 2.4 + Math.sin(t * 2.5) * 0.06;
  free.position.copy(FREE_POS); free.position.y += Math.sin(t * 2.4) * 0.08;
  airS.position.copy(AIR_POS); airS.position.y += Math.sin(t * 2.7) * 0.06;
});

// ---- CAMERA ----
const cam = cameraRig(camera, [
  { s: 0, tgt: [0, -0.4, 1.6], h: [14, 10], az: [10, 34], el: [42, 34] },
  { s: B.snap(3.0), tgt: [0.8, -0.2, 2.1], h: [6.6, 6.1], az: [36, 46], el: [30, 28] },
  { s: B.snap(9.2), tgt: [-1.8, 0, 2.1], h: [7.0, 6.5], az: [52, 42], el: [31, 30] },
  { s: B.snap(15.2), tgt: [-0.3, -0.5, 3.1], h: [7.4, 6.9], az: [40, 30], el: [33, 30] },
  { s: B.snap(19.2), tgt: [0, -0.4, 1.4], h: [11, 13], az: [30, 55], el: [34, 41] },
], { W, H, dur: DUR, shakes: [[FREE_T, 0.07]] });

// ---- OVERLAYS ----
const cap = captions([
  { s: 0.2, e: 2.8, logo: 'assets/logo.png', t1: 'Boise Mold Removal', t2: 'Mold inspection & remediation' },
  { s: 3.2, e: 8.9, n: 1, t1: 'Find hidden mold', t2: 'Moisture scans pinpoint the problem' },
  { s: 9.3, e: 14.9, n: 2, t1: 'Remove it safely', t2: 'Containment and HEPA air scrubbing' },
  { s: 15.3, e: 19.3, n: 3, t1: 'Breathe easy', t2: 'A clean, healthy home again' },
]);
const out = outro([['o-logo', 20.0], ['o-title', 20.3], ['o-sub', 20.45], ['o-tag', 20.65], ['o-btn', 20.95], ['o-url', 21.2]],
  { veil: [19.6, 20.2], cta: 'o-btn', click: 22.4 });

run(stage, DUR, t => { cam(t); cap(t); out(t); }, { bpm: BPM });
