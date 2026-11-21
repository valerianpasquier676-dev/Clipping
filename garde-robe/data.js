// Données de référence : catégories de vêtements, thèmes, marques, parfums, conseils.
// Aucune dépendance au DOM.

/* ---------- Catégories ---------- */
// slot : emplacement dans la tenue. warmth : isolation (0 = rien, 5 = très chaud). formality : 0 (plage) à 5 (cérémonie).
// open : chaussure ouverte (pas pour la pluie / le froid). water : imperméable par défaut.

export const GROUPS = {
  hauts: "Hauts",
  vestes: "Vestes & manteaux",
  bas: "Bas",
  robes: "Robes",
  chaussures: "Chaussures",
  linge: "Chaussettes & sous-vêtements",
  accessoires: "Accessoires",
  bijoux: "Bijoux & montres",
  sacs: "Sacs",
};

export const CATEGORIES = [
  { key: "tshirt", label: "T-shirt", slot: "top", group: "hauts", warmth: 1, formality: 1, emoji: "👕" },
  { key: "debardeur", label: "Débardeur", slot: "top", group: "hauts", warmth: 0.5, formality: 0.5, emoji: "🎽" },
  { key: "polo", label: "Polo", slot: "top", group: "hauts", warmth: 1, formality: 2.5, emoji: "👕" },
  { key: "chemise", label: "Chemise", slot: "top", group: "hauts", warmth: 1.2, formality: 3.5, emoji: "👔" },
  { key: "pull", label: "Pull / maille", slot: "mid", group: "hauts", warmth: 3, formality: 2.5, emoji: "🧶" },
  { key: "sweat", label: "Sweat / hoodie", slot: "mid", group: "hauts", warmth: 3, formality: 1, emoji: "🧥" },
  { key: "gilet", label: "Gilet", slot: "mid", group: "hauts", warmth: 2, formality: 2.5, emoji: "🧥" },

  { key: "veste", label: "Veste / blazer", slot: "outer", group: "vestes", warmth: 2, formality: 3.5, emoji: "🧥" },
  { key: "blouson", label: "Blouson / bomber", slot: "outer", group: "vestes", warmth: 2.5, formality: 1.5, emoji: "🧥" },
  { key: "manteau", label: "Manteau", slot: "outer", group: "vestes", warmth: 4, formality: 3.5, emoji: "🧥" },
  { key: "doudoune", label: "Doudoune", slot: "outer", group: "vestes", warmth: 5, formality: 1, emoji: "🧥" },
  { key: "impermeable", label: "Imperméable / K-way", slot: "outer", group: "vestes", warmth: 1.5, formality: 1.5, emoji: "🌧️", water: true, wind: true },
  { key: "coupevent", label: "Coupe-vent", slot: "outer", group: "vestes", warmth: 1.5, formality: 1, emoji: "🌬️", wind: true },

  { key: "pantalon", label: "Pantalon", slot: "bottom", group: "bas", warmth: 1.5, formality: 3.5, emoji: "👖" },
  { key: "jean", label: "Jean", slot: "bottom", group: "bas", warmth: 1.5, formality: 2, emoji: "👖" },
  { key: "jogging", label: "Jogging", slot: "bottom", group: "bas", warmth: 1.5, formality: 0.5, emoji: "👖" },
  { key: "short", label: "Short", slot: "bottom", group: "bas", warmth: 0.4, formality: 1, emoji: "🩳" },
  { key: "bermuda", label: "Bermuda", slot: "bottom", group: "bas", warmth: 0.6, formality: 2, emoji: "🩳" },
  { key: "jupe", label: "Jupe", slot: "bottom", group: "bas", warmth: 0.8, formality: 2.5, emoji: "👗" },

  { key: "robe", label: "Robe", slot: "dress", group: "robes", warmth: 1.2, formality: 3, emoji: "👗" },

  { key: "baskets", label: "Baskets", slot: "shoes", group: "chaussures", warmth: 1, formality: 1, emoji: "👟" },
  { key: "ville", label: "Chaussures de ville", slot: "shoes", group: "chaussures", warmth: 1, formality: 4.5, emoji: "👞" },
  { key: "bottines", label: "Bottines", slot: "shoes", group: "chaussures", warmth: 1.5, formality: 3, emoji: "🥾" },
  { key: "bottes", label: "Bottes", slot: "shoes", group: "chaussures", warmth: 2, formality: 2, emoji: "🥾", water: true },
  { key: "sandales", label: "Sandales", slot: "shoes", group: "chaussures", warmth: 0, formality: 1.5, emoji: "🩴", open: true },
  { key: "claquettes", label: "Claquettes", slot: "shoes", group: "chaussures", warmth: 0, formality: 0.5, emoji: "🩴", open: true },
  { key: "tongs", label: "Tongs", slot: "shoes", group: "chaussures", warmth: 0, formality: 0, emoji: "🩴", open: true },

  { key: "chaussettes", label: "Chaussettes", slot: "socks", group: "linge", warmth: 0.5, formality: 2, emoji: "🧦" },
  { key: "caleçon", label: "Caleçon / sous-vêtement", slot: "underwear", group: "linge", warmth: 0, formality: 0, emoji: "🩲" },

  { key: "lunettes", label: "Lunettes", slot: "glasses", group: "accessoires", warmth: 0, formality: 2, emoji: "🕶️" },
  { key: "casquette", label: "Casquette", slot: "hat", group: "accessoires", warmth: 0.3, formality: 0.5, emoji: "🧢" },
  { key: "chapeau", label: "Chapeau", slot: "hat", group: "accessoires", warmth: 0.5, formality: 2.5, emoji: "👒" },
  { key: "bonnet", label: "Bonnet", slot: "hat", group: "accessoires", warmth: 1.5, formality: 1, emoji: "🧶" },
  { key: "echarpe", label: "Écharpe / foulard", slot: "scarf", group: "accessoires", warmth: 1.5, formality: 2.5, emoji: "🧣" },
  { key: "gants", label: "Gants", slot: "gloves", group: "accessoires", warmth: 1.5, formality: 2.5, emoji: "🧤" },
  { key: "ceinture", label: "Ceinture", slot: "belt", group: "accessoires", warmth: 0, formality: 2.5, emoji: "➰" },

  { key: "montre", label: "Montre", slot: "watch", group: "bijoux", warmth: 0, formality: 2.5, emoji: "⌚" },
  { key: "collier", label: "Collier / chaîne", slot: "necklace", group: "bijoux", warmth: 0, formality: 2, emoji: "📿" },
  { key: "bracelet", label: "Bracelet", slot: "bracelet", group: "bijoux", warmth: 0, formality: 2, emoji: "📿" },
  { key: "bague", label: "Bague", slot: "ring", group: "bijoux", warmth: 0, formality: 2, emoji: "💍" },
  { key: "boucles", label: "Boucles d'oreilles", slot: "earrings", group: "bijoux", warmth: 0, formality: 2, emoji: "✨" },

  { key: "sacados", label: "Sac à dos", slot: "bag", group: "sacs", warmth: 0, formality: 1, emoji: "🎒", backpack: true },
  { key: "sac", label: "Sac (bandoulière, cabas…)", slot: "bag", group: "sacs", warmth: 0, formality: 2.5, emoji: "👜" },
];

export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

// Ordre d'affichage d'une tenue, de la tête aux pieds.
export const SLOT_ORDER = ["hat", "glasses", "earrings", "scarf", "necklace", "outer", "mid", "top", "dress", "gloves", "bracelet", "watch", "ring", "belt", "bottom", "bag", "socks", "shoes", "underwear"];
export const SLOT_LABEL = {
  hat: "Tête", glasses: "Lunettes", earrings: "Boucles d'oreilles", scarf: "Cou", necklace: "Collier", outer: "Veste / manteau", mid: "Couche intermédiaire",
  top: "Haut", dress: "Robe", gloves: "Gants", bracelet: "Bracelet", watch: "Montre", ring: "Bague", belt: "Ceinture", bottom: "Bas", bag: "Sac",
  socks: "Chaussettes", shoes: "Chaussures", underwear: "Sous-vêtements",
};
// Emplacements qui font partie du « cœur » de la tenue.
export const CORE_SLOTS = ["top", "mid", "outer", "bottom", "dress", "shoes"];
export const ACCESSORY_SLOTS = ["hat", "glasses", "scarf", "gloves", "belt", "watch", "necklace", "bracelet", "ring", "earrings", "bag"];

export const PATTERNS = { uni: "Uni", raye: "Rayé", carreaux: "Carreaux", motif: "Motif", logo: "Logo / print" };
export const FITS = { slim: "Ajusté", regular: "Droit / regular", oversize: "Oversize / ample" };
export const SEASONS = { printemps: "Printemps", ete: "Été", automne: "Automne", hiver: "Hiver" };
export const METALS = { "": "—", or: "Doré", argent: "Argenté", noir: "Noir / acier foncé", cuir: "Cuir", autre: "Autre" };

export const STYLE_TAGS = ["streetwear", "minimal", "classique", "sportswear", "vintage", "workwear", "techwear", "bohème", "preppy", "soirée", "outdoor"];

/* ---------- Thèmes ---------- */
// formality : plage visée. prefer.cats : bonus par catégorie. prefer.tags : bonus par étiquette de style.
// palette : any | mono (tout dans la même famille de teintes) | neutral | earth | pop (une couleur vive d'accent).
// temp : plage de température ressentie où le thème a du sens.

export const THEMES = [
  { key: "casual", label: "Casual décontracté", emoji: "☕", desc: "Simple, confortable, facile à vivre.", formality: [0.8, 2.2], contexts: ["loisirs", "travail", "voyage"], temp: [-10, 40], palette: "any",
    prefer: { cats: { jean: 0.8, tshirt: 0.5, baskets: 0.6, sweat: 0.4 }, tags: ["streetwear", "workwear"] }, jewelry: 0.4, hat: 0.2, bag: "any" },
  { key: "streetwear", label: "Streetwear", emoji: "🛹", desc: "Coupes amples, baskets, pièces de marques indé et touche graphique.", formality: [0.3, 2], contexts: ["loisirs", "travail"], temp: [-5, 38], palette: "any",
    prefer: { cats: { baskets: 1.1, sweat: 0.8, casquette: 0.9, sacados: 0.7, jogging: 0.4, blouson: 0.5, bonnet: 0.4 }, tags: ["streetwear", "techwear"], fit: "oversize" }, jewelry: 0.6, hat: 0.5, bag: "backpack" },
  { key: "smart", label: "Smart casual", emoji: "🧑‍💼", desc: "Soigné sans être guindé : chemise, maille, chino ou jean brut.", formality: [2.3, 3.7], contexts: ["travail", "loisirs", "soiree"], temp: [-10, 36], palette: "neutral",
    prefer: { cats: { chemise: 0.8, polo: 0.6, pull: 0.5, pantalon: 0.5, bottines: 0.5, veste: 0.6 }, tags: ["classique", "preppy"] }, jewelry: 0.35, hat: 0.05, bag: "bag" },
  { key: "business", label: "Business", emoji: "💼", desc: "Tenue professionnelle : chemise, pantalon, chaussures de ville.", formality: [3.5, 5], contexts: ["travail"], temp: [-10, 33], palette: "neutral",
    prefer: { cats: { chemise: 1, pantalon: 1, ville: 1.2, veste: 0.9, manteau: 0.5, ceinture: 0.5, montre: 0.6 }, tags: ["classique"] }, jewelry: 0.15, hat: 0, bag: "bag" },
  { key: "minimal", label: "Minimaliste monochrome", emoji: "⬜", desc: "Peu de couleurs, silhouettes épurées, jeux de matières.", formality: [1, 3.5], contexts: ["travail", "loisirs", "soiree"], temp: [-10, 40], palette: "mono",
    prefer: { cats: {}, tags: ["minimal"] }, jewelry: 0.25, hat: 0.05, bag: "any" },
  { key: "sport", label: "Sport & athleisure", emoji: "🏃", desc: "Pratique, respirant, mobile.", formality: [0, 1.3], contexts: ["sport", "loisirs"], temp: [-5, 40], palette: "any",
    prefer: { cats: { jogging: 1, baskets: 1.2, tshirt: 0.6, short: 0.6, sweat: 0.5, casquette: 0.5, sacados: 0.5, coupevent: 0.7 }, tags: ["sportswear", "techwear"] }, jewelry: 0.05, hat: 0.3, bag: "backpack" },
  { key: "soiree", label: "Soirée", emoji: "🌙", desc: "Plus habillé, plus sombre, bijoux et parfum qui se remarquent.", formality: [2.8, 5], contexts: ["soiree"], temp: [-10, 36], palette: "neutral",
    prefer: { cats: { veste: 0.8, chemise: 0.7, bottines: 0.7, ville: 0.7, robe: 0.8 }, tags: ["soirée", "classique"] }, jewelry: 0.8, hat: 0, bag: "bag" },
  { key: "vintage", label: "Rétro / vintage", emoji: "📼", desc: "Coupes d'hier, matières franches, couleurs chaudes.", formality: [1, 3.3], contexts: ["loisirs", "travail", "soiree"], temp: [-10, 36], palette: "earth",
    prefer: { cats: { polo: 0.5, blouson: 0.5, jean: 0.5, pull: 0.4 }, tags: ["vintage", "workwear"] }, jewelry: 0.5, hat: 0.3, bag: "any" },
  { key: "outdoor", label: "Outdoor / balade", emoji: "🥾", desc: "Praticité, couches qui se règlent, protection contre la météo.", formality: [0.3, 2], contexts: ["loisirs", "sport", "voyage"], temp: [-10, 32], palette: "earth",
    prefer: { cats: { bottes: 0.8, impermeable: 1, coupevent: 0.8, sacados: 0.9, bonnet: 0.5, gilet: 0.4 }, tags: ["outdoor", "techwear", "workwear"] }, jewelry: 0.05, hat: 0.4, bag: "backpack" },
  { key: "cosy", label: "Weekend cosy", emoji: "🛋️", desc: "Mailles épaisses, tissus doux, zéro contrainte.", formality: [0.3, 2], contexts: ["loisirs"], temp: [-10, 17], palette: "neutral",
    prefer: { cats: { pull: 1, sweat: 0.9, jogging: 0.6, echarpe: 0.5, bonnet: 0.4 }, tags: [] }, jewelry: 0.2, hat: 0.2, bag: "any" },
  { key: "ete", label: "Été / plage", emoji: "🏖️", desc: "Léger, clair, ouvert : shorts, lunettes, chapeau.", formality: [0, 1.8], contexts: ["loisirs", "voyage"], temp: [24, 45], palette: "pop",
    prefer: { cats: { short: 1, tshirt: 0.6, debardeur: 0.7, tongs: 0.6, claquettes: 0.6, sandales: 0.7, lunettes: 0.9, casquette: 0.6, chapeau: 0.6 }, tags: [] }, jewelry: 0.5, hat: 0.6, bag: "any" },
  { key: "pop", label: "Color pop", emoji: "🎨", desc: "Une base sobre et une pièce de couleur franche qui fait la tenue.", formality: [0.8, 3], contexts: ["loisirs", "travail", "soiree"], temp: [-5, 40], palette: "pop",
    prefer: { cats: {}, tags: [] }, jewelry: 0.4, hat: 0.2, bag: "any" },
];
export const THEME = Object.fromEntries(THEMES.map((t) => [t.key, t]));

export const CONTEXTS = { travail: "Travail / cours", loisirs: "Loisirs", soiree: "Soirée", sport: "Sport", voyage: "Voyage / sortie" };

/* ---------- Marques (indépendantes) ---------- */
// Noms saisis tels que donnés : à corriger depuis l'écran « Marques » si l'orthographe est différente.
export const BRAND_PRESETS = [
  { name: "Stuque Divin by Divin", style: "streetwear", fit: "oversize", sizeNote: "", preset: true },
  { name: "NoClout", style: "streetwear", fit: "oversize", sizeNote: "", preset: true },
  { name: "Cynique d'Avril", style: "streetwear", fit: "regular", sizeNote: "", preset: true },
  { name: "Supply Vicinity", style: "streetwear", fit: "regular", sizeNote: "", preset: true },
];
export const SIZE_NOTES = { "": "Taille normalement", petit: "Taille petit (prendre au-dessus)", grand: "Taille grand (prendre en dessous)" };

/* ---------- Parfums ---------- */

export const PERFUME_FAMILIES = [
  { key: "agrumes", label: "Hespéridé / agrumes", notes: "citron, bergamote, mandarine, néroli", feel: "Vif, propre, énergisant.", temp: [18, 45], moments: ["jour"], formal: [0, 4], note: "Tient peu : à revaporiser. Idéal en forte chaleur et au bureau." },
  { key: "aquatique", label: "Aquatique / marin", notes: "notes marines, sel, algue, melon d'eau", feel: "Frais, aérien, sportif.", temp: [18, 45], moments: ["jour"], formal: [0, 3], note: "Très agréable par temps chaud et humide, discret." },
  { key: "aromatique", label: "Aromatique / fougère", notes: "lavande, romarin, sauge, géranium", feel: "Net, masculin classique, rassurant.", temp: [8, 35], moments: ["jour", "soir"], formal: [1, 5], note: "Polyvalent, très bon choix pour le travail." },
  { key: "floral", label: "Floral", notes: "rose, jasmin, pivoine, fleur d'oranger", feel: "Doux, lumineux, romantique.", temp: [10, 32], moments: ["jour", "soir"], formal: [1, 5], note: "Les florais blancs sont plus capiteux : 1 à 2 vaporisations de moins." },
  { key: "fruite", label: "Fruité", notes: "pomme, poire, pêche, fruits rouges", feel: "Gai, juvénile, sucré.", temp: [12, 35], moments: ["jour"], formal: [0, 3], note: "Parfait pour le printemps et l'été, plutôt casual." },
  { key: "boise", label: "Boisé", notes: "cèdre, santal, vétiver, patchouli", feel: "Élégant, sec, chaleureux.", temp: [0, 28], moments: ["jour", "soir"], formal: [2, 5], note: "Valeur sûre en intersaison, très bon pour le bureau et les soirées." },
  { key: "epice", label: "Épicé", notes: "poivre, cardamome, cannelle, safran", feel: "Dynamique, caractère.", temp: [0, 24], moments: ["soir", "jour"], formal: [1, 5], note: "Brille quand il fait frais ; dosage mesuré." },
  { key: "ambre", label: "Ambré / oriental", notes: "ambre, vanille, résines, encens", feel: "Chaud, enveloppant, sensuel.", temp: [-10, 17], moments: ["soir"], formal: [2, 5], note: "À réserver au froid et aux soirées : trop lourd en chaleur." },
  { key: "gourmand", label: "Gourmand", notes: "tonka, caramel, café, cacao, amande", feel: "Réconfortant, doux, sucré.", temp: [-10, 15], moments: ["soir", "jour"], formal: [0, 3], note: "Très présent : 2 vaporisations suffisent." },
  { key: "cuir", label: "Cuiré / tabac", notes: "cuir, tabac, daim, bois fumé", feel: "Brut, racé, mature.", temp: [-5, 22], moments: ["soir"], formal: [2, 5], note: "Style marqué ; superbe en automne-hiver et en soirée." },
  { key: "musque", label: "Musqué / poudré", notes: "musc blanc, iris, poudre, coton propre", feel: "Peau propre, doux, discret.", temp: [5, 35], moments: ["jour", "soir"], formal: [0, 5], note: "Le plus consensuel : idéal quand on veut rester discret." },
  { key: "vert", label: "Vert / herbacé", notes: "feuille verte, thé, menthe, figuier", feel: "Naturel, frais, jardin.", temp: [12, 38], moments: ["jour"], formal: [0, 4], note: "Très bon au printemps ou après la pluie." },
];
export const PERF_FAMILY = Object.fromEntries(PERFUME_FAMILIES.map((f) => [f.key, f]));

export const PERFUME_CONCENTRATIONS = {
  edc: { label: "Eau de Cologne", hours: "1 à 2 h", sprays: "3 à 5" },
  edt: { label: "Eau de Toilette", hours: "3 à 5 h", sprays: "3 à 4" },
  edp: { label: "Eau de Parfum", hours: "5 à 8 h", sprays: "2 à 3" },
  extrait: { label: "Extrait / Parfum", hours: "8 h et plus", sprays: "1 à 2" },
};

export const PERFUME_GUIDE = [
  ["Où appliquer", "Sur les points de chaleur : cou, poignets, creux des coudes, derrière les oreilles. Évite les vêtements délicats (taches) et la laine épaisse."],
  ["Ne pas frotter", "Frotter les poignets écrase les molécules de tête et raccourcit la tenue. Vaporise et laisse sécher."],
  ["Peau hydratée", "Une peau sèche fait vite disparaître le parfum : une crème neutre ou non parfumée juste avant prolonge la tenue."],
  ["Doser selon la météo", "Chaleur et humidité amplifient un parfum : moins de vaporisations en été, un peu plus par temps froid et sec."],
  ["Saison", "Frais (agrumes, aquatique, vert) en chaleur ; boisé, épicé, ambré, gourmand quand il fait frais."],
  ["Occasion", "Bureau et rendez-vous pros : discret (aromatique, boisé léger, musqué). Soirée : plus de caractère (ambré, cuiré, épicé)."],
  ["Fatigue olfactive", "Après quelques minutes, tu ne sens plus ton parfum : c'est normal, n'en rajoute pas. Alterne 2 ou 3 parfums dans la semaine."],
  ["Conservation", "À l'abri de la lumière, de la chaleur et des variations de température (évite la salle de bain). Dans sa boîte, il se garde plusieurs années."],
  ["Tester", "Teste sur la peau (pas seulement sur une bandelette) et attends 20 à 30 minutes : le cœur et le fond se révèlent après la tête."],
];

/* ---------- Morphologie ---------- */

export const SHAPES = {
  sablier: {
    label: "Sablier",
    desc: "Épaules et hanches de largeur proche, taille nettement plus fine.",
    favor: ["Les coupes qui suivent la taille : hauts ajustés, ceintures, vestes cintrées.", "Les pantalons taille haute et les robes/jupes cintrées.", "Les cols en V ou arrondis, qui respectent l'équilibre naturel."],
    careful: ["Les pièces très boxy ou très amples partout, qui masquent la taille.", "Les ceintures trop larges si tu veux allonger le buste."],
    tips: ["Marque la taille avec une ceinture ou une veste courte cintrée.", "Garde des matières qui tombent bien plutôt que très rigides."],
  },
  poire: {
    label: "Poire (triangle)",
    desc: "Hanches et cuisses plus larges que les épaules et la poitrine.",
    favor: ["Mettre le haut en valeur : couleurs claires, imprimés, détails aux épaules, cols bateau ou carrés.", "Des bas de couleur foncée et unie, coupe droite ou légèrement évasée.", "Vestes qui s'arrêtent à la taille ou sous les hanches avec de la structure aux épaules."],
    careful: ["Les poches plaquées ou les détails volumineux sur les hanches.", "Les pantalons très moulants sur les cuisses sans haut qui rééquilibre."],
    tips: ["Un bomber, un blazer structuré ou des épaulettes légères élargissent visuellement les épaules.", "Les chaussures claires ou originales attirent le regard vers le bas sans alourdir."],
  },
  triangle_inverse: {
    label: "Triangle inversé (V)",
    desc: "Épaules et poitrine plus larges que les hanches.",
    favor: ["Alléger le haut : encolures simples, tissus fluides, couleurs sobres sur le torse.", "Donner du volume en bas : pantalons droits ou larges, poches, couleurs claires ou motifs.", "Vestes aux épaules naturelles (sans épaulettes)."],
    careful: ["Les épaulettes marquées, les cols très larges, les manches bouffantes.", "Les pantalons slim sans haut ample pour équilibrer."],
    tips: ["Une veste ouverte crée une verticale qui affine le torse.", "Les cargos, chinos droits et jeans larges équilibrent très bien."],
  },
  rectangle: {
    label: "Rectangle",
    desc: "Épaules, taille et hanches de largeur proche, silhouette droite.",
    favor: ["Créer des courbes et des plans : superpositions, ceintures, vestes cintrées, volumes aux épaules ou aux hanches.", "Des matières texturées (maille, côtelé, lin) qui donnent du relief.", "Des motifs et des couleurs qui séparent haut et bas."],
    careful: ["Les ensembles monochromes très droits sans rien qui marque la taille."],
    tips: ["Superpose : t-shirt + chemise ouverte + veste donne de la profondeur.", "Une ceinture ou un haut rentré dessine la taille."],
  },
  rond: {
    label: "Rond (ovale)",
    desc: "Taille plus forte que la poitrine et les hanches, le volume se concentre au centre.",
    favor: ["Les lignes verticales : vestes ouvertes, cols en V, rayures verticales, monochrome du haut en bas.", "Des matières qui tombent (pas collantes ni raides) et des coupes droites, taille semi-haute.", "Des couleurs foncées au centre et claires aux extrémités (épaules, pieds)."],
    careful: ["Les matières très moulantes ou très épaisses au niveau du ventre.", "Les grosses rayures horizontales et les poches plaquées sur le ventre."],
    tips: ["Une veste ou chemise ouverte sur un t-shirt uni allonge la silhouette.", "Choisis la bonne taille plutôt que trop grand : une coupe ajustée sans serrer fait toujours mieux qu'un sac."],
  },
  trapeze: {
    label: "Athlétique (trapèze)",
    desc: "Épaules et torse plus larges que la taille, hanches proportionnées.",
    favor: ["Les coupes ajustées et droites qui montrent les proportions : t-shirts bien coupés, chemises cintrées légèrement.", "Les cols ronds ou polos, les pantalons droits ou fuselés.", "Les vestes structurées à la bonne taille aux épaules."],
    careful: ["Les hauts trop serrés aux bras et au torse (tiraillements) ; choisis la taille d'après les épaules.", "Les pantalons très amples avec un haut très ajusté."],
    tips: ["Si les cuisses sont fortes, privilégie des coupes droites ou « tapered » plutôt que slim.", "Fais ajuster la taille d'une chemise chez un retoucheur : beaucoup de coupes sont trop larges à la taille."],
  },
};

export const HEIGHT_TIPS = {
  petit: ["Reste sur des proportions courtes en haut et longues en bas : hauts courts, pantalons taille haute.", "Monochromie ou tons proches du haut en bas pour allonger.", "Évite les ourlets qui s'accumulent sur la chaussure : fais raccourcir, ou choisis un pantalon cropped."],
  moyen: ["Tu peux jouer avec toutes les proportions : adapte surtout la coupe à ta morphologie."],
  grand: ["Les coupes longues et les superpositions te vont bien : manteaux longs, vestes à longueur étendue.", "Les rayures horizontales et les blocs de couleurs coupent la silhouette de façon flatteuse.", "Vérifie les longueurs de manches et de pantalon : choisis des marques qui proposent des tailles « long »."],
};
export const LEGS_TIPS = {
  courtes: ["Jambes plus courtes que le torse : taille haute, haut rentré, pantalon de la même couleur que les chaussures pour prolonger la jambe."],
  longues: ["Jambes longues : tu peux porter des hauts plus longs, des tailles basses et des coupes larges sans écraser la silhouette."],
};

export const FACE_SHAPES = {
  ovale: { label: "Ovale", glasses: "Presque toutes les formes te vont : aviateur, wayfarer, ronde, carrée.", hat: "Tous les chapeaux et casquettes vont bien ; ajuste la taille au crâne.", note: "Visage équilibré : le plus polyvalent." },
  rond: { label: "Rond", glasses: "Montures anguleuses ou rectangulaires et un peu larges pour allonger le visage ; évite les rondes trop petites.", hat: "Casquettes à visière franche et chapeaux à bord asymétrique ; évite les bonnets très serrés.", note: "Cherche les lignes droites et les angles." },
  carre: { label: "Carré", glasses: "Montures rondes ou ovales pour adoucir la mâchoire ; aviateur fin.", hat: "Bords souples (bob, fedora souple) ; casquettes courbées.", note: "Adoucis les angles avec des lignes rondes." },
  long: { label: "Allongé", glasses: "Montures larges et hautes, oversize ou aviateur épais, pour raccourcir visuellement.", hat: "Bonnets enfilés bas, chapeaux à bords larges ; évite les formes hautes.", note: "Cherche de la largeur." },
  coeur: { label: "Cœur (front large)", glasses: "Montures plus larges en bas, ovales ou aviateur léger ; évite les montures chargées sur le haut.", hat: "Chapeaux à bord moyen, casquettes de type baseball.", note: "Équilibre le front et le menton." },
};

// Palettes d'après le sous-ton de peau (guide, pas règle) ; le contraste cheveux/peau décide si on ose des couleurs franches.
export const PALETTES = {
  chaud: { label: "Sous-ton chaud", desc: "Les veines du poignet paraissent plutôt vertes ; l'or flatte souvent plus que l'argent.", colors: [["Camel", "#c19a6b"], ["Olive", "#6b7a3a"], ["Terracotta", "#c8664a"], ["Moutarde", "#d4a017"], ["Crème", "#f1e6cf"], ["Bordeaux", "#6d1f2c"], ["Marron chocolat", "#4a2f1f"], ["Vert sapin", "#2e5339"]], metal: "or" },
  froid: { label: "Sous-ton froid", desc: "Les veines du poignet paraissent plutôt bleues ; l'argent flatte souvent plus que l'or.", colors: [["Bleu marine", "#1f2a4a"], ["Gris anthracite", "#3b3f46"], ["Bleu roi", "#2f4fb4"], ["Émeraude", "#1b7a5a"], ["Rose poudré", "#e6b8c8"], ["Prune", "#5a2a5f"], ["Blanc optique", "#f7f9fc"], ["Gris perle", "#c9ced6"]], metal: "argent" },
  neutre: { label: "Sous-ton neutre", desc: "Pas de dominante nette : tu peux piocher dans les deux familles.", colors: [["Bleu pétrole", "#1d5c6b"], ["Vert sauge", "#8fa58a"], ["Taupe", "#8b7765"], ["Bleu denim", "#4a6785"], ["Rouge brique", "#a4452f"], ["Écru", "#ece4d3"], ["Noir doux", "#1b1c1f"], ["Rose vieux", "#c68b8b"]], metal: "" },
};
