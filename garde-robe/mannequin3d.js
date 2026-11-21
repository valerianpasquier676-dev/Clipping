// Mannequin 3D paramétrique, habillé avec les pièces de la tenue.
// Le corps est construit à partir des mesures du profil ; chaque vêtement est une enveloppe qui épouse ce corps,
// colorée (et rayée / à carreaux si besoin) d'après la fiche de la pièce. C'est une simulation stylisée,
// pas une reconstruction photo-réaliste du vêtement réel.

import * as THREE from "./vendor/three.min.js";

const FABRIC_THICKNESS = { tshirt: 0.007, debardeur: 0.005, polo: 0.008, chemise: 0.007, pull: 0.016, sweat: 0.02, gilet: 0.014, veste: 0.018, blouson: 0.02, manteau: 0.026, doudoune: 0.04, impermeable: 0.014, coupevent: 0.01 };
const FIT_OFFSET = { slim: -0.004, regular: 0.004, oversize: 0.016 };

/* ---------- Modèles GLB fournis (optionnels) ---------- */
// Un fichier models/<fichier>.glb déclaré dans models/models.json ({"sweat": "sweat.glb"}) remplace le vêtement simplifié
// de cette catégorie. Il est modelé sur le mannequin de référence (models/mannequin-reference.glb), mis à l'échelle sur
// tes mesures, et les matériaux dont le nom commence par « couleur » prennent la couleur de la pièce.

export const REFERENCE_PROFILE = { height: 175, chest: 96, waist: 80, hips: 96, shoulders: 44 };
const REF = { H: 1.75, A: 96 / 100 / (Math.PI * 1.7) };
const modelScenes = new Map();
const modelLoading = new Set();
let modelManifest = null;

export function setModel(category, scene) { if (scene) modelScenes.set(category, scene); else modelScenes.delete(category); }
export const hasModel = (category) => modelScenes.has(category);

export async function ensureModels(categories) {
  if (!modelManifest) modelManifest = await fetch("models/models.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  let changed = false;
  await Promise.all([...new Set(categories)].map(async (c) => {
    if (modelScenes.has(c) || modelLoading.has(c) || !modelManifest[c]) return;
    modelLoading.add(c);
    try { const gltf = await new THREE.GLTFLoader().loadAsync("models/" + modelManifest[c]); modelScenes.set(c, gltf.scene); changed = true; }
    catch (e) { console.warn("Modèle 3D illisible :", modelManifest[c], e?.message || e); }
  }));
  return changed;
}

/* ---------- Courbes lissées (profil du torse) ---------- */

function curve(ctrl) {
  const pts = [...ctrl].sort((p, q) => p.y - q.y);
  return (y) => {
    if (y <= pts[0].y) return { a: pts[0].a, b: pts[0].b };
    if (y >= pts[pts.length - 1].y) { const p = pts[pts.length - 1]; return { a: p.a, b: p.b }; }
    let i = 0;
    while (y > pts[i + 1].y) i++;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const h = p2.y - p1.y, t = (y - p1.y) / h;
    const t2 = t * t, t3 = t2 * t;
    const hermite = (k) => {
      const m1 = ((p2[k] - p0[k]) / (p2.y - p0.y || 1)) * h, m2 = ((p3[k] - p1[k]) / (p3.y - p1.y || 1)) * h;
      return (2 * t3 - 3 * t2 + 1) * p1[k] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[k] + (t3 - t2) * m2;
    };
    return { a: Math.max(0.01, hermite("a")), b: Math.max(0.01, hermite("b")) };
  };
}

// Surface lofée : une suite d'anneaux elliptiques (demi-largeur a, demi-profondeur b).
function loft(levels, { seg = 32, capBottom = false, capTop = false, uvScale = [8, 8.3] } = {}) {
  const pos = [], uv = [], idx = [];
  levels.forEach((L, j) => {
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      pos.push((L.cx || 0) + L.a * Math.cos(th), L.y, (L.cz || 0) + L.b * Math.sin(th));
      uv.push((i / seg) * uvScale[0], L.y * uvScale[1]);
    }
    if (j) {
      const r0 = (j - 1) * (seg + 1), r1 = j * (seg + 1);
      for (let i = 0; i < seg; i++) idx.push(r0 + i, r1 + i, r0 + i + 1, r0 + i + 1, r1 + i, r1 + i + 1);
    }
  });
  const addCap = (L, ringStart, up) => {
    const c = pos.length / 3;
    pos.push(L.cx || 0, L.y, L.cz || 0); uv.push(0, L.y * uvScale[1]);
    for (let i = 0; i < seg; i++) idx.push(c, ringStart + i + (up ? 1 : 0), ringStart + i + (up ? 0 : 1));
  };
  if (capBottom) addCap(levels[0], 0, false);
  if (capTop) addCap(levels[levels.length - 1], (levels.length - 1) * (seg + 1), true);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Recolle les normales de la couture.
  const n = g.attributes.normal;
  for (let j = 0; j < levels.length; j++) {
    const a = j * (seg + 1), b = a + seg;
    const x = (n.getX(a) + n.getX(b)) / 2, y = (n.getY(a) + n.getY(b)) / 2, z = (n.getZ(a) + n.getZ(b)) / 2;
    n.setXYZ(a, x, y, z); n.setXYZ(b, x, y, z);
  }
  return g;
}

const levelsFrom = (f, y0, y1, off = 0, n = 22, shift = {}) =>
  Array.from({ length: n }, (_, i) => {
    const y = y0 + ((y1 - y0) * i) / (n - 1);
    const s = f(y);
    return { y, a: s.a + off, b: s.b + off, cx: shift.cx || 0, cz: shift.cz || 0 };
  });

/* ---------- Matériaux ---------- */

const texCache = new Map();
function patternTexture(pattern, c0, c1) {
  const key = `${pattern}|${c0}|${c1}`;
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d");
  g.fillStyle = c0; g.fillRect(0, 0, 128, 128);
  g.fillStyle = c1;
  if (pattern === "raye") { for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 14); }
  else if (pattern === "carreaux") {
    g.globalAlpha = 0.55; for (let i = 0; i < 128; i += 64) { g.fillRect(i, 0, 14, 128); g.fillRect(0, i, 128, 14); }
    g.globalAlpha = 0.9; for (let i = 0; i < 128; i += 64) { g.fillRect(i + 5, 0, 3, 128); g.fillRect(0, i + 5, 128, 3); }
  } else if (pattern === "motif") { for (let y = 16; y < 128; y += 32) for (let x = 16; x < 128; x += 32) { g.beginPath(); g.arc(x + ((y / 32) % 2) * 16, y, 6, 0, 7); g.fill(); } }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

function fabric(item, extra = {}) {
  const c0 = (item.colors && item.colors[0]) || "#808080";
  const c1 = (item.colors && item.colors[1]) || (item.pattern === "carreaux" ? "#ffffff" : "#f4f4f2");
  const m = new THREE.MeshStandardMaterial({ color: c0, roughness: 0.88, metalness: 0, side: THREE.DoubleSide, ...extra });
  m.name = "couleur_principale";
  if (["raye", "carreaux", "motif"].includes(item.pattern)) { m.map = patternTexture(item.pattern, c0, c1); m.color.set("#ffffff"); }
  return m;
}
const solid = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
const metalMat = (item) => {
  const col = item.metal === "or" ? "#d4af37" : item.metal === "argent" ? "#d0d3d8" : item.metal === "noir" ? "#2a2a2e" : (item.colors && item.colors[0]) || "#c0c0c0";
  return new THREE.MeshStandardMaterial({ color: col, roughness: 0.28, metalness: 0.95 });
};

/* ---------- Classe principale ---------- */

export class Mannequin {
  constructor(container, { autoRotate = true } = {}) {
    this.container = container;
    this.autoRotate = autoRotate;
    this.yaw = -0.35;
    this.body = null;
    this.items = {};
    this.zoom = 1;
    this.dead = false;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      this.renderer = null;
      container.textContent = "La 3D n'est pas disponible sur cet appareil : la planche de photos reste utilisable.";
      return;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:none;cursor:grab";
    container.append(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa0b0, 1.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(1.6, 3, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1.2; key.shadow.camera.right = 1.2; key.shadow.camera.top = 2.4; key.shadow.camera.bottom = -0.5;
    key.shadow.bias = -0.0004;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfd4ff, 0.7);
    rim.position.set(-2.4, 2, -2.2);
    this.scene.add(rim);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.ShadowMaterial({ opacity: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.figure = new THREE.Group();
    this.root.add(this.figure);

    this._bind();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _bind() {
    const el = this.canvas;
    let drag = null;
    el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, yaw: this.yaw }; this.paused = true; el.setPointerCapture(e.pointerId); el.style.cursor = "grabbing"; });
    el.addEventListener("pointermove", (e) => { if (drag) { this.yaw = drag.yaw + (e.clientX - drag.x) * 0.012; this.dirty = true; } });
    const end = () => { drag = null; el.style.cursor = "grab"; clearTimeout(this._resume); this._resume = setTimeout(() => (this.paused = false), 2500); };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("wheel", (e) => { e.preventDefault(); this.zoom = Math.max(0.55, Math.min(1.8, this.zoom * (e.deltaY > 0 ? 0.94 : 1.06))); this.resize(); }, { passive: false });
    el.addEventListener("dblclick", () => { this.zoom = 1; this.yaw = -0.35; this.resize(); });
  }

  resize() {
    if (!this.renderer) return;
    const w = this.container.clientWidth || 300, h = this.container.clientHeight || 400;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const H = this.body?.H || 1.75;
    const t = Math.tan((this.camera.fov * Math.PI) / 360);
    const dist = Math.max((H * 1.12) / (2 * t), 0.95 / (2 * t * this.camera.aspect)) / this.zoom;
    this.camera.position.set(0, H * 0.5 + H * 0.03, dist);
    this.camera.lookAt(0, H * 0.5, 0);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  _loop() {
    if (this.dead) return;
    if (!this.container.isConnected) { this.dispose(); return; }
    if (this.autoRotate && !this.paused) { this.yaw += 0.006; this.dirty = true; }
    if (this.dirty && this.renderer) {
      this.root.rotation.y = this.yaw;
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
    requestAnimationFrame(this._loop);
  }

  setYaw(y) { this.yaw = y; this.dirty = true; }

  setBody(body) {
    if (!this.renderer) return;
    this.body = body;
    this._rebuild();
    this.resize();
  }

  setOutfit(outfit) {
    if (!this.renderer) return;
    this.items = outfit || {};
    this._rebuild();
    ensureModels(Object.values(this.items).filter(Boolean).map((i) => i.category)).then((changed) => { if (changed && !this.dead) this._rebuild(); });
  }

  /* ---------- Construction ---------- */

  _rebuild() {
    if (!this.body) return;
    this._clear();
    const B = this.body;
    const H = B.H;
    const g = this.figure;
    const skin = solid(B.skin, { roughness: 0.72 });
    this._track(skin);

    // Profil du torse (y en mètres).
    const chestB = B.chestA * 0.72, waistB = B.waistA * 0.78, hipB = B.hipA * 0.76;
    const torsoAt = curve([
      { y: 0.28 * H, a: B.hipA * 1.0, b: hipB * 0.98 },
      { y: 0.46 * H, a: B.hipA * 0.86, b: hipB * 0.9 },
      { y: 0.53 * H, a: B.hipA, b: hipB },
      { y: 0.62 * H, a: B.waistA, b: waistB },
      { y: 0.72 * H, a: B.chestA, b: chestB },
      { y: 0.78 * H, a: B.chestA * 0.98, b: chestB * 0.94 },
      { y: 0.815 * H, a: Math.max(B.chestA * 0.93, B.shoulderHalf * 0.8), b: chestB * 0.8 },
      { y: 0.835 * H, a: B.shoulderHalf * 0.62, b: chestB * 0.62 },
      { y: 0.85 * H, a: B.shoulderHalf * 0.34, b: chestB * 0.45 },
      { y: 0.865 * H, a: 0.058 * (H / 1.75), b: 0.052 * (H / 1.75) },
    ]);
    this.torsoAt = torsoAt;

    const torso = new THREE.Mesh(loft(levelsFrom(torsoAt, 0.46 * H, 0.86 * H, 0, 28), { capBottom: true, capTop: true }), skin);
    torso.castShadow = true;
    g.add(torso);
    this._track(torso.geometry);

    // Jambes
    const legX = Math.max(0.05, B.hipA * 0.5);
    const legR = (y) => {
      const f = y / H;
      const pts = [[0.04, 0.028], [0.12, 0.04], [0.2, 0.05], [0.285, 0.048], [0.38, 0.065], [0.47, 0.08]];
      let r = pts[pts.length - 1][1];
      for (let i = 1; i < pts.length; i++) if (f <= pts[i][0]) { const [f0, r0] = pts[i - 1], [f1, r1] = pts[i]; r = r0 + ((r1 - r0) * (f - f0)) / (f1 - f0); break; }
      if (f <= pts[0][0]) r = pts[0][1];
      return r * (H / 1.75) * Math.max(0.85, Math.min(1.35, B.hipA / 0.18));
    };
    this.legX = legX; this.legR = legR;
    for (const s of [-1, 1]) {
      const lv = Array.from({ length: 14 }, (_, i) => { const y = 0.04 * H + ((0.48 * H - 0.04 * H) * i) / 13; const r = legR(y); return { y, a: r, b: r * 0.95, cx: s * legX }; });
      const leg = new THREE.Mesh(loft(lv, { seg: 20, capTop: true }), skin);
      leg.castShadow = true; g.add(leg); this._track(leg.geometry);
      // pied nu
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.036 * (H / 1.75), 0.1 * (H / 1.75), 6, 12), skin);
      foot.rotation.x = Math.PI / 2; foot.scale.set(1, 1.0, 0.7);
      foot.position.set(s * legX, 0.03 * H * 0.95, 0.045 * H);
      foot.castShadow = true; g.add(foot); this._track(foot.geometry);
    }

    // Bras
    const arms = this._arms = [];
    const armR = (0.035 * (H / 1.75)) * Math.max(0.9, Math.min(1.2, B.chestA / 0.17));
    for (const s of [-1, 1]) {
      const S = new THREE.Vector3(s * (B.shoulderHalf - armR * 0.9), 0.8 * H, 0);
      const E = S.clone().add(new THREE.Vector3(s * Math.sin(0.06), -Math.cos(0.06), 0).multiplyScalar(0.186 * H));
      const W = E.clone().add(new THREE.Vector3(s * Math.sin(0.04), -Math.cos(0.04) * Math.cos(0.16), Math.sin(0.16)).multiplyScalar(0.146 * H));
      const Hd = W.clone().add(W.clone().sub(E).normalize().multiplyScalar(0.038 * H));
      arms.push({ s, S, E, W, Hd, r: armR });
      g.add(this._limb(S, E, armR, armR * 0.8, skin, 18));
      g.add(this._limb(E, W, armR * 0.82, armR * 0.6, skin, 18));
      const sh = new THREE.Mesh(new THREE.SphereGeometry(armR * 1.0, 16, 12), skin); sh.position.copy(S); g.add(sh); this._track(sh.geometry);
      const el = new THREE.Mesh(new THREE.SphereGeometry(armR * 0.8, 12, 10), skin); el.position.copy(E); g.add(el); this._track(el.geometry);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(armR * 0.62, 12, 10), skin); hand.scale.set(0.9, 1.45, 0.7); hand.position.copy(Hd); hand.castShadow = true; g.add(hand); this._track(hand.geometry);
    }

    // Cou, tête, cheveux
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.034 * (H / 1.75), 0.04 * (H / 1.75), 0.07 * H, 16), skin);
    neck.position.set(0, 0.885 * H, 0); g.add(neck); this._track(neck.geometry);
    const hr = 0.076 * H;
    this.headY = 0.945 * H; this.headR = hr;
    const head = new THREE.Mesh(new THREE.SphereGeometry(hr, 32, 24), skin);
    head.scale.set(0.84, 1.08, 0.95); head.position.set(0, this.headY, 0); head.castShadow = true; g.add(head); this._track(head.geometry);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(hr * 0.12, hr * 0.28, 10), skin);
    nose.rotation.x = Math.PI / 2; nose.position.set(0, this.headY - hr * 0.05, hr * 0.97); g.add(nose); this._track(nose.geometry);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(hr * 0.16, 10, 8), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * hr * 0.84, this.headY - hr * 0.05, 0); g.add(ear); this._track(ear.geometry); }
    if (B.hairStyle !== "chauve") {
      const hair = solid(B.hair, { roughness: 0.9 });
      const cap = new THREE.Mesh(new THREE.SphereGeometry(hr * 1.03, 32, 20, 0, Math.PI * 2, 0, Math.PI * (B.hairStyle === "long" ? 0.62 : 0.5)), hair);
      cap.scale.set(0.86, 1.1, 0.98); cap.position.set(0, this.headY + hr * 0.02, -hr * 0.04); cap.castShadow = true; g.add(cap); this._track(cap.geometry, hair);
      if (B.hairStyle === "long") { const back = new THREE.Mesh(new THREE.CylinderGeometry(hr * 0.8, hr * 0.7, hr * 2.4, 20, 1, true, Math.PI * 0.35, Math.PI * 1.3), hair); back.material.side = THREE.DoubleSide; back.position.set(0, this.headY - hr * 1.1, -hr * 0.2); g.add(back); this._track(back.geometry); }
    }

    this._bodyCount = g.children.length;
    this._dress(g, B, H);
  }

  // Place un modèle GLB fourni : mis à l'échelle d'après le mannequin de référence, matériaux « couleur* » teintés.
  _glb(g, item, slot, B, H) {
    const inst = modelScenes.get(item.category).clone(true);
    const k = H / REF.H;
    const wide = slot === "bottom" ? B.hipA / REF.A : ["top", "mid", "outer", "dress"].includes(slot) ? B.chestA / REF.A : k;
    inst.scale.set(wide, k, wide);
    const tint = item.colors?.[0];
    inst.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map((m) => { const c = m.clone(); if (tint && /^(couleur|color|tissu)/i.test(c.name || "")) c.color.set(tint); if (["top", "mid", "outer", "dress", "bottom"].includes(slot)) c.side = THREE.DoubleSide; this._track(c); return c; });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    });
    g.add(inst);
  }

  // Les vêtements seuls (sans le corps), pour exporter un exemple en GLB.
  garmentsGroup() { const grp = new THREE.Group(); this.figure.children.slice(this._bodyCount).forEach((c) => grp.add(c.clone(true))); return grp; }

  _limb(p0, p1, r0, r1, mat, seg = 16, open = false) {
    const dir = p1.clone().sub(p0), len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg, 1, open), mat);
    m.position.copy(p0).add(p1).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true;
    this._track(m.geometry);
    return m;
  }

  _shell(item, y0, y1, extraOff = 0, mat = null, opts = {}) {
    const off = (FABRIC_THICKNESS[item.category] ?? 0.012) + (FIT_OFFSET[item.fit || "regular"] ?? 0) + extraOff;
    const m = new THREE.Mesh(loft(levelsFrom(this.torsoAt, y0, y1, off, 22), { capBottom: false, capTop: false }), mat || this._mat(item));
    m.castShadow = true;
    this._track(m.geometry);
    return m;
  }

  _mat(item, extra) { const m = fabric(item, extra); this._track(m); return m; }
  _track(...objs) { (this._disposables ||= []).push(...objs); }
  _clear() {
    while (this.figure.children.length) this.figure.remove(this.figure.children[0]);
    for (const d of this._disposables || []) d.dispose?.();
    this._disposables = [];
  }

  /* ---------- Vêtements ---------- */

  _dress(g, B, H) {
    // Pièces fournies en GLB : placées telles quelles, le vêtement simplifié ne s'en occupe plus.
    const it = { ...this.items };
    for (const [slot, item] of Object.entries(this.items)) if (item && modelScenes.has(item.category)) { this._glb(g, item, slot, B, H); delete it[slot]; }
    const A = this._arms;
    const add = (o) => { if (o) { g.add(o); o.traverse?.((c) => { if (c.isMesh) c.castShadow = true; }); } return o; };

    // Pantalon / short / jupe
    if (it.bottom) this._bottom(g, it.bottom, B, H);
    // Robe
    if (it.dress) this._dressItem(g, it.dress, B, H);
    // Haut, couches
    for (const slot of ["top", "mid", "outer"]) if (it[slot]) this._upper(g, it[slot], slot, B, H, A);

    // Chaussettes puis chaussures
    if (it.socks) {
      const mat = this._mat(it.socks);
      for (const s of [-1, 1]) {
        const r = this.legR(0.07 * H) + 0.006;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.15, 0.1 * H, 16, 1, true), mat);
        m.position.set(s * this.legX, 0.055 * H, 0); add(m); this._track(m.geometry);
      }
    }
    if (it.shoes) this._shoes(g, it.shoes, B, H);

    // Accessoires
    this._accessories(g, it, B, H, A);
  }

  _bottom(g, item, B, H) {
    const cat = item.category;
    const mat = this._mat(item);
    const off = (FIT_OFFSET[item.fit || "regular"] ?? 0.004) + (cat === "jogging" ? 0.006 : 0.004);
    const waistY = (cat === "jean" || cat === "pantalon" ? 0.612 : 0.6) * H;
    // bassin
    g.add(this._shell({ category: "jean", fit: item.fit }, 0.462 * H, waistY, 0, mat));
    if (cat === "jupe") {
      const lv = levelsFrom(this.torsoAt, 0.36 * H, waistY, 0.01, 18);
      lv.forEach((L, i) => { const k = 1 - i / (lv.length - 1); L.a += k * 0.1; L.b += k * 0.1; });
      const sk = new THREE.Mesh(loft(lv), mat); this._track(sk.geometry); sk.castShadow = true; g.add(sk);
      return;
    }
    const hem = { short: 0.34, bermuda: 0.27, jogging: 0.055, jean: 0.05, pantalon: 0.05 }[cat] ?? 0.05;
    const flare = cat === "short" ? 0.02 : cat === "pantalon" ? 0.012 : cat === "jean" ? 0.006 : 0;
    const cuff = cat === "jogging" ? -0.004 : 0;
    for (const s of [-1, 1]) {
      const n = 14, y0 = hem * H, y1 = 0.484 * H;
      const lv = Array.from({ length: n }, (_, i) => {
        const y = y0 + ((y1 - y0) * i) / (n - 1);
        const r = this.legR(y) + off + (1 - i / (n - 1)) * flare + (i === 0 ? cuff : 0);
        return { y, a: r, b: r * 0.96, cx: s * this.legX };
      });
      const m = new THREE.Mesh(loft(lv, { seg: 22 }), mat);
      m.castShadow = true; g.add(m); this._track(m.geometry);
    }
    if (["jogging"].includes(cat)) {
      const c = solid(item.colors?.[1] || item.colors?.[0] || "#333", { roughness: 0.9 });
      this._track(c);
      for (const s of [-1, 1]) { const r = this.legR(hem * H + 0.01) + off; const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 22), c); m.rotation.x = Math.PI / 2; m.position.set(s * this.legX, hem * H + 0.012, 0); g.add(m); this._track(m.geometry); }
    }
  }

  _dressItem(g, item, B, H) {
    const mat = this._mat(item);
    g.add(this._shell(item, 0.6 * H, 0.835 * H, 0, mat));
    const lv = levelsFrom(this.torsoAt, 0.3 * H, 0.6 * H, 0.012, 20);
    lv.forEach((L, i) => { const k = 1 - i / (lv.length - 1); L.a += k * 0.09; L.b += k * 0.09; });
    const sk = new THREE.Mesh(loft(lv), mat); sk.castShadow = true; g.add(sk); this._track(sk.geometry);
  }

  _upper(g, item, slot, B, H, A) {
    const cat = item.category;
    const mat = this._mat(item);
    const hem = {
      tshirt: 0.575, debardeur: 0.585, polo: 0.56, chemise: 0.54, pull: 0.55, sweat: 0.55, gilet: 0.54,
      veste: 0.5, blouson: 0.545, manteau: 0.37, doudoune: 0.49, impermeable: 0.46, coupevent: 0.52,
    }[cat] ?? 0.55;
    const thickOf = (x) => (x ? (FABRIC_THICKNESS[x.category] ?? 0.012) + (FIT_OFFSET[x.fit || "regular"] ?? 0) : 0);
    const under = slot === "outer" ? thickOf(this.items.mid) + thickOf(this.items.top) : slot === "mid" ? thickOf(this.items.top) : 0;
    const slotBoost = (slot === "outer" || slot === "mid" ? 0.006 : 0) + under * 0.9;
    const topY = 0.852 * H;
    g.add(this._shell(item, hem * H, topY, slotBoost, mat));
    // encolure
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.058 * (H / 1.75) + 0.008, cat === "chemise" || cat === "polo" ? 0.011 : 0.007, 8, 24), mat);
    collar.rotation.x = Math.PI / 2; collar.scale.set(1, 0.9, 1); collar.position.set(0, 0.868 * H, 0); g.add(collar); this._track(collar.geometry);
    if (cat === "sweat") { const hood = new THREE.Mesh(new THREE.TorusGeometry(0.075 * (H / 1.75), 0.022, 10, 24), mat); hood.rotation.x = Math.PI / 2.2; hood.position.set(0, 0.862 * H, -0.03); g.add(hood); this._track(hood.geometry); }
    if (["veste", "manteau", "blouson", "doudoune", "impermeable", "coupevent"].includes(cat)) {
      // ligne d'ouverture centrale
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.006, (topY - hem * H) * 0.98, 0.004), solid("#1b1b1b", { roughness: 0.5 }));
      line.position.set(0, (topY + hem * H) / 2, this.torsoAt((topY + hem * H) / 2).b + 0.03 + slotBoost); g.add(line); this._track(line.geometry, line.material);
    }
    if (cat === "doudoune") {
      for (let k = 1; k < 5; k++) { const y = hem * H + ((topY - hem * H) * k) / 5; const s = this.torsoAt(y); const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.004, 6, 32), solid("#000", { transparent: true, opacity: 0.18 })); ring.rotation.x = Math.PI / 2; ring.scale.set(s.a + 0.043, s.b + 0.043, 1); ring.position.y = y; g.add(ring); this._track(ring.geometry, ring.material); }
    }
    // manches
    const fullSleeve = !["tshirt", "polo", "debardeur", "gilet"].includes(cat) || false;
    if (cat === "debardeur" || cat === "gilet") return;
    const thick = (FABRIC_THICKNESS[cat] ?? 0.012) + (FIT_OFFSET[item.fit || "regular"] ?? 0) * 0.8 + slotBoost;
    for (const a of A) {
      const r0 = a.r + thick, r1 = a.r * 0.8 + thick, r2 = a.r * 0.58 + thick * 0.8;
      const sh = new THREE.Mesh(new THREE.SphereGeometry(r0 * 1.02, 14, 10), mat); sh.position.copy(a.S); g.add(sh); this._track(sh.geometry);
      if (!fullSleeve) {
        const P = a.S.clone().lerp(a.E, 0.58);
        g.add(this._limb(a.S, P, r0, a.r * 0.9 + thick, mat, 18, true));
      } else {
        g.add(this._limb(a.S, a.E, r0, r1, mat, 18, true));
        const P = a.E.clone().lerp(a.W, 0.96);
        const el = new THREE.Mesh(new THREE.SphereGeometry(r1 * 1.02, 12, 8), mat); el.position.copy(a.E); g.add(el); this._track(el.geometry);
        g.add(this._limb(a.E, P, r1, r2, mat, 18, true));
        if (["pull", "sweat", "doudoune"].includes(cat)) { const cuff = new THREE.Mesh(new THREE.TorusGeometry(r2, 0.007, 8, 18), mat); const d = a.W.clone().sub(a.E).normalize(); cuff.position.copy(P); cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); g.add(cuff); this._track(cuff.geometry); }
      }
    }
  }

  _shoes(g, item, B, H) {
    const cat = item.category;
    const k = H / 1.75;
    const c0 = item.colors?.[0] || "#222";
    const c1 = item.colors?.[1] || (cat === "baskets" ? "#f2f2ee" : cat === "ville" ? "#1c1c1c" : "#2a2a2a");
    const body = solid(c0, { roughness: cat === "ville" ? 0.35 : 0.75 });
    const sole = solid(c1, { roughness: 0.8 });
    this._track(body, sole);
    for (const s of [-1, 1]) {
      const x = s * this.legX;
      const grp = new THREE.Group();
      grp.position.set(x, 0, 0.045 * H);
      if (["tongs", "claquettes", "sandales"].includes(cat)) {
        const slab = new THREE.Mesh(new THREE.CapsuleGeometry(0.04 * k, 0.15 * k, 4, 14), sole);
        slab.rotation.x = Math.PI / 2; slab.scale.set(1, 1, 0.2); slab.position.set(0, 0.012 * H, 0); grp.add(slab); this._track(slab.geometry);
        if (cat === "claquettes") { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * k, 0.04 * k, 0.07 * k, 16, 1, true, -Math.PI * 0.5, Math.PI), body); band.rotation.x = Math.PI / 2; band.scale.set(1, 1, 0.55); band.position.set(0, 0.03 * H, 0.015 * H); grp.add(band); this._track(band.geometry); }
        else { for (const [px, ang] of [[-0.018, 0.25], [0.018, -0.25]]) { const strap = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.12 * k), body); strap.position.set(px * k, 0.027 * H, 0.0); strap.rotation.y = ang; grp.add(strap); this._track(strap.geometry); } if (cat === "sandales") { const st = new THREE.Mesh(new THREE.BoxGeometry(0.07 * k, 0.01, 0.014), body); st.position.set(0, 0.038 * H, -0.02 * H); grp.add(st); this._track(st.geometry); } }
      } else {
        const slim = cat === "ville" ? 0.86 : 1;
        const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.043 * k * slim, 0.14 * k, 8, 16), body);
        upper.rotation.x = Math.PI / 2; upper.scale.set(1, 1, cat === "baskets" ? 1.0 : 0.88); upper.position.set(0, 0.046 * H, 0.012 * H); upper.castShadow = true; grp.add(upper); this._track(upper.geometry);
        const sl = new THREE.Mesh(new THREE.CapsuleGeometry(0.046 * k * slim, 0.15 * k, 6, 16), sole);
        sl.rotation.x = Math.PI / 2; sl.scale.set(1.04, 1, 0.34); sl.position.set(0, 0.014 * H, 0.012 * H); grp.add(sl); this._track(sl.geometry);
        if (["bottes", "bottines"].includes(cat)) {
          const hgt = (cat === "bottes" ? 0.2 : 0.12) * H;
          const sh = new THREE.Mesh(new THREE.CylinderGeometry(this.legR(0.1 * H) + 0.016, this.legR(0.05 * H) + 0.012, hgt, 18, 1, true), body);
          sh.material.side = THREE.DoubleSide; sh.position.set(0, 0.04 * H + hgt / 2, -0.045 * H); grp.add(sh); this._track(sh.geometry);
        }
        if (cat === "baskets") { const toe = new THREE.Mesh(new THREE.SphereGeometry(0.03 * k, 12, 10), sole); toe.scale.set(1, 0.6, 1); toe.position.set(0, 0.03 * H, 0.1 * k); grp.add(toe); this._track(toe.geometry); }
      }
      grp.traverse((c) => { if (c.isMesh) c.castShadow = true; });
      g.add(grp);
    }
  }

  _accessories(g, it, B, H, A) {
    const k = H / 1.75;
    const hr = this.headR, hy = this.headY;
    const add = (o) => { g.add(o); return o; };

    if (it.hat) {
      const item = it.hat, mat = this._mat(item), cat = item.category;
      const R = hr * (cat === "bonnet" ? 1.06 : 1.02);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 18, 0, Math.PI * 2, 0, Math.PI * (cat === "bonnet" ? 0.58 : 0.5)), mat);
      dome.scale.set(0.88, cat === "bonnet" ? 1.25 : 1.08, 1.0); dome.position.set(0, hy + hr * (cat === "bonnet" ? 0.06 : 0.14), 0); add(dome); this._track(dome.geometry);
      if (cat === "casquette") {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(hr * 0.95, hr * 0.95, 0.008, 24, 1, false, -Math.PI * 0.5, Math.PI), mat);
        brim.position.set(0, hy + hr * 0.2, hr * 0.5); brim.scale.set(0.9, 1, 1.2); add(brim); this._track(brim.geometry);
      } else if (cat === "chapeau") {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(hr * 1.9, hr * 1.9, 0.006, 32), mat);
        brim.position.set(0, hy + hr * 0.16, 0); add(brim); this._track(brim.geometry);
      } else if (cat === "bonnet") {
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(hr * 0.9, hr * 0.16, 10, 28), mat);
        cuff.rotation.x = Math.PI / 2; cuff.scale.set(0.9, 1.0, 1); cuff.position.set(0, hy + hr * 0.2, 0); add(cuff); this._track(cuff.geometry);
      }
    }

    if (it.glasses) {
      const item = it.glasses, frameMat = solid(item.colors?.[0] || "#111", { roughness: 0.35 });
      const lens = new THREE.MeshStandardMaterial({ color: item.sun === false ? "#cfe6f5" : "#1a1a1a", roughness: 0.1, metalness: 0.2, transparent: true, opacity: item.sun === false ? 0.25 : 0.82 });
      this._track(frameMat, lens);
      const z = hr * 0.93, y = hy + hr * 0.08;
      for (const s of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(hr * 0.21, hr * 0.03, 8, 24), frameMat); ring.position.set(s * hr * 0.33, y, z); ring.scale.set(1.1, 0.85, 1); add(ring); this._track(ring.geometry);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(hr * 0.21, 24), lens); disc.position.set(s * hr * 0.33, y, z); disc.scale.set(1.1, 0.85, 1); add(disc); this._track(disc.geometry);
        const temple = new THREE.Mesh(new THREE.CylinderGeometry(hr * 0.02, hr * 0.02, hr * 0.85, 6), frameMat); temple.rotation.x = Math.PI / 2; temple.position.set(s * hr * 0.62, y, z - hr * 0.42); add(temple); this._track(temple.geometry);
      }
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(hr * 0.022, hr * 0.022, hr * 0.14, 6), frameMat); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, y + hr * 0.05, z + 0.002); add(bridge); this._track(bridge.geometry);
    }

    if (it.scarf) {
      const mat = this._mat(it.scarf);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.066 * k, 0.028 * k, 12, 28), mat);
      ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.855 * H, 0.004); add(ring); this._track(ring.geometry);
      for (const [x, len] of [[-0.02, 0.2], [0.025, 0.15]]) { const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05 * k, len * k, 0.012), mat); tail.position.set(x, (0.835 - len * 0.5 * 0.55) * H + 0.02, this.torsoAt(0.78 * H).b + 0.032); tail.rotation.z = x * 1.5; add(tail); this._track(tail.geometry); }
    }

    if (it.belt) {
      const mat = solid(it.belt.colors?.[0] || "#2b1d12", { roughness: 0.55 });
      this._track(mat);
      const y = 0.602 * H, lv = levelsFrom(this.torsoAt, y - 0.014, y + 0.014, 0.018 + (it.bottom ? 0.01 : 0), 3);
      const band = new THREE.Mesh(loft(lv), mat); add(band); this._track(band.geometry);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.026, 0.008), metalMat({ metal: it.belt.metal || "argent", colors: ["#c0c0c0"] }));
      buckle.position.set(0, y, this.torsoAt(y).b + 0.034); add(buckle); this._track(buckle.geometry);
    }

    if (it.gloves) {
      const mat = this._mat(it.gloves);
      for (const a of A) { const m = new THREE.Mesh(new THREE.SphereGeometry(a.r * 0.78, 12, 10), mat); m.scale.set(0.95, 1.5, 0.8); m.position.copy(a.Hd); add(m); this._track(m.geometry); }
    }

    const left = A.find((a) => a.s === 1), right = A.find((a) => a.s === -1);
    if (it.watch && left) {
      const w = left.W.clone().lerp(left.E, 0.12);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(left.r * 0.58 + 0.005, left.r * 0.58 + 0.005, 0.026, 18, 1, true), it.watch.metal ? metalMat(it.watch) : solid(it.watch.colors?.[1] || "#222"));
      band.material.side = THREE.DoubleSide;
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), left.W.clone().sub(left.E).normalize());
      band.quaternion.copy(q); band.position.copy(w); add(band); this._track(band.geometry);
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.007, 20), solid(it.watch.colors?.[0] || "#111", { roughness: 0.25, metalness: 0.4 }));
      face.position.copy(w).add(new THREE.Vector3(left.r * 0.9, 0, 0)); face.rotation.z = Math.PI / 2; add(face); this._track(face.geometry);
    }
    if (it.bracelet && right) {
      const w = right.W.clone().lerp(right.E, 0.1);
      const m = new THREE.Mesh(new THREE.TorusGeometry(right.r * 0.58 + 0.004, 0.004, 8, 22), metalMat(it.bracelet));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), right.W.clone().sub(right.E).normalize()); m.position.copy(w); add(m); this._track(m.geometry);
    }
    if (it.ring && left) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(left.r * 0.28, 0.0035, 8, 16), metalMat(it.ring));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), left.W.clone().sub(left.E).normalize()); m.position.copy(left.Hd).add(new THREE.Vector3(0, -left.r * 0.7, 0)); add(m); this._track(m.geometry);
    }
    if (it.necklace) {
      const mat = metalMat(it.necklace);
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0032 * 1.2, 8, 40, Math.PI * 1.2), mat);
      m.scale.set(0.07 * k, 0.1 * k, 1); m.rotation.set(0, 0, Math.PI + Math.PI * 0.1 * 0 - 0.6); m.position.set(0, 0.832 * H, this.torsoAt(0.82 * H).b * 0.35); add(m); this._track(m.geometry);
      const pend = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), mat); pend.position.set(0, 0.755 * H, this.torsoAt(0.76 * H).b + 0.012); add(pend); this._track(pend.geometry);
    }
    if (it.earrings) {
      const mat = metalMat(it.earrings);
      for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), mat); m.position.set(s * hr * 0.86, hy - hr * 0.25, 0); add(m); this._track(m.geometry); }
    }

    if (it.bag) {
      const item = it.bag, mat = this._mat(item);
      if (item.category === "sacados") {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.28 * k, 0.4 * k, 0.14 * k, 2, 2, 2), mat);
        bag.position.set(0, 0.7 * H, -(this.torsoAt(0.7 * H).b + 0.1 * k)); bag.geometry.translate(0, 0, 0); add(bag); this._track(bag.geometry);
        const strapMat = solid("#1f1f1f"); this._track(strapMat);
        for (const a of A) {
          const p0 = new THREE.Vector3(a.s * 0.075 * k, 0.83 * H, -(this.torsoAt(0.83 * H).b + 0.015));
          const p1 = new THREE.Vector3(a.s * 0.085 * k, 0.83 * H, this.torsoAt(0.82 * H).b + 0.018);
          const p2 = new THREE.Vector3(a.s * 0.1 * k, 0.64 * H, this.torsoAt(0.64 * H).b + 0.02);
          const p3 = new THREE.Vector3(a.s * 0.1 * k, 0.62 * H, -(this.torsoAt(0.62 * H).b + 0.02));
          for (const [u, v] of [[p0, p1], [p1, p2]]) { const seg = this._limb(u, v, 0.012, 0.012, strapMat, 6); add(seg); }
          void p3;
        }
      } else {
        const strapMat = solid("#2a2a2a"); this._track(strapMat);
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.24 * k, 0.17 * k, 0.07 * k), mat);
        bag.position.set(-(this.torsoAt(0.5 * H).a + 0.05), 0.5 * H, 0.03); add(bag); this._track(bag.geometry);
        const p0 = new THREE.Vector3(this.torsoAt(0.8 * H).a * 0.9, 0.83 * H, 0), p1 = new THREE.Vector3(-this.torsoAt(0.5 * H).a * 0.95, 0.52 * H, this.torsoAt(0.52 * H).b + 0.02);
        const mid = p0.clone().lerp(p1, 0.5); mid.z = this.torsoAt(0.67 * H).b + 0.032;
        add(this._limb(p0, mid, 0.007, 0.007, strapMat, 6)); add(this._limb(mid, p1, 0.007, 0.007, strapMat, 6));
      }
    }
  }

  snapshot() { this.root.rotation.y = this.yaw; this.renderer.render(this.scene, this.camera); return this.canvas.toDataURL("image/png"); }

  dispose() {
    this.dead = true;
    this.resizeObs?.disconnect();
    this._clear();
    this.renderer?.dispose();
    this.canvas?.remove();
  }
}

export function webglAvailable() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
