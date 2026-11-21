// Ajout / édition d'une pièce : scan (caméra ou photo) → détourage → couleurs → fiche.
import { h, clear, toast, option, uid } from "../dom.js";
import { CATEGORIES, CAT, GROUPS, PATTERNS, FITS, SEASONS, METALS, STYLE_TAGS, SIZE_NOTES } from "../data.js";
import { colorName } from "../scan.js";
import { openDialog, chips, field } from "./common.js";
import { fileToCanvas, analyzeCanvas, pixelAt, packCutout, packPhoto, startCamera, stopCamera, frameToCanvas } from "./imaging.js";

const METAL_SLOTS = ["watch", "necklace", "bracelet", "ring", "earrings", "belt"];

export function openItemForm(app, existing, opts = {}) {
  const editing = !!existing;
  const draft = existing
    ? structuredClone({ ...existing, photo: undefined })
    : { id: uid(), category: opts.category || "tshirt", name: "", brand: "", colors: ["#808080"], pattern: "uni", fit: "regular", tags: [], seasons: [], size: "", material: "", notes: "", metal: "", sun: true, favorite: false, dirty: false, wornCount: 0 };
  const touched = new Set(existing ? ["name", "formality", "warmth", "waterproof", "windproof", "fit", "tags"] : []);
  let photoState = { src: null, cut: null, colors: [], keepOriginal: false, tolerance: 40, bg: null, newPhoto: false };
  let stream = null;
  const body = h("div", { class: "item-form" });
  let dlg;

  const finish = () => { stopCamera(stream); stream = null; };
  const { close } = (dlg = openDialog({ title: editing ? "Modifier la pièce" : "Ajouter un vêtement", body, wide: true, onClose: finish }));

  if (editing) showForm(); else showCapture();

  /* ----- Étape 1 : capture ----- */
  function showCapture() {
    finish();
    clear(body);
    const camBox = h("div", { class: "cam", hidden: true });
    const video = h("video", { muted: true, playsinline: true });
    const shoot = h("button", { class: "btn primary", type: "button", onclick: () => { const cv = frameToCanvas(video); finish(); camBox.hidden = true; onSource(cv); } }, "📸 Prendre la photo");
    camBox.append(video, h("div", { class: "row gap center" }, shoot, h("button", { class: "btn", type: "button", onclick: () => { finish(); camBox.hidden = true; } }, "Annuler")));
    const fileCam = h("input", { type: "file", accept: "image/*", capture: "environment", hidden: true, onchange: (e) => fromFile(e) });
    const filePick = h("input", { type: "file", accept: "image/*", hidden: true, onchange: (e) => fromFile(e) });
    async function fromFile(e) { const f = e.target.files[0]; e.target.value = ""; if (!f) return; try { onSource(await fileToCanvas(f)); } catch { toast("Image illisible."); } }
    body.append(
      h("p", {}, "Pose le vêtement ", h("b", {}, "à plat sur un fond uni"), " (lit, sol, mur), bien éclairé, sans ombre dure, en entier dans l'image. Le fond sera retiré automatiquement et les couleurs détectées."),
      h("div", { class: "cap-actions" },
        h("button", { class: "btn primary big", type: "button", onclick: async () => {
          if (!navigator.mediaDevices?.getUserMedia) { fileCam.click(); return; }
          try { camBox.hidden = false; stream = await startCamera(video); } catch { camBox.hidden = true; toast("Caméra indisponible : choisis une photo."); fileCam.click(); }
        } }, "📷 Scanner avec la caméra"),
        h("button", { class: "btn big", type: "button", onclick: () => filePick.click() }, "🖼️ Choisir une photo"),
        h("button", { class: "btn big ghost", type: "button", onclick: () => showForm() }, "Saisir sans photo")),
      camBox, fileCam, filePick,
      h("p", { class: "muted small" }, "La photo reste sur ton appareil. Astuce : prends plusieurs pièces à la suite, tu peux enchaîner les ajouts."));
  }

  function onSource(cv) {
    photoState = { ...photoState, src: cv, newPhoto: true, bg: null };
    runAnalysis(true);
    showForm();
  }

  function runAnalysis(first = false) {
    if (!photoState.src) return;
    const res = analyzeCanvas(photoState.src, { tolerance: photoState.tolerance, bg: photoState.bg });
    photoState.cut = res.cut; photoState.colors = res.colors; photoState.conf = res.seg.confidence; photoState.coverage = res.seg.coverage;
    if (first && res.colors.length) {
      draft.colors = [res.colors[0].hex, ...(res.colors[1] && res.colors[1].share >= 0.2 ? [res.colors[1].hex] : [])];
      if (!touched.has("pattern")) draft.pattern = res.pattern;
      autoName();
    }
  }

  /* ----- Étape 2 : fiche ----- */
  function autoName() { if (!touched.has("name")) draft.name = `${CAT[draft.category].label} ${colorName(draft.colors[0]).toLowerCase()}`.replace("(bandoulière, cabas…)", "").replace(/\s+/g, " ").trim(); }
  function applyCategoryDefaults() {
    const c = CAT[draft.category];
    if (!touched.has("formality")) draft.formality = c.formality;
    if (!touched.has("warmth")) draft.warmth = c.warmth;
    if (!touched.has("waterproof")) draft.waterproof = !!c.water;
    if (!touched.has("windproof")) draft.windproof = !!c.wind;
    autoName();
  }
  if (!editing) applyCategoryDefaults();
  else { const c = CAT[draft.category]; draft.formality ??= c.formality; draft.warmth ??= c.warmth; draft.waterproof ??= !!c.water; draft.windproof ??= !!c.wind; }

  function showForm() {
    finish();
    clear(body);
    const stored = existing?.photo;
    const slot = () => CAT[draft.category].slot;

    // aperçu photo
    const preview = h("div", { class: "photo-col" });
    const srcWrap = h("div", { class: "src-wrap" });
    const cutWrap = h("div", { class: "cut-wrap checker" });
    function paintPreview() {
      clear(srcWrap); clear(cutWrap);
      if (photoState.src) {
        const sc = document.createElement("canvas"); sc.width = photoState.src.width; sc.height = photoState.src.height; sc.getContext("2d").drawImage(photoState.src, 0, 0);
        sc.className = "src"; sc.title = "Touche le fond pour corriger le détourage";
        sc.addEventListener("click", (e) => { const r = sc.getBoundingClientRect(); photoState.bg = pixelAt(photoState.src, ((e.clientX - r.left) / r.width) * sc.width, ((e.clientY - r.top) / r.height) * sc.height); runAnalysis(); paintPreview(); paintColors(); });
        srcWrap.append(sc);
        if (photoState.cut) { const cc = document.createElement("canvas"); cc.width = photoState.cut.width; cc.height = photoState.cut.height; cc.getContext("2d").drawImage(photoState.cut, 0, 0); cc.className = "cut"; cutWrap.append(cc); }
        else cutWrap.append(h("p", { class: "muted pad" }, "Aucun objet détecté."));
      } else if (stored || draft.photoPreview) cutWrap.append(h("img", { class: "cut", src: stored, alt: "" }));
      else cutWrap.append(h("div", { class: "nophoto" }, h("span", {}, CAT[draft.category].emoji), h("small", {}, "Sans photo")));
    }
    const confMsg = h("p", { class: "muted small" });
    const slider = h("input", { type: "range", min: 10, max: 120, value: photoState.tolerance, "aria-label": "Sensibilité du détourage", oninput: (e) => { photoState.tolerance = +e.target.value; clearTimeout(slider._t); slider._t = setTimeout(() => { runAnalysis(); paintPreview(); paintColors(); }, 140); } });
    const keepOrig = h("input", { type: "checkbox", checked: photoState.keepOriginal, onchange: (e) => (photoState.keepOriginal = e.target.checked) });
    preview.append(
      h("div", { class: "pv-row" }, cutWrap, photoState.src ? srcWrap : null),
      photoState.src ? h("div", { class: "stack small-gap" },
        h("label", { class: "field" }, h("span", { class: "lbl" }, "Sensibilité du détourage"), slider, h("small", {}, "Touche le fond sur la photo d'origine pour corriger. Plus haut = retire plus de fond.")),
        h("label", { class: "check" }, keepOrig, " Garder la photo d'origine (sans détourage)"), confMsg) : null,
      h("div", { class: "row gap wrap" }, h("button", { class: "btn small", type: "button", onclick: () => showCapture() }, photoState.src || stored ? "📷 Reprendre la photo" : "📷 Ajouter une photo")));

    // couleurs
    const swatches = h("div", { class: "swatches" });
    const c1 = h("input", { type: "color", value: draft.colors[0], "aria-label": "Couleur principale", oninput: (e) => { draft.colors[0] = e.target.value; touchedColor(); } });
    const c2 = h("input", { type: "color", value: draft.colors[1] || "#ffffff", "aria-label": "Couleur secondaire", oninput: (e) => { draft.colors[1] = e.target.value; refreshNames(); } });
    const noSecond = h("button", { class: "btn small ghost", type: "button", onclick: () => { draft.colors = [draft.colors[0]]; refreshNames(); } }, "Sans 2ᵉ couleur");
    const names = h("span", { class: "muted small" });
    function refreshNames() { names.textContent = draft.colors.map(colorName).join(" + "); c2.style.opacity = draft.colors[1] ? 1 : 0.35; }
    function touchedColor() { c1.value = draft.colors[0]; autoName(); nameInput.value = draft.name; refreshNames(); }
    function paintColors() {
      clear(swatches);
      photoState.colors.forEach((c) => swatches.append(h("button", { class: "sw", type: "button", style: `background:${c.hex}`, title: `${c.name} (${Math.round(c.share * 100)} %)`, "aria-label": c.name, onclick: () => { draft.colors[0] = c.hex; touchedColor(); } })));
      if (photoState.src) confMsg.textContent = photoState.conf === "low" ? "⚠️ Détourage peu fiable (fond trop proche du vêtement ?). Utilise un fond contrasté, touche le fond ou garde la photo d'origine." : photoState.conf === "medium" ? "Le vêtement touche le bord de la photo : recule un peu si le découpage est coupé." : "Détourage correct.";
    }

    const nameInput = h("input", { value: draft.name, maxlength: 80, required: true, placeholder: "ex. Hoodie gris oversize", oninput: (e) => { draft.name = e.target.value; touched.add("name"); } });
    const catSel = h("select", { onchange: (e) => { draft.category = e.target.value; applyCategoryDefaults(); nameInput.value = draft.name; showForm(); } },
      Object.entries(GROUPS).map(([g, gl]) => h("optgroup", { label: gl }, CATEGORIES.filter((c) => c.group === g).map((c) => option(c.key, c.label, draft.category)))));
    const brandList = h("datalist", { id: "brandlist" }, app.state.brands.map((b) => h("option", { value: b.name })));
    const brandHint = h("small", {});
    const brandInput = h("input", { value: draft.brand || "", list: "brandlist", maxlength: 60, placeholder: "Marque (ex. NoClout)", oninput: (e) => {
      draft.brand = e.target.value;
      const b = app.state.brands.find((x) => x.name.toLowerCase() === draft.brand.trim().toLowerCase());
      brandHint.textContent = b ? `${b.style ? "Style : " + b.style + ". " : ""}${b.sizeNote ? SIZE_NOTES[b.sizeNote] + "." : ""}` : "";
      if (b && !editing) {
        if (b.style && !touched.has("tags") && !draft.tags.includes(b.style)) draft.tags = [b.style];
        if (b.fit && !touched.has("fit")) { draft.fit = b.fit; fitSel.value = b.fit; }
      }
    } });
    const fitSel = h("select", { onchange: (e) => { draft.fit = e.target.value; touched.add("fit"); } }, Object.entries(FITS).map(([k, l]) => option(k, l, draft.fit)));
    const patSel = h("select", { onchange: (e) => { draft.pattern = e.target.value; touched.add("pattern"); } }, Object.entries(PATTERNS).map(([k, l]) => option(k, l, draft.pattern)));
    const range = (key, min, max, step, label) => {
      const out = h("output", {}, String(draft[key]));
      return h("label", { class: "field" }, h("span", { class: "lbl" }, label, " : ", out), h("input", { type: "range", min, max, step, value: draft[key], oninput: (e) => { draft[key] = +e.target.value; touched.add(key); out.textContent = e.target.value; } }));
    };

    body.append(
      h("div", { class: "two-col" },
        preview,
        h("div", { class: "stack" },
          field("Nom", nameInput),
          h("div", { class: "form-grid" }, field("Catégorie", catSel), field("Marque", brandInput, null)),
          brandList, brandHint,
          h("div", { class: "field" }, h("span", { class: "lbl" }, "Couleurs"), h("div", { class: "row gap wrap center" }, c1, c2, noSecond, names), swatches),
          h("div", { class: "form-grid" }, field("Motif", patSel), field("Coupe", fitSel), field("Taille", h("input", { value: draft.size || "", maxlength: 12, placeholder: "M, 42, 38…", oninput: (e) => (draft.size = e.target.value) })), field("Matière", h("input", { value: draft.material || "", maxlength: 30, placeholder: "coton, cuir, daim…", oninput: (e) => (draft.material = e.target.value) }))))),
      h("details", { class: "more", open: true },
        h("summary", {}, "Usage et météo"),
        h("div", { class: "form-grid" }, range("formality", 0, 5, 0.5, "Formalité (0 plage → 5 cérémonie)"), range("warmth", 0, 6, 0.5, "Chaleur (0 léger → 5 très chaud)")),
        h("div", { class: "row gap wrap" },
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!draft.waterproof, onchange: (e) => { draft.waterproof = e.target.checked; touched.add("waterproof"); } }), " Imperméable / supporte la pluie"),
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!draft.windproof, onchange: (e) => { draft.windproof = e.target.checked; touched.add("windproof"); } }), " Coupe-vent"),
          slot() === "glasses" ? h("label", { class: "check" }, h("input", { type: "checkbox", checked: draft.sun !== false, onchange: (e) => (draft.sun = e.target.checked) }), " Lunettes de soleil") : null,
          METAL_SLOTS.includes(slot()) ? field("Métal / finition", h("select", { onchange: (e) => (draft.metal = e.target.value) }, Object.entries(METALS).map(([k, l]) => option(k, l, draft.metal || "")))) : null),
        h("div", { class: "field" }, h("span", { class: "lbl" }, "Saisons"), chips(SEASONS, draft.seasons, (k, on) => { draft.seasons = on ? [...new Set([...draft.seasons, k])] : draft.seasons.filter((x) => x !== k); }), h("small", {}, "Laisse vide si la pièce se porte toute l'année.")),
        h("div", { class: "field" }, h("span", { class: "lbl" }, "Style"), chips(Object.fromEntries(STYLE_TAGS.map((t) => [t, t])), draft.tags, (k, on) => { touched.add("tags"); draft.tags = on ? [...new Set([...draft.tags, k])] : draft.tags.filter((x) => x !== k); })),
        field("Notes", h("textarea", { rows: 2, maxlength: 300, oninput: (e) => (draft.notes = e.target.value) }, draft.notes || ""))),
      h("div", { class: "row gap wrap between foot-row" },
        h("div", { class: "row gap wrap" },
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!draft.favorite, onchange: (e) => (draft.favorite = e.target.checked) }), " ⭐ Favori"),
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!draft.dirty, onchange: (e) => (draft.dirty = e.target.checked) }), " 🧺 Au sale")),
        h("div", { class: "row gap wrap" },
          editing ? h("button", { class: "btn danger-text", type: "button", onclick: () => { if (!confirm(`Supprimer « ${draft.name} » ?`)) return; app.state.items = app.state.items.filter((i) => i.id !== draft.id); app.persistItems([draft.id]); close(); toast("Pièce supprimée."); app.refresh(); } }, "Supprimer") : null,
          !editing ? h("button", { class: "btn", type: "button", onclick: () => save(true) }, "Enregistrer et en ajouter une autre") : null,
          h("button", { class: "btn primary", type: "button", onclick: () => save(false) }, "Enregistrer"))));
    paintPreview(); paintColors(); refreshNames();
  }

  function save(another) {
    const name = (draft.name || "").trim();
    if (!name) return toast("Donne un nom à cette pièce.");
    const base = existing ? { ...existing } : {};
    const item = { ...base, ...draft, name, brand: (draft.brand || "").trim(), colors: draft.colors.filter(Boolean).slice(0, 2), tags: draft.tags || [], seasons: draft.seasons || [] };
    delete item.photoPreview;
    if (!METAL_SLOTS.includes(CAT[item.category].slot)) delete item.metal;
    if (CAT[item.category].slot !== "glasses") delete item.sun;
    let photoChanged = false;
    if (photoState.newPhoto && photoState.src) {
      item.photo = photoState.keepOriginal || !photoState.cut ? packPhoto(photoState.src) : packCutout(photoState.cut);
      photoChanged = true;
    } else if (existing) item.photo = existing.photo;
    if (existing) { const i = app.state.items.findIndex((x) => x.id === existing.id); app.state.items[i] = item; }
    else app.state.items.push(item);
    app.persistItems(photoChanged ? [item.id] : []);
    toast(existing ? "Pièce mise à jour." : "Pièce ajoutée à ta garde-robe.");
    close();
    app.refresh();
    if (another) setTimeout(() => app.openItemForm(null, { category: item.category }), 150);
  }
}
