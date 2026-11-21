import {
  CYCLES, STATUSES, CATEGORIES, SAMPLE,
  nextRenewal, toMonthly, toYearly, totals, groupMonthly, upcoming,
  cleanData, cleanSub, cleanCard, newId, toCSV, todayISO, daysBetween, parseDate,
} from "./logic.js";

const KEY = "abonnements:v1";
const $ = (sel) => document.querySelector(sel);
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/* ---------- Données ---------- */

let data = load();
const view = { card: "all", status: "active", sort: "next", q: "" };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return cleanData(JSON.parse(raw));
  } catch {}
  return { cards: [], subs: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch { alert("Impossible d'enregistrer dans ce navigateur (stockage bloqué ?). Fais une sauvegarde depuis « Données »."); }
}
const cardOf = (id) => data.cards.find((c) => c.id === id);

/* ---------- Petit utilitaire DOM (pas de innerHTML : tout est du texte) ---------- */

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const cardLabel = (c) => (c ? `${c.name}${c.last4 ? " ••••" + c.last4 : ""}` : "Sans carte");
const dot = (color) => h("span", { class: "dot", style: color ? `background:${color}` : "" });

function relative(iso, today) {
  const n = daysBetween(today, iso);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n < 0) return "en retard";
  if (n < 31) return `dans ${n} j`;
  return dateFmt.format(parseDate(iso));
}

/* ---------- Affichage ---------- */

function render() {
  const today = todayISO();
  renderTiles(today);
  renderChips();
  renderList(today);
  renderSide(today);
}

function renderTiles(today) {
  const t = totals(data.subs);
  const soon = upcoming(data.subs, today, 30);
  const soonSum = soon.reduce((s, u) => s + u.sub.amount, 0);
  const tile = (cls, label, value, sub) =>
    h("div", { class: "tile " + cls }, h("div", { class: "label" }, label), h("div", { class: "value" }, value), sub ? h("div", { class: "sub" }, sub) : null);
  const off = data.subs.length - t.count;
  $("#tiles").replaceChildren(
    tile("hero", "Par mois", eur.format(t.monthly), "tous abonnements confondus"),
    tile("", "Par an", eur.format(t.yearly), "total sur 12 mois"),
    tile("", "Abonnements actifs", String(t.count), off ? `${off} en pause ou résilié${off > 1 ? "s" : ""}` : null),
    tile("", "À payer sous 30 jours", eur.format(soonSum), `${soon.length} prélèvement${soon.length > 1 ? "s" : ""}`),
  );
}

function renderChips() {
  const mk = (id, label, color) =>
    h("button", { class: "chip", type: "button", "aria-pressed": String(view.card === id), onclick: () => { view.card = id; render(); } }, color ? dot(color) : null, label);
  const chips = [mk("all", "Toutes les cartes")];
  for (const c of data.cards) chips.push(mk(c.id, cardLabel(c), c.color));
  if (data.subs.some((s) => !cardOf(s.cardId))) chips.push(mk("none", "Sans carte"));
  if (view.card !== "all" && view.card !== "none" && !cardOf(view.card)) view.card = "all";
  $("#cardChips").replaceChildren(...chips);
}

function visibleSubs(today) {
  const q = view.q.trim().toLowerCase();
  let list = data.subs.filter((s) => {
    if (view.status !== "all" && s.status !== view.status) return false;
    if (view.card === "none" ? cardOf(s.cardId) : view.card !== "all" && s.cardId !== view.card) return false;
    if (q && !`${s.name} ${s.category} ${s.notes}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const next = (s) => nextRenewal(s.startDate, s.cycle, today);
  if (view.sort === "cost") list.sort((a, b) => toMonthly(b) - toMonthly(a));
  else if (view.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  else list.sort((a, b) => (a.status === "active") === (b.status === "active") ? next(a).localeCompare(next(b)) : a.status === "active" ? -1 : 1);
  return list;
}

function renderList(today) {
  const list = visibleSubs(today);
  $("#list").replaceChildren(...list.map((s) => {
    const c = cardOf(s.cardId);
    const next = nextRenewal(s.startDate, s.cycle, today);
    const soon = s.status === "active" && daysBetween(today, next) <= 7;
    return h("li", {},
      h("button", { class: "item" + (s.status === "active" ? "" : " off"), type: "button", onclick: () => openSub(s.id) },
        h("div", {},
          h("div", { class: "name" }, s.name, s.status !== "active" ? h("span", { class: "badge off" }, STATUSES[s.status]) : null),
          h("div", { class: "meta" },
            h("span", { class: "card" }, dot(c?.color), cardLabel(c)),
            h("span", {}, s.category),
            s.status === "active" ? h("span", { class: soon ? "badge warn" : "" }, "Prochain : " + relative(next, today) + (daysBetween(today, next) > 1 && daysBetween(today, next) < 31 ? " · " + shortFmt.format(parseDate(next)) : "")) : null,
          ),
        ),
        h("div", { class: "price" }, eur.format(s.amount), h("small", {}, CYCLES[s.cycle].label.toLowerCase(), s.cycle !== "monthly" ? ` · ${eur.format(toMonthly(s))}/mois` : "")),
      ));
  }));
  const empty = $("#empty");
  empty.hidden = list.length > 0;
  if (!list.length) {
    if (!data.subs.length) {
      empty.replaceChildren(
        h("p", {}, "Aucun abonnement pour l'instant."),
        h("button", { class: "btn primary", onclick: () => openSub() }, "+ Ajouter mon premier abonnement"),
        h("button", { class: "btn", onclick: loadSample }, "Voir avec des exemples"),
      );
    } else empty.replaceChildren(h("p", {}, "Aucun abonnement ne correspond à ce filtre."));
  }
}

function barRows(groups, labelOf, colorOf, total) {
  if (!groups.length) return [h("p", { class: "muted" }, "Rien à afficher.")];
  const max = Math.max(...groups.map((g) => g.monthly)) || 1;
  return groups.map((g) =>
    h("div", { class: "bar-row" },
      h("div", { class: "top-line" },
        h("span", {}, colorOf(g.key) ? dot(colorOf(g.key)) : null, h("span", {}, `${labelOf(g.key)} · ${g.count}`)),
        h("span", { class: "amt" }, eur.format(g.monthly), total ? ` (${Math.round((g.monthly / total) * 100)} %)` : ""),
      ),
      h("div", { class: "track" }, h("div", { class: "fill", style: `width:${(g.monthly / max) * 100}%;${colorOf(g.key) ? `background:${colorOf(g.key)}` : ""}` })),
    ));
}

function renderSide(today) {
  const t = totals(data.subs);
  const up = upcoming(data.subs, today, 30);
  const upEl = $("#upcoming");
  if (!up.length) upEl.replaceChildren(h("li", { class: "muted" }, "Aucun prélèvement dans les 30 prochains jours."));
  else {
    upEl.replaceChildren(...[
      ...up.slice(0, 12).map((u) => h("li", {}, h("div", {}, u.sub.name, h("div", { class: "when" }, `${relative(u.date, today)} · ${shortFmt.format(parseDate(u.date))}`)), h("span", { class: "amt" }, eur.format(u.sub.amount)))),
      up.length > 12 ? h("li", { class: "muted" }, `… et ${up.length - 12} autres`) : null,
      h("li", { class: "total" }, h("span", {}, "Total"), h("span", { class: "amt" }, eur.format(up.reduce((s, u) => s + u.sub.amount, 0)))),
    ].filter(Boolean));
  }
  const byCard = groupMonthly(data.subs, (s) => (cardOf(s.cardId) ? s.cardId : ""));
  $("#byCard").replaceChildren(...barRows(byCard, (k) => cardLabel(cardOf(k)), (k) => cardOf(k)?.color, t.monthly));
  $("#byCat").replaceChildren(...barRows(groupMonthly(data.subs, (s) => s.category), (k) => k, () => null, t.monthly));
}

/* ---------- Formulaire d'abonnement ---------- */

const subDlg = $("#subDialog");
const subForm = $("#subForm");
let editingId = null;

function fillSelect(sel, entries, value) {
  sel.replaceChildren(...entries.map(([v, l]) => h("option", { value: v }, l)));
  sel.value = value;
}

function openSub(id) {
  editingId = id || null;
  const s = id ? data.subs.find((x) => x.id === id) : null;
  $("#subTitle").textContent = s ? "Modifier l'abonnement" : "Nouvel abonnement";
  $("#deleteSub").hidden = !s;
  const f = subForm.elements;
  f.name.value = s?.name ?? "";
  f.amount.value = s?.amount ?? "";
  fillSelect(f.cycle, Object.entries(CYCLES).map(([k, v]) => [k, v.label]), s?.cycle ?? "monthly");
  f.startDate.value = s?.startDate ?? todayISO();
  fillSelect(f.cardId, [["", "Sans carte"], ...data.cards.map((c) => [c.id, cardLabel(c)])], s?.cardId ?? (view.card !== "all" && view.card !== "none" ? view.card : ""));
  fillSelect(f.category, CATEGORIES.map((c) => [c, c]), s?.category ?? "Autres");
  fillSelect(f.status, Object.entries(STATUSES), s?.status ?? "active");
  f.url.value = s?.url ?? "";
  f.notes.value = s?.notes ?? "";
  subDlg.showModal();
  f.name.focus();
}

subForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = subForm.elements;
  const sub = cleanSub({
    id: editingId, name: f.name.value, amount: f.amount.value, cycle: f.cycle.value, startDate: f.startDate.value,
    cardId: f.cardId.value, category: f.category.value, status: f.status.value, url: f.url.value, notes: f.notes.value,
  }, new Set(data.cards.map((c) => c.id)));
  if (!sub) return alert("Vérifie le nom et le montant.");
  const i = data.subs.findIndex((x) => x.id === sub.id);
  if (i >= 0) data.subs[i] = sub; else data.subs.push(sub);
  save(); subDlg.close(); render();
});
$("#deleteSub").addEventListener("click", () => {
  const s = data.subs.find((x) => x.id === editingId);
  if (s && confirm(`Supprimer « ${s.name} » ?`)) {
    data.subs = data.subs.filter((x) => x.id !== editingId);
    save(); subDlg.close(); render();
  }
});

/* ---------- Cartes ---------- */

const cardsDlg = $("#cardsDialog");

function renderCardsDialog() {
  $("#cardsList").replaceChildren(...(data.cards.length ? data.cards : []).map((c) => {
    const upd = (patch) => { Object.assign(c, cleanCard({ ...c, ...patch }) || {}); save(); render(); };
    return h("li", {},
      h("input", { type: "color", value: c.color, "aria-label": "Couleur", onchange: (e) => upd({ color: e.target.value }) }),
      h("input", { value: c.name, maxlength: 40, "aria-label": "Nom", onchange: (e) => e.target.value.trim() ? upd({ name: e.target.value }) : (e.target.value = c.name) }),
      h("input", { value: c.last4, maxlength: 4, inputmode: "numeric", placeholder: "••••", "aria-label": "4 derniers chiffres", onchange: (e) => upd({ last4: e.target.value }) }),
      h("button", {
        class: "btn danger-text", type: "button", onclick: () => {
          const n = data.subs.filter((s) => s.cardId === c.id).length;
          if (!confirm(`Supprimer la carte « ${c.name} » ?${n ? ` Ses ${n} abonnement(s) passeront en « Sans carte ».` : ""}`)) return;
          data.cards = data.cards.filter((x) => x.id !== c.id);
          for (const s of data.subs) if (s.cardId === c.id) s.cardId = "";
          save(); renderCardsDialog(); render();
        },
      }, "Supprimer"));
  }));
  if (!data.cards.length) $("#cardsList").replaceChildren(h("li", { class: "muted" }, "Aucune carte enregistrée."));
}

$("#cardsBtn").addEventListener("click", () => { renderCardsDialog(); cardsDlg.showModal(); });
$("#cardForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const c = cleanCard({ id: newId(), name: f.name.value, last4: f.last4.value, color: f.color.value });
  if (!c) return;
  data.cards.push(c);
  save(); e.target.reset(); renderCardsDialog(); render();
});

/* ---------- Données : export / import ---------- */

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => todayISO();
const closeMenu = () => document.querySelector(".menu").removeAttribute("open");

$("#exportJson").addEventListener("click", () => { download(`abonnements-${stamp()}.json`, JSON.stringify(data, null, 2), "application/json"); closeMenu(); });
$("#exportCsv").addEventListener("click", () => { download(`abonnements-${stamp()}.csv`, "﻿" + toCSV(data), "text/csv;charset=utf-8"); closeMenu(); });
$("#importBtn").addEventListener("click", () => { closeMenu(); $("#importFile").click(); });
$("#importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (file.size > 5e6) throw new Error("fichier trop gros");
    const next = cleanData(JSON.parse(await file.text()));
    if (!next.subs.length && !next.cards.length) throw new Error("vide");
    if (!confirm(`Remplacer tes données actuelles par cette sauvegarde (${next.subs.length} abonnement(s), ${next.cards.length} carte(s)) ?`)) return;
    data = next; save(); render();
  } catch { alert("Ce fichier n'est pas une sauvegarde valide."); }
});
$("#wipeBtn").addEventListener("click", () => {
  closeMenu();
  if (confirm("Tout effacer (abonnements et cartes) ? Pense à sauvegarder avant.")) { data = { cards: [], subs: [] }; save(); render(); }
});

function loadSample() {
  const start = (day) => { const d = new Date(); d.setDate(day); return d.toISOString().slice(0, 10); };
  data = cleanData({ cards: SAMPLE.cards, subs: SAMPLE.subs.map((s, i) => ({ ...s, startDate: start(((i * 5 + 3) % 28) + 1), status: "active" })) });
  save(); render();
}

/* ---------- Branchements ---------- */

$("#addBtn").addEventListener("click", () => openSub());
$("#search").addEventListener("input", (e) => { view.q = e.target.value; render(); });
$("#statusFilter").addEventListener("change", (e) => { view.status = e.target.value; render(); });
$("#sortBy").addEventListener("change", (e) => { view.sort = e.target.value; render(); });
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
for (const d of [subDlg, cardsDlg]) d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
document.addEventListener("click", (e) => { const m = document.querySelector(".menu"); if (!m.contains(e.target)) m.removeAttribute("open"); });

render();
