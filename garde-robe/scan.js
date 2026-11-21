// Scan d'un vêtement : détourage du fond, couleurs dominantes, nom de couleur.
// Travaille sur des pixels RGBA bruts (Uint8ClampedArray) : aucune dépendance au DOM, donc testable.
// Principe : on estime la couleur du fond d'après les bords de la photo, on garde ce qui s'en distingue,
// on ignore les ombres douces, on remplit les trous et on conserve l'objet principal.

import { rgbToHsl, hexToRgb } from "./engine.js";

export const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/* ---------- Nom de couleur (français) ---------- */

export function colorName(hex) {
  const { h, s, l } = rgbToHsl(...hexToRgb(hex));
  if (l < 0.1) return "Noir";
  if (l > 0.93 && s < 0.25) return "Blanc";
  if (s < 0.1) return l < 0.28 ? "Anthracite" : l < 0.62 ? "Gris" : "Gris clair";
  if (s < 0.2 && l < 0.2) return "Noir";
  if (h < 12 || h >= 345) return l < 0.3 ? "Bordeaux" : l > 0.72 ? "Rose" : "Rouge";
  if (h < 40) {
    if (l < 0.34) return "Marron";
    if (s < 0.5) return l > 0.75 ? "Crème" : l > 0.6 ? "Beige" : "Camel";
    return l > 0.75 ? "Pêche" : l < 0.45 ? "Marron" : "Orange";
  }
  if (h < 65) return l < 0.45 ? (s < 0.5 ? "Kaki" : "Moutarde") : s < 0.4 ? (l > 0.78 ? "Crème" : "Beige") : l > 0.8 ? "Jaune pâle" : "Jaune";
  if (h < 160) return l < 0.28 ? "Vert foncé" : h < 100 && s < 0.5 ? "Kaki" : l > 0.72 ? "Vert clair" : "Vert";
  if (h < 200) return l < 0.3 ? "Vert canard" : "Turquoise";
  if (h < 255) {
    if (l < 0.28) return "Bleu marine";
    if (l > 0.75) return "Bleu ciel";
    if (h < 230 && s < 0.6) return "Bleu denim";
    return "Bleu";
  }
  if (h < 290) return l > 0.72 ? "Lavande" : l < 0.28 ? "Aubergine" : "Violet";
  return l > 0.75 ? "Rose" : l < 0.3 ? "Prune" : s > 0.6 ? "Fuchsia" : "Rose";
}

/* ---------- Estimation du fond ---------- */

export function estimateBackground(rgba, w, h) {
  const frame = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  const bins = new Map();
  const visit = (x, y) => {
    const i = (y * w + x) * 4;
    const key = ((rgba[i] >> 4) << 8) | ((rgba[i + 1] >> 4) << 4) | (rgba[i + 2] >> 4);
    const b = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += rgba[i]; b.g += rgba[i + 1]; b.b += rgba[i + 2];
    bins.set(key, b);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < frame || y < frame || x >= w - frame || y >= h - frame) visit(x, y);
  let best = null;
  for (const b of bins.values()) if (!best || b.n > best.n) best = b;
  return [best.r / best.n, best.g / best.n, best.b / best.n];
}

/* ---------- Détourage ---------- */

// tolerance : 10 (très strict) à 120 (très souple). Retourne { mask, bg, bbox, coverage, confidence }.
export function segmentGarment(rgba, w, h, { tolerance = 40, bg = null } = {}) {
  const bgc = bg || estimateBackground(rgba, w, h);
  const bgSum = bgc[0] + bgc[1] + bgc[2] + 1;
  const bgChroma = bgc.map((v) => v / bgSum);
  const bgLum = 0.299 * bgc[0] + 0.587 * bgc[1] + 0.114 * bgc[2];

  const raw = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    if (rgba[i + 3] < 20) continue;
    const d = Math.hypot(r - bgc[0], g - bgc[1], b - bgc[2]);
    if (d <= tolerance) continue;
    // Ombre douce : même teinte que le fond, simplement plus sombre.
    const sum = r + g + b + 1;
    const chroma = Math.hypot(r / sum - bgChroma[0], g / sum - bgChroma[1], b / sum - bgChroma[2]);
    const lumRatio = (0.299 * r + 0.587 * g + 0.114 * b) / (bgLum + 1);
    if (d < tolerance * 2.4 && chroma < 0.035 && lumRatio > 0.45 && lumRatio <= 1.02) continue;
    raw[p] = 1;
  }

  // Le fond = ce qui touche le bord sans faire partie de l'objet. Le reste (trous) fait partie de l'objet.
  const outside = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => { const p = y * w + x; if (!raw[p] && !outside[p]) { outside[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  let mask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) mask[p] = outside[p] ? 0 : 1;

  // Lissage (vote majoritaire 3×3), deux passes.
  for (let pass = 0; pass < 2; pass++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) c += mask[yy * w + xx];
        }
        next[y * w + x] = c >= 5 ? 1 : 0;
      }
    mask = next;
  }

  // On garde l'objet principal et les morceaux significatifs (≥ 8 % du plus grand).
  const label = new Int32Array(w * h);
  const sizes = [0];
  let n = 0;
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!mask[p0] || label[p0]) continue;
    n++; sizes[n] = 0; label[p0] = n;
    const st = [p0];
    while (st.length) {
      const p = st.pop(); sizes[n]++;
      const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1])
        if (q >= 0 && mask[q] && !label[q]) { label[q] = n; st.push(q); }
    }
  }
  const biggest = Math.max(0, ...sizes);
  const keep = sizes.map((s) => s >= biggest * 0.08 && s > 0);
  let x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0;
  for (let p = 0; p < w * h; p++) {
    if (mask[p] && !keep[label[p]]) mask[p] = 0;
    if (mask[p]) {
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      area++;
    }
  }
  const coverage = area / (w * h);
  const touches = x0 <= 1 || y0 <= 1 || x1 >= w - 2 || y1 >= h - 2;
  const confidence = coverage < 0.03 || coverage > 0.92 ? "low" : touches || coverage > 0.8 ? "medium" : "high";
  return { mask, bg: bgc, bbox: area ? { x0, y0, x1, y1 } : null, coverage, confidence };
}

// Découpe l'objet : renvoie une image RGBA recadrée, fond transparent, bord légèrement adouci.
export function cutOut(rgba, w, h, mask, bbox, pad = 6) {
  if (!bbox) return null;
  const x0 = Math.max(0, bbox.x0 - pad), y0 = Math.max(0, bbox.y0 - pad);
  const x1 = Math.min(w - 1, bbox.x1 + pad), y1 = Math.min(h - 1, bbox.y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const sx = x + x0, sy = y + y0, sp = sy * w + sx, op = (y * cw + x) * 4;
      let a = mask[sp] ? 255 : 0;
      if (a) {
        // Adoucit le contour : alpha réduit si un voisin est hors masque.
        let outside = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = sx + dx, yy = sy + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h || !mask[yy * w + xx]) outside++;
        }
        if (outside) a = 255 - outside * 45;
      }
      out[op] = rgba[sp * 4]; out[op + 1] = rgba[sp * 4 + 1]; out[op + 2] = rgba[sp * 4 + 2]; out[op + 3] = a;
    }
  return { data: out, w: cw, h: ch };
}

/* ---------- Couleurs dominantes ---------- */

export function dominantColors(rgba, w, h, mask = null, k = 3) {
  const pts = [];
  const total = w * h;
  const step = Math.max(1, Math.floor(total / 5000));
  for (let p = 0; p < total; p += step) {
    if (mask && !mask[p]) continue;
    const i = p * 4;
    if (rgba[i + 3] < 128) continue;
    pts.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }
  if (!pts.length) return [];
  // Initialisation « plus éloigné d'abord ».
  const cent = [pts[0].slice()];
  while (cent.length < Math.min(k, pts.length)) {
    let far = null, farD = -1;
    for (const p of pts) {
      const d = Math.min(...cent.map((c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])));
      if (d > farD) { farD = d; far = p; }
    }
    cent.push(far.slice());
  }
  let counts = [];
  for (let it = 0; it < 8; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < cent.length; c++) {
        const d = (p[0] - cent[c][0]) ** 2 + (p[1] - cent[c][1]) ** 2 + (p[2] - cent[c][2]) ** 2;
        if (d < bd) { bd = d; bi = c; }
      }
      sum[bi][0] += p[0]; sum[bi][1] += p[1]; sum[bi][2] += p[2]; sum[bi][3]++;
    }
    counts = sum.map((s) => s[3]);
    sum.forEach((s, c) => { if (s[3]) cent[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  let res = cent.map((c, i) => ({ rgb: c, share: counts[i] / pts.length })).filter((r) => r.share > 0.04).sort((a, b) => b.share - a.share);
  // Fusionne les teintes quasi identiques.
  const merged = [];
  for (const r of res) {
    const near = merged.find((m) => Math.hypot(m.rgb[0] - r.rgb[0], m.rgb[1] - r.rgb[1], m.rgb[2] - r.rgb[2]) < 40);
    if (near) near.share += r.share; else merged.push({ ...r });
  }
  return merged.map((m) => ({ hex: toHex(...m.rgb), share: Math.round(m.share * 100) / 100, name: colorName(toHex(...m.rgb)) }));
}

// Suggère « uni » ou « motif » d'après le nombre de couleurs significatives.
export function guessPattern(colors) {
  const strong = colors.filter((c) => c.share >= 0.2).length;
  return strong <= 1 ? "uni" : "motif";
}
