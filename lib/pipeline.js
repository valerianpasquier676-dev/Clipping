// Chaîne de traitement d'une vidéo : téléchargement (yt-dlp), analyse,
// choix des passages, titres, puis découpage en clips (ffmpeg).

import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pickSegments } from "./segments.js";
import { generateTitles } from "./titles.js";

const MAX_DURATION = Number(process.env.MAX_VIDEO_SECONDS || 3 * 3600);

function run(cmd, args, { onLine, onStdout } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let tail = "";
    const feed = (chunk) => {
      const text = chunk.toString();
      tail = (tail + text).slice(-2000);
      if (onLine) text.split(/[\r\n]+/).forEach((l) => l && onLine(l));
    };
    if (onStdout) child.stdout.on("data", onStdout);
    else child.stdout.on("data", feed);
    child.stderr.on("data", feed);
    child.on("error", (err) =>
      reject(err.code === "ENOENT" ? new Error(`« ${cmd} » n'est pas installé sur le serveur.`) : err),
    );
    child.on("close", (code) => resolve({ code, tail }));
  });
}

function fontFile() {
  if (process.env.CLIPPING_FONT) return process.env.CLIPPING_FONT;
  try {
    return execFileSync("fc-match", ["-f", "%{file}", "sans:bold"]).toString().trim() || null;
  } catch {
    return null;
  }
}
const FONT = fontFile();

async function download(job) {
  const out = path.join(job.dir, "source.%(ext)s");
  const { tail } = await run(
    "yt-dlp",
    [
      "--no-playlist",
      "--newline",
      "--match-filter", `duration<=${MAX_DURATION}`,
      "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]/b",
      "--merge-output-format", "mp4",
      "--write-info-json",
      "--write-subs", "--write-auto-subs",
      "--sub-langs", "fr.*,en.*",
      "--sub-format", "vtt",
      "-o", out,
      "--", job.url,
    ],
    {
      onLine: (line) => {
        const m = line.match(/\[download\]\s+([\d.]+)%/);
        if (m) job.progress = Math.round(Number(m[1]) * 0.4);
      },
    },
  );
  const file = fs.readdirSync(job.dir).find((f) => /^source\.(mp4|mkv|webm|mov)$/.test(f));
  if (!file) {
    const reason = tail.split("\n").filter((l) => /ERROR|does not pass filter/.test(l)).pop();
    throw new Error(
      reason
        ? `Téléchargement impossible : ${reason.replace(/^ERROR:\s*/, "")}`
        : "Téléchargement impossible. Vérifie le lien.",
    );
  }
  let info = {};
  try {
    info = JSON.parse(fs.readFileSync(path.join(job.dir, "source.info.json"), "utf8"));
  } catch {}
  return { file: path.join(job.dir, file), info };
}

async function probeDuration(file) {
  const { tail } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
  ]);
  const d = parseFloat(tail.trim().split("\n").pop());
  if (!Number.isFinite(d) || d <= 0) throw new Error("Fichier vidéo illisible.");
  return d;
}

/** Énergie audio (RMS) par seconde, calculée en flux pour ne rien garder en mémoire. */
async function audioEnergy(file) {
  const RATE = 8000;
  const energy = [];
  let sum = 0;
  let n = 0;
  let odd = null;
  await run(
    "ffmpeg",
    ["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"],
    {
      onStdout: (chunk) => {
        if (odd) {
          chunk = Buffer.concat([odd, chunk]);
          odd = null;
        }
        const usable = chunk.length - (chunk.length % 2);
        for (let i = 0; i < usable; i += 2) {
          const v = chunk.readInt16LE(i) / 32768;
          sum += v * v;
          if (++n === RATE) {
            energy.push(Math.sqrt(sum / RATE));
            sum = 0;
            n = 0;
          }
        }
        if (usable < chunk.length) odd = chunk.subarray(usable);
      },
    },
  );
  return energy;
}

/** Sous-titres .vtt -> [{start, text}] sans les répétitions des sous-titres automatiques. */
export function parseVtt(text) {
  const cues = [];
  const toSec = (t) => {
    const p = t.split(":").map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  };
  let last = "";
  for (const block of text.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const t = lines.findIndex((l) => l.includes("-->"));
    if (t < 0) continue;
    const start = toSec(lines[t].split("-->")[0].trim().replace(",", "."));
    for (const raw of lines.slice(t + 1)) {
      const line = raw.replace(/<[^>]+>/g, "").trim();
      if (line && line !== last) {
        cues.push({ start, text: line });
        last = line;
      }
    }
  }
  return cues;
}

function loadTranscript(dir) {
  const subs = fs.readdirSync(dir).filter((f) => f.endsWith(".vtt"));
  const file = subs.find((f) => /\.fr/.test(f)) || subs[0];
  if (!file) return [];
  try {
    return parseVtt(fs.readFileSync(path.join(dir, file), "utf8"));
  } catch {
    return [];
  }
}

/** Coupe le texte incrusté en lignes courtes ; les emojis sont retirés (police standard). */
export function wrapHook(title, width = 20) {
  const clean = title.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();
  const lines = [];
  let cur = "";
  for (const word of clean.split(" ")) {
    if (cur && (cur + " " + word).length > width) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? cur + " " + word : word;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4).join("\n");
}

async function cutClip(job, source, clip, n) {
  const out = path.join(job.dir, `clip-${n}.mp4`);
  const thumb = path.join(job.dir, `clip-${n}.jpg`);
  const { format, burnTitle } = job.options;

  let chain;
  if (format === "crop") {
    chain = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[base]";
  } else if (format === "original") {
    chain = "[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1[base]";
  } else {
    chain =
      "[0:v]split[a][b];" +
      "[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=10,scale=1080:1920[bg];" +
      "[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg];" +
      "[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[base]";
  }
  if (burnTitle && FONT && format !== "original") {
    // Une instruction drawtext par ligne pour que chaque ligne soit centrée.
    const lines = wrapHook(clip.titles[0]).split("\n");
    lines.forEach((line, i) => {
      const textFile = path.join(job.dir, `clip-${n}-${i}.txt`);
      fs.writeFileSync(textFile, line);
      chain +=
        `;[${i === 0 ? "base" : "t" + i}]drawtext=fontfile='${FONT}':textfile='${textFile}':expansion=none:` +
        `fontsize=68:fontcolor=white:borderw=7:bordercolor=black:x=(w-text_w)/2:y=${230 + i * 86}` +
        `[${i === lines.length - 1 ? "v" : "t" + (i + 1)}]`;
    });
  } else {
    chain += ";[base]null[v]";
  }

  const { code, tail } = await run("ffmpeg", [
    "-v", "error", "-y",
    "-ss", String(clip.start), "-t", String(clip.end - clip.start),
    "-i", source,
    "-filter_complex", chain,
    "-map", "[v]", "-map", "0:a?",
    "-r", "30",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
    out,
  ]);
  if (code !== 0 || !fs.existsSync(out)) throw new Error(`Découpage du clip ${n} raté : ${tail.trim().slice(-300)}`);
  await run("ffmpeg", ["-v", "error", "-y", "-ss", "1", "-i", out, "-frames:v", "1", "-vf", "scale=360:-2", thumb]);
}

export async function processJob(job) {
  const step = (name, progress) => {
    job.step = name;
    job.progress = progress;
  };

  let source;
  let info;
  if (job.url) {
    step("Téléchargement de la vidéo", 0);
    ({ file: source, info } = await download(job));
  } else {
    source = job.upload;
    info = { title: job.uploadName.replace(/\.[^.]+$/, ""), id: job.id };
  }
  job.videoTitle = info.title || "Vidéo";

  step("Analyse des meilleurs moments", 42);
  const duration = await probeDuration(source);
  if (duration > MAX_DURATION) throw new Error("Vidéo trop longue pour être traitée.");
  const energy = await audioEnergy(source);
  const segments = pickSegments({
    duration,
    energy,
    heatmap: info.heatmap,
    clipLength: job.options.clipLength,
    maxClips: job.options.maxClips,
  });
  if (!segments.length) throw new Error("Aucun passage exploitable trouvé.");

  const cues = loadTranscript(job.dir);
  const clips = segments.map((s) => ({
    ...s,
    chapter: (info.chapters || []).find((c) => s.start >= c.start_time && s.start < c.end_time)?.title || null,
    transcript:
      cues.filter((c) => c.start >= s.start && c.start < s.end).map((c) => c.text).join(" ").slice(0, 1200) || null,
  }));

  step("Écriture des titres", 50);
  const titles = await generateTitles(info, clips, (m) => job.notes.push(m));
  clips.forEach((c, i) => Object.assign(c, titles[i]));

  for (let i = 0; i < clips.length; i++) {
    step(`Découpage du clip ${i + 1}/${clips.length}`, 52 + Math.round((i / clips.length) * 48));
    await cutClip(job, source, clips[i], i + 1);
    job.clips.push({
      n: i + 1,
      start: clips[i].start,
      end: Math.round(clips[i].end),
      titles: clips[i].titles,
      caption: clips[i].caption,
      titleSource: clips[i].source,
      video: `/files/${job.id}/clip-${i + 1}.mp4`,
      thumb: `/files/${job.id}/clip-${i + 1}.jpg`,
    });
  }

  // La vidéo source n'est plus utile une fois les clips produits.
  fs.rmSync(source, { force: true });
  step("Terminé", 100);
}
