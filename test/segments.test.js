import test from "node:test";
import assert from "node:assert/strict";
import { pickSegments } from "../lib/segments.js";
import { templateTitles } from "../lib/titles.js";
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

test("titres GTA 6 avec hashtags et crédit", () => {
  const [t] = templateTitles({ title: "GTA VI Trailer 2 - analyse", channel: "Chaîne" }, [{ start: 0, end: 30 }]);
  assert.equal(t.titles.length, 3);
  assert.ok(t.titles.every((x) => x.includes("GTA 6")));
  assert.ok(t.caption.includes("#gta6") && t.caption.includes("Crédit : Chaîne"));
});

test("sous-titres et texte incrusté", () => {
  const cues = parseVtt("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<c>Salut</c>\n\n00:00:03.000 --> 00:00:05.000\nSalut\nà tous");
  assert.deepEqual(cues, [{ start: 1, text: "Salut" }, { start: 3, text: "à tous" }]);
  assert.equal(wrapHook("Ce détail de GTA 6 change TOUT 😳"), "Ce détail de GTA 6\nchange TOUT");
});
