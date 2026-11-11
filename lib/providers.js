// IA gratuites ou locales, via l'API « compatible OpenAI » que parlent
// Ollama (sur ton ordinateur), Groq, Gemini et OpenRouter.

import fs from "node:fs";

const visionName = /vl\b|vision|llava|gemma-?[34]|gemini|scout|maverick|qwen3\.[5-9]|pixtral|minicpm|moondream|gpt-4o|gpt-5/i;

export const PROVIDERS = {
  ollama: {
    label: "Ollama",
    baseUrl: process.env.OLLAMA_URL || "http://localhost:11434/v1",
    needsKey: false,
    maxImages: 3,
    prefer: [/qwen3-?vl/i, /gemma-?4/i, /gemma-?3/i, /qwen2\.5-?vl/i, /llama3\.2-vision/i, /llava/i, /minicpm-v/i, /moondream/i],
    hint: "Ollama n'a aucun modèle installé : lance « ollama pull gemma3:4b » puis réessaie",
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    needsKey: true,
    maxImages: 3,
    prefer: [/qwen3\.[5-9]/i, /llama-4-scout/i, /llama-4-maverick/i, /llama-3\.3-70b/i],
  },
  gemini: {
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    needsKey: true,
    maxImages: 3,
    // Les modèles « flash » sont ceux du palier gratuit ; le plus récent d'abord.
    pick: (models) =>
      models
        .map((m) => m.id.replace(/^models\//, ""))
        .filter((id) => /^gemini-[\d.]+-flash/.test(id) && !/image|tts|audio|live|embed|native|thinking/.test(id))
        .sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)) || a.length - b.length),
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
    maxImages: 3,
    // Modèles gratuits (« :free »), ceux qui acceptent les images d'abord.
    pick: (models) => {
      const free = models.filter((m) => m.id.endsWith(":free"));
      const sees = (m) => (m.architecture?.input_modalities || []).includes("image");
      return [...free.filter(sees), ...free.filter((m) => !sees(m))].map((m) => m.id);
    },
  },
  custom: { label: "IA personnalisée", baseUrl: null, needsKey: false, maxImages: 3, prefer: [] },
};

class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function call(url, { key, body, timeoutMs }) {
  let res;
  try {
    res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ProviderError(err.name === "TimeoutError" ? "pas de réponse à temps" : "service injoignable", 0);
  }
  const text = await res.text();
  if (!res.ok) throw new ProviderError(text.slice(0, 200).replace(/\s+/g, " "), res.status);
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("réponse illisible", 0);
  }
}

/** Modèles à essayer, dans l'ordre, quand l'utilisateur n'en a pas choisi. */
export async function candidateModels(preset, baseUrl, key) {
  const list = await call(`${baseUrl}/models`, { key, timeoutMs: 20000 });
  const models = list.data || list.models || [];
  if (!models.length) throw new ProviderError(preset.hint || "aucun modèle disponible", 0);
  if (preset.pick) {
    const picked = preset.pick(models);
    if (picked.length) return picked.slice(0, 3);
  }
  const ids = models.map((m) => m.id);
  const ordered = [];
  for (const re of preset.prefer || []) for (const id of ids) if (re.test(id) && !ordered.includes(id)) ordered.push(id);
  for (const id of ids) if (!ordered.includes(id) && visionName.test(id)) ordered.push(id);
  for (const id of ids) if (!ordered.includes(id) && !/embed|whisper|tts|guard|rerank/i.test(id)) ordered.push(id);
  return ordered.slice(0, 3);
}

/** Extrait l'objet JSON d'une réponse, même entourée de texte ou de ```json. */
export function parseLoose(text) {
  if (!text) return null;
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
}

/** Garde uniquement les passages bien formés d'une réponse. */
export function cleanClips(parsed, indexes) {
  const out = new Map();
  for (const c of Array.isArray(parsed?.clips) ? parsed.clips : []) {
    const index = Number(c?.index);
    const titles = (Array.isArray(c?.titles) ? c.titles : [])
      .filter((t) => typeof t === "string" && t.trim())
      .map((t) => t.trim().slice(0, 90));
    if (!indexes.includes(index) || !titles.length) continue;
    const score = Number(c.score);
    out.set(index, {
      titles: titles.slice(0, 3),
      hook: typeof c.hook === "string" && c.hook.trim() ? c.hook.trim().slice(0, 60) : titles[0],
      hashtags: (Array.isArray(c.hashtags) ? c.hashtags : [])
        .filter((h) => typeof h === "string" && h.trim())
        .map((h) => "#" + h.trim().replace(/^#+/, "").replace(/\s+/g, ""))
        .slice(0, 8),
      score: Number.isFinite(score) ? Math.min(10, Math.max(0, score)) : null,
      summary: typeof c.what_happens === "string" ? c.what_happens.trim().slice(0, 200) : null,
    });
  }
  return out;
}

const JSON_RULES = `

Réponds uniquement avec un objet JSON, sans texte autour, de cette forme exacte :
{"clips":[{"index":0,"what_happens":"…","score":7,"hook":"…","titles":["…","…","…"],"hashtags":["#…"]}]}
avec une entrée par passage reçu, en reprenant son "index".`;

/**
 * Fait analyser les passages par une IA compatible OpenAI, par petits lots pour
 * rester dans les limites des modèles locaux et des offres gratuites.
 * Retourne une Map index -> résultat ; les passages non traités en sont absents.
 */
export async function compatTitles({ ai, system, video, clips, log = () => {} }) {
  const preset = PROVIDERS[ai.provider];
  const baseUrl = (ai.baseUrl || preset.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) throw new ProviderError("adresse de l'IA manquante", 0);
  if (preset.needsKey && !ai.key) throw new ProviderError("clé manquante", 401);

  let models = ai.model ? [ai.model] : await candidateModels(preset, baseUrl, ai.key);
  const timeoutMs = ai.provider === "ollama" || ai.provider === "custom" ? 15 * 60 * 1000 : 120 * 1000;
  const results = new Map();
  const usedTitles = [];
  const BATCH = 3;

  for (let at = 0; at < clips.length; at += BATCH) {
    const batch = clips.slice(at, at + BATCH).map((c, k) => ({ c, index: at + k }));
    const build = (withImages) => {
      const content = [{ type: "text", text: JSON.stringify({ video, titres_deja_utilises: usedTitles }) }];
      let images = 0;
      for (const { c, index } of batch) {
        content.push({
          type: "text",
          text: JSON.stringify({
            index,
            debut_s: c.start,
            fin_s: c.end,
            chapitre: c.chapter || null,
            paroles: c.transcript || null,
            mesures: c.features || null,
          }),
        });
        const frame = c.frames?.[Math.floor((c.frames.length - 1) / 2)]; // l'image du milieu
        if (withImages && frame && images < preset.maxImages) {
          images++;
          content.push({
            type: "image_url",
            image_url: { url: "data:image/jpeg;base64," + fs.readFileSync(frame).toString("base64") },
          });
        }
      }
      return [
        { role: "system", content: system + JSON_RULES },
        { role: "user", content: withImages ? content : content.map((p) => p.text).join("\n") },
      ];
    };

    let done = false;
    let lastError = null;
    for (const model of models) {
      // D'abord avec les images ; si le modèle ne les accepte pas, texte seul.
      for (const withImages of visionName.test(model) || ai.model ? [true, false] : [false]) {
        try {
          const body = { model, messages: build(withImages), temperature: 0.8 };
          if (withImages) body.response_format = { type: "json_object" };
          const res = await call(`${baseUrl}/chat/completions`, { key: ai.key, body, timeoutMs });
          const found = cleanClips(parseLoose(res.choices?.[0]?.message?.content), batch.map((b) => b.index));
          if (!found.size) throw new ProviderError("réponse inexploitable", 0);
          for (const [index, value] of found) {
            results.set(index, { ...value, model, sawImages: withImages });
            usedTitles.push(...value.titles);
          }
          done = true;
          break;
        } catch (err) {
          lastError = err;
          if (err.status === 401 || err.status === 403) throw new ProviderError("clé refusée", err.status);
          if (err.status === 429) break; // limite atteinte sur ce modèle : on passe au suivant
        }
      }
      if (done) {
        models = [model]; // on garde le modèle qui fonctionne pour les lots suivants
        break;
      }
    }
    if (!done) {
      const why =
        lastError?.status === 429 ? "limite gratuite atteinte" : lastError?.status === 404 ? "modèle introuvable" : lastError?.message;
      if (!results.size) throw new ProviderError(why || "échec", lastError?.status || 0);
      log(`L'IA s'est arrêtée en route (${why}) : les passages restants ont des titres automatiques.`);
      break;
    }
  }
  return results;
}
