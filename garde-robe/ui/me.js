import { h, toast, option, clear } from "../dom.js";
import { SHAPES, FACE_SHAPES, PALETTES, CONTEXTS } from "../data.js";
import { analyzeBody, paletteFor, mannequinFromProfile } from "../morph.js";
import { Mannequin, webglAvailable } from "../mannequin3d.js";
import { field, chips, openDialog } from "./common.js";
import * as store from "../store.js";
import { uid } from "../dom.js";

const SKINS = ["#f5d5c0", "#e8b999", "#d9a78a", "#c68863", "#a86b45", "#8d5a3b", "#6b4129", "#4a2c1c"];
const HAIRS = ["#0f0b09", "#2b1d14", "#3a2a1f", "#6b4423", "#a0703c", "#c9a66b", "#d8d2c8", "#8d2a1f"];
const DAYS = { 1: "Lun", 2: "Mar", 3: "Mer", 4: "Jeu", 5: "Ven", 6: "Sam", 0: "Dim" };

export function renderMe(app, root) {
  const { profile } = app.state;
  const set = (k, v) => { profile[k] = v; app.save("profile"); };
  const num = (k, label, ph, hint) => field(label, h("input", { type: "text", inputmode: "decimal", value: profile[k] ?? "", placeholder: ph, "aria-label": label, onchange: (e) => { set(k, e.target.value.trim()); runAnalysis(true); } }), hint);

  const result = h("div", { class: "stack" });
  const sim = h("div", { class: "sim-box is3d small-sim" });
  let mm = null;

  function runAnalysis(refreshSim) {
    const r = analyzeBody(profile);
    clear(result);
    if (!r.ok) {
      delete profile.shape; app.save("profile");
      result.append(h("p", { class: "muted" }, r.errors.length ? r.errors.join(" ") : "Renseigne au minimum le tour de poitrine, de taille et de hanches pour obtenir ton analyse."));
    } else {
      profile.shape = r.shape; profile.heightClass = r.heightClass; app.save("profile");
      result.append(
        h("div", { class: "shape" }, h("h3", {}, r.label), h("p", {}, r.desc), h("p", { class: "muted small" }, `Poitrine/hanches : ${r.ratios.chestHips > 0 ? "+" : ""}${r.ratios.chestHips} % · taille/moyenne : ${r.ratios.waist}`)),
        h("div", { class: "cols3" },
          h("div", {}, h("h4", {}, "✅ Ce qui te valorise"), h("ul", {}, r.favor.map((t) => h("li", {}, t)))),
          h("div", {}, h("h4", {}, "⚠️ À manier avec précaution"), h("ul", {}, r.careful.map((t) => h("li", {}, t)))),
          h("div", {}, h("h4", {}, "💡 Astuces"), h("ul", {}, r.tips.map((t) => h("li", {}, t))))),
        h("p", { class: "muted small" }, "Ce sont des repères de style, pas des règles : porte ce qui te plaît et dans quoi tu te sens bien. L'algorithme en tient compte avec un poids léger."));
    }
    if (refreshSim) paintSim();
  }

  function paintSim() {
    if (!webglAvailable()) { sim.replaceChildren(h("p", { class: "muted pad" }, "Aperçu 3D indisponible sur cet appareil.")); return; }
    mm = new Mannequin(sim, { autoRotate: true });
    mm.setBody(mannequinFromProfile(profile));
    const c = (category, color, extra = {}) => ({ category, colors: [color], ...extra });
    mm.setOutfit({ top: c("tshirt", "#9aa0aa"), bottom: c("jean", "#3a5a85"), shoes: c("baskets", "#f2f2ee") });
  }

  const pal = paletteFor(profile.undertone, profile.contrast);
  const face = FACE_SHAPES[profile.face];

  root.append(
    h("div", { class: "week-head" }, h("div", {}, h("h1", {}, "Moi"), h("p", { class: "muted" }, "Tes mesures, ton visage, tes préférences : tout reste sur ton appareil."))),
    h("div", { class: "card" },
      h("h2", {}, "Ma morphologie"),
      h("div", { class: "two-col" },
        h("div", { class: "stack" },
          h("div", { class: "form-grid" },
            num("height", "Taille (cm)", "175"), num("chest", "Tour de poitrine (cm)", "98", "Autour de la partie la plus forte du torse, mètre à l'horizontale."),
            num("waist", "Tour de taille (cm)", "84", "Au point le plus étroit du buste, sans serrer."), num("hips", "Tour de hanches (cm)", "98", "Partie la plus large du bassin."),
            num("shoulders", "Largeur d'épaules (cm)", "46", "Optionnel : d'une pointe d'épaule à l'autre, dans le dos."), num("inseam", "Entrejambe (cm)", "80", "Optionnel : de l'entrejambe à la cheville.")),
          h("p", { class: "muted small" }, "L'analyse part de tes mesures, jamais d'une photo de toi. Aucune donnée ne quitte cet appareil.")),
        sim),
      result),
    h("div", { class: "card" },
      h("h2", {}, "Visage, teint & couleurs"),
      h("div", { class: "form-grid" },
        field("Forme du visage", h("select", { onchange: (e) => { set("face", e.target.value); app.refresh(); } }, option("", "— choisir —", profile.face || ""), Object.entries(FACE_SHAPES).map(([k, f]) => option(k, f.label, profile.face || "")))),
        field("Sous-ton de peau", h("select", { onchange: (e) => { set("undertone", e.target.value); app.refresh(); } }, option("", "— choisir —", profile.undertone || ""), Object.entries(PALETTES).map(([k, p]) => option(k, p.label, profile.undertone || ""))), "Veines du poignet à la lumière du jour : vertes = chaud, bleues = froid, mélange = neutre."),
        field("Contraste cheveux / peau", h("select", { onchange: (e) => { set("contrast", e.target.value); app.refresh(); } }, ["faible", "moyen", "fort"].map((k) => option(k, k[0].toUpperCase() + k.slice(1), profile.contrast || "moyen"))))),
      face ? h("div", { class: "note" }, h("b", {}, `Visage ${face.label.toLowerCase()} · `), face.note, h("br"), h("b", {}, "Lunettes : "), face.glasses, h("br"), h("b", {}, "Chapeaux et bonnets : "), face.hat) : null,
      profile.undertone ? h("div", { class: "palette" }, h("p", {}, h("b", {}, pal.label + " : "), pal.desc), h("div", { class: "swatch-row" }, pal.colors.map(([n, c]) => h("div", { class: "pal" }, h("span", { class: "sw big", style: `background:${c}` }), h("small", {}, n)))), h("p", { class: "muted small" }, pal.contrastNote, pal.metal ? ` Métal qui te flatte souvent : ${pal.metal === "or" ? "doré" : "argenté"}.` : "")) : null,
      h("div", { class: "form-grid" },
        field("Teint (mannequin 3D)", swatchPicker(SKINS, profile.skin || SKINS[2], (c) => { set("skin", c); app.refresh(); })),
        field("Cheveux (mannequin 3D)", swatchPicker(HAIRS, profile.hair || HAIRS[2], (c) => { set("hair", c); app.refresh(); })),
        field("Coiffure", h("select", { onchange: (e) => { set("hairStyle", e.target.value); app.refresh(); } }, [["court", "Courts"], ["long", "Longs"], ["chauve", "Rasés / chauve"]].map(([k, l]) => option(k, l, profile.hairStyle || "court"))))),
      h("div", { class: "row gap wrap" },
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!profile.wearsGlasses, onchange: (e) => set("wearsGlasses", e.target.checked) }), " Je porte des lunettes de vue"),
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!profile.earrings, onchange: (e) => set("earrings", e.target.checked) }), " Je porte des boucles d'oreilles"),
        field("Métal préféré", h("select", { onchange: (e) => set("metal", e.target.value) }, [["", "Peu importe"], ["or", "Doré"], ["argent", "Argenté"]].map(([k, l]) => option(k, l, profile.metal || "")))))),
    h("div", { class: "card" },
      h("h2", {}, "Mon style et mon quotidien"),
      h("div", { class: "form-grid" },
        field("Dress code au travail / en cours", h("select", { onchange: (e) => set("workStyle", e.target.value) }, [["formel", "Formel (chemise, chaussures de ville)"], ["smart", "Soigné / smart casual"], ["casual", "Décontracté"], ["etudiant", "Étudiant"]].map(([k, l]) => option(k, l, profile.workStyle || "smart")))),
        field("Sensibilité au froid", h("select", { onchange: (e) => set("coldSensitivity", Number(e.target.value)) }, [[1, "Frileux (je m'habille plus chaudement)"], [0, "Normal"], [-1, "J'ai toujours chaud"]].map(([k, l]) => option(String(k), l, String(profile.coldSensitivity ?? 0)))))),
      h("div", { class: "field" }, h("span", { class: "lbl" }, "Jours de travail / cours"), chips(DAYS, profile.workDays || [1, 2, 3, 4, 5], (k, on) => { const s = new Set(profile.workDays || [1, 2, 3, 4, 5]); on ? s.add(Number(k)) : s.delete(Number(k)); set("workDays", [...s]); }), h("small", {}, "Les autres jours sont proposés en mode loisirs.")),
      h("p", { class: "muted small" }, "Après un changement, utilise « Régénérer la semaine » dans l'onglet Semaine pour appliquer ces préférences.")),
    dataCard(app));

  runAnalysis(false);
  paintSim();
}

function swatchPicker(colors, current, onPick) {
  return h("div", { class: "swatches" }, colors.map((c) => h("button", { class: "sw" + (c === current ? " sel" : ""), type: "button", style: `background:${c}`, "aria-label": c, onclick: () => onPick(c) })));
}

function dataCard(app) {
  const fileIn = h("input", { type: "file", accept: "application/json,.json", hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.items)) throw new Error("format");
      if (!confirm(`Remplacer tes données par cette sauvegarde (${d.items.length} pièces) ?`)) return;
      await store.wipe();
      const s = app.state;
      s.items = d.items.map((i) => ({ ...i, id: i.id || uid() })); s.profile = d.profile || {}; s.perfumes = d.perfumes || []; s.brands = d.brands || s.brands; s.plan = null; s.weather = { place: null, days: [], manual: {}, fetchedAt: null };
      app.persistItems(s.items.filter((i) => i.photo).map((i) => i.id)); app.save("profile"); app.save("perfumes"); app.save("brands"); app.save("plan"); app.save("weather");
      toast("Sauvegarde restaurée."); app.refresh();
    } catch { toast("Ce fichier n'est pas une sauvegarde valide."); }
  } });
  return h("div", { class: "card" }, h("h2", {}, "Mes données"),
    h("p", { class: "muted" }, "Tout est stocké dans ce navigateur (photos comprises). Vider les données du navigateur efface tout : fais une sauvegarde de temps en temps, elle te permet aussi de passer de l'ordinateur au téléphone."),
    h("div", { class: "row gap wrap" },
      h("button", { class: "btn", type: "button", onclick: () => {
        const s = app.state, blob = new Blob([JSON.stringify({ app: "garde-robe", version: 1, items: s.items, profile: s.profile, perfumes: s.perfumes, brands: s.brands })], { type: "application/json" });
        const a = h("a", { href: URL.createObjectURL(blob), download: `garde-robe-${new Date().toISOString().slice(0, 10)}.json` }); document.body.append(a); a.click(); a.remove();
      } }, "⬇️ Sauvegarder (JSON)"),
      h("button", { class: "btn", type: "button", onclick: () => fileIn.click() }, "⬆️ Restaurer une sauvegarde"),
      h("button", { class: "btn danger-text", type: "button", onclick: async () => { if (!confirm("Tout effacer (pièces, photos, profil, parfums) ? Pense à sauvegarder avant.")) return; await store.wipe(); Object.assign(app.state, { items: [], profile: { coldSensitivity: 0, workStyle: "smart", workDays: [1, 2, 3, 4, 5] }, perfumes: [], plan: null, weather: { place: null, days: [], manual: {}, fetchedAt: null } }); toast("Données effacées."); app.go("week"); } }, "Tout effacer")),
    fileIn);
}
