// Décor de chambre procédural : parquet, murs, grand miroir réfléchissant, lit, fenêtre, armoire, plante, tableaux.
// Le mannequin se tient à l'origine, tourné vers +Z, face au miroir fixé au mur du fond.

import * as THREE from "./vendor/three.min.js";

const ROOM = { x0: -2.7, x1: 2.7, z0: -3.0, z1: 2.7, h: 2.7 };
export const MIRROR = { w: 1.35, h: 2.05, y: 1.18, z: 2.675 };

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const rnd = (() => { let a = 12345; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); })();

function floorTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const y = (i * h) / n;
      let x = -rnd() * 400;
      while (x < w) {
        const len = 380 + rnd() * 420;
        const l = 46 + rnd() * 9, s = 34 + rnd() * 8, hh = 28 + rnd() * 6;
        g.fillStyle = `hsl(${hh},${s}%,${l}%)`;
        g.fillRect(x, y, len, h / n);
        g.globalAlpha = 0.16;
        for (let k = 0; k < 14; k++) { g.fillStyle = rnd() > 0.5 ? "#3a2412" : "#f3d8b0"; g.fillRect(x + rnd() * len, y + rnd() * (h / n), 40 + rnd() * 160, 1 + rnd() * 1.5); }
        g.globalAlpha = 1;
        g.fillStyle = "rgba(40,24,12,.55)"; g.fillRect(x, y, 2, h / n);
        x += len;
      }
      g.fillStyle = "rgba(40,24,12,.5)"; g.fillRect(0, y, w, 2);
    }
  }, [2.2, 2.4]);
}
function rugTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#b9674d"; g.fillRect(0, 0, w, h);
    const rings = ["#e9dcc4", "#8a3f2f", "#e9dcc4", "#c98b5f", "#e9dcc4"];
    rings.forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h / 2, 230 - i * 42, 0, Math.PI * 2); g.stroke(); });
    g.fillStyle = "#e9dcc4"; for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; g.beginPath(); g.arc(w / 2 + Math.cos(a) * 70, h / 2 + Math.sin(a) * 70, 5, 0, 7); g.fill(); }
  });
}
function skyTexture(kind) {
  return canvasTex(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    if (kind === "day") { grad.addColorStop(0, "#8ec5f2"); grad.addColorStop(0.7, "#d8eefc"); grad.addColorStop(1, "#f6fbff"); }
    else if (kind === "evening") { grad.addColorStop(0, "#3d4f86"); grad.addColorStop(0.45, "#d9728a"); grad.addColorStop(1, "#ffb15c"); }
    else { grad.addColorStop(0, "#050914"); grad.addColorStop(1, "#16223f"); }
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    if (kind === "day") { g.fillStyle = "rgba(255,255,255,.85)"; for (const [x, y, r] of [[60, 70, 26], [95, 78, 20], [190, 130, 24], [160, 140, 18]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }
    if (kind === "night") { g.fillStyle = "#fff"; for (let i = 0; i < 60; i++) g.fillRect(rnd() * w, rnd() * h * 0.8, 1.5, 1.5); g.fillStyle = "#f4f1d8"; g.beginPath(); g.arc(190, 60, 16, 0, 7); g.fill(); }
    // silhouette de toits
    g.fillStyle = kind === "day" ? "#9db1bf" : "#0b0f1a";
    for (let i = 0; i < 9; i++) { const bw = 20 + rnd() * 30, bh = 20 + rnd() * 50; g.fillRect(i * 30, h - bh, bw, bh); }
  });
}
function artTexture(seed) {
  return canvasTex(256, 360, (g, w, h) => {
    const pal = [["#f2e8d5", "#c8553d", "#2f4f4f", "#e0a84d"], ["#1f2d3d", "#e9d8a6", "#ee9b00", "#ca6702"], ["#e5e5e5", "#222", "#9b2226", "#bb9457"]][seed % 3];
    g.fillStyle = pal[0]; g.fillRect(0, 0, w, h);
    g.fillStyle = pal[1]; g.beginPath(); g.arc(w * 0.5, h * 0.4, w * 0.3, 0, 7); g.fill();
    g.fillStyle = pal[2]; g.fillRect(w * 0.12, h * 0.68, w * 0.76, h * 0.1);
    g.fillStyle = pal[3]; g.beginPath(); g.moveTo(w * 0.2, h * 0.9); g.lineTo(w * 0.5, h * 0.55); g.lineTo(w * 0.8, h * 0.9); g.fill();
  });
}

const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });

const AMBIANCES = {
  day: { hemi: [0xffffff, 0xcdb89a, 1.0], sun: [0xfff0d6, 3.4, [-6.5, 3.6, 0.6]], lamp: 0, ceil: 0, env: 0.5, exposure: 1.0, bg: 0x9fb4c8 },
  evening: { hemi: [0xffd9b8, 0x3a2a30, 0.5], sun: [0xff8a42, 2.4, [-6.5, 1.1, 0.6]], lamp: 14, ceil: 0, env: 0.22, exposure: 1.1, bg: 0x2a2030 },
  night: { hemi: [0x5d70a8, 0x15131f, 0.32], sun: [0x8aa6ff, 0.55, [-5.5, 4.2, 1.2]], lamp: 16, ceil: 6, env: 0.12, exposure: 1.2, bg: 0x070a14 },
};

export class Room {
  constructor({ quality = "high" } = {}) {
    this.quality = quality;
    this.group = new THREE.Group();
    this.skies = { day: skyTexture("day"), evening: skyTexture("evening"), night: skyTexture("night") };
    this._disposables = [];
    this._build();
  }

  _build() {
    const g = this.group;
    const R = ROOM;
    const W = R.x1 - R.x0, D = R.z1 - R.z0;
    const wall = std("#ded8cc"), sage = std("#8b9b87"), white = std("#f4f1ea", { roughness: 0.6 }), dark = std("#2a2018", { roughness: 0.6 }), wood = std("#a9805a", { roughness: 0.55 });

    // Sol
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.55, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (R.z0 + R.z1) / 2); floor.receiveShadow = true; g.add(floor);
    // Plafond
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std("#f2efe8")); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, R.h, (R.z0 + R.z1) / 2); g.add(ceil);
    // Murs
    const mkWall = (w, h, mat, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); return m; };
    mkWall(W, R.h, wall, 0, R.h / 2, R.z1, Math.PI);            // mur du miroir
    mkWall(W, R.h, wall, 0, R.h / 2, R.z0, 0);                  // mur derrière la caméra
    mkWall(D, R.h, wall, R.x0, R.h / 2, (R.z0 + R.z1) / 2, Math.PI / 2);   // mur de la fenêtre
    mkWall(D, R.h, sage, R.x1, R.h / 2, (R.z0 + R.z1) / 2, -Math.PI / 2); // mur du lit
    // Plinthes
    for (const [w, x, z, ry] of [[W, 0, R.z1 - 0.02, 0], [W, 0, R.z0 + 0.02, 0]]) g.add(box(w, 0.09, 0.03, white, x, 0.045, z));
    for (const x of [R.x0 + 0.02, R.x1 - 0.02]) g.add(box(0.03, 0.09, D, white, x, 0.045, (R.z0 + R.z1) / 2));

    // Tapis
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.2, 64), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 0.1); rug.receiveShadow = true; g.add(rug);

    // Miroir
    const mirror = new THREE.Reflector(new THREE.PlaneGeometry(MIRROR.w, MIRROR.h), {
      clipBias: 0.003, color: 0xc9d0d6, textureWidth: this.quality === "high" ? 1024 : 512, textureHeight: this.quality === "high" ? 1536 : 768,
    });
    mirror.position.set(0, MIRROR.y, MIRROR.z); mirror.rotation.y = Math.PI;
    g.add(mirror); this.mirror = mirror;
    const fm = dark, t = 0.07, d = 0.06;
    g.add(box(MIRROR.w + 2 * t, t, d, fm, 0, MIRROR.y + MIRROR.h / 2 + t / 2, MIRROR.z - 0.01), box(MIRROR.w + 2 * t, t, d, fm, 0, MIRROR.y - MIRROR.h / 2 - t / 2, MIRROR.z - 0.01),
      box(t, MIRROR.h, d, fm, -MIRROR.w / 2 - t / 2, MIRROR.y, MIRROR.z - 0.01), box(t, MIRROR.h, d, fm, MIRROR.w / 2 + t / 2, MIRROR.y, MIRROR.z - 0.01));
    const back = new THREE.Mesh(new THREE.PlaneGeometry(MIRROR.w, MIRROR.h), std("#111")); back.position.set(0, MIRROR.y, MIRROR.z + 0.012); back.rotation.y = Math.PI; g.add(back);

    // Fenêtre (mur de gauche) : ciel lumineux, cadre, rideaux
    this.skyMat = new THREE.MeshBasicMaterial({ map: this.skies.day, toneMapped: false });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), this.skyMat); sky.rotation.y = Math.PI / 2; sky.position.set(R.x0 + 0.01, 1.55, 0.6); g.add(sky);
    const fx = R.x0 + 0.04;
    g.add(box(0.06, 0.06, 1.42, white, fx, 2.33, 0.6), box(0.06, 0.06, 1.42, white, fx, 0.8, 0.6), box(0.06, 1.56, 0.06, white, fx, 1.57, -0.09), box(0.06, 1.56, 0.06, white, fx, 1.57, 1.29), box(0.04, 1.5, 0.03, white, fx, 1.55, 0.6), box(0.04, 0.03, 1.3, white, fx, 1.55, 0.6), box(0.16, 0.05, 1.6, white, R.x0 + 0.08, 0.77, 0.6));
    const curtainMat = std("#e6dac4", { side: THREE.DoubleSide, roughness: 1 });
    for (const zc of [-0.38, 1.58]) {
      const geo = new THREE.PlaneGeometry(0.65, 2.45, 24, 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 14) * 0.05);
      geo.computeVertexNormals();
      const c = new THREE.Mesh(geo, curtainMat); c.rotation.y = Math.PI / 2; c.position.set(R.x0 + 0.14, 1.3, zc); c.castShadow = true; g.add(c);
    }
    g.add(box(0.03, 0.03, 2.1, dark, R.x0 + 0.14, 2.55, 0.6));

    // Lit (mur de droite) : tête de lit contre le mur
    const frame = box(2.1, 0.26, 1.62, wood, 1.55, 0.15, 1.55);
    const mattress = box(2.0, 0.22, 1.5, std("#f2eee6"), 1.55, 0.38, 1.55);
    const duvet = box(1.45, 0.14, 1.56, std("#d9d2c2", { roughness: 1 }), 1.2, 0.52, 1.55);
    const fold = box(0.28, 0.16, 1.58, std("#cfc6b3", { roughness: 1 }), 1.92, 0.53, 1.55);
    const throwM = box(0.42, 0.05, 1.58, std("#c0644a", { roughness: 1 }), 0.72, 0.6, 1.55);
    const head = box(0.08, 1.05, 1.75, wood, 2.62, 0.6, 1.55);
    g.add(frame, mattress, duvet, fold, throwM, head);
    for (const z of [1.18, 1.92]) { const p = box(0.46, 0.13, 0.68, std("#faf8f2", { roughness: 1 }), 2.25, 0.58, z); p.rotation.z = -0.1; g.add(p); }
    // Chevet et lampe
    g.add(box(0.42, 0.48, 0.42, wood, 2.43, 0.24, 0.45));
    this.lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: "#f7e3c0", emissive: "#ffcf8a", emissiveIntensity: 0, side: THREE.DoubleSide, roughness: 1 }));
    this.lampShade.position.set(2.43, 0.88, 0.45); g.add(this.lampShade);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.3, 16), dark); base.position.set(2.43, 0.63, 0.45); g.add(base);

    // Armoire (mur du miroir, à gauche)
    const wardrobe = std("#b9a88f", { roughness: 0.7 });
    g.add(box(1.25, 2.25, 0.6, wardrobe, -1.85, 1.125, 2.36), box(0.012, 2.1, 0.02, dark, -1.85, 1.125, 2.055));
    for (const x of [-1.9, -1.8]) g.add(box(0.02, 0.22, 0.03, dark, x, 1.1, 2.04));

    // Plante
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.3, 24), std("#c97a5a", { roughness: 0.8 })); pot.position.set(-2.2, 0.15, -1.1); pot.castShadow = true; g.add(pot);
    const leaf = std("#3f7a4a", { roughness: 0.7 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), leaf);
      l.scale.set(0.55, 1.9, 0.25); l.position.set(-2.2 + Math.cos(a) * 0.12, 0.62 + (i % 3) * 0.13, -1.1 + Math.sin(a) * 0.12); l.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5); l.castShadow = true; g.add(l);
    }

    // Tableaux (mur du lit) et lumière de plafond
    [[1.25, 1.65, 0], [1.9, 1.55, 1]].forEach(([z, y, s], i) => {
      const art = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.64), new THREE.MeshStandardMaterial({ map: artTexture(i + s) })); art.position.set(R.x1 - 0.02, y, z); art.rotation.y = -Math.PI / 2; g.add(art);
      g.add(box(0.03, 0.7, 0.52, dark, R.x1 - 0.015, y, z));
    });
    this.ceilLamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshStandardMaterial({ color: "#fff4e0", emissive: "#ffe2b0", emissiveIntensity: 0.3 })); this.ceilLamp.position.set(0, R.h - 0.15, 0.4); g.add(this.ceilLamp);

    // Tabouret (apparaît quand la personne est assise)
    this.seat = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 32), std("#7c5a3a", { roughness: 0.5 })); top.position.y = 0;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1, 12), dark);
    this.seat.add(top, leg); this.seatTop = top; this.seatLeg = leg;
    top.castShadow = true; leg.castShadow = true; top.receiveShadow = true;
    this.seat.visible = false; g.add(this.seat);

    // Lumières
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xaa9980, 1); g.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.target.position.set(0, 0.9, 0.8); g.add(this.sun.target);
    this.sun.castShadow = true;
    const s = this.sun.shadow; s.mapSize.set(this.quality === "high" ? 2048 : 1024, this.quality === "high" ? 2048 : 1024);
    Object.assign(s.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 0.5, far: 16 }); s.bias = -0.0004; s.normalBias = 0.03;
    g.add(this.sun);
    this.lamp = new THREE.PointLight(0xffc27a, 0, 0, 2); this.lamp.position.set(2.43, 0.95, 0.45); g.add(this.lamp);
    this.ceil = new THREE.PointLight(0xffe6c0, 0, 0, 2); this.ceil.position.set(0, R.h - 0.35, 0.4); g.add(this.ceil);

    this.setAmbiance("day");
  }

  setAmbiance(name) {
    const A = AMBIANCES[name] || AMBIANCES.day;
    this.ambiance = name in AMBIANCES ? name : "day";
    this.hemi.color.set(A.hemi[0]); this.hemi.groundColor.set(A.hemi[1]); this.hemi.intensity = A.hemi[2];
    this.sun.color.set(A.sun[0]); this.sun.intensity = A.sun[1]; this.sun.position.set(...A.sun[2]);
    this.lamp.intensity = A.lamp; this.ceil.intensity = A.ceil;
    this.lampShade.material.emissiveIntensity = A.lamp ? 1.6 : 0; this.ceilLamp.material.emissiveIntensity = A.ceil ? 2 : 0.15;
    this.skyMat.map = this.skies[this.ambiance]; this.skyMat.needsUpdate = true;
    this.params = A;
  }

  // Tabouret à la hauteur demandée (null = rangé).
  setSeat(topY) {
    this.seat.visible = topY != null;
    if (topY == null) return;
    this.seat.position.set(0, 0, -0.07);
    this.seatTop.position.y = topY - 0.025;
    this.seatLeg.scale.y = topY - 0.05; this.seatLeg.position.y = (topY - 0.05) / 2;
  }

  dispose() {
    this.group.traverse((o) => { if (o.isMesh) { o.geometry?.dispose(); [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); } });
    this.mirror?.dispose?.();
    Object.values(this.skies).forEach((t) => t.dispose());
  }
}
