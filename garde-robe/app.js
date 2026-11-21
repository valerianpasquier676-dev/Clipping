import { h, $, clear, toast } from "./dom.js";
import * as store from "./store.js";
import { BRAND_PRESETS } from "./data.js";
import { fetchForecast } from "./weather.js";
import { renderWeek } from "./ui/week.js";
import { renderCloset } from "./ui/closet.js";
import { renderMe } from "./ui/me.js";
import { renderScent } from "./ui/scent.js";
import { openItemForm } from "./ui/item-form.js";
import { buildPlan, staleDays, weatherFor } from "./ui/plan.js";

const state = {
  items: [], profile: {}, perfumes: [], brands: [], plan: null, settings: { autoLaundry: true },
  weather: { place: null, days: [], manual: {}, fetchedAt: null },
  view: "week", ui: { day: 0, sim: "3d", filter: { group: "", q: "", brand: "", dirty: false, fav: false, never: false, sort: "recent" } },
};
const timers = {};

export const app = {
  state,
  save(key) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(async () => { if (!(await store.set(key, state[key]))) toast("Enregistrement impossible (stockage plein ou bloqué) : fais une sauvegarde."); }, 120);
  },
  // Les photos sont stockées à part pour ne pas réécrire des mégaoctets à chaque modification.
  persistItems(photoIds = []) {
    const light = state.items.map(({ photo, ...rest }) => ({ ...rest, hasPhoto: !!photo }));
    clearTimeout(timers.items);
    timers.items = setTimeout(async () => {
      await store.set("items", light);
      for (const id of photoIds) { const it = state.items.find((i) => i.id === id); if (it?.photo) await store.set("photo:" + id, it.photo); else await store.del("photo:" + id); }
    }, 120);
  },
  go(view) { state.view = view; if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view); render(); },
  refresh: () => render(),
  openItemForm: (item, opts) => openItemForm(app, item, opts),
  async refreshWeather({ silent = false } = {}) {
    const p = state.profile.city;
    if (!p) return false;
    try {
      const days = await fetchForecast(p.lat, p.lon, 7);
      state.weather = { ...state.weather, place: p, days, fetchedAt: Date.now() };
      app.save("weather");
      const plan = state.plan;
      if (plan && !plan.weatherKnown?.some(Boolean) && !plan.days.some((d) => d.worn)) buildPlan(app);
      if (!silent) toast("Météo mise à jour.");
      render();
      return true;
    } catch (e) {
      if (!silent) toast("Météo indisponible : tu peux la saisir à la main pour chaque jour.");
      return false;
    }
  },
};

const NAV = [["week", "Semaine", "🗓️"], ["closet", "Garde-robe", "👕"], ["me", "Moi", "🧍"], ["scent", "Parfums", "🧴"]];
const VIEWS = { week: renderWeek, closet: renderCloset, me: renderMe, scent: renderScent };

function renderNav() {
  const mk = (cls) => NAV.map(([k, label, emoji]) =>
    h("button", { class: cls + (state.view === k ? " on" : ""), type: "button", "aria-current": state.view === k ? "page" : null, onclick: () => app.go(k) }, h("span", { class: "ic" }, emoji), h("span", {}, label)));
  $("#nav").replaceChildren(...mk("tab"));
  $("#bottomnav").replaceChildren(...mk("btab"));
}

function render() {
  renderNav();
  const root = $("#view");
  clear(root);
  try { VIEWS[state.view](app, root); }
  catch (e) { console.error(e); root.append(h("div", { class: "card" }, h("h2", {}, "Une erreur est survenue"), h("p", { class: "muted" }, String(e.message || e)))); }
  window.scrollTo?.(0, 0);
}
let firstRender = true;
const _render = render;
// on ne remonte en haut de page que lors d'un changement d'onglet
function renderKeepScroll() { const y = window.scrollY; _render(); window.scrollTo(0, y); }
app.refresh = renderKeepScroll;

async function boot() {
  const [items, profile, perfumes, brands, plan, weather, settings] = await Promise.all(
    ["items", "profile", "perfumes", "brands", "plan", "weather", "settings"].map((k) => store.get(k, null)));
  state.items = items || [];
  await Promise.all(state.items.map(async (it) => { if (it.hasPhoto) it.photo = await store.get("photo:" + it.id, null); delete it.hasPhoto; }));
  state.profile = profile || { coldSensitivity: 0, workStyle: "smart", workDays: [1, 2, 3, 4, 5] };
  state.perfumes = perfumes || [];
  state.brands = brands || BRAND_PRESETS.map((b) => ({ ...b }));
  state.plan = plan || null;
  state.weather = weather || state.weather;
  state.settings = { ...state.settings, ...(settings || {}) };
  const hv = location.hash.slice(1);
  if (VIEWS[hv]) state.view = hv;
  render();
  app.refreshWeather({ silent: true });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
}
window.addEventListener("hashchange", () => { const hv = location.hash.slice(1); if (VIEWS[hv] && hv !== state.view) { state.view = hv; render(); } });
boot();
