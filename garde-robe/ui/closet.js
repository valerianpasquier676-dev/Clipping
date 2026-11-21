import { h, toast, option } from "../dom.js";
import { GROUPS, CAT, STYLE_TAGS, FITS, SIZE_NOTES } from "../data.js";
import { visual, openDialog, catLabel, colorLabel, field } from "./common.js";

export function renderCloset(app, root) {
  const { state } = app;
  const f = (state.ui.filter ||= { group: "", q: "", brand: "", dirty: false, fav: false, never: false, sort: "recent" });
  const items = state.items;
  const dirtyCount = items.filter((i) => i.dirty).length;
  const never = items.filter((i) => !(i.wornCount > 0)).length;

  root.append(
    h("div", { class: "week-head" },
      h("div", {}, h("h1", {}, "Ma garde-robe"), h("p", { class: "muted" }, `${items.length} pièce${items.length > 1 ? "s" : ""} · ${dirtyCount} au sale · ${never} jamais portée${never > 1 ? "s" : ""}`)),
      h("div", { class: "row wrap gap" },
        h("button", { class: "btn primary", type: "button", onclick: () => app.openItemForm() }, "📷 Ajouter / scanner"),
        h("button", { class: "btn", type: "button", onclick: () => brandsDialog(app) }, "🏷️ Marques"),
        dirtyCount ? h("button", { class: "btn", type: "button", onclick: () => { items.forEach((i) => { i.dirty = false; }); app.persistItems(); toast("Tout est propre ✨"); app.refresh(); } }, `🧺 Lessive faite (${dirtyCount})`) : null)));

  if (!items.length) {
    root.append(h("div", { class: "card hero" }, h("p", {}, "Ta garde-robe est vide."), h("div", { class: "row gap wrap" },
      h("button", { class: "btn primary", onclick: () => app.openItemForm() }, "📷 Scanner un vêtement"),
      h("button", { class: "btn", onclick: async () => { const { sampleItems, samplePerfumes } = await import("./sample.js"); state.items = sampleItems(); if (!state.perfumes.length) { state.perfumes = samplePerfumes(); app.save("perfumes"); } app.persistItems(); app.refresh(); } }, "Charger une garde-robe d'exemple"))));
    return;
  }

  const brands = [...new Set(items.map((i) => i.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const set = (k, v) => { f[k] = v; app.refresh(); };
  root.append(h("div", { class: "filters" },
    h("div", { class: "chips" },
      h("button", { class: "chip", type: "button", "aria-pressed": String(!f.group), onclick: () => set("group", "") }, "Tout"),
      Object.entries(GROUPS).filter(([g]) => items.some((i) => CAT[i.category]?.group === g)).map(([g, l]) =>
        h("button", { class: "chip", type: "button", "aria-pressed": String(f.group === g), onclick: () => set("group", g) }, `${l} · ${items.filter((i) => CAT[i.category]?.group === g).length}`))),
    h("div", { class: "row wrap gap" },
      h("input", { type: "search", placeholder: "Rechercher…", value: f.q, "aria-label": "Rechercher", oninput: (e) => { f.q = e.target.value; clearTimeout(f._t); f._t = setTimeout(() => { app.refresh(); const s = document.querySelector('input[type="search"]'); s?.focus(); s?.setSelectionRange(f.q.length, f.q.length); }, 200); } }),
      brands.length ? h("select", { "aria-label": "Marque", onchange: (e) => set("brand", e.target.value) }, option("", "Toutes les marques", f.brand), brands.map((b) => option(b, b, f.brand))) : null,
      h("select", { "aria-label": "Trier", onchange: (e) => set("sort", e.target.value) }, option("recent", "Ajoutées récemment", f.sort), option("name", "Nom", f.sort), option("worn", "Les plus portées", f.sort), option("unworn", "Les moins portées", f.sort)),
      toggle("🧺 Au sale", f.dirty, () => set("dirty", !f.dirty)), toggle("⭐ Favoris", f.fav, () => set("fav", !f.fav)), toggle("Jamais portées", f.never, () => set("never", !f.never)))));

  const q = f.q.trim().toLowerCase();
  let list = items.filter((i) =>
    (!f.group || CAT[i.category]?.group === f.group) && (!f.brand || i.brand === f.brand) && (!f.dirty || i.dirty) && (!f.fav || i.favorite) && (!f.never || !(i.wornCount > 0)) &&
    (!q || `${i.name} ${i.brand || ""} ${catLabel(i.category)} ${colorLabel(i)} ${(i.tags || []).join(" ")}`.toLowerCase().includes(q)));
  if (f.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  else if (f.sort === "worn") list.sort((a, b) => (b.wornCount || 0) - (a.wornCount || 0));
  else if (f.sort === "unworn") list.sort((a, b) => (a.wornCount || 0) - (b.wornCount || 0));
  else list = [...list].reverse();

  root.append(list.length
    ? h("div", { class: "grid-items" }, list.map((it) =>
      h("button", { class: "item-card" + (it.dirty ? " dirty" : ""), type: "button", onclick: () => app.openItemForm(it) },
        visual(it, "vis"),
        h("div", { class: "ic-body" },
          h("div", { class: "ic-name" }, it.name),
          h("div", { class: "muted small" }, [catLabel(it.category), it.brand, colorLabel(it)].filter(Boolean).join(" · ")),
          h("div", { class: "badges" }, it.favorite ? h("span", { class: "badge" }, "⭐") : null, it.dirty ? h("span", { class: "badge warn" }, "🧺 sale") : null, it.wornCount ? h("span", { class: "badge soft" }, `${it.wornCount}× porté`) : h("span", { class: "badge soft" }, "jamais porté"))))))
    : h("div", { class: "card soft" }, "Aucune pièce ne correspond à ces filtres."));
}

const toggle = (label, on, fn) => h("button", { class: "chip", type: "button", "aria-pressed": String(!!on), onclick: fn }, label);

/* ---------- Marques ---------- */

export function brandsDialog(app) {
  const wrap = h("div", { class: "stack" });
  const paint = () => {
    wrap.replaceChildren(
      h("p", { class: "muted small" }, "Les marques sont saisies telles que tu les as données : corrige l'orthographe si besoin. Le style et la coupe servent de valeurs par défaut quand tu ajoutes une pièce de la marque, et orientent l'algorithme vers les bons thèmes (ex. streetwear)."),
      ...app.state.brands.map((b, i) => {
        const count = app.state.items.filter((it) => it.brand === b.name).length;
        return h("div", { class: "brand-row" },
          h("input", { value: b.name, maxlength: 60, "aria-label": "Nom de la marque", onchange: (e) => {
            const nn = e.target.value.trim(); if (!nn) { e.target.value = b.name; return; }
            app.state.items.forEach((it) => { if (it.brand === b.name) it.brand = nn; }); b.name = nn; app.persistItems(); app.save("brands"); paint();
          } }),
          h("select", { "aria-label": "Style", onchange: (e) => { b.style = e.target.value; app.save("brands"); } }, option("", "Style…", b.style || ""), STYLE_TAGS.map((t) => option(t, t, b.style || ""))),
          h("select", { "aria-label": "Coupe", onchange: (e) => { b.fit = e.target.value; app.save("brands"); } }, option("", "Coupe…", b.fit || ""), Object.entries(FITS).map(([k, l]) => option(k, l, b.fit || ""))),
          h("select", { "aria-label": "Taille", onchange: (e) => { b.sizeNote = e.target.value; app.save("brands"); } }, Object.entries(SIZE_NOTES).map(([k, l]) => option(k, l, b.sizeNote || ""))),
          h("span", { class: "muted small" }, `${count} pièce${count > 1 ? "s" : ""}`),
          h("button", { class: "btn small ghost icon", type: "button", "aria-label": "Supprimer la marque", onclick: () => { if (count && !confirm(`${count} pièce(s) portent cette marque : elles la conservent, mais elle disparaît de la liste. Continuer ?`)) return; app.state.brands.splice(i, 1); app.save("brands"); paint(); } }, "✕"));
      }),
      h("form", { class: "brand-add", onsubmit: (e) => { e.preventDefault(); const v = e.target.elements.name.value.trim(); if (!v) return; if (!app.state.brands.some((b) => b.name.toLowerCase() === v.toLowerCase())) app.state.brands.push({ name: v, style: "", fit: "", sizeNote: "" }); app.save("brands"); paint(); } },
        h("input", { name: "name", placeholder: "Ajouter une marque…", maxlength: 60 }), h("button", { class: "btn primary", type: "submit" }, "Ajouter")));
  };
  paint();
  openDialog({ title: "Mes marques", body: wrap, wide: true });
}
