// Serveur statique minimal : node abonnements/serve.js  (port 3100 par défaut)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const port = Number(process.env.PORT) || 3100;
const allowed = new Set(["index.html", "app.js", "logic.js", "detect.js", "style.css"]);

http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
  if (!allowed.has(name)) { res.writeHead(404).end("Introuvable"); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(name)], "Cache-Control": "no-cache" });
  fs.createReadStream(path.join(root, name)).pipe(res);
}).listen(port, () => console.log(`Abonnements : http://localhost:${port}`));
