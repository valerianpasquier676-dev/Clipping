// Service worker : met l'application en cache pour qu'elle marche hors ligne (la météo reste en ligne).
const CACHE = "garde-robe-v1";
const SHELL = ["./", "./index.html", "./style.css", "./app.js", "./dom.js", "./store.js", "./data.js", "./engine.js", "./morph.js", "./scan.js", "./weather.js", "./mannequin3d.js",
  "./ui/common.js", "./ui/plan.js", "./ui/week.js", "./ui/closet.js", "./ui/item-form.js", "./ui/imaging.js", "./ui/me.js", "./ui/scent.js", "./ui/sample.js",
  "./vendor/three.min.js", "./icon.svg", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // météo et autres : réseau direct
  // Réseau d'abord (toujours la dernière version), cache en secours hors ligne.
  e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request)));
});
