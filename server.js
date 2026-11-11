import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { processJob } from "./lib/pipeline.js";
import { PROVIDERS } from "./lib/providers.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.DATA_DIR || path.join(here, "data");
const JOBS_DIR = path.join(DATA, "jobs");
const PORT = Number(process.env.PORT || 3000);
const KEEP_HOURS = Number(process.env.KEEP_HOURS || 24);

fs.rmSync(JOBS_DIR, { recursive: true, force: true }); // les jobs vivent en mémoire : on repart propre
fs.mkdirSync(JOBS_DIR, { recursive: true });

const jobs = new Map();
let queue = Promise.resolve(); // une vidéo à la fois pour ne pas saturer la machine

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
  const { id, status, step, progress, error, clips, videoTitle, notes, options } = job;
  return { id, status, step, progress, error, clips, videoTitle, notes, options };
}

app.post("/api/jobs", upload.single("video"), (req, res) => {
  const body = req.body || {};
  const url = (body.url || "").trim();

  if (!req.file) {
    let ok = false;
    try {
      ok = ["http:", "https:"].includes(new URL(url).protocol);
    } catch {}
    if (!ok) return res.status(400).json({ error: "Colle un lien de vidéo valide ou choisis un fichier vidéo." });
  }

  const id = req.file ? req.jobId : crypto.randomBytes(8).toString("hex");
  const dir = path.join(JOBS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  const job = {
    id,
    dir,
    url: req.file ? null : url,
    upload: req.file ? req.file.path : null,
    uploadName: req.file ? req.file.originalname : null,
    ai: resolveAi(body),
    options: {
      clipLength: clamp(body.clipLength, 10, 180, 30),
      maxClips: clamp(body.maxClips, 1, 12, 5),
      format: ["blur", "crop", "original"].includes(body.format) ? body.format : "blur",
      burnTitle: body.burnTitle === true || body.burnTitle === "true",
    },
    status: "queued",
    step: "En file d'attente",
    progress: 0,
    error: null,
    clips: [],
    notes: [],
    createdAt: Date.now(),
  };
  jobs.set(id, job);

  queue = queue.then(async () => {
    job.status = "running";
    try {
      await processJob(job);
      job.status = "done";
    } catch (err) {
      console.error(`[job ${id}]`, err);
      job.status = "error";
      job.error = err.message || "Erreur inconnue";
    }
  });

  res.status(202).json(publicJob(job));
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

app.listen(PORT, () => {
  console.log(`Clipping prêt sur http://localhost:${PORT}`);
  const ai = resolveAi();
  console.log(ai ? `IA par défaut : ${ai.provider}.` : "IA par défaut : aucune (à choisir sur le site).");
});
