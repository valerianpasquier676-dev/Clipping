// Titres, texte incrusté, description et hashtags de chaque clip.
//
// Deux niveaux :
//  - avec une clé API Anthropic, Claude regarde des images de chaque clip et lit
//    ce qui s'y dit, puis note le clip et écrit des titres sur mesure ;
//  - sans clé, les titres sont construits à partir du contenu détecté dans le clip
//    (chapitre, phrases prononcées, thème, rythme, intensité sonore).

import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { PROVIDERS, compatTitles } from "./providers.js";

const isGta = (s) => /gta\s*(6|vi)\b|grand theft auto\s*(6|vi)\b/i.test(s || "");

export function topicOf(info) {
  const title = info.title || "";
  if (isGta(title) || isGta(info.description)) return "GTA 6";
  const clean = title
    .replace(/[\[(【].*?[\])】]/g, " ")
    .replace(/\s+/g, " ")
    .split(/\s[|\-–—:]\s/)[0]
    .trim();
  if (!clean) return "cette vidéo";
  return clean.length > 32 ? clean.slice(0, 30).trim() + "…" : clean;
}

function baseHashtags(info) {
  const base = ["#fyp", "#pourtoi"];
  if (isGta(info.title) || isGta(info.description)) return ["#gta6", "#gtavi", "#rockstargames", "#gaming", ...base];
  const fromTags = (info.tags || [])
    .map((t) => "#" + t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 2 && t.length < 22);
  return [...new Set([...fromTags.slice(0, 4), ...base])];
}

function credit(info) {
  const who = info.channel || info.uploader;
  return who ? `\n🎥 Crédit : ${who}` : "";
}

// Thèmes reconnus dans ce qui est dit pendant le clip (français et anglais).
const THEMES = [
  { tag: "#map", re: /\b(carte|map|mapa)\b/i, lines: [(t) => `La carte de ${t} vue de près 🗺️`, (t) => `${t} : ce qu'on voit de la carte 👀`] },
  { tag: "#sortie", re: /\b(date de sortie|sortie|release|report[ée]?|delay(ed)?|repouss)/i, lines: [(t) => `${t} : on parle de la date de sortie 📅`, (t) => `La sortie de ${t}, on en est où ? ⏳`] },
  { tag: "#prix", re: /\b(prix|price|euros?|dollars?|\d+\s?[€$])/i, lines: [(t) => `${t} : la question du prix 💸`, (t) => `Combien va coûter ${t} ? 💰`] },
  { tag: "#trailer", re: /\b(trailer|bande[- ]annonce|teaser)\b/i, lines: [(t) => `Ce plan du trailer de ${t} 👀`, (t) => `Le trailer de ${t} décortiqué 🎬`] },
  { tag: "#voitures", re: /\b(voitures?|cars?|v[ée]hicules?|conduite|driving|motos?|bike)\b/i, lines: [(t) => `Les véhicules de ${t} 🚗`, (t) => `La conduite dans ${t}, ça donne ça 🏎️`] },
  { tag: "#police", re: /\b(police|flics?|cops?|wanted|poursuite|chase|[ée]toiles?)\b/i, lines: [(t) => `La police dans ${t} ne rigole pas 🚔`, (t) => `Une poursuite dans ${t}, ça ressemble à ça 🚨`] },
  { tag: "#lucia", re: /\blucia\b/i, lines: [(t) => `Lucia dans ${t} : ce qu'on sait 👀`, (t) => `Ce moment avec Lucia dans ${t} 🔥`] },
  { tag: "#jason", re: /\bjason\b/i, lines: [(t) => `Jason dans ${t} : ce passage 👀`, (t) => `Qui est vraiment Jason dans ${t} ?`] },
  { tag: "#vicecity", re: /\b(vice city|leonida|miami)\b/i, lines: [(t) => `Vice City comme on ne l'a jamais vue 🌴`, (t) => `Bienvenue à Vice City 🌴 ${t}`] },
  { tag: "#graphismes", re: /\b(graphismes?|graphics?|ray ?tracing|r[ée]alis(te|me|tic)|lumi[èe]res?|lighting)\b/i, lines: [(t) => `Les graphismes de ${t} sont fous 😍`, (t) => `Le niveau de réalisme de ${t} 🤯`] },
  { tag: "#gtaonline", re: /\b(online|multijoueur|multiplayer)\b/i, lines: [(t) => `Le mode en ligne de ${t} : ce passage 🌐`, (t) => `${t} en ligne, on en parle 👥`] },
  { tag: "#braquage", re: /\b(braquages?|heists?|missions?|casse)\b/i, lines: [(t) => `Les braquages de ${t} 💰`, (t) => `Cette mission de ${t} s'annonce énorme 🎯`] },
  { tag: "#action", re: /\b(armes?|weapons?|guns?|fusillade|shoot(ing|out)?|explosions?|combat)\b/i, lines: [(t) => `Les combats dans ${t} 💥`, (t) => `Ça tire de partout dans ${t} 🔫`] },
  { tag: "#animaux", re: /\b(animaux|animals?|alligators?|crocodiles?|requins?|sharks?|chiens?|dogs?)\b/i, lines: [(t) => `La faune de ${t} 🐊`, (t) => `Même les animaux sont réalistes dans ${t} 🐊`] },
  { tag: "#ps5", re: /\b(ps5|playstation|xbox|pc|console)\b/i, lines: [(t) => `${t} : sur quelles consoles ? 🎮`, (t) => `${t} sur console, ce qu'on sait 🎮`] },
  { tag: "#leak", re: /\b(fuites?|leaks?|leaked|rumeurs?|rumou?rs?)\b/i, lines: [(t) => `${t} : que disent les rumeurs ? 🤫`, (t) => `Cette rumeur sur ${t} fait parler 👀`] },
  { tag: "#musique", re: /\b(musiques?|music|radio|soundtrack|chanson|song)\b/i, lines: [(t) => `La musique de ${t} 🎶`, (t) => `Mets le son : la bande-son de ${t} 🎧`] },
  { tag: "#easteregg", re: /\b(easter ?eggs?|secrets?|cach[ée]s?|hidden|d[ée]tails?|r[ée]f[ée]rences?)\b/i, lines: [(t) => `Le détail caché de ce plan de ${t} 🔍`, (t) => `Tu avais repéré ce détail dans ${t} ? 👀`] },
  { tag: "#gta5", re: /\b(gta\s?(5|v)\b|compar|versus|\bvs\b)/i, lines: [(t) => `${t} face à GTA 5 : la différence 😳`, (t) => `Le bond entre GTA 5 et ${t} 📈`] },
];

// Accroches selon ce qui se passe à l'image et au son.
const SITUATIONS = {
  action: [
    (t) => `Ça part dans tous les sens dans ${t} 💥`,
    (t) => `Cette séquence d'action de ${t} 🔥`,
    (t) => `Pas le temps de respirer dans ${t} 😮‍💨`,
    (t) => `Le montage de ce passage de ${t} est fou ⚡`,
    (t) => `${t} : ça s'enchaîne à toute vitesse 🏃`,
    (t) => `Tout va très vite dans cette scène de ${t} 💨`,
  ],
  buildUp: [
    (t) => `Attends la fin… 🤯 ${t}`,
    (t) => `Ça monte, ça monte… regarde la fin 👀`,
    (t) => `La fin de ce passage de ${t} 😳`,
    (t) => `${t} : reste jusqu'au bout de cette scène ⏳`,
    (t) => `Ça commence calmement… puis ça explose 💣`,
    (t) => `Le final de cette scène de ${t} 🎇`,
  ],
  intense: [
    (t) => `Le moment le plus intense de ${t} 🚨`,
    (t) => `Mets le son pour ce passage de ${t} 🔊`,
    (t) => `Ce passage de ${t} donne des frissons 🥶`,
    (t) => `${t} : cette scène envoie du lourd 🔥`,
    (t) => `Monte le volume, c'est ${t} 🎧`,
    (t) => `L'ambiance de cette scène de ${t} 😮`,
  ],
  calm: [
    (t) => `Regarde bien l'arrière-plan dans ${t} 🔍`,
    (t) => `Ce plan de ${t} est magnifique 😍`,
    (t) => `Prends le temps de regarder ce plan de ${t} 👀`,
    (t) => `Le calme avant la tempête dans ${t} 🌅`,
    (t) => `${t} : un plan à mettre sur pause ⏸️`,
    (t) => `Les décors de ${t} dans ce passage 🌴`,
  ],
  neutral: [
    (t) => `Ce passage de ${t} vaut le coup d'œil 👇`,
    (t) => `Tu avais vu ce moment de ${t} ?`,
    (t) => `On reparle de ce passage de ${t} 👀`,
    (t) => `${t} : la scène dont tout le monde parle 💬`,
    (t) => `Un extrait de ${t} à revoir 🔁`,
    (t) => `Ce moment de ${t} mérite un deuxième visionnage 👀`,
    (t) => `${t} : ton avis sur cette scène ? 👇`,
    (t) => `Impossible de rater ce passage de ${t} 📌`,
    (t) => `Arrête-toi deux secondes sur ${t} ✋`,
    (t) => `${t} : cette scène en dit long 🤔`,
    (t) => `Encore un passage marquant de ${t} ⭐`,
    (t) => `Qu'est-ce que tu remarques dans ${t} ? 🧐`,
  ],
};

const STOP = new Set(
  ("alors aussi autre avec avoir bien cette comme dans depuis donc elle elles encore entre etre être faire fait " +
    "leur leurs mais meme même nous notre pour plus quand quoi sans sera sont tout tous tres très vous votre vraiment " +
    "cela ceci ceux chose choses comment parce peut peux dire going about that this with have from they what your " +
    "will just like there their would could really because which when then than them were been being also into very")
    .split(" "),
);

function keywords(text, others) {
  const count = (s) => {
    const m = new Map();
    for (const w of (s || "").toLowerCase().match(/[a-zà-ÿ]{5,}/g) || []) if (!STOP.has(w)) m.set(w, (m.get(w) || 0) + 1);
    return m;
  };
  const mine = count(text);
  const rest = count(others);
  return [...mine.entries()]
    .filter(([, n]) => n >= 2)
    .map(([w, n]) => [w, n / (1 + (rest.get(w) || 0))])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);
}

function bestQuote(text) {
  if (!text || !/[.!?]/.test(text)) return null; // sous-titres automatiques sans ponctuation : pas de citation propre
  let best = null;
  for (const raw of text.split(/(?<=[.!?…])\s+/)) {
    const s = raw.trim();
    if (s.length < 18 || s.length > 56) continue;
    const score = (/[?!]/.test(s) ? 2 : 0) + (/\d/.test(s) ? 1 : 0) + (THEMES.some((th) => th.re.test(s)) ? 1 : 0);
    if (!best || score > best.score) best = { s, score };
  }
  return best ? `« ${best.s[0].toUpperCase()}${best.s.slice(1)} »` : null;
}

function situationOf(f = {}) {
  if (f.buildUp) return "buildUp";
  if (f.action) return "action";
  if (f.intense) return "intense";
  if (f.calm) return "calm";
  return "neutral";
}

/** Titres construits à partir du contenu détecté dans chaque clip, sans IA. */
export function localTitles(info, clips) {
  const topic = topicOf(info);
  const base = baseHashtags(info);
  const used = new Set();
  const all = clips.map((c) => c.transcript || "").join(" ");

  return clips.map((clip, i) => {
    const said = `${clip.chapter || ""} ${clip.transcript || ""}`;
    // Thèmes présents dans le clip, le plus souvent évoqué d'abord.
    const hits = (th) => (said.match(new RegExp(th.re.source, "gi")) || []).length;
    const themes = THEMES.map((th) => [th, hits(th)])
      .filter(([, n]) => n > 0)
      .sort((x, y) => y[1] - x[1])
      .map(([th]) => th);
    const rot = (arr, k = 0) => arr[(i + k) % arr.length];

    // Du plus spécifique au plus général ; on garde les trois premiers encore inutilisés.
    const pool = [];
    if (clip.chapter) pool.push(`${topic} : ${clip.chapter}`);
    const quote = bestQuote(clip.transcript);
    if (quote) pool.push(quote);
    themes.forEach((th, k) => pool.push(rot(th.lines, k)(topic)));
    const kw = keywords(clip.transcript, all.replace(clip.transcript || "", ""));
    if (kw.length >= 2) pool.push(`${topic} · ${kw.join(", ")} 👀`);
    const situation = situationOf(clip.features);
    const sit = SITUATIONS[situation];
    const neutral = SITUATIONS.neutral;
    if (situation === "neutral") pool.push(rot(sit, i * 2)(topic), rot(sit, i * 2 + 1)(topic), rot(sit, i * 2 + 2)(topic));
    else pool.push(rot(sit)(topic), rot(neutral, i)(topic), rot(sit, 3)(topic), ...sit.map((f) => f(topic)));
    themes.forEach((th, k) => pool.push(rot(th.lines, k + 1)(topic)));
    pool.push(...SITUATIONS.neutral.map((f) => f(topic)));
    pool.push(`${topic} — moment n°${i + 1} 👇`, `${topic}, extrait ${i + 1} 🎬`, `${topic} : passage ${i + 1} à voir 👀`);

    const titles = [];
    for (const t of pool) {
      if (titles.length === 3) break;
      if (!used.has(t)) {
        used.add(t);
        titles.push(t);
      }
    }
    const hashtags = [...new Set([...base.slice(0, -2), ...themes.slice(0, 2).map((t) => t.tag), ...base.slice(-2)])];
    return {
      titles,
      hook: titles[0],
      caption: `${titles[0]} ${hashtags.join(" ")}${credit(info)}`,
      hashtags,
      score: null,
      source: "analyse automatique",
    };
  });
}

const Schema = z.object({
  clips: z.array(
    z.object({
      index: z.number(),
      score: z.number(),
      what_happens: z.string(),
      hook: z.string(),
      titles: z.array(z.string()),
      hashtags: z.array(z.string()),
    }),
  ),
});

const SYSTEM = `Tu es monteur de clips courts pour TikTok. On te donne des passages candidats découpés dans une vidéo plus longue. Pour chaque passage tu reçois des images extraites (début, milieu, fin), ce qui s'y dit quand il y a des sous-titres, le chapitre, et des mesures (intensité sonore, rythme du montage).

Pour chaque passage :
- what_happens : une phrase qui décrit ce qui se passe réellement à l'image et dans les paroles.
- score : de 0 à 10, la force du passage comme clip TikTok autonome (compréhensible sans le reste de la vidéo, accroche dans les premières secondes, moment marquant). Sers-toi de toute l'échelle : les meilleurs seront gardés, les autres écartés.
- hook : le texte incrusté en haut de la vidéo, 35 caractères maximum, sans emoji.
- titles : 3 titres en français, 60 caractères maximum chacun, 1 ou 2 emojis au plus, avec trois angles différents (par exemple une question, une affirmation, une réaction).
- hashtags : 5 à 8 hashtags commençant par #, du plus précis au plus général.

Chaque texte doit parler de ce qui se passe précisément dans CE passage : ce qu'on voit, ce qui est dit, l'ambiance. Deux passages ne doivent jamais recevoir la même formule. Écris comme un créateur francophone, pas comme une publicité.

Reste exact : n'invente ni annonce, ni date, ni prix, ni fuite, ni chiffre qui ne figure pas dans ce qu'on te donne. Si tu n'es pas sûr de ce que montre une image, décris ce qui est visible plutôt que de deviner.`;

async function aiTitles(info, clips, apiKey) {
  const client = new Anthropic({ apiKey });
  const content = [
    {
      type: "text",
      text: JSON.stringify({
        video: {
          titre: info.title,
          chaine: info.channel || info.uploader || null,
          description: (info.description || "").slice(0, 800),
        },
        nombre_de_passages: clips.length,
      }),
    },
  ];
  clips.forEach((c, i) => {
    content.push({
      type: "text",
      text: JSON.stringify({
        index: i,
        debut_s: c.start,
        fin_s: c.end,
        chapitre: c.chapter || null,
        paroles: c.transcript || null,
        mesures: c.features || null,
      }),
    });
    for (const frame of c.frames || []) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(frame).toString("base64") },
      });
    }
  });

  const response = await client.messages.parse({
    model: process.env.CLIPPING_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { effort: "medium", format: zodOutputFormat(Schema) },
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("réponse inexploitable");

  const byIndex = new Map(response.parsed_output.clips.map((c) => [c.index, c]));
  return clips.map((_, i) => {
    const c = byIndex.get(i);
    if (!c || !c.titles.length) throw new Error(`titres manquants pour le passage ${i + 1}`);
    const hashtags = [...new Set(c.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h)))];
    return {
      titles: c.titles.slice(0, 3),
      hook: c.hook || c.titles[0],
      caption: `${c.titles[0]} ${hashtags.join(" ")}${credit(info)}`,
      hashtags,
      score: c.score,
      summary: c.what_happens,
      source: "IA (Claude)",
    };
  });
}

/**
 * Retourne, pour chaque clip, ses titres. `ai` = { provider, key, model, baseUrl } ou null.
 * Tout passage que l'IA n'a pas pu traiter garde ses titres d'analyse automatique.
 */
export async function generateTitles(info, clips, { ai = null, log = () => {} } = {}) {
  const local = localTitles(info, clips);
  if (!ai) return local;
  const name = ai.provider === "claude" ? "Claude" : PROVIDERS[ai.provider]?.label || ai.provider;
  try {
    if (ai.provider === "claude") return await aiTitles(info, clips, ai.key);

    const video = {
      titre: info.title,
      chaine: info.channel || info.uploader || null,
      description: (info.description || "").slice(0, 500),
    };
    const found = await compatTitles({ ai, system: SYSTEM, video, clips, log });
    const first = found.values().next().value;
    log(`Titres écrits par ${name} (${first.model}${first.sawImages ? ", avec les images" : ", sans les images"}).`);
    return local.map((fallback, i) => {
      const r = found.get(i);
      if (!r) return fallback;
      const hashtags = r.hashtags.length ? r.hashtags : fallback.hashtags;
      return { ...r, hashtags, caption: `${r.titles[0]} ${hashtags.join(" ")}${credit(info)}`, source: `IA (${name})` };
    });
  } catch (err) {
    let why = err.message;
    if (err instanceof Anthropic.AuthenticationError) why = "clé refusée";
    else if (err instanceof Anthropic.RateLimitError) why = "limite d'utilisation de la clé atteinte";
    else if (err instanceof Anthropic.APIConnectionError) why = "service injoignable";
    log(`${name} indisponible (${why}) : titres par analyse automatique à la place.`);
    return local;
  }
}
