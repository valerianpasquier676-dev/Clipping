import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBody, parseMeasure, mannequinFromProfile, paletteFor, accessoryAdvice, recommendPerfumes, dose, scoreFamily } from "./morph.js";

const body = (chest, waist, hips, extra = {}) => analyzeBody({ chest, waist, hips, ...extra });

test("classification de la silhouette d'après les mesures", () => {
  assert.equal(body(92, 66, 96).shape, "sablier");
  assert.equal(body(88, 72, 102).shape, "poire");
  assert.equal(body(104, 82, 98).shape, "trapeze");
  assert.equal(body(112, 84, 96).shape, "triangle_inverse");
  assert.equal(body(98, 88, 100).shape, "rectangle");
  assert.equal(body(100, 98, 100).shape, "rond");
});

test("conseils fournis pour chaque silhouette", () => {
  for (const args of [[92, 66, 96], [88, 72, 102], [104, 82, 98], [112, 84, 96], [98, 88, 100], [100, 98, 100]]) {
    const r = body(...args);
    assert.ok(r.ok && r.favor.length >= 2 && r.careful.length >= 1 && r.tips.length >= 2 && r.label && r.desc);
  }
});

test("taille, jambes et épaules ajoutent des conseils", () => {
  const petit = body(98, 84, 98, { height: 158 });
  assert.equal(petit.heightClass, "petit");
  assert.ok(petit.tips.some((t) => /taille haute/i.test(t)));
  const grand = body(98, 84, 98, { height: 190, inseam: 94, shoulders: 52 });
  assert.equal(grand.heightClass, "grand");
  assert.equal(grand.legs, "longues");
  assert.equal(grand.shouldersClass, "moyennes");
  assert.equal(body(98, 84, 98, { height: 175, inseam: 74 }).legs, "courtes");
  assert.equal(body(98, 84, 98, { height: 180, shoulders: 38 }).shouldersClass, "etroites");
});

test("validation : mesures manquantes ou aberrantes", () => {
  const miss = analyzeBody({ chest: 98 });
  assert.equal(miss.ok, false);
  assert.deepEqual(miss.missing, ["waist", "hips"]);
  const bad = analyzeBody({ chest: 98, waist: 4000, hips: 98 });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors[0].includes("taille"));
  assert.equal(parseMeasure("98,5"), 98.5);
  assert.equal(parseMeasure("abc"), null);
});

test("dimensions du mannequin d'après le profil", () => {
  const m = mannequinFromProfile({ height: "180", chest: "100", waist: "80", hips: "100" });
  assert.equal(m.H, 1.8);
  assert.ok(m.chestA > m.waistA);
  assert.ok(m.chestA > 0.15 && m.chestA < 0.25);
  assert.equal(mannequinFromProfile({}).H, 1.75);
});

test("palette selon le sous-ton", () => {
  const p = paletteFor("chaud", "fort");
  assert.equal(p.metal, "or");
  assert.ok(p.colors.length >= 6);
  assert.match(p.contrastNote, /franches/);
  assert.equal(paletteFor("inconnu").label, "Sous-ton neutre");
});

test("conseils accessoires : métaux mélangés, montre trop habillée, sac à dos en tenue habillée", () => {
  const outfit = {
    watch: { name: "Montre", category: "montre", metal: "or", formality: 4 },
    necklace: { name: "Chaîne", category: "collier", metal: "argent" },
    top: { formality: 1 }, bottom: { formality: 1 }, shoes: { formality: 1, category: "baskets" },
    bag: { category: "sacados" },
  };
  const a = accessoryAdvice({ outfit, profile: { face: "rond" }, theme: "casual" });
  const txt = a.map((x) => x.text).join(" | ");
  assert.match(txt, /doré et argenté/);
  assert.match(txt, /plus formelle/);
  const b = accessoryAdvice({ outfit: { bag: { category: "sacados" } }, theme: "business" });
  assert.match(b[0].text, /sac à dos fait casual/);
  const c = accessoryAdvice({ outfit: { glasses: { name: "Ray", sun: true } }, profile: { face: "carre" } });
  assert.match(c[0].text, /UV400/);
  assert.match(c[0].text, /rondes ou ovales/);
  assert.ok(accessoryAdvice({}).length === 1);
});

test("parfums : frais en chaleur, chaud en hiver, bureau discret", () => {
  const perfumes = [
    { id: "a", name: "Citrus", family: "agrumes", concentration: "edt" },
    { id: "b", name: "Ambre Nuit", family: "ambre", concentration: "edp" },
    { id: "c", name: "Cèdre", family: "boise", concentration: "edp" },
  ];
  const summer = recommendPerfumes({ perfumes, weather: { tempMax: 34, tempMin: 24, feelMax: 35, feelMin: 25 }, theme: "ete", context: "loisirs", date: "2026-07-10" });
  assert.equal(summer.owned[0].perfume.id, "a");
  assert.equal(summer.owned.at(-1).perfume.id, "b");
  assert.equal(summer.families[0].family.key === "agrumes" || summer.families[0].family.key === "aquatique", true);
  const winter = recommendPerfumes({ perfumes, weather: { tempMax: 2, tempMin: -3, feelMax: 0, feelMin: -5 }, theme: "soiree", context: "soiree", date: "2026-12-10" });
  assert.equal(winter.owned[0].perfume.id, "b");
  assert.ok(winter.advice.some((t) => /soirée/i.test(t)));
  const office = recommendPerfumes({ perfumes, weather: { tempMax: 18, tempMin: 12, feelMax: 18, feelMin: 12 }, theme: "business", context: "travail" });
  assert.ok(office.advice.some((t) => /bureau/i.test(t)));
  assert.equal(recommendPerfumes({}).owned.length, 0);
});

test("dosage : moins en chaleur, plus par grand froid", () => {
  assert.equal(dose({ concentration: "edt" }, 18), "3 à 4");
  assert.equal(dose({ concentration: "edt" }, 32), "2 à 3");
  assert.equal(dose({ concentration: "extrait" }, 32), "1");
  assert.equal(dose({ concentration: "edp" }, 2), "2 à 4");
  assert.ok(scoreFamily("agrumes", { t: 32 }) > scoreFamily("ambre", { t: 32 }));
});
