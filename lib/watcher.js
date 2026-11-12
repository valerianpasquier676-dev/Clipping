// Automatisation : surveille des chaînes et lance le découpage dès qu'une
// nouvelle vidéo correspondant aux mots-clés est publiée.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULTS = {
  enabled: false,
  intervalMinutes: 30,
  keyword: "",
  options: { clipLength: 30, maxClips: 5, format: "blur", burnTitle: true },
  ai: null,
  channels: [],
  seen: {},
};

/** Les dernières vidéos d'une chaîne ou d'une playlist, la plus récente d'abord. */
export function listVideos(url, limit = 6) {
  // Pour une chaîne YouTube, on vise l'onglet « Vidéos » (pas les Shorts ni les directs).
  if (/youtube\.com\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/?$/i.test(url)) url = url.replace(/\/?$/, "/videos");
  return new Promise((resolve, reject) => {
    const child = spawn(
      "yt-dlp",
      ["--flat-playlist", "--js-runtimes", "node", "--playlist-end", String(limit), "--print", "%(id)s\t%(webpage_url,url)s\t%(title)s", "--", url],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (c) => (out += c));
    child.stderr.on("data", (c) => (err = (err + c).slice(-1000)));
    child.on("error", () => reject(new Error("yt-dlp n'est pas installé sur le serveur.")));
    child.on("close", () => {
      const videos = out
        .split("\n")
        .map((l) => l.split("\t"))
        .filter((p) => p.length >= 3 && /^https?:\/\//.test(p[1]))
        .map(([id, link, ...title]) => ({ id, url: link, title: title.join(" ") }));
      if (videos.length) return resolve(videos);
      if (/proxy|timed out|Temporary failure|getaddrinfo|Connection refused/i.test(err)) {
        return reject(new Error("site vidéo injoignable depuis ce serveur"));
      }
      const reason = err.split("\n").filter((l) => l.includes("ERROR")).pop();
      reject(new Error(reason ? reason.replace(/^ERROR:\s*/, "").slice(0, 160) : "aucune vidéo trouvée à cette adresse"));
    });
  });
}

export function matchesKeyword(title, keyword) {
  const words = (keyword || "").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
  if (!words.length) return true;
  const t = (title || "").toLowerCase();
  return words.some((w) => t.includes(w));
}

export function createWatcher({ file, startJob, list = listVideos, log = console.log }) {
  let state = structuredClone(DEFAULTS);
  try {
    state = { ...state, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {}
  let timer = null;
  let checking = null;

  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
  };

  async function checkChannel(channel) {
    const videos = await list(channel.url);
    const started = [];
    if (!channel.primed) {
      // Première visite : on ne traite que la vidéo la plus récente, pas tout l'historique.
      for (const v of videos.slice(1)) state.seen[v.id] = Date.now();
      channel.primed = true;
    }
    // De la plus ancienne à la plus récente, deux nouvelles vidéos au plus par passage.
    for (const v of videos.filter((x) => !state.seen[x.id]).reverse()) {
      if (started.length >= 2) break;
      state.seen[v.id] = Date.now();
      if (!matchesKeyword(v.title, state.keyword)) continue;
      startJob({ url: v.url, title: v.title, options: state.options, ai: state.ai, channel: channel.url });
      started.push(v.title);
    }
    return started;
  }

  async function check() {
    if (checking) return checking;
    checking = (async () => {
      const started = [];
      for (const channel of state.channels) {
        try {
          started.push(...(await checkChannel(channel)));
          channel.lastError = null;
        } catch (err) {
          channel.lastError = err.message;
          log(`[veille] ${channel.url} : ${err.message}`);
        }
        channel.lastCheck = Date.now();
      }
      // On oublie les vidéos vues il y a plus de 90 jours pour que le fichier ne grossisse pas sans fin.
      const limit = Date.now() - 90 * 24 * 3600 * 1000;
      for (const [id, at] of Object.entries(state.seen)) if (at < limit) delete state.seen[id];
      save();
      return started;
    })().finally(() => (checking = null));
    return checking;
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    if (!state.enabled || !state.channels.length) return;
    timer = setInterval(() => check().catch(() => {}), state.intervalMinutes * 60 * 1000);
    timer.unref?.();
  }

  return {
    /** État affichable : la clé de l'IA n'en sort jamais. */
    view() {
      const { seen, ai, ...rest } = state;
      return { ...rest, aiProvider: ai?.provider || null, checking: Boolean(checking) };
    },
    addChannel(url) {
      if (state.channels.some((c) => c.url === url)) return;
      state.channels.push({ url, primed: false, lastCheck: null, lastError: null });
      save();
      schedule();
    },
    removeChannel(url) {
      state.channels = state.channels.filter((c) => c.url !== url);
      save();
      schedule();
    },
    update(patch) {
      for (const k of ["enabled", "intervalMinutes", "keyword", "options", "ai"]) if (k in patch) state[k] = patch[k];
      save();
      schedule();
    },
    check,
    start: schedule,
    stop: () => clearInterval(timer),
  };
}
