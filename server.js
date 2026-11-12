import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { processJob, setPaused, cancelRunning } from "./lib/pipeline.js";
import { PROVIDERS } from "./lib/providers.js";
import { createWatcher } from "./lib/watcher.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.DATA_DIR || path.join(here, "data");
const JOBS_DIR = path.join(DATA, "jobs");
const PORT = Number(process.env.PORT || 3000);
const KEEP_HOURS = Number(process.env.KEEP_HOURS || 72);

fs.mkdirSync(JOBS_DIR, { recursive: true });

// Au démarrage, on retrouve les clips déjà produits ; les traitements interrompus sont supprimés.
const jobs = new Map();
for (const id of fs.readdirSync(JOBS_DIR)) {
  const dir = path.join(JOBS_DIR, id);
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(dir, "job.json"), "utf8"));
    jobs.set(id, { ...saved, id, dir });
  } catch {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
// File d'attente : une vidéo à la fois pour ne pas saturer la machine.
const pending = [];
let current = null;
let paused = false;

async function pump() {
  if (current || paused || !pending.length) return;
  const job = (current = pending.shift());
  job.status = "running";
  try {
    await processJob(job);
    job.status = "done";
  } catch (err) {
    if (!job.cancelled) console.error(`[job ${job.id}]`, err);
    job.status = "error";
    job.error = err.message || "Erreur inconnue";
  }
  current = null;
  if (job.cancelled) {
    fs.rmSync(job.dir, { recursive: true, force: true });
    jobs.delete(job.id);
  } else {
    // Sauvegarde pour retrouver les clips après un redémarrage (sans la clé de l'IA).
    try {
      fs.writeFileSync(path.join(job.dir, "job.json"), JSON.stringify({ ...publicJob(job), url: job.url }));
    } catch {}
  }
  pump();
}

const app = express();

/** Réglage IA d'un traitement : celui choisi sur le site, sinon celui du serveur. */
function resolveAi(body = {}) {
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  let provider = str(body.aiProvider);
  let key = str(body.aiKey);
  let model = str(body.aiModel);
  let baseUrl = str(body.aiBaseUrl);
  if (!provider || provider === "server") {
    provider = process.env.AI_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "claude" : "");
    key = process.env.AI_API_KEY || (provider === "claude" ? process.env.ANTHROPIC_API_KEY || "" : "");
    model = process.env.AI_MODEL || "";
    baseUrl = process.env.AI_BASE_URL || "";
  }
  if (provider === "none" || !provider) return null;
  if (provider !== "claude" && !PROVIDERS[provider]) return null;
  if (provider !== "custom") baseUrl = "";
  else if (!/^https?:\/\//i.test(baseUrl)) return null;
  if ((provider === "claude" || PROVIDERS[provider]?.needsKey) && !key) return null;
  return { provider, key: key || null, model: model || null, baseUrl: baseUrl || null };
}

app.get("/api/config", (_req, res) => {
  const ai = resolveAi();
  res.json({ serverAi: ai ? (ai.provider === "claude" ? "Claude" : PROVIDERS[ai.provider].label) : null });
});
app.use(express.json());
app.use(express.static(path.join(here, "public")));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      req.jobId = crypto.randomBytes(8).toString("hex");
      const dir = path.join(JOBS_DIR, req.jobId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, _file, cb) => cb(null, "upload.video"),
  }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 2048) * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(null, /^video\//.test(file.mimetype) || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(file.originalname)),
});

const clamp = (v, lo, hi, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def;
};

function publicJob(job) {
  const { id, status, step, progress, error, clips, videoTitle, notes, options, auto, createdAt } = job;
  return { id, status, step, progress, error, clips, videoTitle, notes, options, auto, createdAt };
}

const cleanOptions = (o = {}) => ({
  clipLength: clamp(o.clipLength, 10, 180, 30),
  maxClips: clamp(o.maxClips, 1, 12, 5),
  format: ["blur", "crop", "original"].includes(o.format) ? o.format : "blur",
  burnTitle: o.burnTitle === true || o.burnTitle === "true",
});

const isHttpUrl = (url) => {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

/** Crée un traitement et le place dans la file d'attente. */
function startJob({ id = crypto.randomBytes(8).toString("hex"), url = null, file = null, title = null, options, ai, auto = false }) {
  const dir = path.join(JOBS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const job = {
    id,
    dir,
    url,
    upload: file ? file.path : null,
    uploadName: file ? file.originalname : null,
    ai,
    options: cleanOptions(options),
    auto,
    videoTitle: title,
    status: "queued",
    step: "En file d'attente",
    progress: 0,
    error: null,
    clips: [],
    notes: [],
    createdAt: Date.now(),
  };
  jobs.set(id, job);

  pending.push(job);
  pump();
  return job;
}

const watcher = createWatcher({
  file: path.join(DATA, "watch.json"),
  startJob: (v) => startJob({ ...v, auto: true }),
});

app.post("/api/jobs", upload.single("video"), (req, res) => {
  const body = req.body || {};
  const url = (body.url || "").trim();
  if (!req.file && !isHttpUrl(url)) {
    return res.status(400).json({ error: "Colle un lien de vidéo valide ou choisis un fichier vidéo." });
  }
  const job = startJob({
    id: req.file ? req.jobId : undefined,
    url: req.file ? null : url,
    file: req.file || null,
    options: body,
    ai: resolveAi(body),
  });
  res.status(202).json(publicJob(job));
});

app.get("/api/jobs", (_req, res) => {
  const list = [...jobs.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ id, status, step, progress, error, videoTitle, uploadName, url, auto, createdAt, clips }) => ({
      id, status, step, progress, error, auto, createdAt, clipCount: clips.length,
      videoTitle: videoTitle || uploadName || url,
    }));
  res.json({ paused, jobs: list });
});

// --- File d'attente : pause, reprise, arrêt, suppression ---
app.post("/api/queue/pause", (_req, res) => {
  paused = true;
  setPaused(true);
  res.json({ paused });
});

app.post("/api/queue/resume", (_req, res) => {
  paused = false;
  setPaused(false);
  pump();
  res.json({ paused });
});

app.delete("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Traitement introuvable." });
  if (job === current) {
    cancelRunning(job); // pump() supprime ses fichiers dès que le programme en cours s'est arrêté
  } else {
    const i = pending.indexOf(job);
    if (i >= 0) pending.splice(i, 1);
    fs.rmSync(job.dir, { recursive: true, force: true });
    jobs.delete(job.id);
  }
  res.json({ ok: true });
});

// --- Automatisation ---
app.get("/api/watch", (_req, res) => res.json(watcher.view()));

app.put("/api/watch", (req, res) => {
  const body = req.body || {};
  const patch = {};
  if ("enabled" in body) patch.enabled = body.enabled === true;
  if ("keyword" in body) patch.keyword = String(body.keyword || "").slice(0, 200);
  if ("intervalMinutes" in body) patch.intervalMinutes = clamp(body.intervalMinutes, 10, 1440, 30);
  if ("options" in body) patch.options = cleanOptions(body.options);
  if ("aiProvider" in body) patch.ai = resolveAi(body);
  watcher.update(patch);
  res.json(watcher.view());
});

app.post("/api/watch/channels", (req, res) => {
  const url = String(req.body?.url || "").trim();
  if (!isHttpUrl(url)) return res.status(400).json({ error: "Colle l'adresse d'une chaîne ou d'une playlist." });
  watcher.addChannel(url);
  res.json(watcher.view());
});

app.delete("/api/watch/channels", (req, res) => {
  watcher.removeChannel(String(req.body?.url || ""));
  res.json(watcher.view());
});

app.post("/api/watch/check", async (_req, res) => {
  const started = await watcher.check();
  res.json({ started, ...watcher.view() });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Traitement introuvable (expiré ?)." });
  res.json(publicJob(job));
});

app.get("/files/:id/:file", (req, res) => {
  const { id, file } = req.params;
  if (!jobs.has(id) || !/^clip-\d+\.(mp4|jpg)$/.test(file)) return res.sendStatus(404);
  const opts = { root: path.join(JOBS_DIR, id) };
  if (req.query.dl) res.attachment(file);
  res.sendFile(file, opts, (err) => err && !res.headersSent && res.sendStatus(404));
});

app.use((err, _req, res, _next) => {
  const tooBig = err?.code === "LIMIT_FILE_SIZE";
  res.status(tooBig ? 413 : 500).json({ error: tooBig ? "Fichier trop volumineux." : "Erreur serveur." });
});

// Nettoyage des anciens traitements.
setInterval(() => {
  const limit = Date.now() - KEEP_HOURS * 3600 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < limit && job.status !== "running" && job.status !== "queued") {
      fs.rmSync(job.dir, { recursive: true, force: true });
      jobs.delete(id);
    }
  }
}, 15 * 60 * 1000).unref();

watcher.start();

app.listen(PORT, () => {
  console.log(`Clipping prêt sur http://localhost:${PORT}`);
  const ai = resolveAi();
  console.log(ai ? `IA par défaut : ${ai.provider}.` : "IA par défaut : aucune (à choisir sur le site).");
});
