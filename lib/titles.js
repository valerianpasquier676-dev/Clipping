// Génération des titres, descriptions et hashtags de chaque clip.
// Avec ANTHROPIC_API_KEY : titres écrits par Claude à partir du contenu réel du clip.
// Sans clé : modèles d'accroches prêts à l'emploi.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const HOOKS = [
  (t) => `Personne n'a remarqué ça dans ${t} 👀`,
  (t) => `Ce détail de ${t} change TOUT 😳`,
  (t) => `Attends la fin… 🤯 ${t}`,
  (t) => `${t} : le passage que tout le monde attendait 🔥`,
  (t) => `Ils ont vraiment fait ÇA dans ${t} 😱`,
  (t) => `Regarde bien ce moment de ${t} 👇`,
  (t) => `POV : tu découvres ça dans ${t}`,
  (t) => `Le moment le plus fou de ${t} 🚨`,
  (t) => `${t} : tu l'avais vu, ce détail ?`,
  (t) => `On doit parler de ce passage de ${t} 😮`,
  (t) => `${t} va être INCROYABLE, la preuve 👇`,
  (t) => `Ce passage de ${t} m'a choqué 💀`,
];

const isGta = (s) => /gta\s*(6|vi)\b|grand theft auto\s*(6|vi)\b/i.test(s || "");

function topicOf(info) {
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

function hashtagsOf(info) {
  const base = ["#fyp", "#pourtoi", "#viral"];
  if (isGta(info.title) || isGta(info.description)) {
    return ["#gta6", "#gtavi", "#rockstargames", "#gta", "#gaming", ...base];
  }
  const fromTags = (info.tags || [])
    .map((t) => "#" + t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 2 && t.length < 22);
  return [...new Set([...fromTags.slice(0, 4), ...base])];
}

function credit(info) {
  const who = info.channel || info.uploader;
  return who ? `\n🎥 Crédit : ${who}` : "";
}

export function templateTitles(info, clips) {
  const topic = topicOf(info);
  const tags = hashtagsOf(info);
  // Décalage stable par vidéo pour ne pas toujours ressortir les mêmes accroches.
  const seed = [...(info.id || info.title || "x")].reduce((a, c) => a + c.charCodeAt(0), 0);
  return clips.map((clip, i) => {
    const titles = [0, 1, 2].map((k) => HOOKS[(seed + i * 3 + k) % HOOKS.length](topic));
    if (clip.chapter) titles[2] = `${topic} : ${clip.chapter} 🔥`;
    return {
      titles,
      caption: `${titles[0]} ${tags.join(" ")}${credit(info)}`,
      hashtags: tags,
      source: "modèles",
    };
  });
}

const Schema = z.object({
  clips: z.array(
    z.object({
      index: z.number(),
      titles: z.array(z.string()),
      hashtags: z.array(z.string()),
    }),
  ),
});

async function aiTitles(info, clips) {
  const client = new Anthropic();
  const payload = {
    video: {
      titre: info.title,
      chaine: info.channel || info.uploader,
      description: (info.description || "").slice(0, 800),
    },
    clips: clips.map((c, i) => ({
      index: i,
      debut_s: c.start,
      fin_s: c.end,
      chapitre: c.chapter || null,
      transcription: c.transcript || null,
    })),
  };
  const response = await client.messages.parse({
    model: process.env.CLIPPING_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    system:
      "Tu écris des titres TikTok en français pour des clips découpés dans une vidéo plus longue. " +
      "Pour chaque clip, propose 3 titres différents de 60 caractères maximum, qui donnent envie de regarder " +
      "jusqu'au bout (curiosité, enjeu, émotion, 1 ou 2 emojis au plus), et 5 à 8 hashtags pertinents commençant par #. " +
      "Appuie-toi sur la transcription et le chapitre quand ils existent pour parler de ce qui se passe vraiment dans le clip. " +
      "Les titres doivent rester vrais : n'invente ni annonce, ni date, ni fuite, ni chiffre absent des données fournies.",
    messages: [{ role: "user", content: JSON.stringify(payload) }],
    output_config: { effort: "low", format: zodOutputFormat(Schema) },
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("réponse IA inexploitable");
  }
  const byIndex = new Map(response.parsed_output.clips.map((c) => [c.index, c]));
  return clips.map((_, i) => {
    const c = byIndex.get(i);
    if (!c || !c.titles.length) throw new Error(`titres manquants pour le clip ${i + 1}`);
    const hashtags = c.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h));
    return {
      titles: c.titles.slice(0, 3),
      caption: `${c.titles[0]} ${hashtags.join(" ")}${credit(info)}`,
      hashtags,
      source: "IA",
    };
  });
}

export async function generateTitles(info, clips, log = () => {}) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await aiTitles(info, clips);
    } catch (err) {
      log(`Titres IA indisponibles (${err.message}), utilisation des modèles.`);
    }
  }
  return templateTitles(info, clips);
}
