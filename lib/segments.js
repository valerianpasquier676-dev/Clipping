// Choix des meilleurs passages d'une vidéo à partir de deux signaux :
//  - l'énergie audio par seconde (cris, explosions, musique, réactions)
//  - la courbe « moments les plus revus » de YouTube quand elle existe

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

/**
 * Retourne jusqu'à `maxClips` fenêtres de `clipLength` secondes, sans
 * chevauchement, triées dans l'ordre chronologique.
 */
export function pickSegments({ duration, energy = [], heatmap = null, clipLength, maxClips }) {
  const total = Math.floor(duration);
  if (total <= 0) return [];
  const len = Math.min(clipLength, total);
  if (total <= len + 2) return [{ start: 0, end: duration, score: 1 }];

  const e = normalize(energy);
  const h = heatmap ? normalize(heatmapPerSecond(heatmap, duration)) : null;
  const score = new Array(total).fill(0).map((_, s) => {
    const ev = e[s] ?? 0;
    return h ? 0.6 * (h[s] ?? 0) + 0.4 * ev : ev;
  });

  const hasSignal = score.some((v) => v > 0);
  const count = Math.max(1, Math.min(maxClips, Math.floor(total / len)));

  if (!hasSignal) {
    // Aucun signal exploitable : on répartit les clips régulièrement.
    const step = total / count;
    return Array.from({ length: count }, (_, i) => {
      const start = Math.min(total - len, Math.floor(i * step + (step - len) / 2));
      return { start: Math.max(0, start), end: Math.max(0, start) + len, score: 0 };
    });
  }

  // Score moyen de chaque fenêtre via une somme glissante.
  const prefix = [0];
  for (const v of score) prefix.push(prefix[prefix.length - 1] + v);
  const windows = [];
  for (let s = 0; s + len <= total; s++) {
    windows.push({ start: s, score: (prefix[s + len] - prefix[s]) / len });
  }
  windows.sort((a, b) => b.score - a.score);

  const picked = [];
  const gap = 2; // secondes minimum entre deux clips
  for (const w of windows) {
    if (picked.length >= count) break;
    if (picked.every((p) => w.start >= p.start + len + gap || w.start + len + gap <= p.start)) {
      picked.push(w);
    }
  }

  return picked
    .map((p) => {
      // On cale le début sur le creux sonore le plus proche pour éviter de couper une phrase.
      let start = p.start;
      let best = Infinity;
      for (let s = Math.max(0, p.start - 2); s <= Math.min(total - len, p.start + 2); s++) {
        const free = picked.every((o) => o === p || s >= o.start + len || s + len <= o.start);
        if (free && (e[s] ?? 0) < best) {
          best = e[s] ?? 0;
          start = s;
        }
      }
      return { start, end: start + len, score: Number(p.score.toFixed(3)) };
    })
    .sort((a, b) => a.start - b.start);
}
