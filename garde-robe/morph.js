// Analyse morphologique, conseils accessoires et parfums. Logique pure, sans DOM.
// Les conseils sont des repères de style, pas des règles : l'analyse part de tes mesures, jamais d'une photo.

import { SHAPES, HEIGHT_TIPS, LEGS_TIPS, FACE_SHAPES, PALETTES, PERF_FAMILY, PERFUME_FAMILIES, PERFUME_CONCENTRATIONS, THEME } from "./data.js";
import { itemFormality, isSunny, feelTemp, seasonOf, isWaterproof } from "./engine.js";

/* ---------- Morphologie ---------- */

const RANGES = {
  height: [120, 230, "la taille"],
  chest: [60, 160, "le tour de poitrine"],
  waist: [50, 170, "le tour de taille"],
  hips: [60, 175, "le tour de hanches"],
  shoulders: [30, 65, "la largeur d'épaules"],
  inseam: [50, 115, "l'entrejambe"],
};

export function parseMeasure(v) {
  const n = Number(String(v ?? "").replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function analyzeBody(input) {
  const m = {};
  const errors = [];
  for (const [k, [lo, hi, label]] of Object.entries(RANGES)) {
    const v = parseMeasure(input[k]);
    if (v === null) continue;
    if (v < lo || v > hi) errors.push(`Vérifie ${label} (${v} cm semble hors limites).`);
    else m[k] = v;
  }
  const missing = ["chest", "waist", "hips"].filter((k) => !m[k]);
  if (missing.length || errors.length) return { ok: false, errors, missing };

  const avg = (m.chest + m.hips) / 2;
  const diff = (m.chest - m.hips) / avg; // > 0 : poitrine/épaules plus fortes que les hanches
  const waistRatio = m.waist / avg;

  let shape;
  if (waistRatio >= 0.95) shape = "rond";
  else if (Math.abs(diff) <= 0.08 && waistRatio <= 0.76) shape = "sablier";
  else if (diff < -0.05) shape = "poire";
  else if (diff > 0.05) shape = diff <= 0.1 ? "trapeze" : "triangle_inverse";
  else shape = "rectangle";

  const heightClass = !m.height ? null : m.height < 165 ? "petit" : m.height > 182 ? "grand" : "moyen";
  const legs = m.height && m.inseam ? (m.inseam / m.height < 0.44 ? "courtes" : m.inseam / m.height > 0.48 ? "longues" : "equilibrees") : null;
  let shouldersClass = null;
  if (m.height && m.shoulders) {
    const r = m.shoulders / m.height;
    shouldersClass = r < 0.23 ? "etroites" : r > 0.285 ? "larges" : "moyennes";
  }

  const info = SHAPES[shape];
  const tips = {
    favor: [...info.favor],
    careful: [...info.careful],
    tips: [...info.tips, ...(heightClass ? HEIGHT_TIPS[heightClass] : [])],
  };
  if (legs && LEGS_TIPS[legs]) tips.tips.push(...LEGS_TIPS[legs]);
  if (shouldersClass === "etroites") tips.tips.push("Épaules plutôt étroites : les coupes structurées aux épaules, les cols bateau ou les couches superposées les élargissent visuellement.");
  if (shouldersClass === "larges") tips.tips.push("Épaules plutôt larges : des épaules naturelles (sans épaulettes) et des hauts fluides gardent un bel équilibre.");

  return {
    ok: true, shape, label: info.label, desc: info.desc, heightClass, legs, shouldersClass,
    ratios: { chestHips: Math.round(diff * 1000) / 10, waist: Math.round(waistRatio * 100) / 100 },
    ...tips,
  };
}

// Dimensions du mannequin 3D : demi-largeurs et profondeurs en mètres.
export function mannequinFromProfile(p = {}) {
  const H = (parseMeasure(p.height) || 175) / 100;
  const circ = (c) => c / 100 / (Math.PI * 1.7); // demi-largeur d'une ellipse de profondeur 0,7 × largeur
  const chest = parseMeasure(p.chest) || 98;
  const waist = parseMeasure(p.waist) || 84;
  const hips = parseMeasure(p.hips) || 98;
  const sh = parseMeasure(p.shoulders) || chest * 0.43;
  return { H, chestA: circ(chest), waistA: circ(waist), hipA: circ(hips), shoulderHalf: sh / 200, skin: p.skin || "#d9a78a", hair: p.hair || "#3a2a1f", hairStyle: p.hairStyle || "court" };
}

/* ---------- Couleurs personnelles ---------- */

export function paletteFor(undertone, contrast = "moyen") {
  const base = PALETTES[undertone] || PALETTES.neutre;
  const note = contrast === "fort" ? "Contraste fort (cheveux et peau très différents) : tu portes bien les couleurs franches et les oppositions noir/blanc."
    : contrast === "faible" ? "Contraste doux : privilégie des tons tonaux et nuancés plutôt que des oppositions dures."
    : "Contraste moyen : les couleurs profondes et les tons moyens te vont bien.";
  return { ...base, contrastNote: note };
}

/* ---------- Conseils accessoires ---------- */

const METAL = { or: "doré", argent: "argenté" };

export function accessoryAdvice({ outfit = {}, profile = {}, weather = {}, theme = "casual" }) {
  const out = [];
  const th = THEME[theme];
  const t = feelTemp({ tempMax: 18, tempMin: 11, ...weather }, profile);
  const add = (slot, text) => out.push({ slot, text });

  // Lunettes
  const face = FACE_SHAPES[profile.face];
  if (outfit.glasses) {
    add("glasses", `${outfit.glasses.name} : ${outfit.glasses.sun ? "verres de soleil de catégorie 3 minimum et marquage UV400 ; " : ""}${face ? `pour un visage ${face.label.toLowerCase()} → ${face.glasses}` : "renseigne la forme de ton visage dans « Moi » pour un conseil de monture."}`);
  } else if (face && isSunny(weather)) {
    add("glasses", `Soleil prévu : pour un visage ${face.label.toLowerCase()}, ${face.glasses.charAt(0).toLowerCase()}${face.glasses.slice(1)}`);
  }

  // Montre
  if (outfit.watch) {
    const f = itemFormality(outfit.watch), core = ["top", "bottom", "shoes"].filter((k) => outfit[k]).map((k) => itemFormality(outfit[k]));
    const avg = core.length ? core.reduce((a, b) => a + b, 0) / core.length : 2;
    if (f >= 3 && avg < 1.6) add("watch", "Ta montre habillée est plus formelle que la tenue : sur du casual, un bracelet cuir souple ou une montre sportive s'accorde mieux.");
    else if (f < 2 && avg > 3.3) add("watch", "Pour une tenue habillée, préfère une montre fine à bracelet cuir ou métal.");
    else add("watch", "Montre bien assortie au niveau de la tenue.");
  }

  // Bijoux
  const jewels = ["necklace", "bracelet", "ring", "earrings"].map((k) => outfit[k]).filter(Boolean);
  const metals = new Set([outfit.watch, outfit.belt, ...jewels].map((i) => i?.metal).filter((m) => m === "or" || m === "argent"));
  if (metals.size > 1) add("jewels", "Tu mélanges doré et argenté : choisis un seul métal dominant, ou fais le mélange assumé avec une pièce de liaison (bicolore).");
  else if (metals.size === 1) add("jewels", `Métaux cohérents (${METAL[[...metals][0]]}) : c'est ce qui donne un rendu soigné.`);
  if (jewels.length >= 3) add("jewels", "Trois bijoux ou plus : garde-en un en pièce principale et laisse les autres discrets.");
  const palette = PALETTES[profile.undertone];
  if (palette?.metal && !metals.size && jewels.length) add("jewels", `Avec ton sous-ton ${profile.undertone}, le métal ${METAL[palette.metal] || ""} te flatte souvent plus.`.replace("  ", " "));

  // Chapeau, écharpe, gants
  if (outfit.hat) {
    if (outfit.hat.category === "bonnet") add("hat", "Bonnet : enfile-le avant de te coiffer, tire-le sur le front pour les oreilles et laisse-le plus lâche si le visage est long.");
    else if (face) add("hat", `Pour un visage ${face.label.toLowerCase()} : ${face.hat}`);
  }
  if (outfit.scarf) add("scarf", t < 6 ? "Écharpe nouée serré dans le col du manteau : le cou protégé réchauffe tout le corps." : "Écharpe légère : noue-la lâche, en boucle simple, plutôt qu'en gros nœud.");

  // Sac, ceinture
  if (outfit.bag) {
    if (outfit.bag.category === "sacados" && th && th.formality[0] >= 3) add("bag", "Un sac à dos fait casual : pour une tenue habillée, préfère un sac cabas, une sacoche ou une serviette.");
    else if (outfit.bag.category === "sacados") add("bag", "Sac à dos : porte-le sur les deux épaules, sangles ajustées, c'est meilleur pour le dos.");
    else add("bag", "Sac assorti : reprends la teinte de ta ceinture ou de tes chaussures pour une tenue cohérente.");
  }
  if (outfit.belt && outfit.shoes) add("belt", "Ceinture et chaussures dans la même famille de couleur (noir/noir, marron/marron) : la règle qui marche toujours.");

  // Chaussettes
  if (outfit.socks && outfit.shoes && ["baskets"].includes(outfit.shoes.category)) add("socks", "Avec des baskets : chaussettes blanches ou de la couleur du pantalon, pas de couleur qui détonne.");

  if (!out.length) add("general", "Peu d'accessoires aujourd'hui : une montre ou un bracelet sobre suffit à finir la tenue.");
  return out;
}

/* ---------- Parfums ---------- */

const sprayRange = { edc: [3, 5], edt: [3, 4], edp: [2, 3], extrait: [1, 2] };

export function scoreFamily(familyKey, { t, context = "loisirs", theme = "casual", rain = 0, hour = "jour" }) {
  const f = PERF_FAMILY[familyKey];
  if (!f) return -99;
  let s = 0;
  const [lo, hi] = f.temp;
  s -= t < lo ? (lo - t) * 0.5 : t > hi ? (t - hi) * 0.5 : -1.5;
  const th = THEME[theme];
  const form = th ? (th.formality[0] + th.formality[1]) / 2 : 2;
  const [fl, fh] = f.formal;
  s -= form < fl ? (fl - form) * 0.8 : form > fh ? (form - fh) * 0.8 : -0.5;
  const moment = context === "soiree" || hour === "soir" ? "soir" : "jour";
  s += f.moments[0] === moment ? 1.5 : f.moments.includes(moment) ? 0.5 : -1.5;
  if (rain >= 50 && ["vert", "boise", "aromatique"].includes(familyKey)) s += 0.6; // petrichor
  return s;
}

export function recommendPerfumes({ perfumes = [], weather = {}, profile = {}, theme = "casual", context = "loisirs", date = "2026-01-01" }) {
  const t = feelTemp({ tempMax: 18, tempMin: 11, ...weather }, { ...profile, coldSensitivity: 0 });
  const ctx = { t, context, theme, rain: weather.rainProb || 0 };
  const season = seasonOf(date);

  const owned = perfumes
    .map((p) => {
      let score = scoreFamily(p.family, ctx);
      if (p.seasons?.length) score += p.seasons.includes(season) ? 0.8 : -1.2;
      if (p.favorite) score += 0.5;
      return { perfume: p, score, sprays: dose(p, t, weather) };
    })
    .sort((a, b) => b.score - a.score);

  const families = PERFUME_FAMILIES.map((f) => ({ family: f, score: scoreFamily(f.key, ctx) })).sort((a, b) => b.score - a.score).slice(0, 3);
  return { t, owned, families, advice: perfumeTips(t, weather, theme, context) };
}

export function dose(p, t, weather = {}) {
  const [lo, hi] = sprayRange[p?.concentration] || sprayRange.edt;
  let a = lo, b = hi;
  if (t >= 28 || (weather.humidity ?? 0) >= 80) { a--; b--; }
  else if (t <= 6) { b++; }
  a = Math.max(1, a); b = Math.max(a, b);
  return a === b ? `${a}` : `${a} à ${b}`;
}

function perfumeTips(t, w, theme, context) {
  const tips = [];
  if (t >= 28) tips.push("Il fait très chaud : le parfum diffuse plus fort, 1 à 2 vaporisations de moins, sur les poignets et la nuque.");
  else if (t <= 6) tips.push("Par temps froid le parfum diffuse moins : tu peux ajouter une vaporisation, sur la peau sous les vêtements (le torse, la nuque).");
  if ((w.rainProb ?? 0) >= 60) tips.push("La pluie et l'humidité sublime les notes boisées et vertes, mais amplifient aussi les parfums lourds : reste mesuré.");
  if (context === "travail") tips.push("Au bureau : sillage discret, 2 vaporisations maximum, évite les parfums très capiteux.");
  if (context === "soiree") tips.push("En soirée tu peux choisir un parfum plus marqué (ambré, cuiré, épicé) : vaporise sur le cou et les poignets 15 minutes avant de sortir.");
  if (!tips.length) tips.push("Vaporise à 15 cm de la peau sur le cou et les poignets, sans frotter.");
  return tips;
}

export { PERFUME_CONCENTRATIONS, isWaterproof };
