import test from "node:test";
import assert from "node:assert/strict";
import { pickSegments, refineSegments, describeSegment } from "../lib/segments.js";
import { localTitles } from "../lib/titles.js";
import { parseVtt, wrapHook } from "../lib/pipeline.js";

test("choisit les passages les plus forts, sans chevauchement", () => {
  const energy = Array.from({ length: 150 }, (_, t) => (t >= 40 && t < 70 ? 1 : t >= 110 && t < 135 ? 0.7 : 0.05));
  const segs = pickSegments({ duration: 150, energy, clipLength: 30, maxClips: 2 });
  assert.equal(segs.length, 2);
  assert.ok(Math.abs(segs[0].start - 40) <= 3 && Math.abs(segs[1].start - 108) <= 5, JSON.stringify(segs));
  assert.ok(segs[0].end <= segs[1].start);
});

test("la heatmap YouTube l'emporte sur le son", () => {
  const energy = new Array(200).fill(0.1);
  const heatmap = [{ start_time: 0, end_time: 150, value: 0.1 }, { start_time: 150, end_time: 180, value: 1 }];
  const [seg] = pickSegments({ duration: 200, energy, heatmap, clipLength: 30, maxClips: 1 });
  assert.ok(Math.abs(seg.start - 150) <= 2, JSON.stringify(seg));
});

test("sans signal, répartit les clips ; vidéo courte = un seul clip", () => {
  const segs = pickSegments({ duration: 100, energy: [], clipLength: 20, maxClips: 3 });
  assert.equal(segs.length, 3);
  assert.deepEqual(pickSegments({ duration: 12, energy: [], clipLength: 30, maxClips: 5 }), [{ start: 0, end: 12, score: 1 }]);
});

test("recale les coupes sur les phrases, sinon sur les changements de plan", () => {
  const cues = [
    { start: 8.2, end: 11, text: "Bon." },
    { start: 11.4, end: 20, text: "Regardez la carte" },
    { start: 20, end: 38.6, text: "elle est immense." },
    { start: 39.5, end: 45, text: "Ensuite la police." },
  ];
  const [a] = refineSegments([{ start: 10, end: 40, score: 1 }], { cues, cuts: [], energy: [], duration: 100 });
  assert.ok(Math.abs(a.start - 11.25) < 0.01 && Math.abs(a.end - 38.85) < 0.01, JSON.stringify(a));
  const [b] = refineSegments([{ start: 50, end: 80, score: 1 }], { cues: [], cuts: [48.5, 81.25], energy: [], duration: 100 });
  assert.deepEqual([b.start, b.end], [48.5, 81.25]);
});

test("décrit la situation d'un passage", () => {
  const energy = Array.from({ length: 60 }, (_, t) => (t >= 20 && t < 30 ? 1 : 0.1));
  assert.equal(describeSegment({ start: 0, end: 30 }, { energy, cuts: [] }).buildUp, true);
  assert.equal(describeSegment({ start: 30, end: 60 }, { energy, cuts: [31, 33, 35, 38, 41, 44, 47, 50, 55] }).action, true);
  assert.equal(describeSegment({ start: 30, end: 60 }, { energy, cuts: [] }).calm, true);
});

test("les titres suivent le contenu de chaque clip et ne se répètent pas", () => {
  const info = { title: "GTA VI Trailer 2 - analyse", channel: "Chaîne" };
  const out = localTitles(info, [
    { start: 0, end: 30, chapter: "La carte", transcript: "La carte est gigantesque ! On voit toute la map.", features: { calm: true } },
    { start: 40, end: 70, transcript: "la police arrive et la poursuite commence", features: { action: true } },
    { start: 80, end: 110, features: { buildUp: true } },
    { start: 120, end: 150, features: { buildUp: true } },
  ]);
  assert.equal(out[0].titles[0], "GTA 6 : La carte");
  assert.equal(out[0].titles[1], "« La carte est gigantesque ! »");
  assert.ok(out[0].hashtags.includes("#map") && out[0].caption.includes("Crédit : Chaîne"));
  assert.ok(/police|poursuite/i.test(out[1].titles[0]) && out[1].hashtags.includes("#police"), out[1].titles[0]);
  assert.ok(/fin/i.test(out[2].titles[0]));
  assert.ok(out.every((o) => o.titles.every((t) => typeof t === "string")));
  const all = out.flatMap((o) => o.titles);
  assert.equal(all.length, 12);
  assert.equal(new Set(all).size, 12);
});

test("sous-titres et texte incrusté", () => {
  const cues = parseVtt("WEBVTT\n\n00:00:01.000 --> 00:00:03.000 align:start\n<c>Salut</c>\n\n00:00:03.000 --> 00:00:05.000\nSalut\nà tous");
  assert.deepEqual(cues, [{ start: 1, end: 3, text: "Salut" }, { start: 3, end: 5, text: "à tous" }]);
  assert.equal(wrapHook("Ce détail de GTA 6 change TOUT 😳"), "Ce détail de GTA 6\nchange TOUT");
});
