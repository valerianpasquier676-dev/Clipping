// Stockage local : IndexedDB (photos incluses), avec repli sur localStorage puis sur la mémoire.
// Rien n'est envoyé hors de l'appareil.

const DB = "garde-robe", STORE = "kv";
let dbPromise = null;
const mem = new Map();

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

export async function get(key, fallback) {
  const db = await open();
  if (db) {
    try {
      const v = await new Promise((res, rej) => { const r = db.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      return v === undefined ? fallback : v;
    } catch {}
  }
  try { const raw = localStorage.getItem("garde-robe:" + key); if (raw) return JSON.parse(raw); } catch {}
  return mem.has(key) ? mem.get(key) : fallback;
}

export async function set(key, value) {
  mem.set(key, value);
  const db = await open();
  if (db) {
    try {
      await new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(value, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
      return true;
    } catch {}
  }
  try { localStorage.setItem("garde-robe:" + key, JSON.stringify(value)); return true; } catch { return false; }
}

export async function wipe() {
  mem.clear();
  const db = await open();
  if (db) { try { await new Promise((res) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).clear(); tx.oncomplete = res; tx.onerror = res; }); } catch {} }
  try { Object.keys(localStorage).filter((k) => k.startsWith("garde-robe:")).forEach((k) => localStorage.removeItem(k)); } catch {}
}

export async function del(key) {
  mem.delete(key);
  const db = await open();
  if (db) { try { await new Promise((res) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(key); tx.oncomplete = res; tx.onerror = res; }); } catch {} }
  try { localStorage.removeItem("garde-robe:" + key); } catch {}
}
