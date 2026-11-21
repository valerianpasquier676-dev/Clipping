// Logique pure (sans DOM) : utilisée par le site et par les tests.

export const CYCLES = {
  weekly: { label: "Chaque semaine", perYear: 52, months: 0 },
  monthly: { label: "Chaque mois", perYear: 12, months: 1 },
  quarterly: { label: "Chaque trimestre", perYear: 4, months: 3 },
  semiannual: { label: "Chaque semestre", perYear: 2, months: 6 },
  yearly: { label: "Chaque année", perYear: 1, months: 12 },
};

export const STATUSES = { active: "Actif", paused: "En pause", cancelled: "Résilié" };

export const CATEGORIES = [
  "Streaming vidéo",
  "Musique",
  "Jeux vidéo",
  "Cloud & logiciels",
  "Presse & livres",
  "Sport & santé",
  "Télécom & internet",
  "Assurance & banque",
  "Transport",
  "Autres",
];

/* ---------- Dates (YYYY-MM-DD, heure locale) ---------- */

export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}

export function toISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayISO(now = new Date()) {
  return toISO(now);
}

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

// Ajoute n mois en gardant le jour d'origine (ramené à la fin du mois si besoin :
// 31 janvier + 1 mois = 28/29 février, puis 31 mars).
export function addMonths(d, n) {
  const total = d.getFullYear() * 12 + d.getMonth() + n;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  return new Date(y, m, Math.min(d.getDate(), daysInMonth(y, m)));
}

export function daysBetween(fromISO, toISOStr) {
  const a = parseDate(fromISO);
  const b = parseDate(toISOStr);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

// Prochain prélèvement à partir d'une date de prélèvement connue (passée ou future).
export function nextRenewal(startDate, cycle, today = todayISO()) {
  const start = parseDate(startDate);
  if (!start || !CYCLES[cycle]) return null;
  if (startDate >= today) return startDate;
  if (cycle === "weekly") {
    const n = Math.ceil(daysBetween(startDate, today) / 7);
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + n * 7);
    return toISO(d);
  }
  const step = CYCLES[cycle].months;
  const t = parseDate(today);
  const diffMonths = (t.getFullYear() - start.getFullYear()) * 12 + (t.getMonth() - start.getMonth());
  let n = Math.max(0, Math.floor(diffMonths / step));
  while (toISO(addMonths(start, n * step)) < today) n++;
  return toISO(addMonths(start, n * step));
}

/* ---------- Montants ---------- */

export const toYearly = (sub) => sub.amount * CYCLES[sub.cycle].perYear;
export const toMonthly = (sub) => toYearly(sub) / 12;

export const isActive = (sub) => sub.status === "active";

export function totals(subs) {
  const active = subs.filter(isActive);
  const monthly = active.reduce((s, x) => s + toMonthly(x), 0);
  return { count: active.length, monthly, yearly: monthly * 12 };
}

// Regroupe les abonnements actifs par clé (carte, catégorie…) avec leur coût mensuel.
export function groupMonthly(subs, keyOf) {
  const map = new Map();
  for (const s of subs.filter(isActive)) {
    const k = keyOf(s);
    const g = map.get(k) || { key: k, monthly: 0, count: 0 };
    g.monthly += toMonthly(s);
    g.count += 1;
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => b.monthly - a.monthly);
}

// Prélèvements des `days` prochains jours (abonnements actifs), du plus proche au plus lointain.
// Un abonnement hebdomadaire peut apparaître plusieurs fois.
export function upcoming(subs, today = todayISO(), days = 30) {
  const out = [];
  const limit = toISO(new Date(parseDate(today).getTime() + days * 86400000 + 3600000 * 3));
  for (const sub of subs.filter(isActive)) {
    let date = nextRenewal(sub.startDate, sub.cycle, today);
    while (date && date <= limit) {
      out.push({ sub, date, in: daysBetween(today, date) });
      if (sub.cycle !== "weekly") break;
      const d = parseDate(date);
      date = toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.sub.name.localeCompare(b.sub.name));
}

/* ---------- Données : validation, import / export ---------- */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const newId = uid;

export function cleanCard(c) {
  if (!c || typeof c !== "object") return null;
  const name = String(c.name ?? "").trim().slice(0, 40);
  if (!name) return null;
  const last4 = String(c.last4 ?? "").replace(/\D/g, "").slice(-4);
  const color = /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : "#6366f1";
  return { id: String(c.id || uid()), name, last4, color };
}

export function cleanSub(s, cardIds = null) {
  if (!s || typeof s !== "object") return null;
  const name = String(s.name ?? "").trim().slice(0, 80);
  const amount = Number(String(s.amount).replace(",", "."));
  if (!name || !Number.isFinite(amount) || amount < 0 || amount > 1e6) return null;
  const cycle = CYCLES[s.cycle] ? s.cycle : "monthly";
  const startDate = parseDate(s.startDate) ? s.startDate : todayISO();
  const status = STATUSES[s.status] ? s.status : "active";
  const cardId = s.cardId && (!cardIds || cardIds.has(s.cardId)) ? String(s.cardId) : "";
  const url = /^https?:\/\//i.test(s.url || "") ? String(s.url).slice(0, 300) : "";
  return {
    id: String(s.id || uid()),
    name,
    amount: Math.round(amount * 100) / 100,
    cycle,
    startDate,
    cardId,
    category: CATEGORIES.includes(s.category) ? s.category : "Autres",
    status,
    url,
    notes: String(s.notes ?? "").slice(0, 500),
  };
}

export function cleanData(raw) {
  const cards = (Array.isArray(raw?.cards) ? raw.cards : []).map(cleanCard).filter(Boolean);
  const ids = new Set(cards.map((c) => c.id));
  const subs = (Array.isArray(raw?.subs) ? raw.subs : []).map((s) => cleanSub(s, ids)).filter(Boolean);
  return { cards, subs };
}

const csvCell = (v) => {
  let s = String(v ?? "");
  // Neutralise l'injection de formules quand le CSV est ouvert dans un tableur.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(data, today = todayISO()) {
  const cards = new Map(data.cards.map((c) => [c.id, c]));
  const head = ["Nom", "Montant", "Fréquence", "Par mois", "Par an", "Prochain prélèvement", "Carte", "Catégorie", "Statut", "Notes"];
  const rows = data.subs.map((s) => {
    const c = cards.get(s.cardId);
    return [
      s.name,
      s.amount.toFixed(2),
      CYCLES[s.cycle].label,
      toMonthly(s).toFixed(2),
      toYearly(s).toFixed(2),
      nextRenewal(s.startDate, s.cycle, today),
      c ? `${c.name}${c.last4 ? " ••••" + c.last4 : ""}` : "",
      s.category,
      STATUSES[s.status],
      s.notes,
    ];
  });
  return [head, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

export const SAMPLE = {
  cards: [
    { id: "c1", name: "Visa principale", last4: "4242", color: "#6366f1" },
    { id: "c2", name: "Carte pro", last4: "1881", color: "#f59e0b" },
  ],
  subs: [
    { name: "Netflix", amount: 13.49, cycle: "monthly", cardId: "c1", category: "Streaming vidéo" },
    { name: "Spotify", amount: 10.99, cycle: "monthly", cardId: "c1", category: "Musique" },
    { name: "iCloud+ 200 Go", amount: 2.99, cycle: "monthly", cardId: "c1", category: "Cloud & logiciels" },
    { name: "Salle de sport", amount: 29.9, cycle: "monthly", cardId: "c1", category: "Sport & santé" },
    { name: "Amazon Prime", amount: 69.9, cycle: "yearly", cardId: "c1", category: "Streaming vidéo" },
    { name: "Adobe Creative Cloud", amount: 65.99, cycle: "monthly", cardId: "c2", category: "Cloud & logiciels" },
    { name: "Forfait mobile", amount: 14.99, cycle: "monthly", cardId: "c2", category: "Télécom & internet" },
  ],
};
