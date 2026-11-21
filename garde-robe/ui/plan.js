// Planning persistant de la semaine : on stocke les identifiants de pièces par jour, le reste se recalcule.
import { planWeek, evaluateDay, replanDay, generateDay, candidateThemes, feelTemp, addDays, isoDate } from "../engine.js";
import { ACCESSORY_SLOTS, CORE_SLOTS } from "../data.js";

const ALL = [...CORE_SLOTS, ...ACCESSORY_SLOTS];

export const today = () => isoDate(new Date());
export const weatherFor = (app, date) => app.state.weather.manual?.[date] || app.state.weather.days?.find((d) => d.date === date) || null;

const idsOf = (outfit) => Object.fromEntries(Object.entries(outfit).filter(([, v]) => v).map(([k, v]) => [k, v.id]));
export function outfitOf(app, day) {
  const by = new Map(app.state.items.map((i) => [i.id, i]));
  const o = {};
  for (const [slot, id] of Object.entries(day.ids)) { const it = by.get(id); if (it) o[slot] = it; }
  return o;
}
const toDay = (d, extra = {}) => ({
  date: d.date, theme: d.theme, context: d.context, ids: idsOf(d.outfit), weather: d.weather, score: d.score, reasons: d.reasons,
  tips: d.tips, missing: d.missing, warmth: d.warmth, feel: d.feel, sig: d.sig, worn: false, ...extra,
});
const randomSeed = () => 1 + Math.floor(Math.random() * 90000);

export function buildPlan(app, { seed = randomSeed(), keep = [] } = {}) {
  const startDate = today();
  const weather = Array.from({ length: 7 }, (_, i) => weatherFor(app, addDays(startDate, i)) || undefined);
  const forced = {}, themeLocks = {}, contexts = {};
  for (const d of keep) {
    forced[d.date] = Object.fromEntries(ALL.map((s) => [s, d.ids[s] ?? null]));
    themeLocks[d.date] = d.theme; contexts[d.date] = d.context;
  }
  const res = planWeek({ items: app.state.items, profile: app.state.profile, weather, startDate, seed, forced, themeLocks, contexts });
  const days = res.days.map((d) => { const k = keep.find((x) => x.date === d.date); return toDay(d, k ? { worn: k.worn, wornSnapshot: k.wornSnapshot, themeLocked: k.themeLocked } : {}); });
  app.state.plan = { startDate, seed, days, weatherKnown: weather.map(Boolean) };
  app.save("plan");
  return app.state.plan;
}

export function ensurePlan(app) {
  const { plan, items } = app.state;
  if (!items.length) { app.state.plan = null; return null; }
  const t = today();
  if (!plan) return buildPlan(app);
  if (plan.startDate !== t) return buildPlan(app, { keep: plan.days.filter((d) => d.date >= t) });
  return plan;
}

export function reeval(app, day) {
  const w = weatherFor(app, day.date) || day.weather;
  const r = evaluateDay({ items: app.state.items, profile: app.state.profile, date: day.date, weather: w, theme: day.theme, context: day.context, outfit: outfitOf(app, day) });
  Object.assign(day, { weather: w, score: r.score, reasons: r.reasons, tips: r.tips, missing: r.missing, warmth: r.warmth, feel: r.feel, sig: r.sig });
}

export function changeSlot(app, idx, slot, id) {
  const day = app.state.plan.days[idx];
  if (id) day.ids[slot] = id; else delete day.ids[slot];
  if (id && slot === "dress") { delete day.ids.top; delete day.ids.bottom; }
  if (id && (slot === "top" || slot === "bottom")) delete day.ids.dress;
  reeval(app, day);
  app.save("plan");
}

export function varyDay(app, idx, { theme } = {}) {
  const plan = app.state.plan, day = plan.days[idx];
  const engineDays = plan.days.map((d) => ({ ...d, outfit: outfitOf(app, d) }));
  const res = replanDay({ plan: engineDays, index: idx, items: app.state.items, profile: app.state.profile, seed: randomSeed(), theme: theme || day.theme });
  plan.days[idx] = toDay(res, { themeLocked: day.themeLocked });
  app.save("plan");
}

export function setTheme(app, idx, key) {
  const plan = app.state.plan, day = plan.days[idx];
  if (key) { day.themeLocked = true; varyDay(app, idx, { theme: key }); return; }
  // Auto : on laisse l'algorithme choisir le thème le mieux servi par la garde-robe, différent des autres jours.
  const used = new Map();
  plan.days.forEach((d, i) => { if (i !== idx) used.set(d.theme, (used.get(d.theme) || 0) + 1); });
  const t = feelTemp(day.weather, app.state.profile);
  let best = null, bestScore = -Infinity;
  for (const th of candidateThemes(day.context, t, app.state.profile)) {
    const probe = generateDay({ items: app.state.items, profile: app.state.profile, date: day.date, weather: day.weather, context: day.context, theme: th.key, seed: randomSeed(), samples: 40 });
    const s = probe.score - (used.get(th.key) || 0) * 3.5;
    if (s > bestScore) { bestScore = s; best = th.key; }
  }
  day.themeLocked = false;
  varyDay(app, idx, { theme: best });
}

export function markWorn(app, idx) {
  const day = app.state.plan.days[idx];
  const items = outfitOf(app, day);
  if (!day.worn) {
    day.wornSnapshot = {};
    for (const it of Object.values(items)) {
      day.wornSnapshot[it.id] = { lastWorn: it.lastWorn || null, wornCount: it.wornCount || 0, dirty: !!it.dirty };
      it.lastWorn = day.date; it.wornCount = (it.wornCount || 0) + 1;
      if (["socks", "underwear"].includes(it.slot || slotKey(it)) && app.state.settings?.autoLaundry !== false) it.dirty = true;
    }
    day.worn = true;
  } else {
    for (const it of Object.values(items)) {
      const s = day.wornSnapshot?.[it.id];
      if (s) { it.lastWorn = s.lastWorn || undefined; it.wornCount = s.wornCount; it.dirty = s.dirty; }
    }
    day.worn = false; day.wornSnapshot = null;
  }
  app.persistItems();
  app.save("plan");
}
import { CAT } from "../data.js";
const slotKey = (it) => CAT[it.category]?.slot;

// Jours dont la météo a nettement changé depuis la génération (et non portés).
export function staleDays(app) {
  const plan = app.state.plan;
  if (!plan) return [];
  return plan.days.map((d, i) => {
    const w = weatherFor(app, d.date);
    if (!w || d.worn) return -1;
    const a = feelTemp(w, app.state.profile), b = d.feel ?? a;
    const rain = (x) => (x.rainProb ?? 0) >= 45;
    return Math.abs(a - b) >= 3 || rain(w) !== rain(d.weather || {}) ? i : -1;
  }).filter((i) => i >= 0);
}
