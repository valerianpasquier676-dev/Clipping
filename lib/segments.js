// Choix des meilleurs passages d'une vidéo à partir de trois signaux :
//  - la courbe « moments les plus revus » de YouTube quand elle existe
//  - l'énergie audio par seconde (réactions, explosions, musique)
//  - le rythme du montage (changements de plan = action)
// puis recalage des coupes sur les phrases ou les changements de plan.

/** Ramène un tableau de valeurs entre 0 et 1 (bornes = 5e et 95e centiles). */
export function normalize(values) {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.05)];
  const hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  if (hi - lo < 1e-9) return values.map(() => 0);
  return values.map((v) => Math.min(1, Math.max(0, (v - lo) / (hi - lo))));
}

/** Convertit la heatmap yt-dlp ([{start_time,end_time,value}]) en une valeur par seconde. */
export function heatmapPerSecond(heatmap, duration) {
  const out = new Array(Math.ceil(duration)).fill(0);
  for (const h of heatmap || []) {
    const a = Math.max(0, Math.floor(h.start_time));
    const b = Math.min(out.length, Math.ceil(h.end_time));
    for (let s = a; s < b; s++) out[s] = Math.max(out[s], h.value || 0);
  }
  return out;
}

/** Densité de changements de plan autour de chaque seconde (fenêtre de 10 s). */
export function cutDensity(cuts, duration) {
  const total = Math.ceil(duration);
  const perSec = new Array(total).fill(0);
  for (const c of cuts) if (c >= 0 && c < total) perSec[Math.floor(c)]++;
  return perSec.map((_, s) => {
    let n = 0;
    for (let k = Math.max(0, s - 5); k < Math.min(total, s + 5); k++) n += perSec[k];
    return n;
  });
}

/**
 * Retourne jusqu'à `maxClips` fenêtres de `clipLength` secondes, sans
 * chevauchement, triées dans l'ordre chronologique.
 */
export function pickSegments({ duration, energy = [], heatmap = null, cuts = [], clipLength, maxClips }) {
  const total = Math.floor(duration);
  if (total <= 0) return [];
  const len = Math.min(clipLength, total);
  if (total <= len + 2) return [{ start: 0, end: duration, score: 1 }];

  const e = normalize(energy);
  const a = normalize(cutDensity(cuts, duration));
  const h = heatmap?.length ? normalize(heatmapPerSecond(heatmap, duration)) : null;
  const score = new Array(total).fill(0).map((_, s) => {
    const ev = e[s] ?? 0;
    const av = a[s] ?? 0;
    return h ? 0.5 * (h[s] ?? 0) + 0.3 * ev + 0.2 * av : 0.65 * ev + 0.35 * av;
  });

  const hasSignal = score.some((v) => v > 0);
  const count = Math.max(1, Math.min(maxClips, Math.floor(total / len)));

  if (!hasSignal) {
    // Aucun signal exploitable : on répartit les clips régulièrement.
    const step = total / count;
    return Array.from({ length: count }, (_, i) => {
      const start = Math.max(0, Math.min(total - len, Math.floor(i * step + (step - len) / 2)));
      return { start, end: start + len, score: 0 };
    });
  }

  // Score moyen de chaque fenêtre via une somme glissante.
  const prefix = [0];
  for (const v of score) prefix.push(prefix[prefix.length - 1] + v);
  const windows = [];
  for (let s = 0; s + len <= total; s++) {
    windows.push({ start: s, score: (prefix[s + len] - prefix[s]) / len });
  }
  windows.sort((x, y) => y.score - x.score);

  const picked = [];
  const gap = 4; // marge entre deux clips, qui laisse la place au recalage des coupes
  for (const w of windows) {
    if (picked.length >= count) break;
    if (picked.every((p) => w.start >= p.start + len + gap || w.start + len + gap <= p.start)) {
      picked.push(w);
    }
  }
  return picked
    .map((p) => ({ start: p.start, end: p.start + len, score: Number(p.score.toFixed(3)) }))
    .sort((x, y) => x.start - y.start);
}

const nearest = (points, target, lo, hi) => {
  let best = null;
  for (const p of points) {
    if (p < lo || p > hi) continue;
    if (best === null || Math.abs(p - target) < Math.abs(best - target)) best = p;
  }
  return best;
};

/**
 * Recale le début et la fin de chaque clip pour ne couper ni une phrase ni un plan :
 * début/fin de phrase si la vidéo a des sous-titres, sinon changement de plan,
 * sinon creux sonore.
 */
export function refineSegments(segments, { cues = [], cuts = [], energy = [], duration }) {
  const e = normalize(energy);
  // Débuts de phrase : une réplique qui suit une ponctuation forte ou un silence.
  const sentenceStarts = [];
  const sentenceEnds = [];
  cues.forEach((c, i) => {
    const prev = cues[i - 1];
    if (!prev || /[.!?…]["»]?$/.test(prev.text) || c.start - prev.end > 0.7) sentenceStarts.push(c.start);
    const next = cues[i + 1];
    if (!next || /[.!?…]["»]?$/.test(c.text) || next.start - c.end > 0.7) sentenceEnds.push(c.end);
  });

  const quietest = (around) => {
    let best = around;
    let min = Infinity;
    for (let s = Math.max(0, Math.round(around) - 2); s <= Math.min(e.length - 1, Math.round(around) + 2); s++) {
      if (e[s] < min) {
        min = e[s];
        best = s;
      }
    }
    return best;
  };

  return segments.map((seg, i) => {
    const floor = i > 0 ? segments[i - 1].end + 3.5 : 0;
    const ceil = i < segments.length - 1 ? segments[i + 1].start - 3.5 : duration;
    const inSpeech = cues.some((c) => c.start < seg.end && c.end > seg.start);

    let start =
      (inSpeech ? nearest(sentenceStarts, seg.start, seg.start - 3, seg.start + 2) : null) ??
      nearest(cuts, seg.start, seg.start - 2.5, seg.start + 2) ??
      (e.length ? quietest(seg.start) : seg.start);
    let end =
      (inSpeech ? nearest(sentenceEnds, seg.end, seg.end - 3, seg.end + 3) : null) ??
      nearest(cuts, seg.end, seg.end - 2.5, seg.end + 2.5) ??
      seg.end;

    if (inSpeech && start === nearest(sentenceStarts, seg.start, seg.start - 3, seg.start + 2)) start -= 0.15;
    if (inSpeech && end === nearest(sentenceEnds, seg.end, seg.end - 3, seg.end + 3)) end += 0.25;
    start = Math.max(0, floor, start);
    end = Math.min(duration, ceil, end);
    if (end - start < 5) return seg;
    return { ...seg, start: Number(start.toFixed(2)), end: Number(end.toFixed(2)) };
  });
}

/** Décrit ce qui se passe dans un clip, pour adapter le texte à la situation. */
export function describeSegment(seg, { energy = [], cuts = [] }) {
  const e = normalize(energy);
  const slice = e.slice(Math.floor(seg.start), Math.ceil(seg.end));
  const mean = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0);
  const third = Math.max(1, Math.floor(slice.length / 3));
  const loudness = mean(slice);
  const lastThird = mean(slice.slice(-third));
  const firstPart = mean(slice.slice(0, slice.length - third));
  const cutCount = cuts.filter((c) => c > seg.start && c < seg.end).length;
  const cutsPerMinute = (cutCount / Math.max(1, seg.end - seg.start)) * 60;
  return {
    loudness: Number(loudness.toFixed(2)),
    cutsPerMinute: Math.round(cutsPerMinute),
    action: cutsPerMinute >= 14,
    buildUp: slice.length >= 6 && lastThird > firstPart + 0.25,
    intense: loudness >= 0.6,
    calm: loudness <= 0.2 && cutsPerMinute < 8,
  };
}
