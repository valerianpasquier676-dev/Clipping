// Garde-robe d'exemple (sans photos) pour essayer l'application.
import { uid } from "../dom.js";

const I = (category, name, color, extra = {}) => ({ id: uid(), category, name, colors: [color], pattern: "uni", fit: "regular", tags: [], seasons: [], wornCount: 0, ...extra });

export function sampleItems() {
  const NC = "NoClout", SV = "Supply Vicinity", CA = "Cynique d'Avril", SD = "Stuque Divin by Divin";
  return [
    I("tshirt", "T-shirt blanc", "#f4f4f1"), I("tshirt", "T-shirt noir oversize", "#161616", { brand: NC, fit: "oversize", tags: ["streetwear"], pattern: "logo" }),
    I("tshirt", "T-shirt marine", "#1b2a49"), I("tshirt", "T-shirt rayé", "#1b2a49", { pattern: "raye", colors: ["#1b2a49", "#f4f4f1"] }),
    I("tshirt", "T-shirt kaki", "#6b7a4a", { brand: SV, tags: ["streetwear", "workwear"] }), I("tshirt", "T-shirt sable", "#d9c9a8"),
    I("chemise", "Chemise blanche", "#ffffff"), I("chemise", "Chemise bleu ciel", "#9ec1e6"), I("chemise", "Chemise à carreaux", "#4b6b9a", { pattern: "carreaux", colors: ["#4b6b9a", "#ffffff"] }),
    I("polo", "Polo marine", "#1b2a49"),
    I("pull", "Pull maille beige", "#d9c9a8"), I("pull", "Pull col rond gris", "#6f737a"), I("pull", "Pull noir", "#1f1f22"),
    I("sweat", "Hoodie gris", "#7b7f86", { brand: SD, fit: "oversize", tags: ["streetwear"] }), I("sweat", "Sweat noir", "#1a1a1a", { brand: CA, fit: "oversize", tags: ["streetwear"] }),
    I("jean", "Jean brut", "#2c3e5c", { fit: "slim" }), I("jean", "Jean noir", "#171717"), I("jean", "Jean large délavé", "#5b7fa8", { brand: NC, fit: "oversize", tags: ["streetwear"] }),
    I("pantalon", "Chino beige", "#cdb98f"), I("pantalon", "Pantalon marine", "#1b2a49", { formality: 4 }), I("pantalon", "Cargo kaki", "#5f6b45", { brand: SV, fit: "oversize", tags: ["streetwear", "techwear"] }),
    I("jogging", "Jogging noir", "#1b1b1b"), I("short", "Short sable", "#d9c9a8"), I("short", "Short marine", "#2d3b55"),
    I("baskets", "Baskets blanches", "#f2f2ee", { waterproof: false }), I("baskets", "Baskets noires", "#141414", { colors: ["#141414", "#f2f2ee"] }),
    I("ville", "Derbies marron", "#4a2f1f", { material: "cuir", waterproof: true }), I("bottines", "Bottines noires", "#151515", { material: "cuir", waterproof: true }),
    I("bottes", "Bottes de pluie", "#2e4a38", { waterproof: true }), I("claquettes", "Claquettes noires", "#161616"), I("tongs", "Tongs", "#35383d"),
    I("veste", "Blazer marine", "#1b2a49"), I("blouson", "Bomber kaki", "#4b5a3a", { brand: SV, tags: ["streetwear"] }), I("manteau", "Manteau laine gris", "#4a4d52"),
    I("doudoune", "Doudoune noire", "#121212"), I("impermeable", "K-way jaune", "#e0b400", { waterproof: true, windproof: true }), I("coupevent", "Coupe-vent bleu", "#3b5b8f"),
    I("echarpe", "Écharpe grise", "#7b7f86"), I("bonnet", "Bonnet noir", "#1c1c1c"), I("gants", "Gants noirs", "#1c1c1c"),
    I("casquette", "Casquette noire", "#141414", { brand: NC, tags: ["streetwear"] }), I("lunettes", "Lunettes de soleil", "#111111", { sun: true }),
    I("ceinture", "Ceinture marron", "#4a2f1f", { material: "cuir" }), I("ceinture", "Ceinture noire", "#151515", { material: "cuir" }),
    I("montre", "Montre acier", "#c4c7cc", { metal: "argent" }), I("montre", "Montre dorée", "#c9a227", { metal: "or" }),
    I("collier", "Chaîne argent", "#c4c7cc", { metal: "argent" }), I("bracelet", "Bracelet argent", "#c4c7cc", { metal: "argent" }), I("bague", "Bague argent", "#c4c7cc", { metal: "argent" }),
    I("sacados", "Sac à dos noir", "#1d1d1f", { brand: NC }), I("sac", "Sacoche cuir", "#4a2f1f", { material: "cuir" }),
    ...Array.from({ length: 9 }, (_, i) => I("chaussettes", `Chaussettes ${i % 2 ? "blanches" : "noires"} ${i + 1}`, i % 2 ? "#f2f2f2" : "#222222")),
    ...Array.from({ length: 9 }, (_, i) => I("caleçon", `Caleçon ${i + 1}`, "#2a2a2e")),
  ];
}

export function samplePerfumes() {
  return [
    { id: uid(), name: "Cologne agrumes", brand: "", family: "agrumes", concentration: "edt", seasons: ["printemps", "ete"], notes: "bergamote, néroli, musc" },
    { id: uid(), name: "Bois d'hiver", brand: "", family: "boise", concentration: "edp", seasons: ["automne", "hiver"], notes: "cèdre, vétiver, poivre" },
    { id: uid(), name: "Nuit ambrée", brand: "", family: "ambre", concentration: "edp", seasons: ["hiver"], notes: "ambre, vanille, tonka" },
  ];
}
