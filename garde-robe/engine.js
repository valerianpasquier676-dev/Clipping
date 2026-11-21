// Moteur de tenues : couleurs, météo, thèmes, variété, morphologie, planning de la semaine.
// Logique pure (sans DOM), déterministe pour une graine donnée.

import { CAT, THEMES, THEME, CORE_SLOTS, ACCESSORY_SLOTS, SLOT_LABEL } from "./data.js";

/* ---------- Utilitaires ---------- */

export function rng(seed = 1) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (x, pts) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
};

export const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoDate(d); };
export const daysBetween = (a, b) => Math.round((Date.UTC(...b.split("-").map((x, i) => (i === 1 ? x - 1 : +x))) - Date.UTC(...a.split("-").map((x, i) => (i === 1 ? x - 1 : +x)))) / 86400000);
export const seasonOf = (iso) => { const m = parseISO(iso).getMonth(); return m >= 2 && m <= 4 ? "printemps" : m >= 5 && m <= 7 ? "ete" : m >= 8 && m <= 10 ? "automne" : "hiver"; };
export const weekdayOf = (iso) => parseISO(iso).getDay(); // 0 = dimanche

/* ---------- Propriétés d'une pièce ---------- */

export const itemWarmth = (it) => (it ? it.warmth ?? CAT[it.category]?.warmth ?? 0 : 0);
export const itemFormality = (it) => it.formality ?? CAT[it.category]?.formality ?? 2;
export const isOpenShoe = (it) => !!(it && (it.open ?? CAT[it.category]?.open));
export const isWaterproof = (it) => !!(it && (it.waterproof ?? CAT[it.category]?.water));
export const isWindproof = (it) => !!(it && (it.windproof ?? CAT[it.category]?.wind));
export const slotOf = (it) => CAT[it.category]?.slot;
export const mainColor = (it) => (it?.colors && it.colors[0]) || "#808080";

/* ---------- Couleurs ---------- */

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  const n = parseInt(m ? m[1] : "808080", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// kind : neutral (noir, blanc, gris, marine), denim, earth (beige, marron, camel), muted, vivid.
export function colorInfo(hex) {
  const { h, s, l } = rgbToHsl(...hexToRgb(hex));
  let kind;
  if (l < 0.17 || l > 0.9 || s < 0.14) kind = "neutral";
  else if (h >= 200 && h <= 260 && l < 0.32) kind = "neutral"; // marine
  else if (h >= 195 && h <= 240 && s < 0.7 && l >= 0.25 && l <= 0.62) kind = "denim";
  else if (h >= 15 && h <= 50 && s < 0.55 && l >= 0.2 && l <= 0.88) kind = "earth";
  else kind = s >= 0.55 ? "vivid" : "muted";
  return { h, s, l, kind };
}

function pairScore(ca, cb) {
  const A = colorInfo(ca), B = colorInfo(cb);
  const soft = (k) => k === "neutral" || k === "denim";
  if (soft(A.kind) && soft(B.kind)) return 1;
  if (soft(A.kind) || soft(B.kind)) return 1.2;
  if (A.kind === "earth" && B.kind === "earth") return 0.9;
  if (A.kind === "earth" || B.kind === "earth") return (A.kind === "earth" ? B : A).kind === "vivid" ? 0.2 : 0.8;
  const d = hueDist(A.h, B.h);
  const vivid = (A.kind === "vivid") + (B.kind === "vivid");
  if (d < 14) return 0.9;
  if (d < 50) return vivid === 2 ? 0.2 : 0.6;
  if (d > 150) return vivid === 2 ? 0.1 : 0.7;
  if (d > 100) return vivid === 2 ? -1.2 : 0.2;
  return vivid === 2 ? -2 : -0.6;
}
export const colorHarmony = pairScore;

const COLOR_WEIGHT = { top: 1, mid: 1, outer: 1, bottom: 1, dress: 1, shoes: 1, bag: 0.5, hat: 0.5, scarf: 0.5, belt: 0.3, gloves: 0.3 };

export function analyzeColors(outfit, palette = "any") {
  const pieces = Object.entries(outfit)
    .filter(([slot, it]) => it && COLOR_WEIGHT[slot])
    .map(([slot, it]) => ({ slot, w: COLOR_WEIGHT[slot], info: colorInfo(mainColor(it)), hex: mainColor(it) }));
  const notes = [];
  if (pieces.length < 2) return { score: 0, notes };
  let sum = 0, wsum = 0;
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++) {
      const w = pieces[i].w * pieces[j].w;
      sum += pairScore(pieces[i].hex, pieces[j].hex) * w;
      wsum += w;
    }
  let score = (sum / wsum) * 3;
  const chroma = pieces.filter((p) => p.info.kind === "vivid" || p.info.kind === "muted");
  const hueBuckets = new Set(chroma.map((p) => Math.round(p.info.h / 40) % 9));
  if (hueBuckets.size > 2) { score -= 2 * (hueBuckets.size - 2); notes.push({ ok: false, text: "Beaucoup de teintes différentes : la tenue peut paraître chargée." }); }
  const vivid = pieces.filter((p) => p.info.kind === "vivid").length;
  if (vivid > 2) score -= 2.5 * (vivid - 2);
  const softShare = pieces.filter((p) => ["neutral", "denim", "earth"].includes(p.info.kind)).length / pieces.length;

  if (palette === "mono") {
    const ref = chroma[0];
    const mono = chroma.every((p) => hueDist(p.info.h, ref.info.h) < 30);
    if (mono) { score += 3; notes.push({ ok: true, text: "Palette monochrome maîtrisée." }); } else score -= 2 * (hueBuckets.size - 1);
  } else if (palette === "neutral") {
    if (softShare >= 0.75) { score += 2; notes.push({ ok: true, text: "Base de neutres : facile à porter et à accessoiriser." }); } else score -= (1 - softShare) * 3;
  } else if (palette === "earth") {
    const earthy = pieces.filter((p) => ["neutral", "earth", "denim"].includes(p.info.kind) || (p.info.h >= 60 && p.info.h <= 150)).length / pieces.length;
    if (earthy >= 0.7) { score += 2; notes.push({ ok: true, text: "Tons terre et naturels cohérents." }); } else score -= (1 - earthy) * 3;
  } else if (palette === "pop") {
    if (vivid === 1 && softShare >= 0.6) { score += 4; notes.push({ ok: true, text: "Une seule couleur franche sur une base sobre : l'effet « pop » est réussi." }); }
    else if (vivid === 0) score -= 1.5;
    else if (vivid >= 2) score -= 2;
  } else if (softShare >= 0.7 && vivid <= 1) notes.push({ ok: true, text: "Couleurs harmonieuses." });
  return { score, notes };
}

/* ---------- Météo ---------- */

export const DEFAULT_WEATHER = { tempMax: 18, tempMin: 11, feelMax: 18, feelMin: 11, rainProb: 10, rainMm: 0, wind: 10, uv: 3, code: 3, unknown: true };

export function feelTemp(w, profile = {}) {
  const hi = w.feelMax ?? w.tempMax, lo = w.feelMin ?? w.tempMin;
  return 0.55 * hi + 0.45 * lo - 3 * (profile.coldSensitivity || 0);
}
export const targetWarmth = (t) => lerp(t, [[-5, 13.5], [0, 11.5], [5, 9], [10, 6.8], [15, 5.2], [20, 3.8], [25, 2.6], [30, 1.7], [35, 1.2], [40, 0.9]]);

export function warmthOf(o) {
  return itemWarmth(o.top) + itemWarmth(o.mid) + itemWarmth(o.outer) + itemWarmth(o.bottom) + itemWarmth(o.dress) +
    0.5 * itemWarmth(o.socks) + 0.4 * itemWarmth(o.shoes) + 0.8 * itemWarmth(o.scarf) + 0.5 * itemWarmth(o.hat) + 0.5 * itemWarmth(o.gloves);
}
const isSnow = (w) => [71, 73, 75, 77, 85, 86].includes(w.code);
export const isSunny = (w) => (w.uv ?? 0) >= 5 || ([0, 1].includes(w.code) && (w.tempMax ?? 0) >= 20);
const isRainy = (w) => (w.rainProb ?? 0) >= 45 || (w.rainMm ?? 0) >= 1.5 || isSnow(w);

function weatherScore(o, w, t) {
  let s = 0;
  const notes = [];
  const W = warmthOf(o), T = targetWarmth(t);
  const diff = W - T;
  s -= diff < 0 ? -diff * 1.8 : diff * (t >= 24 ? 2.4 : 1.1);
  if (Math.abs(diff) <= 1.3) notes.push({ ok: true, text: `Bien adaptée à ${Math.round(t)} °C ressentis.` });
  else if (diff < 0) notes.push({ ok: false, text: "Un peu légère pour la météo : ajoute une couche si tu peux." });
  else notes.push({ ok: false, text: "Un peu chaude pour la météo." });

  const shoes = o.shoes;
  if (isRainy(w)) {
    if (o.outer && isWaterproof(o.outer)) { s += 2.5; notes.push({ ok: true, text: "Veste imperméable pour la pluie prévue." }); }
    else if (!o.outer) s -= 1;
    if (shoes) {
      if (isOpenShoe(shoes)) s -= 8;
      else if (isWaterproof(shoes)) { s += 2; notes.push({ ok: true, text: "Chaussures qui supportent l'eau." }); }
      else if (/daim|suede|toile|canvas|tissu/i.test(shoes.material || "")) s -= 3;
    }
    if (o.bottom && ["short", "jupe"].includes(o.bottom.category) && t < 20) s -= 1.5;
    if (isSnow(w) && shoes && isWaterproof(shoes)) s += 2;
  } else if (shoes && isWaterproof(shoes) && shoes.category === "bottes" && t > 22) s -= 3;

  if (t < 14 && isOpenShoe(shoes)) s -= t < 10 ? 9 : 5;
  if (o.bottom && o.bottom.category === "short" && t < 14) s -= t < 10 ? 6 : 2;
  if (t >= 24 && !isRainy(w) && isOpenShoe(shoes)) s += 1.5;
  if (t > 26 && shoes && ["bottes", "bottines"].includes(shoes.category)) s -= 3;

  const hiFeel = w.feelMax ?? w.tempMax;
  if (o.mid && itemWarmth(o.mid) >= 2.5 && hiFeel >= 23) s -= 3;
  if (o.bottom && ["short", "bermuda"].includes(o.bottom.category) && ((o.mid && itemWarmth(o.mid) >= 2.5) || (o.outer && itemWarmth(o.outer) >= 2.5))) s -= 3;
  if (hiFeel >= 28 && o.bottom && !["short", "bermuda", "jupe"].includes(o.bottom.category) && !o.dress) s -= 1.5;

  if ((w.wind ?? 0) >= 30) {
    if (o.outer && isWindproof(o.outer)) { s += 1.5; notes.push({ ok: true, text: "Veste coupe-vent : bien vu avec ce vent." }); }
    if (o.scarf && t < 16) s += 0.8;
    if ((w.wind ?? 0) >= 45 && (o.dress || o.bottom?.category === "jupe")) s -= 1;
  }
  if (isSunny(w)) {
    if (o.glasses) s += 1.5;
    if (o.hat && !["bonnet"].includes(o.hat.category)) s += 1;
  }
  return { score: s, notes, W, T };
}

/* ---------- Thème, cohésion, usage, saison, morphologie ---------- */

function themeScore(o, theme) {
  let s = 0;
  const [lo, hi] = theme.formality;
  for (const slot of CORE_SLOTS) {
    const it = o[slot];
    if (!it) continue;
    const f = itemFormality(it);
    const d = f < lo ? lo - f : f > hi ? f - hi : 0;
    s -= (slot === "mid" || slot === "outer" ? 1.2 : 2) * Math.pow(d, 1.5);
    s += theme.prefer.cats[it.category] || 0;
    const tagHits = (it.tags || []).filter((x) => theme.prefer.tags.includes(x)).length;
    s += Math.min(1.2, tagHits * 0.6);
    if (theme.prefer.fit && it.fit === theme.prefer.fit) s += 0.5;
  }
  for (const slot of ACCESSORY_SLOTS) {
    const it = o[slot];
    if (it) s += (theme.prefer.cats[it.category] || 0) * 0.6;
  }
  if (o.bag) {
    if (theme.bag === "backpack") s += o.bag.category === "sacados" ? 1.2 : 0;
    else if (theme.bag === "bag" && o.bag.category === "sacados") s -= 2;
  }
  return s;
}

function cohesionScore(o) {
  const f = ["top", "bottom", "shoes", "dress"].filter((k) => o[k]).map((k) => itemFormality(o[k]));
  if (f.length < 2) return 0;
  const spread = Math.max(...f) - Math.min(...f);
  let s = spread > 1.7 ? -(spread - 1.7) * 1.8 : 0;
  // Une veste habillée (blazer, manteau) ne va pas avec une tenue très sport, et inversement.
  const base = f.reduce((a, b) => a + b, 0) / f.length;
  for (const k of ["outer", "mid"]) {
    if (!o[k]) continue;
    const d = Math.abs(itemFormality(o[k]) - base);
    if (d > 2) s -= (d - 2) * 1.4;
  }
  return s;
}

function patternScore(o) {
  const loud = ["top", "mid", "outer", "bottom", "dress"].filter((k) => o[k] && ["raye", "carreaux", "motif"].includes(o[k].pattern));
  return loud.length >= 2 ? -2.5 * (loud.length - 1) : 0;
}

// Une veste ou des chaussures se portent plusieurs jours de suite, pas un haut.
const REPEAT_COST = { top: 1, dress: 1, mid: 0.65, bottom: 0.65, outer: 0.3, shoes: 0.3 };

function usageScore(o, ctx) {
  let s = 0;
  const notes = [];
  const core = new Set(CORE_SLOTS);
  for (const [slot, it] of Object.entries(o)) {
    if (!it || slot === "underwear") continue;
    const isCore = core.has(slot);
    const k = REPEAT_COST[slot] ?? 1;
    const n = ctx.used.get(it.id) || 0;
    s -= Math.min(n, 2) * (isCore ? 3.5 * k : 0.8);
    const since = it.lastWorn ? daysBetween(it.lastWorn, ctx.date) : Infinity;
    if (isCore) {
      if (since <= 2) s -= 2.5 * k; else if (since <= 5) s -= 1 * k;
      if (since === Infinity && !(it.wornCount > 0)) { s += 0.6; }
      else if (since !== Infinity) s += Math.min(1.5, since / 10) * 0.4;
    }
    if (it.favorite) s += 0.7;
  }
  return { score: s, notes };
}

function seasonScore(o, date) {
  const season = seasonOf(date);
  let s = 0;
  for (const slot of CORE_SLOTS) {
    const it = o[slot];
    if (!it || !it.seasons || !it.seasons.length) continue;
    s += it.seasons.includes(season) ? 0.4 : -1;
  }
  return s;
}

function morphScore(o, profile) {
  const shape = profile.shape;
  if (!shape) return { score: 0, notes: [] };
  let s = 0;
  const notes = [];
  const L = (it) => colorInfo(mainColor(it)).l;
  const top = o.top, bottom = o.bottom;
  const good = (txt) => notes.push({ ok: true, text: txt });
  if (shape === "poire") {
    if (top && bottom && L(top) > L(bottom) + 0.1) { s += 0.8; good("Haut plus clair que le bas : équilibre bien ta silhouette."); }
    if (o.outer && ["veste", "blouson"].includes(o.outer.category)) s += 0.5;
  } else if (shape === "triangle_inverse") {
    if (bottom && ["oversize", "regular"].includes(bottom.fit)) s += 0.5;
    if (top && L(top) < 0.45) { s += 0.4; good("Haut sobre et bas plus présent : équilibre les épaules."); }
  } else if (shape === "rond") {
    if (top && bottom && Math.abs(L(top) - L(bottom)) < 0.25) { s += 0.6; good("Haut et bas dans des tons proches : allonge la silhouette."); }
    if (o.outer) s += 0.5;
  } else if (shape === "rectangle") {
    if (o.mid || o.outer) { s += 0.6; good("Superposition : crée du relief sur une silhouette droite."); }
    if (o.belt) s += 0.4;
  } else if (shape === "sablier") {
    if (o.dress || o.belt || bottom?.category === "jupe") { s += 0.5; good("Taille marquée : met ta silhouette en valeur."); }
    if (top?.fit === "oversize" && bottom?.fit === "oversize") s -= 0.6;
  } else if (shape === "trapeze") {
    if (top && ["slim", "regular"].includes(top.fit)) { s += 0.4; good("Haut bien coupé : montre tes épaules."); }
    if (top?.fit === "oversize") s -= 0.2;
  }
  if (profile.heightClass === "petit" && top && bottom && Math.abs(L(top) - L(bottom)) < 0.25) s += 0.4;
  return { score: s, notes };
}

/* ---------- Tirage pondéré ---------- */

function weightedPick(list, weightFn, rand) {
  if (!list.length) return null;
  const ws = list.map((x) => Math.max(0.02, weightFn(x)));
  let r = rand() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

const available = (it) => !it.dirty && !it.retired;
const bySlot = (items, slot) => items.filter((it) => available(it) && slotOf(it) === slot);

function candidateWeight(ctx, slot) {
  const [lo, hi] = ctx.theme.formality;
  const reuse = { outer: 0.7, shoes: 0.6, bottom: 0.5, mid: 0.4 }[slot] ?? 0.3;
  return (it) => {
    const f = itemFormality(it);
    const d = f < lo ? lo - f : f > hi ? f - hi : 0;
    let w = Math.exp(-d * 0.8) * (1 + (it.favorite ? 0.4 : 0));
    if (ctx.used.has(it.id)) w *= reuse;
    if (it.lastWorn && daysBetween(it.lastWorn, ctx.date) <= 2) w *= reuse + 0.1;
    w *= 1 + (ctx.theme.prefer.cats[it.category] || 0) * 0.4;
    if ((it.tags || []).some((x) => ctx.theme.prefer.tags.includes(x))) w *= 1.4;
    return w;
  };
}

// Filtres « durs » selon la météo (on les relâche s'il ne reste rien).
function weatherFilter(slot, ctx) {
  const { w, t } = ctx;
  const rainy = isRainy(w);
  return (it) => {
    if (slot === "shoes") {
      if (isOpenShoe(it) && (t < 14 || rainy)) return false;
      if (["bottes", "bottines"].includes(it.category) && t > 26) return false;
      if (it.category === "ville" && isSnow(w)) return false;
    }
    if (slot === "outer" && itemWarmth(it) >= 4.5 && t > 17) return false;
    if (slot === "mid" && itemWarmth(it) >= 2.5 && ((w.feelMax ?? w.tempMax) >= 23 || t > 24)) return false;
    if (slot === "bottom" && it.category === "short" && t < 12) return false;
    return true;
  };
}
function filtered(list, pred) { const f = list.filter(pred); return f.length ? f : list; }

function sampleCore(ctx, rand) {
  const { items, w, t, forced } = ctx;
  const pick = (slot, pred = () => true) => {
    if (slot in forced) return forced[slot] ? items.find((i) => i.id === forced[slot]) || null : null;
    const pool = filtered(ctx.pool[slot], (it) => weatherFilter(slot, ctx)(it) && pred(it));
    return weightedPick(pool, candidateWeight(ctx, slot), rand);
  };
  const o = {};
  const hasPair = ctx.pool.top.length && ctx.pool.bottom.length;
  const dressForced = "dress" in forced && forced.dress;
  const useDress = dressForced || (ctx.pool.dress.length && (!hasPair || rand() < 0.3) && !("top" in forced && forced.top) && !("bottom" in forced && forced.bottom));
  if (useDress) {
    o.dress = pick("dress");
  } else {
    o.top = pick("top");
    o.bottom = pick("bottom");
  }
  o.shoes = pick("shoes");

  const target = targetWarmth(t);
  const rainy = isRainy(w);
  let W = warmthOf(o);
  if ("mid" in forced) o.mid = pick("mid");
  else if (target - W > 1.2 || (target - W > 0.2 && rand() < 0.3)) o.mid = pick("mid", (it) => itemWarmth(it) <= target - W + 2.2);
  W = warmthOf(o);
  if ("outer" in forced) o.outer = pick("outer");
  else if (target - W > 1 || (rainy && ctx.pool.outer.some(isWaterproof) && rand() < 0.85) || (t < 13 && rand() < 0.9)) {
    const need = Math.max(0, target - W);
    const wet = rainy ? ctx.pool.outer.filter((it) => isWaterproof(it) && itemWarmth(it) >= need - 2.5) : [];
    const fit = (it) => Math.exp(-Math.abs(itemWarmth(it) - need) / 3);
    if (wet.length && rand() < 0.9) o.outer = weightedPick(wet, (it) => candidateWeight(ctx, "outer")(it) * fit(it), rand);
    else {
      const pool = filtered(ctx.pool.outer, (it) => weatherFilter("outer", ctx)(it) && itemWarmth(it) <= Math.max(1.5, need + 2.5));
      o.outer = weightedPick(pool, (it) => candidateWeight(ctx, "outer")(it) * fit(it), rand);
    }
  }
  for (const k of Object.keys(o)) if (!o[k]) delete o[k];
  return o;
}

/* ---------- Accessoires ---------- */

function accessoryProbability(slot, ctx, core) {
  const { theme, w, t, profile, context } = ctx;
  const sunny = isSunny(w);
  // Si le cœur de la tenue est déjà assez chaud, on n'empile pas bonnet, écharpe et gants.
  const warmEnough = warmthOf(core) >= targetWarmth(t) + 0.5 && t > 0 ? 0.25 : 1;
  switch (slot) {
    case "glasses": return profile.wearsGlasses ? 1 : sunny ? 0.85 : 0.08;
    case "hat": {
      let p = theme.hat;
      if (t < 5) p = Math.max(p, 0.75);
      else if (t < 10) p = Math.max(p, 0.35);
      if (sunny && t > 22) p += 0.4;
      if ((w.wind ?? 0) >= 40) p -= 0.2;
      return clamp(p, 0, 0.9) * (core.hat || p < 0.5 ? 1 : (t < 14 ? warmEnough : 1));
    }
    case "scarf": return t < 14 ? clamp(((14 - t) / 9) * 0.9 + ((w.wind ?? 0) >= 30 ? 0.2 : 0), 0, 0.95) * warmEnough : 0;
    case "gloves": return (t < 3 ? 0.85 : t < 7 ? 0.3 : 0) * warmEnough;
    case "belt": {
      const b = core.bottom;
      if (!b || core.dress) return 0;
      if (["jogging"].includes(b.category)) return 0;
      if (b.category === "short") return 0.3;
      return theme.key === "business" ? 1 : 0.7;
    }
    case "watch": return theme.key === "business" ? 1 : theme.key === "sport" ? 0.6 : 0.85;
    case "necklace": return theme.jewelry * 0.8;
    case "bracelet": return theme.jewelry * 0.9;
    case "ring": return theme.jewelry * 0.7;
    case "earrings": return profile.earrings ? clamp(theme.jewelry + 0.3, 0, 1) : 0;
    case "bag": return context === "soiree" ? 0.6 : context === "sport" ? 0.9 : 0.85;
    default: return 0;
  }
}

function accessoryAllowed(slot, it, ctx, core) {
  const { t, w, profile } = ctx;
  if (slot === "glasses") {
    if (profile.wearsGlasses) return !it.sun || it.prescription;
    return (!!it.sun || it.sun === undefined) && !isRainy(w) && (isSunny(w) || t >= 18);
  }
  if (slot === "hat") {
    if (it.category === "bonnet" && t > 14) return false;
    if (["casquette", "chapeau"].includes(it.category) && t < 3) return false;
    if (it.category === "chapeau" && (w.wind ?? 0) >= 45) return false;
  }
  if (slot === "bag" && ctx.theme.key === "business" && it.category === "sacados") return false;
  return true;
}

function dominantMetal(o) {
  for (const slot of ["watch", "bracelet", "necklace", "ring", "earrings", "belt"]) {
    const m = o[slot]?.metal;
    if (m === "or" || m === "argent") return m;
  }
  return null;
}

function scoreAccessory(slot, it, o, ctx, rand) {
  let s = rand() * 0.6;
  const n = ctx.used.get(it.id) || 0;
  s -= n * 0.8;
  if (it.favorite) s += 0.5;
  s += (ctx.theme.prefer.cats[it.category] || 0) * 0.6;
  if ((it.tags || []).some((x) => ctx.theme.prefer.tags.includes(x))) s += 0.4;
  // cohérence de formalité avec la tenue
  const core = ["top", "bottom", "shoes", "dress"].filter((k) => o[k]).map((k) => itemFormality(o[k]));
  if (core.length) {
    const avg = core.reduce((a, b) => a + b, 0) / core.length;
    s -= Math.max(0, Math.abs(itemFormality(it) - avg) - 1.3) * 0.8;
  }
  // métaux
  if (["watch", "bracelet", "necklace", "ring", "earrings"].includes(slot) && (it.metal === "or" || it.metal === "argent")) {
    const dom = dominantMetal(o);
    if (dom) s += it.metal === dom ? 1.2 : -1.8;
    else if (ctx.profile.metal && ctx.profile.metal === it.metal) s += 0.6;
  }
  // couleur vs tenue
  if (["hat", "scarf", "bag", "gloves"].includes(slot)) {
    const refs = ["top", "bottom", "outer", "shoes"].filter((k) => o[k]);
    if (refs.length) s += (refs.reduce((a, k) => a + pairScore(mainColor(it), mainColor(o[k])), 0) / refs.length) * 1.5;
  }
  if (slot === "belt" && o.shoes) {
    const a = colorInfo(mainColor(it)), b = colorInfo(mainColor(o.shoes));
    const close = hueDist(a.h, b.h) < 30 && Math.abs(a.l - b.l) < 0.2;
    const bothNeutral = a.kind === "neutral" && b.kind === "neutral" && Math.abs(a.l - b.l) < 0.2;
    s += close || bothNeutral ? 1.5 : ctx.theme.formality[0] >= 3 ? -1.5 : -0.3;
  }
  if (slot === "glasses" && isSunny(ctx.w) && it.sun) s += 1;
  return s;
}

function addAccessories(core, ctx, rand) {
  const o = { ...core };
  const order = ["glasses", "hat", "scarf", "gloves", "belt", "watch", "necklace", "bracelet", "ring", "earrings", "bag"];
  let jewels = 0;
  for (const slot of order) {
    if (slot in ctx.forced) { o[slot] = ctx.forced[slot] ? ctx.items.find((i) => i.id === ctx.forced[slot]) : null; if (!o[slot]) delete o[slot]; continue; }
    const pool = ctx.pool[slot].filter((it) => accessoryAllowed(slot, it, ctx, o));
    if (!pool.length) continue;
    if (["necklace", "bracelet", "ring", "earrings"].includes(slot) && jewels >= 3) continue;
    if (rand() >= accessoryProbability(slot, ctx, o)) continue;
    let best = null, bestS = -Infinity;
    for (const it of pool) {
      const s = scoreAccessory(slot, it, o, ctx, rand);
      if (s > bestS) { bestS = s; best = it; }
    }
    if (best) { o[slot] = best; if (["necklace", "bracelet", "ring", "earrings"].includes(slot)) jewels++; }
  }
  return o;
}

/* ---------- Chaussettes & sous-vêtements ---------- */

function addLinen(o, ctx) {
  const out = { ...o };
  const leastUsed = (list, score = () => 0) =>
    [...list].sort((a, b) => (ctx.used.get(a.id) || 0) - (ctx.used.get(b.id) || 0) || score(b) - score(a) || (a.lastWorn || "").localeCompare(b.lastWorn || ""))[0];
  const socks = bySlot(ctx.items, "socks");
  if (socks.length && !isOpenShoe(o.shoes)) {
    out.socks = leastUsed(socks, (s) => (o.bottom ? pairScore(mainColor(s), mainColor(o.bottom)) : 0) + (o.shoes ? pairScore(mainColor(s), mainColor(o.shoes)) : 0));
  }
  const under = bySlot(ctx.items, "underwear");
  if (under.length) out.underwear = leastUsed(under);
  return out;
}

/* ---------- Conseils météo ---------- */

export function weatherTips(w, t, o, profile = {}) {
  const tips = [];
  const spread = (w.feelMax ?? w.tempMax) - (w.feelMin ?? w.tempMin);
  if (spread >= 9) tips.push(`Écart de ${Math.round(spread)} °C entre le matin et l'après-midi : privilégie des couches faciles à retirer.`);
  if (isRainy(w) && !(o.outer && isWaterproof(o.outer))) tips.push("Pluie annoncée : prends un parapluie ou une veste imperméable.");
  if (isSnow(w)) tips.push("Neige : chaussures imperméables et semelles accrocheuses.");
  if ((w.wind ?? 0) >= 35) tips.push(`Vent soutenu (${Math.round(w.wind)} km/h) : évite les chapeaux légers et ferme bien ta veste.`);
  if ((w.uv ?? 0) >= 6) tips.push(`UV élevé (${Math.round(w.uv)}) : crème solaire sur le visage et lunettes de soleil.`);
  if (t >= 30) tips.push("Forte chaleur : tissus respirants (coton, lin), couleurs claires, bois beaucoup d'eau.");
  if (t <= 3) tips.push("Grand froid : superpose trois couches fines plutôt qu'une seule épaisse, protège mains, cou et tête.");
  return tips;
}

/* ---------- Choix d'un jour ---------- */

function buildPool(items) {
  const pool = {};
  for (const slot of [...CORE_SLOTS, ...ACCESSORY_SLOTS, "socks", "underwear"]) pool[slot] = bySlot(items, slot);
  return pool;
}

function scoreOutfit(o, ctx) {
  const wx = weatherScore(o, ctx.w, ctx.t);
  const col = analyzeColors(o, ctx.theme.palette);
  const use = usageScore(o, ctx);
  const mo = morphScore(o, ctx.profile);
  const total =
    wx.score + themeScore(o, ctx.theme) + col.score + cohesionScore(o) + patternScore(o) + use.score + seasonScore(o, ctx.date) + mo.score;
  return { total, notes: [...wx.notes, ...col.notes, ...mo.notes], W: wx.W, T: wx.T };
}

export const signature = (o) => CORE_SLOTS.map((k) => o[k]?.id || "-").join("|");

export function generateDay(opts) {
  const { items, profile = {}, date, theme: themeKey = "casual", context = "loisirs", seed = 1 } = opts;
  const w = { ...DEFAULT_WEATHER, ...(opts.weather || {}) };
  const theme = THEME[themeKey] || THEMES[0];
  const t = feelTemp(w, profile);
  const ctx = {
    items, profile, date, theme, context, w, t,
    used: opts.used || new Map(),
    forced: opts.forced || {},
    pool: buildPool(items),
  };
  const rand = rng(seed * 7919 + date.replace(/-/g, "") * 1);
  const usedSigs = opts.usedSigs || new Set();
  const samples = opts.samples ?? 160;

  let best = null;
  for (let i = 0; i < samples; i++) {
    const core = sampleCore(ctx, rand);
    if (!Object.keys(core).length) break;
    const sc = scoreOutfit(core, ctx);
    const total = sc.total + rand() * 1.2 - (usedSigs.has(signature(core)) ? 50 : 0);
    if (!best || total > best.total) best = { core, total, sc };
    if (i > 0 && !ctx.pool.top.length && !ctx.pool.dress.length && !ctx.pool.bottom.length) break;
  }
  const core = best?.core || {};
  let outfit = addAccessories(core, ctx, rand);
  outfit = addLinen(outfit, ctx);
  const final = scoreOutfit(outfit, ctx);

  const missing = [];
  if (!outfit.dress && !outfit.top) missing.push("Ajoute un haut (t-shirt, chemise…) à ta garde-robe.");
  if (!outfit.dress && !outfit.bottom) missing.push("Ajoute un bas (jean, pantalon, short…) à ta garde-robe.");
  if (!outfit.shoes) missing.push("Ajoute au moins une paire de chaussures.");
  if (t < 12 && !outfit.outer) missing.push("Il te manque une veste ou un manteau pour ce temps.");

  return {
    date, theme: theme.key, context, weather: w, feel: t,
    outfit, sig: signature(outfit),
    score: Math.round(final.total * 10) / 10,
    warmth: { have: Math.round(final.W * 10) / 10, need: Math.round(final.T * 10) / 10 },
    reasons: dedupeNotes(final.notes).slice(0, 6),
    tips: weatherTips(w, t, outfit, profile),
    missing,
  };
}

// Ré-évalue une tenue (modifiée à la main) : score, explications, conseils météo.
export function evaluateDay(opts) {
  const { items, profile = {}, date, theme: themeKey = "casual", context = "loisirs", outfit } = opts;
  const w = { ...DEFAULT_WEATHER, ...(opts.weather || {}) };
  const theme = THEME[themeKey] || THEMES[0];
  const t = feelTemp(w, profile);
  const ctx = { items, profile, date, theme, context, w, t, used: new Map(), forced: {}, pool: buildPool(items) };
  const f = scoreOutfit(outfit, ctx);
  const missing = [];
  if (!outfit.dress && !outfit.top) missing.push("Ajoute un haut (t-shirt, chemise…) à ta garde-robe.");
  if (!outfit.dress && !outfit.bottom) missing.push("Ajoute un bas (jean, pantalon, short…) à ta garde-robe.");
  if (!outfit.shoes) missing.push("Ajoute au moins une paire de chaussures.");
  if (t < 12 && !outfit.outer) missing.push("Il te manque une veste ou un manteau pour ce temps.");
  return {
    score: Math.round(f.total * 10) / 10,
    warmth: { have: Math.round(f.W * 10) / 10, need: Math.round(f.T * 10) / 10 },
    reasons: dedupeNotes(f.notes).slice(0, 6), tips: weatherTips(w, t, outfit, profile), missing, feel: t, sig: signature(outfit),
  };
}

function dedupeNotes(notes) {
  const seen = new Set();
  return notes.filter((n) => (seen.has(n.text) ? false : seen.add(n.text)));
}

/* ---------- Choix des thèmes et planning de la semaine ---------- */

const WORK_THEMES = {
  formel: ["business", "smart"],
  smart: ["smart", "minimal", "casual", "pop", "vintage"],
  casual: ["casual", "streetwear", "smart", "minimal", "pop", "vintage"],
  etudiant: ["casual", "streetwear", "smart", "minimal", "pop"],
};

export function defaultContext(date, profile = {}) {
  const days = profile.workDays || [1, 2, 3, 4, 5];
  return days.includes(weekdayOf(date)) ? "travail" : "loisirs";
}

export function candidateThemes(context, t, profile = {}) {
  let list = THEMES.filter((th) => th.contexts.includes(context) && t >= th.temp[0] - 2 && t <= th.temp[1] + 2);
  if (context === "travail") {
    const allowed = WORK_THEMES[profile.workStyle || "smart"];
    list = list.filter((th) => allowed.includes(th.key));
  }
  if (!list.length) list = THEMES.filter((th) => th.key === "casual");
  return list;
}

export function planWeek(opts) {
  const { items, profile = {}, weather = [], startDate, days = 7, seed = 1, contexts = {}, themeLocks = {}, forced = {} } = opts;
  const out = [];
  const used = new Map();
  const usedSigs = new Set();
  const themeCount = new Map();
  let prevTheme = null;

  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const w = { ...DEFAULT_WEATHER, ...(weather[i] || {}) };
    const context = contexts[date] || defaultContext(date, profile);
    const t = feelTemp(w, profile);
    const base = { items, profile, date, weather: w, context, seed, used, usedSigs, forced: forced[date] || {} };

    let themeKey = themeLocks[date];
    if (!themeKey) {
      const rand = rng(seed * 31 + i * 101);
      let bestTheme = null, bestScore = -Infinity;
      for (const th of candidateThemes(context, t, profile)) {
        const probe = generateDay({ ...base, theme: th.key, samples: 40 });
        let s = probe.score + rand() * 2;
        s -= (themeCount.get(th.key) || 0) * 3.5;
        if (prevTheme === th.key) s -= 2;
        if (s > bestScore) { bestScore = s; bestTheme = th.key; }
      }
      themeKey = bestTheme || "casual";
    }
    const day = generateDay({ ...base, theme: themeKey });
    out.push(day);
    prevTheme = themeKey;
    themeCount.set(themeKey, (themeCount.get(themeKey) || 0) + 1);
    usedSigs.add(day.sig);
    for (const [slot, it] of Object.entries(day.outfit)) if (it) used.set(it.id, (used.get(it.id) || 0) + 1);
  }
  return { days: out, laundry: laundryReport(items, days), gaps: gapAnalysis(items, out.map((d) => d.weather), profile, out.map((d) => d.date)) };
}

// Régénère un seul jour en tenant compte des autres jours de la semaine déjà planifiés.
export function replanDay(opts) {
  const { plan, index, items, profile = {}, seed = 1, theme, forced = {} } = opts;
  const used = new Map();
  const usedSigs = new Set();
  plan.forEach((d, i) => {
    if (i === index) return;
    usedSigs.add(d.sig);
    for (const it of Object.values(d.outfit)) if (it) used.set(it.id, (used.get(it.id) || 0) + 1);
  });
  const d = plan[index];
  usedSigs.add(d.sig);
  for (const it of Object.values(d.outfit)) if (it) used.set(it.id, (used.get(it.id) || 0) + 1);
  return generateDay({ items, profile, date: d.date, weather: d.weather, context: d.context, theme: theme || d.theme, seed, used, usedSigs, forced });
}

/* ---------- Linge et manques ---------- */

export function laundryReport(items, days) {
  const clean = (slot) => bySlot(items, slot).length;
  const warnings = [];
  const u = clean("underwear"), s = clean("socks");
  if (items.some((i) => slotOf(i) === "underwear") && u < days) warnings.push(`Seulement ${u} sous-vêtement${u > 1 ? "s" : ""} propre${u > 1 ? "s" : ""} pour ${days} jours : lance une machine.`);
  if (items.some((i) => slotOf(i) === "socks") && s < days - 1) warnings.push(`Seulement ${s} paire${s > 1 ? "s" : ""} de chaussettes propre${s > 1 ? "s" : ""} pour ${days} jours.`);
  return warnings;
}

export function gapAnalysis(items, weatherDays, profile = {}, dates = []) {
  const gaps = [];
  const av = items.filter(available);
  const has = (pred) => av.some(pred);
  const label = (i) => (dates[i] ? new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(parseISO(dates[i])) : `jour ${i + 1}`);
  const where = (pred) => weatherDays.map((w, i) => (pred({ ...DEFAULT_WEATHER, ...w }) ? label(i) : null)).filter(Boolean);

  const rainy = where(isRainy);
  if (rainy.length && !has((i) => slotOf(i) === "outer" && isWaterproof(i)))
    gaps.push({ level: "warn", text: `Pluie prévue (${rainy.join(", ")}) et aucune veste imperméable : un K-way ou une parka serait utile.` });
  if (rainy.length && !has((i) => slotOf(i) === "shoes" && !isOpenShoe(i) && isWaterproof(i)))
    gaps.push({ level: "info", text: "Aucune chaussure vraiment imperméable : des bottes ou des baskets imper te serviraient les jours de pluie." });
  const cold = where((w) => feelTemp(w, profile) < 6);
  if (cold.length && !has((i) => ["echarpe", "bonnet", "gants"].includes(i.category)))
    gaps.push({ level: "info", text: `Il fait froid (${cold.join(", ")}) : écharpe, bonnet et gants compléteraient bien tes tenues.` });
  if (cold.length && !has((i) => slotOf(i) === "outer" && itemWarmth(i) >= 3.5))
    gaps.push({ level: "warn", text: "Aucun manteau chaud pour les jours de froid." });
  const sunny = where((w) => isSunny(w));
  if (sunny.length && !has((i) => i.category === "lunettes"))
    gaps.push({ level: "info", text: "Soleil prévu : des lunettes de soleil te manquent." });
  if (!has((i) => i.category === "ville") && (profile.workStyle === "formel"))
    gaps.push({ level: "warn", text: "Aucune chaussure de ville pour un dress code formel." });
  const tops = av.filter((i) => ["top", "dress"].includes(slotOf(i))).length;
  const bottoms = av.filter((i) => ["bottom", "dress"].includes(slotOf(i))).length;
  if (av.length && tops < 4) gaps.push({ level: "info", text: `Seulement ${tops} haut${tops > 1 ? "s" : ""} propre${tops > 1 ? "s" : ""} : les tenues vont se répéter.` });
  if (av.length && bottoms < 3) gaps.push({ level: "info", text: `Seulement ${bottoms} bas propre${bottoms > 1 ? "s" : ""} : ajoute-en pour varier.` });
  return gaps;
}

export { SLOT_LABEL };
