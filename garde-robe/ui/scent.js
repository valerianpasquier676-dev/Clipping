import { h, toast, option, uid } from "../dom.js";
import { PERFUME_FAMILIES, PERF_FAMILY, PERFUME_CONCENTRATIONS, PERFUME_GUIDE, SEASONS, THEME } from "../data.js";
import { recommendPerfumes } from "../morph.js";
import { openDialog, chips, field, themeLabel, fmtDay } from "./common.js";
import { ensurePlan, today } from "./plan.js";

export function renderScent(app, root) {
  const { perfumes, profile } = app.state;
  const plan = app.state.items.length ? ensurePlan(app) : null;
  const day = plan?.days[0];
  const weather = day?.weather || { tempMax: 18, tempMin: 11 };
  const rec = recommendPerfumes({ perfumes, weather, profile, theme: day?.theme || "casual", context: day?.context || "loisirs", date: day?.date || today() });

  root.append(
    h("div", { class: "week-head" }, h("div", {}, h("h1", {}, "Parfums"), h("p", { class: "muted" }, "Ta collection, le bon choix selon la météo et la tenue, et les bons gestes.")),
      h("button", { class: "btn primary", type: "button", onclick: () => perfumeDialog(app) }, "+ Ajouter un parfum")),

    h("div", { class: "card" },
      h("h2", {}, "Pour aujourd'hui"),
      day ? h("p", { class: "muted" }, `${fmtDay(day.date)} · ${Math.round(rec.t)} °C ressentis · ${themeLabel(day.theme)}`) : h("p", { class: "muted" }, `Météo moyenne supposée (${Math.round(rec.t)} °C).`),
      rec.owned.length
        ? h("ol", { class: "rank" }, rec.owned.slice(0, 3).map((r, i) => h("li", {}, h("b", {}, r.perfume.name), r.perfume.brand ? ` · ${r.perfume.brand}` : "", " ", h("span", { class: "badge" }, PERF_FAMILY[r.perfume.family]?.label || ""), h("span", { class: "muted" }, ` — ${r.sprays} vaporisations`), i === 0 ? h("span", { class: "badge good" }, "Le meilleur choix") : null)))
        : h("p", {}, "Ajoute tes parfums pour recevoir un choix personnalisé."),
      h("p", {}, h("b", {}, "Familles à privilégier : "), rec.families.map((f) => `${f.family.label} (${f.family.notes})`).join(" · ")),
      h("ul", {}, rec.advice.map((t) => h("li", {}, t)))),

    h("div", { class: "card" }, h("h2", {}, "Ma collection"),
      perfumes.length
        ? h("div", { class: "grid-perf" }, perfumes.map((p) => {
          const f = PERF_FAMILY[p.family], c = PERFUME_CONCENTRATIONS[p.concentration];
          return h("div", { class: "perf" },
            h("div", { class: "row between" }, h("b", {}, p.name, p.favorite ? " ⭐" : ""), h("button", { class: "btn small ghost", type: "button", onclick: () => perfumeDialog(app, p) }, "Modifier")),
            h("div", { class: "muted small" }, [p.brand, c?.label].filter(Boolean).join(" · ")),
            h("div", {}, h("span", { class: "badge" }, f?.label || "—"), " ", ...(p.seasons || []).map((s) => h("span", { class: "badge soft" }, SEASONS[s]))),
            f ? h("p", { class: "small" }, `${f.feel} ${f.note}`) : null,
            p.notes ? h("p", { class: "muted small" }, "Notes : " + p.notes) : null,
            c ? h("p", { class: "muted small" }, `Tenue : ${c.hours} · ${c.sprays} vaporisations`) : null);
        }))
        : h("p", { class: "muted" }, "Aucun parfum pour l'instant.")),

    h("div", { class: "card" }, h("h2", {}, "Les familles olfactives"),
      h("div", { class: "grid-perf" }, PERFUME_FAMILIES.map((f) => h("div", { class: "perf" }, h("b", {}, f.label), h("div", { class: "muted small" }, f.notes), h("p", { class: "small" }, f.feel), h("p", { class: "small" }, f.note), h("p", { class: "muted small" }, `Idéal entre ${f.temp[0]} et ${f.temp[1]} °C`))))),

    h("div", { class: "card" }, h("h2", {}, "Bien porter son parfum"),
      h("dl", { class: "guide" }, PERFUME_GUIDE.map(([t, d]) => [h("dt", {}, t), h("dd", {}, d)]))));
}

function perfumeDialog(app, existing) {
  const d = existing ? { ...existing, seasons: [...(existing.seasons || [])] } : { id: uid(), name: "", brand: "", family: "boise", concentration: "edp", seasons: [], notes: "", favorite: false };
  const { close } = openDialog({
    title: existing ? "Modifier le parfum" : "Ajouter un parfum",
    body: h("div", { class: "stack" },
      h("div", { class: "form-grid" },
        field("Nom", h("input", { value: d.name, maxlength: 60, oninput: (e) => (d.name = e.target.value) })),
        field("Marque", h("input", { value: d.brand || "", maxlength: 60, oninput: (e) => (d.brand = e.target.value) })),
        field("Famille olfactive", h("select", { onchange: (e) => (d.family = e.target.value) }, PERFUME_FAMILIES.map((f) => option(f.key, f.label, d.family))), "Regarde les notes de tête/cœur/fond sur la fiche du parfum."),
        field("Concentration", h("select", { onchange: (e) => (d.concentration = e.target.value) }, Object.entries(PERFUME_CONCENTRATIONS).map(([k, c]) => option(k, c.label, d.concentration))))),
      h("div", { class: "field" }, h("span", { class: "lbl" }, "Saisons où tu le portes"), chips(SEASONS, d.seasons, (k, on) => { d.seasons = on ? [...new Set([...d.seasons, k])] : d.seasons.filter((x) => x !== k); })),
      field("Notes (optionnel)", h("input", { value: d.notes || "", maxlength: 120, placeholder: "bergamote, cèdre, musc…", oninput: (e) => (d.notes = e.target.value) })),
      h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!d.favorite, onchange: (e) => (d.favorite = e.target.checked) }), " ⭐ Favori")),
    actions: [
      existing ? { label: "Supprimer", kind: "danger-text", onClick: (c) => { if (!confirm(`Supprimer « ${d.name} » ?`)) return; app.state.perfumes = app.state.perfumes.filter((p) => p.id !== d.id); app.save("perfumes"); c(); app.refresh(); } } : null,
      { label: "Enregistrer", kind: "primary", onClick: (c) => {
        if (!d.name.trim()) return toast("Donne un nom au parfum.");
        d.name = d.name.trim();
        const i = app.state.perfumes.findIndex((p) => p.id === d.id);
        if (i >= 0) app.state.perfumes[i] = d; else app.state.perfumes.push(d);
        app.save("perfumes"); c(); app.refresh();
      } }].filter(Boolean),
  });
}
