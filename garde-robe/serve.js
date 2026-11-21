// Serveur statique minimal : node garde-robe/serve.js  (port 3200 par défaut)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".glb": "model/gltf-binary", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};
const port = Number(process.env.PORT) || 3200;

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(root, rel));
  const ext = path.extname(file);
  if (!file.startsWith(root + path.sep) || !types[ext] || /\.test\.js$|serve\.js$/.test(file)) { res.writeHead(404).end("Introuvable"); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end("Introuvable"); return; }
    res.writeHead(200, { "Content-Type": types[ext], "Cache-Control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, () => console.log(`Garde-robe : http://localhost:${port}`));
