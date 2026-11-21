import test from "node:test";
import assert from "node:assert/strict";
import { colorName, estimateBackground, segmentGarment, cutOut, dominantColors, guessPattern, toHex } from "./scan.js";
import { normalizeForecast, describeWeather, geocode, fetchForecast } from "./weather.js";

function image(w, h, bg, draw) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const noise = ((x * 7 + y * 13) % 5) - 2; // léger bruit de capteur
      const c = draw(x, y) || bg;
      const i = (y * w + x) * 4;
      d[i] = c[0] + noise; d[i + 1] = c[1] + noise; d[i + 2] = c[2] + noise; d[i + 3] = 255;
    }
  return d;
}
const W = 160, H = 120;
const RED = [200, 30, 40], WHITE = [238, 238, 234];

test("noms de couleurs en français", () => {
  const cases = { "#000000": "Noir", "#ffffff": "Blanc", "#808080": "Gris", "#c81e28": "Rouge", "#1b2a49": "Bleu marine", "#3a5a85": "Bleu denim", "#d9c9a8": "Beige", "#4b6b3a": "Kaki", "#2e8b3a": "Vert", "#6d1f2c": "Bordeaux", "#e87d1e": "Orange", "#f1c40f": "Jaune", "#e6b8c8": "Rose", "#5a2a5f": "Prune", "#7a3fb5": "Violet" };
  for (const [hex, name] of Object.entries(cases)) assert.equal(colorName(hex), name, hex);
  assert.equal(toHex(255, 0, 128), "#ff0080");
});

test("fond estimé d'après les bords", () => {
  const img = image(W, H, WHITE, (x, y) => (x > 50 && x < 110 && y > 30 && y < 90 ? RED : null));
  const bg = estimateBackground(img, W, H);
  assert.ok(bg.every((v, i) => Math.abs(v - WHITE[i]) < 6), bg.join());
});

test("détoure un vêtement rouge sur fond clair, ombre et trou compris", () => {
  const rect = (x, y) => x >= 50 && x < 110 && y >= 30 && y < 90;
  const img = image(W, H, WHITE, (x, y) => {
    if (x >= 70 && x < 90 && y >= 50 && y < 70) return WHITE; // trou de la même couleur que le fond (doit être rempli)
    if (rect(x, y)) return RED;
    if (x >= 50 && x < 120 && y >= 90 && y < 100) return [200, 200, 197]; // ombre douce portée
    if (x === 5 && y === 5) return [0, 0, 0]; // poussière isolée
    return null;
  });
  const seg = segmentGarment(img, W, H, { tolerance: 40 });
  const area = seg.mask.reduce((a, b) => a + b, 0);
  const truth = 60 * 60;
  assert.ok(Math.abs(area - truth) / truth < 0.08, `aire ${area} vs ${truth}`);
  assert.equal(seg.mask[5 * W + 5], 0, "poussière retirée");
  assert.equal(seg.mask[60 * W + 80], 1, "trou rempli");
  assert.equal(seg.mask[95 * W + 80], 0, "ombre ignorée");
  assert.equal(seg.confidence, "high");
  assert.ok(Math.abs(seg.bbox.x0 - 50) <= 2 && Math.abs(seg.bbox.y1 - 89) <= 2);
});

test("découpe recadrée avec fond transparent", () => {
  const img = image(W, H, WHITE, (x, y) => (x >= 50 && x < 110 && y >= 30 && y < 90 ? RED : null));
  const seg = segmentGarment(img, W, H);
  const cut = cutOut(img, W, H, seg.mask, seg.bbox, 4);
  assert.ok(cut.w >= 60 && cut.w <= 72 && cut.h >= 60 && cut.h <= 72, `${cut.w}x${cut.h}`);
  assert.equal(cut.data[3], 0, "coin transparent");
  const mid = ((cut.h >> 1) * cut.w + (cut.w >> 1)) * 4;
  assert.equal(cut.data[mid + 3], 255);
});

test("couleurs dominantes : rouge reconnu, motif détecté pour deux couleurs franches", () => {
  const img = image(W, H, WHITE, (x, y) => (x >= 50 && x < 110 && y >= 30 && y < 90 ? RED : null));
  const seg = segmentGarment(img, W, H);
  const cols = dominantColors(img, W, H, seg.mask);
  assert.equal(cols[0].name, "Rouge");
  assert.ok(cols[0].share > 0.9);
  assert.equal(guessPattern(cols), "uni");
  const GRAY = [165, 165, 160];
  const stripes = image(W, H, GRAY, (x, y) => (x >= 50 && x < 110 && y >= 30 && y < 90 ? (Math.floor(x / 6) % 2 ? [20, 40, 120] : [250, 250, 250]) : null));
  const s2 = segmentGarment(stripes, W, H);
  assert.equal(guessPattern(dominantColors(stripes, W, H, s2.mask)), "motif");
});

test("blanc sur blanc : confiance faible plutôt qu'un faux résultat", () => {
  const img = image(W, H, WHITE, (x, y) => (x >= 50 && x < 110 && y >= 30 && y < 90 ? [245, 245, 242] : null));
  const seg = segmentGarment(img, W, H);
  assert.equal(seg.confidence, "low");
});

test("météo : normalisation Open-Meteo et libellés", () => {
  const json = { daily: { time: ["2026-11-23", "2026-11-24"], temperature_2m_max: [12.4, 9], temperature_2m_min: [6, 3], apparent_temperature_max: [10, 7], apparent_temperature_min: [3.5, null], precipitation_probability_max: [80, 10], precipitation_sum: [4.2, 0], wind_speed_10m_max: [28, 14], uv_index_max: [1.2, 2], weather_code: [63, 3] } };
  const d = normalizeForecast(json);
  assert.equal(d.length, 2);
  assert.deepEqual([d[0].tempMax, d[0].feelMin, d[0].rainProb, d[0].code], [12.4, 3.5, 80, 63]);
  assert.equal(d[1].feelMin, 3); // repli sur la température mesurée si la ressentie manque
  assert.equal(describeWeather({ code: 63 }).label, "Pluie");
  assert.throws(() => normalizeForecast({}), /inattendue/);
});

test("météo : appels réseau (simulés), échec propre", async () => {
  const urls = [];
  const fake = async (u) => { urls.push(u); return { ok: true, json: async () => (u.includes("geocoding") ? { results: [{ name: "Lyon", admin1: "Auvergne-Rhône-Alpes", country: "France", latitude: 45.75, longitude: 4.85 }] } : { daily: { time: ["2026-11-23"] } }) }; };
  const places = await geocode("Lyon", fake);
  assert.equal(places[0].name, "Lyon");
  assert.ok(urls[0].includes("name=Lyon"));
  const f = await fetchForecast(45.75, 4.85, 7, fake);
  assert.equal(f[0].date, "2026-11-23");
  assert.ok(urls[1].includes("forecast_days=7") && urls[1].includes("latitude=45.750"));
  assert.deepEqual(await geocode("a", fake), []);
  await assert.rejects(() => fetchForecast(1, 1, 7, async () => ({ ok: false })), /indisponible/);
});
