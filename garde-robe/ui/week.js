import { h, $, clear, toast, option } from "../dom.js";
import { THEMES, THEME, CONTEXTS, SLOT_ORDER, SLOT_LABEL, CAT, SHAPES, PERF_FAMILY } from "../data.js";
import { gapAnalysis, laundryReport } from "../engine.js";
import { accessoryAdvice, recommendPerfumes, mannequinFromProfile } from "../morph.js";
import { describeWeather, geocode } from "../weather.js";
import { Mannequin, webglAvailable } from "../mannequin3d.js";
import { ensurePlan, buildPlan, outfitOf, changeSlot, varyDay, setTheme, markWorn, reeval, staleDays, weatherFor, today } from "./plan.js";
import { visual, board, openDialog, fmtDay, cap, catLabel, colorLabel, themeLabel, field } from "./common.js";

const OPTIONAL = ["hat", "glasses", "scarf", "gloves", "belt", "watch", "necklace", "bracelet", "ring", "earrings", "bag", "mid", "outer"];

export function renderWeek(app, root) {
  const { state } = app;
  if (!state.items.length) return root.append(emptyState(app));
  const plan = ensurePlan(app);
  const idx = Math.min(state.ui.day || 0, plan.days.length - 1);
  state.ui.day = idx;
  const day = plan.days[idx];
  reeval(app, day);
  const outfit = outfitOf(app, day);

  root.append(
    header(app, plan),
    staleBanner(app),
    strip(app, plan, idx),
    h("div", { class: "day-grid" },
      dayHead(app, day, idx), simCard(app, day, outfit),
      h("div", { class: "g-main" }, outfitCard(app, day, idx, outfit), reasonsCard(day), adviceCards(app, day, outfit))),
    laundryAndGaps(app, plan),
  );
}

/* ---------- Écran vide ---------- */

function emptyState(app) {
  return h("div", { class: "card hero" },
    h("h1", {}, "Bienvenue dans ta garde-robe"),
    h("p", {}, "Ajoute tes vêtements (en les scannant avec l'appareil photo ou en choisissant une photo) et l'algorithme prépare chaque jour de la semaine des tenues adaptées à la météo, à ta morphologie et à ton style, sans jamais répéter les mêmes."),
    h("div", { class: "row wrap gap" },
      h("button", { class: "btn primary", onclick: () => app.openItemForm() }, "📷 Scanner mon premier vêtement"),
      h("button", { class: "btn", onclick: async () => { const { sampleItems, samplePerfumes } = await import("./sample.js"); app.state.items = sampleItems(); app.state.perfumes = app.state.perfumes.length ? app.state.perfumes : samplePerfumes(); app.persistItems(); app.save("perfumes"); app.state.plan = null; app.refresh(); } }, "Essayer avec une garde-robe d'exemple"),
      h("button", { class: "btn", onclick: () => app.go("me") }, "Renseigner mes mesures")),
    h("ol", { class: "steps" },
      h("li", {}, h("b", {}, "1. Scanne"), " tes pièces : le fond est retiré, les couleurs sont détectées."),
      h("li", {}, h("b", {}, "2. Dis qui tu es"), " : mesures, ville, style (onglet Moi)."),
      h("li", {}, h("b", {}, "3. Laisse faire"), " : thèmes, météo, accessoires, parfum, tout est calculé.")));
}

/* ---------- En-tête, météo, bandeau ---------- */

function header(app, plan) {
  const place = app.state.profile.city;
  return h("div", { class: "week-head" },
    h("div", {},
      h("h1", {}, "Ma semaine"),
      h("p", { class: "muted" }, `Du ${fmtDay(plan.days[0].date, { day: "numeric", month: "long" })} au ${fmtDay(plan.days.at(-1).date, { day: "numeric", month: "long" })}`)),
    h("div", { class: "row wrap gap" },
      h("button", { class: "btn", type: "button", onclick: () => placeDialog(app) }, place ? `📍 ${place.name}` : "📍 Ajouter ma ville"),
      place ? h("button", { class: "btn ghost icon", type: "button", title: "Actualiser la météo", "aria-label": "Actualiser la météo", onclick: () => app.refreshWeather() }, "↻") : null,
      h("button", { class: "btn", type: "button", onclick: () => overview(app) }, "Vue d'ensemble"),
      h("button", { class: "btn primary", type: "button", onclick: () => { if (app.state.plan.days.some((d) => d.worn) && !confirm("Certains jours sont marqués comme portés. Tout régénérer quand même ?")) return; buildPlan(app, { keep: app.state.plan.days.filter((d) => d.worn) }); app.refresh(); toast("Nouvelle semaine proposée."); } }, "🔀 Régénérer la semaine")));
}

function staleBanner(app) {
  const stale = staleDays(app);
  if (!stale.length) return h("span");
  return h("div", { class: "banner" },
    h("span", {}, `La météo a changé pour ${stale.length} jour${stale.length > 1 ? "s" : ""} : les tenues ne sont plus adaptées.`),
    h("button", { class: "btn primary small", type: "button", onclick: () => { stale.forEach((i) => varyDay(app, i)); app.refresh(); } }, "Mettre à jour"));
}

function strip(app, plan, idx) {
  return h("div", { class: "strip", role: "tablist" }, plan.days.map((d, i) => {
    const w = d.weather, desc = describeWeather(w);
    return h("button", { class: "daybtn" + (i === idx ? " on" : "") + (d.worn ? " worn" : ""), role: "tab", "aria-selected": String(i === idx), type: "button", onclick: () => { app.state.ui.day = i; app.refresh(); } },
      h("span", { class: "dw" }, fmtDay(d.date, { weekday: "short" }), i === 0 ? " · auj." : ""),
      h("span", { class: "dn" }, fmtDay(d.date, { day: "numeric" })),
      h("span", { class: "we", title: desc.label }, desc.emoji),
      h("span", { class: "tp" }, `${Math.round(w.tempMax)}° `, h("small", {}, `${Math.round(w.tempMin)}°`)),
      h("span", { class: "th", title: THEME[d.theme]?.label }, THEME[d.theme]?.emoji, d.worn ? " ✓" : ""));
  }));
}

/* ---------- Jour : thème, contexte, météo ---------- */

function dayHead(app, day, idx) {
  const w = day.weather, desc = describeWeather(w);
  const themeSel = h("select", { "aria-label": "Thème", onchange: (e) => { setTheme(app, idx, e.target.value || null); app.refresh(); } },
    h("option", { value: "", selected: !day.themeLocked }, "✨ Thème automatique"),
    THEMES.map((t) => h("option", { value: t.key, selected: day.themeLocked && day.theme === t.key }, `${t.emoji} ${t.label}`)));
  const ctxSel = h("select", { "aria-label": "Contexte", onchange: (e) => { day.context = e.target.value; day.themeLocked = false; setTheme(app, idx, null); app.refresh(); } },
    Object.entries(CONTEXTS).map(([k, l]) => h("option", { value: k, selected: k === day.context }, l)));
  return h("div", { class: "card day-head g-head" },
    h("div", { class: "row between wrap gap" },
      h("div", {}, h("h2", {}, cap(fmtDay(day.date))), h("p", { class: "theme-line" }, themeLabel(day.theme), " ", h("span", { class: "muted" }, THEME[day.theme]?.desc))),
      h("span", {})),
    h("div", { class: "wx" },
      h("div", { class: "wx-main" }, h("span", { class: "wx-ic" }, desc.emoji), h("div", {}, h("b", {}, `${Math.round(w.tempMax)}° / ${Math.round(w.tempMin)}°`), h("div", { class: "muted" }, desc.label, w.unknown ? " (météo non renseignée)" : ""))),
      h("div", { class: "wx-facts" },
        fact("🌡️", "Ressenti", `${Math.round(day.feel)}°`),
        fact("🌧️", "Pluie", `${Math.round(w.rainProb ?? 0)} %`),
        fact("💨", "Vent", `${Math.round(w.wind ?? 0)} km/h`),
        fact("🕶️", "UV", `${Math.round(w.uv ?? 0)}`)),
      h("button", { class: "btn small ghost", type: "button", onclick: () => weatherDialog(app, day, idx) }, "✎ Météo")),
    h("div", { class: "row gap wrap" },
      h("button", { class: "btn", type: "button", onclick: () => { if (day.worn && !confirm("Cette tenue est marquée comme portée. La remplacer ?")) return; varyDay(app, idx); app.refresh(); } }, "🔀 Varier cette tenue"),
      h("button", { class: "btn " + (day.worn ? "" : "primary"), type: "button", onclick: () => { markWorn(app, idx); app.refresh(); toast(day.worn ? "Tenue marquée comme portée (chaussettes et sous-vêtements au sale)." : "Marquage annulé."); } }, day.worn ? "↩︎ Annuler « porté »" : "✓ Je la porte")),
    h("details", { class: "adjust" }, h("summary", {}, "Changer le thème ou le contexte"), h("div", { class: "row gap wrap" }, h("label", { class: "inline" }, "Contexte", ctxSel), h("label", { class: "inline" }, "Thème", themeSel))));
}
const fact = (ic, label, v) => h("div", { class: "fact", title: label }, h("span", {}, ic), h("b", {}, v), h("small", {}, label));

/* ---------- Simulation ---------- */

function simCard(app, day, outfit) {
  const can3d = webglAvailable();
  const mode = can3d ? app.state.ui.sim || "3d" : "board";
  const box = h("div", { class: "sim-box" });
  const seg = h("div", { class: "seg", role: "tablist" },
    can3d ? h("button", { class: mode === "3d" ? "on" : "", type: "button", onclick: () => { app.state.ui.sim = "3d"; app.refresh(); } }, "Mannequin 3D") : null,
    h("button", { class: mode === "board" ? "on" : "", type: "button", onclick: () => { app.state.ui.sim = "board"; app.refresh(); } }, "Planche photos"));
  const card = h("div", { class: "card sim g-sim" }, h("div", { class: "row between" }, h("h3", {}, "Simulation de la tenue"), seg), box,
    h("p", { class: "muted small-note" }, mode === "3d" ? "Fais glisser pour tourner autour du mannequin, molette pour zoomer, double-clic pour recentrer. Les proportions viennent de tes mesures." : "Tes vraies pièces, posées à plat."));
  if (mode === "3d") {
    const m = new Mannequin(box, { autoRotate: true });
    m.setBody(mannequinFromProfile(app.state.profile));
    m.setOutfit(outfit);
    box.classList.add("is3d");
  } else box.append(board(outfit));
  return card;
}

/* ---------- Tenue ---------- */

function outfitCard(app, day, idx, outfit) {
  const rows = SLOT_ORDER.filter((s) => outfit[s]).map((slot) => {
    const it = outfit[slot];
    const optional = OPTIONAL.includes(slot);
    return h("li", { class: "orow" },
      h("div", { class: "othumb" }, visual(it, "vis")),
      h("div", { class: "otext" },
        h("div", { class: "otitle" }, it.name, it.favorite ? " ⭐" : ""),
        h("div", { class: "muted small" }, SLOT_LABEL[slot], it.brand ? ` · ${it.brand}` : "", colorLabel(it) ? ` · ${colorLabel(it)}` : "", it.metal && it.metal !== "cuir" ? ` · ${it.metal}` : "")),
      h("div", { class: "oact" },
        slot !== "underwear" ? h("button", { class: "btn small", type: "button", onclick: () => pickDialog(app, idx, slot) }, "Changer") : null,
        optional ? h("button", { class: "btn small ghost icon", type: "button", title: "Retirer", "aria-label": "Retirer " + it.name, onclick: () => { changeSlot(app, idx, slot, null); app.refresh(); } }, "✕") : null));
  });
  const absent = OPTIONAL.filter((s) => !outfit[s] && app.state.items.some((i) => CAT[i.category]?.slot === s));
  const missing = day.missing || [];
  return h("div", { class: "card" },
    h("div", { class: "row between" }, h("h3", {}, "La tenue"), h("span", { class: "badge", title: "Chaleur de la tenue / chaleur recommandée pour la météo" }, `Chaleur ${day.warmth?.have ?? "?"} / ${day.warmth?.need ?? "?"}`)),
    rows.length ? h("ul", { class: "olist" }, rows) : h("p", { class: "muted" }, "Rien à proposer avec ta garde-robe actuelle."),
    missing.length ? h("ul", { class: "miss" }, missing.map((m) => h("li", {}, "⚠️ ", m))) : null,
    absent.length ? h("div", { class: "add-acc" }, h("span", { class: "muted small" }, "Ajouter : "), absent.map((s) => h("button", { class: "btn small ghost", type: "button", onclick: () => pickDialog(app, idx, s) }, "+ " + SLOT_LABEL[s]))) : null);
}

function pickDialog(app, idx, slot) {
  const day = app.state.plan.days[idx];
  const current = day.ids[slot];
  const cands = app.state.items.filter((i) => CAT[i.category]?.slot === slot);
  const { close } = openDialog({
    title: `Choisir : ${SLOT_LABEL[slot].toLowerCase()}`, wide: true,
    body: h("div", {},
      h("div", { class: "grid-pick" },
        cands.map((it) => h("button", { class: "pick" + (it.id === current ? " on" : "") + (it.dirty ? " dirty" : ""), type: "button", onclick: () => { changeSlot(app, idx, slot, it.id); close(); app.refresh(); } },
          visual(it, "vis"), h("span", { class: "pn" }, it.name), it.dirty ? h("span", { class: "badge warn" }, "au sale") : null))),
      !cands.length ? h("p", { class: "muted" }, "Aucune pièce dans cette catégorie.") : null),
    actions: [OPTIONAL.includes(slot) ? { label: "Aucun", onClick: (c) => { changeSlot(app, idx, slot, null); c(); app.refresh(); } } : null].filter(Boolean),
  });
}

function reasonsCard(day) {
  if (!day.reasons?.length) return h("span");
  return h("div", { class: "card" }, h("h3", {}, "Pourquoi cette tenue"),
    h("ul", { class: "reasons" }, day.reasons.map((r) => h("li", { class: r.ok ? "ok" : "no" }, r.ok ? "✓ " : "• ", r.text))));
}

/* ---------- Conseils : météo, morphologie, accessoires, parfum ---------- */

function adviceCards(app, day, outfit) {
  const { profile, perfumes } = app.state;
  const wrap = h("div", { class: "stack" });
  if (day.tips?.length) wrap.append(h("div", { class: "card tip" }, h("h3", {}, "Météo & conseils pratiques"), h("ul", {}, day.tips.map((t) => h("li", {}, t)))));

  if (profile.shape && SHAPES[profile.shape]) {
    const sh = SHAPES[profile.shape];
    wrap.append(h("div", { class: "card" }, h("div", { class: "row between" }, h("h3", {}, `Morphologie : ${sh.label}`), h("button", { class: "btn small ghost", onclick: () => app.go("me") }, "Mon analyse")),
      h("ul", {}, sh.favor.slice(0, 2).map((t) => h("li", {}, t)), sh.tips.slice(0, 1).map((t) => h("li", {}, t)))));
  } else wrap.append(h("div", { class: "card soft" }, h("b", {}, "Morphologie : "), "renseigne tes mesures pour que les tenues et les conseils s'adaptent à ta silhouette. ", h("button", { class: "btn small", onclick: () => app.go("me") }, "Mes mesures")));

  const adv = accessoryAdvice({ outfit, profile, weather: day.weather, theme: day.theme });
  wrap.append(h("div", { class: "card" }, h("h3", {}, "Accessoires"), h("ul", {}, adv.map((a) => h("li", {}, a.text)))));

  const rec = recommendPerfumes({ perfumes, weather: day.weather, profile, theme: day.theme, context: day.context, date: day.date });
  const best = rec.owned[0];
  wrap.append(h("div", { class: "card" }, h("div", { class: "row between" }, h("h3", {}, "Parfum du jour"), h("button", { class: "btn small ghost", onclick: () => app.go("scent") }, "Mes parfums")),
    best
      ? h("div", {}, h("p", {}, h("b", {}, best.perfume.name), best.perfume.brand ? ` · ${best.perfume.brand}` : "", " ", h("span", { class: "badge" }, PERF_FAMILY[best.perfume.family]?.label || ""), ` — ${best.sprays} vaporisations`),
        rec.owned[1] ? h("p", { class: "muted small" }, `Alternative : ${rec.owned[1].perfume.name}`) : null)
      : h("p", {}, "Tu n'as pas encore ajouté de parfum. Pour ", `${Math.round(rec.t)} °C`, ", oriente-toi vers : ", rec.families.map((f) => f.family.label).join(", "), "."),
    h("ul", {}, rec.advice.map((t) => h("li", {}, t)))));
  return wrap;
}

/* ---------- Linge, manques, vue d'ensemble ---------- */

function laundryAndGaps(app, plan) {
  const { items, profile } = app.state;
  const gaps = gapAnalysis(items, plan.days.map((d) => d.weather), profile, plan.days.map((d) => d.date));
  const laundry = laundryReport(items, plan.days.length);
  const dirty = items.filter((i) => i.dirty).length;
  if (!gaps.length && !laundry.length && !dirty) return h("span");
  return h("div", { class: "card gaps" },
    h("h3", {}, "Linge et manques pour cette semaine"),
    h("ul", {},
      dirty ? h("li", {}, `🧺 ${dirty} pièce${dirty > 1 ? "s" : ""} au sale (non utilisée${dirty > 1 ? "s" : ""} par l'algorithme). `, h("button", { class: "btn small", type: "button", onclick: () => app.go("closet") }, "Voir")) : null,
      laundry.map((t) => h("li", {}, "🧺 ", t)),
      gaps.map((g) => h("li", {}, g.level === "warn" ? "⚠️ " : "💡 ", g.text))));
}

function overview(app) {
  const plan = app.state.plan;
  const grid = h("div", { class: "overview" }, plan.days.map((d, i) => h("button", { class: "ov", type: "button", onclick: () => { app.state.ui.day = i; close(); app.refresh(); } },
    h("div", { class: "ov-h" }, h("b", {}, fmtDay(d.date, { weekday: "short", day: "numeric" })), h("span", {}, THEME[d.theme]?.emoji, " ", describeWeather(d.weather).emoji, ` ${Math.round(d.weather.tempMax)}°`)),
    board(outfitOf(app, d), { compact: true }), h("div", { class: "muted small" }, THEME[d.theme]?.label))));
  const { close } = openDialog({ title: "Ma semaine en un coup d'œil", body: grid, wide: true });
}

/* ---------- Ville et météo manuelle ---------- */

function placeDialog(app) {
  const list = h("ul", { class: "places" });
  const input = h("input", { type: "search", placeholder: "Ville (ex. Lyon)", value: app.state.profile.city?.name || "", autofocus: true });
  const msg = h("p", { class: "muted small" }, "Seul le nom de la ville est envoyé au service météo gratuit Open-Meteo.");
  const search = async () => {
    clear(list);
    try {
      const res = await geocode(input.value);
      if (!res.length) { msg.textContent = "Aucune ville trouvée."; return; }
      msg.textContent = "Choisis ta ville :";
      res.forEach((p) => list.append(h("li", {}, h("button", { class: "btn", type: "button", onclick: async () => {
        app.state.profile.city = { name: p.name, lat: p.lat, lon: p.lon };
        app.save("profile"); close();
        await app.refreshWeather();
        const plan = app.state.plan; if (plan && !plan.days.some((d) => d.worn)) buildPlan(app);
        app.refresh();
      } }, `${p.name}${p.region ? ", " + p.region : ""} (${p.country})`))));
    } catch { msg.textContent = "Recherche indisponible (hors ligne ?). Tu peux saisir la météo à la main jour par jour."; }
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); search(); } });
  const { close } = openDialog({ title: "Ma ville", body: h("div", { class: "stack" }, h("div", { class: "row gap" }, input, h("button", { class: "btn primary", type: "button", onclick: search }, "Chercher")), msg, list),
    actions: app.state.profile.city ? [{ label: "Retirer ma ville", onClick: (c) => { delete app.state.profile.city; app.state.weather = { place: null, days: [], manual: app.state.weather.manual, fetchedAt: null }; app.save("profile"); app.save("weather"); c(); app.refresh(); } }] : [] });
  setTimeout(() => input.focus(), 50);
}

const CONDITIONS = { 0: "Dégagé", 3: "Nuageux", 61: "Pluie", 65: "Pluie forte", 73: "Neige", 95: "Orage" };

function weatherDialog(app, day, idx) {
  const w = day.weather;
  const f = {
    tempMax: h("input", { type: "number", value: Math.round(w.tempMax), step: 1 }), tempMin: h("input", { type: "number", value: Math.round(w.tempMin), step: 1 }),
    rainProb: h("input", { type: "number", value: Math.round(w.rainProb ?? 0), min: 0, max: 100 }), wind: h("input", { type: "number", value: Math.round(w.wind ?? 0), min: 0 }),
    uv: h("input", { type: "number", value: Math.round(w.uv ?? 0), min: 0, max: 12 }),
    code: h("select", {}, Object.entries(CONDITIONS).map(([k, l]) => option(k, l, String(CONDITIONS[w.code] ? w.code : 3)))),
  };
  const { close } = openDialog({
    title: `Météo du ${fmtDay(day.date, { weekday: "long", day: "numeric" })}`,
    body: h("div", { class: "form-grid" }, field("Max (°C)", f.tempMax), field("Min (°C)", f.tempMin), field("Risque de pluie (%)", f.rainProb), field("Vent (km/h)", f.wind), field("Indice UV", f.uv), field("Ciel", f.code)),
    actions: [{ label: "Annuler", onClick: (c) => c() }, { label: "Appliquer et régénérer", kind: "primary", onClick: (c) => {
      const n = (el, d) => (Number.isFinite(Number(el.value)) && el.value !== "" ? Number(el.value) : d);
      const tmax = n(f.tempMax, 18), tmin = Math.min(tmax, n(f.tempMin, 10));
      app.state.weather.manual = { ...(app.state.weather.manual || {}), [day.date]: { date: day.date, tempMax: tmax, tempMin: tmin, feelMax: tmax, feelMin: tmin, rainProb: n(f.rainProb, 0), rainMm: n(f.rainProb, 0) >= 60 ? 3 : 0, wind: n(f.wind, 10), uv: n(f.uv, 3), code: Number(f.code.value) } };
      app.save("weather"); c(); varyDay(app, idx); app.refresh();
    } }],
  });
}
