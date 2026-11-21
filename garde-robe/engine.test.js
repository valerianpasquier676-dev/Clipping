import test from "node:test";
import assert from "node:assert/strict";
import {
  colorInfo, colorHarmony, targetWarmth, generateDay, planWeek, replanDay, gapAnalysis, laundryReport,
  warmthOf, isOpenShoe, isWaterproof, itemFormality, addDays, daysBetween, seasonOf, rng,
} from "./engine.js";

let n = 0;
const mk = (category, color, extra = {}) => ({ id: `${category}${++n}`, name: `${category} ${n}`, category, colors: [color], ...extra });

function wardrobe() {
  n = 0;
  const w = [];
  for (const c of ["#ffffff", "#111111", "#3b5b8f", "#9a3b3b", "#d9c9a8", "#4b6b3a", "#c9a227", "#888888"]) w.push(mk("tshirt", c));
  w.push(mk("chemise", "#ffffff"), mk("chemise", "#9ec1e6"), mk("chemise", "#1b2a49"), mk("polo", "#1b2a49"));
  w.push(mk("pull", "#d9c9a8"), mk("pull", "#2b2b2b"), mk("sweat", "#777777", { tags: ["streetwear"], fit: "oversize" }), mk("sweat", "#1b1b1b", { tags: ["streetwear"], fit: "oversize" }));
  w.push(mk("jean", "#3a5a85"), mk("jean", "#161616"), mk("pantalon", "#1b2a49"), mk("pantalon", "#6b5b45"), mk("jogging", "#222222"), mk("short", "#d9c9a8"), mk("short", "#2d3b55"), mk("bermuda", "#4b6b3a"));
  w.push(mk("baskets", "#ffffff"), mk("baskets", "#111111"), mk("ville", "#3a2618"), mk("ville", "#111111"), mk("bottes", "#4a3626"), mk("claquettes", "#111111"), mk("tongs", "#333333"), mk("sandales", "#8a6a45"));
  w.push(mk("veste", "#1b2a49"), mk("blouson", "#4b4b3a"), mk("manteau", "#2b2b2b"), mk("doudoune", "#111111"), mk("impermeable", "#d4a017"), mk("coupevent", "#3b5b8f"));
  w.push(mk("echarpe", "#777777"), mk("bonnet", "#222222"), mk("gants", "#222222"), mk("casquette", "#111111"), mk("lunettes", "#111111", { sun: true }));
  w.push(mk("ceinture", "#3a2618"), mk("ceinture", "#111111"), mk("montre", "#c0c0c0", { metal: "argent" }), mk("montre", "#c9a227", { metal: "or" }));
  w.push(mk("collier", "#c0c0c0", { metal: "argent" }), mk("collier", "#c9a227", { metal: "or" }), mk("bracelet", "#c0c0c0", { metal: "argent" }), mk("bracelet", "#c9a227", { metal: "or" }));
  w.push(mk("sacados", "#222222"), mk("sac", "#3a2618"));
  for (let i = 0; i < 8; i++) w.push(mk("chaussettes", i % 2 ? "#ffffff" : "#222222"), mk("caleçon", "#222222"));
  return w;
}
const day = (items, weather, extra = {}) => generateDay({ items, date: "2026-11-23", weather, theme: "casual", ...extra });
const rainy = { tempMax: 12, tempMin: 8, feelMax: 11, feelMin: 7, rainProb: 90, rainMm: 6, wind: 20, uv: 1, code: 63 };
const hot = { tempMax: 34, tempMin: 22, feelMax: 35, feelMin: 23, rainProb: 0, wind: 8, uv: 9, code: 0 };
const cold = { tempMax: 2, tempMin: -4, feelMax: 0, feelMin: -6, rainProb: 5, wind: 15, uv: 1, code: 3 };

test("classification des couleurs", () => {
  assert.equal(colorInfo("#000000").kind, "neutral");
  assert.equal(colorInfo("#ffffff").kind, "neutral");
  assert.equal(colorInfo("#1b2a49").kind, "neutral"); // marine
  assert.equal(colorInfo("#3a5a85").kind, "denim");
  assert.equal(colorInfo("#d9c9a8").kind, "earth");
  assert.equal(colorInfo("#e02020").kind, "vivid");
});

test("harmonie : un neutre va avec tout, deux couleurs vives qui jurent sont pénalisées", () => {
  assert.ok(colorHarmony("#111111", "#e02020") > 1);
  assert.ok(colorHarmony("#e02020", "#20c020") < colorHarmony("#e02020", "#111111"));
  assert.ok(colorHarmony("#e02020", "#e5a020") < 0.5);
  assert.ok(colorHarmony("#d9c9a8", "#4b6b3a") > 0.5);
});

test("l'isolation visée diminue quand il fait chaud", () => {
  let prev = Infinity;
  for (const t of [-5, 0, 5, 10, 15, 20, 25, 30, 35]) { const v = targetWarmth(t); assert.ok(v < prev); prev = v; }
});

test("pluie : chaussures fermées et veste imperméable dans la grande majorité des cas", () => {
  const items = wardrobe();
  let wet = 0, closed = 0;
  for (let s = 1; s <= 30; s++) {
    const d = day(items, rainy, { seed: s });
    if (isWaterproof(d.outfit.outer)) wet++;
    if (!isOpenShoe(d.outfit.shoes)) closed++;
  }
  assert.equal(closed, 30);
  assert.ok(wet >= 27, `imperméable ${wet}/30`);
});

test("forte chaleur : pas de manteau ni de pull, jambes à l'air ou tissu léger", () => {
  const items = wardrobe();
  for (let s = 1; s <= 30; s++) {
    const d = day(items, hot, { seed: s });
    assert.ok(!d.outfit.outer || d.outfit.outer.category === "impermeable" ? true : false, "pas de veste en pleine chaleur : " + d.outfit.outer?.category);
    assert.ok(!d.outfit.mid, "pas de pull");
    assert.ok(warmthOf(d.outfit) < 4.5, "isolation " + warmthOf(d.outfit));
    assert.ok(!["bottes"].includes(d.outfit.shoes?.category));
    assert.ok(d.tips.some((t) => /UV/.test(t)));
  }
});

test("grand froid : manteau chaud, chaussures fermées, accessoires de protection", () => {
  const items = wardrobe();
  let scarf = 0;
  for (let s = 1; s <= 30; s++) {
    const d = day(items, cold, { seed: s });
    assert.ok(d.outfit.outer && warmthOf(d.outfit) >= d.warmth.need - 3.5, JSON.stringify(d.warmth));
    assert.ok(!isOpenShoe(d.outfit.shoes));
    assert.ok(d.outfit.bottom.category !== "short");
    if (d.outfit.scarf || d.outfit.hat) scarf++;
  }
  assert.ok(scarf >= 24, "protection tête/cou " + scarf);
});

test("sensibilité au froid : un profil frileux est plus couvert", () => {
  const items = wardrobe();
  const mild = { tempMax: 17, tempMin: 11, feelMax: 17, feelMin: 11, rainProb: 0, wind: 5, uv: 3, code: 1 };
  let a = 0, b = 0;
  for (let s = 1; s <= 25; s++) {
    a += warmthOf(day(items, mild, { seed: s, profile: { coldSensitivity: 1 } }).outfit);
    b += warmthOf(day(items, mild, { seed: s, profile: { coldSensitivity: -1 } }).outfit);
  }
  assert.ok(a > b, `${a} vs ${b}`);
});

test("pièces sales jamais utilisées", () => {
  const items = wardrobe().map((i) => (["tshirt", "jean"].includes(i.category) ? { ...i, dirty: true } : i));
  const plan = planWeek({ items, startDate: "2026-11-23", seed: 3, weather: Array(7).fill({ tempMax: 20, tempMin: 12, feelMax: 20, feelMin: 12 }) });
  for (const d of plan.days) for (const it of Object.values(d.outfit)) assert.ok(!it.dirty);
});

test("semaine : variété des hauts et bas, aucune tenue identique", () => {
  const items = wardrobe();
  const weather = Array(7).fill({ tempMax: 19, tempMin: 11, feelMax: 19, feelMin: 11, rainProb: 10, wind: 10, uv: 3, code: 2 });
  const plan = planWeek({ items, startDate: "2026-11-23", seed: 5, weather });
  assert.equal(plan.days.length, 7);
  const tops = new Set(plan.days.map((d) => d.outfit.top?.id));
  const bottoms = new Set(plan.days.map((d) => d.outfit.bottom?.id));
  const sigs = new Set(plan.days.map((d) => d.sig));
  assert.ok(tops.size >= 6, "hauts " + tops.size);
  assert.ok(bottoms.size >= 5, "bas " + bottoms.size);
  assert.equal(sigs.size, 7);
  const themes = new Set(plan.days.map((d) => d.theme));
  assert.ok(themes.size >= 4, "thèmes " + [...themes].join(","));
  const unders = new Set(plan.days.map((d) => d.outfit.underwear?.id));
  assert.equal(unders.size, 7);
});

test("semaine : déterministe pour une graine, différente selon la graine", () => {
  const items = wardrobe();
  const weather = Array(7).fill({ tempMax: 19, tempMin: 11, feelMax: 19, feelMin: 11 });
  const a = planWeek({ items, startDate: "2026-11-23", seed: 9, weather });
  const b = planWeek({ items, startDate: "2026-11-23", seed: 9, weather });
  const c = planWeek({ items, startDate: "2026-11-23", seed: 10, weather });
  assert.deepEqual(a.days.map((d) => d.sig), b.days.map((d) => d.sig));
  assert.notDeepEqual(a.days.map((d) => d.sig), c.days.map((d) => d.sig));
});

test("thème verrouillé respecté ; business → pièces habillées", () => {
  const items = wardrobe();
  const weather = Array(7).fill({ tempMax: 18, tempMin: 10, feelMax: 18, feelMin: 10 });
  const locks = {};
  for (let i = 0; i < 7; i++) locks[addDays("2026-11-23", i)] = "business";
  const plan = planWeek({ items, startDate: "2026-11-23", seed: 2, weather, themeLocks: locks });
  for (const d of plan.days) {
    assert.equal(d.theme, "business");
    const f = ["top", "bottom", "shoes"].map((k) => itemFormality(d.outfit[k]));
    assert.ok(f.reduce((a, b) => a + b, 0) / 3 >= 3, `formalité ${f}`);
    assert.ok(d.outfit.bag?.category !== "sacados");
  }
});

test("jours de travail vs week-end : contexte et thèmes cohérents", () => {
  const items = wardrobe();
  const plan = planWeek({ items, startDate: "2026-11-23", seed: 4, profile: { workStyle: "formel" }, weather: Array(7).fill({ tempMax: 18, tempMin: 10, feelMax: 18, feelMin: 10 }) });
  assert.equal(plan.days[0].context, "travail");
  assert.equal(plan.days[5].context, "loisirs");
  for (const d of plan.days.slice(0, 5)) assert.ok(["business", "smart"].includes(d.theme), d.theme);
});

test("pièces forcées respectées", () => {
  const items = wardrobe();
  const top = items.find((i) => i.category === "chemise");
  const d = day(items, { tempMax: 18, tempMin: 10, feelMax: 18, feelMin: 10 }, { forced: { top: top.id, hat: null } });
  assert.equal(d.outfit.top.id, top.id);
  assert.ok(!d.outfit.hat);
});

test("un seul métal par tenue dans la grande majorité des cas", () => {
  const items = wardrobe();
  let mixed = 0;
  for (let s = 1; s <= 40; s++) {
    const d = generateDay({ items, date: "2026-11-23", theme: "soiree", weather: { tempMax: 16, tempMin: 10, feelMax: 16, feelMin: 10 }, seed: s });
    const metals = new Set(["watch", "bracelet", "necklace"].map((k) => d.outfit[k]?.metal).filter(Boolean));
    if (metals.size > 1) mixed++;
  }
  assert.ok(mixed <= 6, "métaux mélangés " + mixed);
});

test("régénérer un jour évite les pièces des autres jours", () => {
  const items = wardrobe();
  const weather = Array(7).fill({ tempMax: 19, tempMin: 11, feelMax: 19, feelMin: 11 });
  const plan = planWeek({ items, startDate: "2026-11-23", seed: 1, weather });
  const d = replanDay({ plan: plan.days, index: 2, items, seed: 77 });
  const others = new Set(plan.days.filter((_, i) => i !== 2).flatMap((x) => [x.outfit.top?.id, x.outfit.bottom?.id]));
  assert.ok(!others.has(d.outfit.top.id) || !others.has(d.outfit.bottom.id));
  assert.notEqual(d.sig, plan.days[2].sig);
});

test("garde-robe vide ou incomplète : pas d'exception, messages utiles", () => {
  const empty = day([], rainy);
  assert.equal(empty.missing.length >= 3, true);
  const noShoes = day(wardrobe().filter((i) => !["baskets", "ville", "bottes", "claquettes", "tongs", "sandales"].includes(i.category)), rainy);
  assert.ok(noShoes.missing.some((m) => /chaussures/i.test(m)));
  const plan = planWeek({ items: [], startDate: "2026-11-23" });
  assert.equal(plan.days.length, 7);
});

test("manques détectés : pluie sans imperméable, froid sans accessoires, soleil sans lunettes", () => {
  const base = wardrobe().filter((i) => !["impermeable", "echarpe", "bonnet", "gants", "lunettes", "bottes"].includes(i.category));
  const gaps = gapAnalysis(base, [rainy, cold, hot], {}, ["2026-11-23", "2026-11-24", "2026-11-25"]);
  const txt = gaps.map((g) => g.text).join(" | ");
  assert.match(txt, /imperméable/);
  assert.match(txt, /écharpe/);
  assert.match(txt, /lunettes/);
});

test("linge : alerte quand il manque de sous-vêtements propres", () => {
  const items = wardrobe().map((i) => (i.category === "caleçon" ? { ...i, dirty: true } : i)).slice(0);
  assert.ok(laundryReport(items, 7).some((m) => /sous-vêtement/.test(m)));
  assert.equal(laundryReport(wardrobe(), 7).length, 0);
});

test("dates : saison, écart de jours, PRNG", () => {
  assert.equal(seasonOf("2026-07-14"), "ete");
  assert.equal(seasonOf("2026-12-24"), "hiver");
  assert.equal(daysBetween("2026-02-27", "2026-03-02"), 3);
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  const r = rng(42), r2 = rng(42);
  assert.equal(r(), r2());
});

test("neige par grand froid : manteau chaud, pas un simple K-way", () => {
  const items = wardrobe();
  const snow = { tempMax: 0, tempMin: -5, feelMax: -3, feelMin: -8, rainProb: 70, rainMm: 4, wind: 20, uv: 1, code: 73 };
  for (let s = 1; s <= 25; s++) {
    const d = day(items, snow, { seed: s });
    assert.ok(d.outfit.outer && ["manteau", "doudoune"].includes(d.outfit.outer.category), "veste : " + d.outfit.outer?.category);
    assert.ok(!isOpenShoe(d.outfit.shoes));
  }
});

test("journée douce l'après-midi : pas de gros pull, pas de pull avec un short", () => {
  const items = wardrobe();
  const spring = { tempMax: 25, tempMin: 13, feelMax: 25, feelMin: 13, rainProb: 5, wind: 8, uv: 6, code: 1 };
  for (let s = 1; s <= 30; s++) {
    const d = day(items, spring, { seed: s });
    assert.ok(!d.outfit.mid || d.outfit.mid.warmth < 2.5 && !["pull", "sweat"].includes(d.outfit.mid.category), "couche : " + d.outfit.mid?.category);
  }
});

test("canicule : le short l'emporte sur le jean", () => {
  const items = wardrobe();
  let shorts = 0;
  for (let s = 1; s <= 30; s++) if (["short", "bermuda"].includes(day(items, hot, { seed: s }).outfit.bottom?.category)) shorts++;
  assert.ok(shorts >= 26, "shorts " + shorts);
});

test("pas de lunettes de soleil sous la pluie ; blazer jamais avec un jogging", () => {
  const items = wardrobe();
  let sun = 0, blazerJog = 0;
  for (let s = 1; s <= 40; s++) {
    const d = day(items, rainy, { seed: s });
    if (d.outfit.glasses) sun++;
    const m = day(items, { tempMax: 24, tempMin: 13, feelMax: 24, feelMin: 13, rainProb: 0, wind: 5, uv: 5, code: 1 }, { seed: s });
    if (m.outfit.outer?.category === "veste" && m.outfit.bottom?.category === "jogging") blazerJog++;
  }
  assert.equal(sun, 0);
  assert.equal(blazerJog, 0);
});
