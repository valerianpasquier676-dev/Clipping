// Détection automatique des abonnements à partir d'un relevé bancaire (CSV ou OFX).
// Logique pure, sans DOM : tout se passe dans le navigateur.

import { parseDate, daysBetween, CATEGORIES } from "./logic.js";

const strip = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");

/* ---------- Lecture des montants et des dates ---------- */

export function parseAmount(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[\s  €$£]|EUR/gi, "");
  if (/^[-−–]/.test(s)) { neg = !neg; s = s.slice(1); }
  if (/[-−–]$/.test(s)) { neg = !neg; s = s.slice(0, -1); }
  s = s.replace(/^\+/, "");
  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) s = comma > dot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (comma >= 0) s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  return neg ? -n : n;
}

export function parseDateLoose(raw) {
  const s = String(raw ?? "").trim();
  let y, m, d, x;
  if ((x = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) [, y, m, d] = x;
  else if ((x = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/.exec(s))) { [, d, m, y] = x; if (y.length === 2) y = "20" + y; }
  else if ((x = /^(\d{4})(\d{2})(\d{2})/.exec(s))) [, y, m, d] = x;
  else return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return parseDate(iso) ? iso : null;
}

/* ---------- CSV ---------- */

function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 40);
  let best = ";", bestScore = -1;
  for (const d of [";", "\t", ",", "|"]) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const freq = new Map();
    for (const c of counts) if (c > 0) freq.set(c, (freq.get(c) || 0) + 1);
    const score = freq.size ? Math.max(...freq.values()) : 0;
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

export function parseCSV(text) {
  text = String(text).replace(/^﻿/, "");
  const delim = detectDelimiter(text);
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

function mapColumns(rows) {
  const norm = rows.map((r) => r.map((c) => strip(c).toLowerCase().trim()));
  let hi = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const r = norm[i];
    if (r.some((c) => /\bdate\b/.test(c)) && r.some((c) => /libelle|label|description|montant|amount|debit|credit|intitule|operation|detail/.test(c))) { hi = i; break; }
  }
  const sample = rows.slice(hi + 1, hi + 61);
  const width = Math.max(...rows.map((r) => r.length));
  const cols = { date: -1, labels: [], amount: -1, debit: -1, credit: -1, start: hi + 1 };

  if (hi >= 0) {
    const h = norm[hi];
    const idx = (re, not) => h.map((c, i) => (re.test(c) && !(not && not.test(c)) ? i : -1)).filter((i) => i >= 0);
    cols.date = idx(/date/, /valeur|comptab/)[0] ?? idx(/date/)[0] ?? -1;
    cols.labels = idx(/libelle|label|description|intitule|detail|motif|objet|memo|beneficiaire|^nom$|operation/, /date|categorie|solde|montant/);
    cols.amount = idx(/montant|amount|somme/)[0] ?? -1;
    cols.debit = idx(/debit/)[0] ?? -1;
    cols.credit = idx(/credit/)[0] ?? -1;
  }
  // Repli : deviner les colonnes d'après leur contenu (relevés sans en-tête reconnaissable).
  if (cols.date < 0) {
    let bestRatio = 0;
    for (let c = 0; c < width; c++) {
      const r = sample.filter((x) => parseDateLoose(x[c])).length / (sample.length || 1);
      if (r > bestRatio) { bestRatio = r; cols.date = c; }
    }
    if (bestRatio < 0.6) cols.date = -1;
  }
  if (cols.amount < 0 && cols.debit < 0 && cols.credit < 0) {
    for (let c = 0; c < width; c++) {
      if (c === cols.date) continue;
      if (sample.filter((x) => parseAmount(x[c]) !== null && !parseDateLoose(x[c])).length / (sample.length || 1) >= 0.8) { cols.amount = c; break; }
    }
  }
  if (!cols.labels.length) {
    let best = -1, bestLen = 0;
    for (let c = 0; c < width; c++) {
      if ([cols.date, cols.amount, cols.debit, cols.credit].includes(c)) continue;
      const len = sample.reduce((s, x) => s + String(x[c] ?? "").length, 0) / (sample.length || 1);
      if (len > bestLen) { bestLen = len; best = c; }
    }
    if (best >= 0) cols.labels = [best];
  }
  return cols;
}

// Renvoie des opérations { date, label, amount } où amount < 0 = dépense.
export function transactionsFromCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const cols = mapColumns(rows);
  if (cols.date < 0 || (cols.amount < 0 && cols.debit < 0 && cols.credit < 0)) return [];
  const tx = [];
  for (const r of rows.slice(cols.start)) {
    const date = parseDateLoose(r[cols.date]);
    if (!date) continue;
    let amount;
    if (cols.amount >= 0) amount = parseAmount(r[cols.amount]);
    else {
      const d = parseAmount(r[cols.debit]);
      const c = parseAmount(r[cols.credit]);
      amount = d === null && c === null ? null : (c ? Math.abs(c) : 0) - (d ? Math.abs(d) : 0);
    }
    if (amount === null || amount === 0) continue;
    const label = cols.labels.map((i) => String(r[i] ?? "").trim()).filter(Boolean).join(" ");
    if (label) tx.push({ date, label, amount });
  }
  // Un seul champ de montant sans aucun négatif : le fichier liste des dépenses en positif.
  if (cols.amount >= 0 && tx.length && tx.every((t) => t.amount > 0)) for (const t of tx) t.amount = -t.amount;
  return tx;
}

/* ---------- OFX ---------- */

export function transactionsFromOFX(text) {
  const tx = [];
  for (const chunk of String(text).split(/<STMTTRN>/i).slice(1)) {
    const tag = (n) => new RegExp(`<${n}>([^<\\r\\n]*)`, "i").exec(chunk)?.[1]?.trim() ?? "";
    const date = parseDateLoose(tag("DTPOSTED"));
    const amount = parseAmount(tag("TRNAMT"));
    const label = `${tag("NAME")} ${tag("MEMO")}`.trim();
    if (date && amount !== null && amount !== 0 && label) tx.push({ date, label, amount });
  }
  return tx;
}

export function readStatement(text) {
  return /<STMTTRN>/i.test(text) ? transactionsFromOFX(text) : transactionsFromCSV(text);
}

/* ---------- Services connus ---------- */

// [motif sur le libellé compacté, nom affiché, catégorie, fréquence probable]
const KNOWN = [
  [/NETFLIX/, "Netflix", "Streaming vidéo"],
  [/DISNEY/, "Disney+", "Streaming vidéo"],
  [/CANAL\+?|CANALPLUS|MYCANAL/, "Canal+", "Streaming vidéo"],
  [/AMAZONPRIME|PRIMEVIDEO|AMZNPRIME|AMZN.*PRIME/, "Amazon Prime", "Streaming vidéo"],
  [/PARAMOUNT/, "Paramount+", "Streaming vidéo"],
  [/CRUNCHYROLL/, "Crunchyroll", "Streaming vidéo"],
  [/OCS(?![A-Z])/, "OCS", "Streaming vidéo"],
  [/APPLETV|APPLE\.?COM\/?BILL|APPLECOMBILL|ITUNES|APPLESERVICES/, "Apple (iCloud, App Store…)", "Cloud & logiciels"],
  [/SPOTIFY/, "Spotify", "Musique"],
  [/DEEZER/, "Deezer", "Musique"],
  [/YOUTUBE|GOOGLEYOUTUBE/, "YouTube Premium", "Streaming vidéo"],
  [/GOOGLEONE|GOOGLESTORAGE|GOOGLECLOUD/, "Google One", "Cloud & logiciels"],
  [/OPENAI|CHATGPT/, "ChatGPT", "Cloud & logiciels"],
  [/ANTHROPIC|CLAUDE\.?AI/, "Claude", "Cloud & logiciels"],
  [/ADOBE/, "Adobe", "Cloud & logiciels"],
  [/MICROSOFT|MSFT|OFFICE365/, "Microsoft 365", "Cloud & logiciels"],
  [/DROPBOX/, "Dropbox", "Cloud & logiciels"],
  [/NOTION/, "Notion", "Cloud & logiciels"],
  [/GITHUB/, "GitHub", "Cloud & logiciels"],
  [/CANVA/, "Canva", "Cloud & logiciels"],
  [/NORDVPN|EXPRESSVPN|PROTONVPN|PROTON(?:AG|MAIL)?/, "VPN / messagerie sécurisée", "Cloud & logiciels"],
  [/PLAYSTATION|SONYINTERACTIVE|PSPLUS/, "PlayStation Plus", "Jeux vidéo"],
  [/XBOX/, "Xbox Game Pass", "Jeux vidéo"],
  [/NINTENDO/, "Nintendo Switch Online", "Jeux vidéo"],
  [/STEAM/, "Steam", "Jeux vidéo"],
  [/TWITCH/, "Twitch", "Jeux vidéo"],
  [/AUDIBLE/, "Audible", "Presse & livres"],
  [/KINDLE/, "Kindle", "Presse & livres"],
  [/LEMONDE/, "Le Monde", "Presse & livres"],
  [/MEDIAPART/, "Mediapart", "Presse & livres"],
  [/LEFIGARO|FIGARO/, "Le Figaro", "Presse & livres"],
  [/BASICFIT|BASIC-FIT/, "Basic-Fit", "Sport & santé"],
  [/FITNESSPARK/, "Fitness Park", "Sport & santé"],
  [/NEONESS|ONAIR|KEEPCOOL|GYMLIB|CMGSPORTS|ORANGEBLEUE/, "Salle de sport", "Sport & santé"],
  [/ORANGE(?!BLEUE)/, "Orange", "Télécom & internet"],
  [/SFR/, "SFR", "Télécom & internet"],
  [/BOUYGUES|BOUYGTEL/, "Bouygues Telecom", "Télécom & internet"],
  [/FREEMOBILE|FREEBOX|FREESAS|ILIAD/, "Free", "Télécom & internet"],
  [/SOSH|REDBYSFR|B&YOU|BYOU|LAPOSTEMOBILE|LEBARA|PRIXTEL/, "Forfait mobile", "Télécom & internet"],
  [/NAVIGO|ILEDEFRANCEMOB|IDFMOBILITES/, "Pass Navigo", "Transport"],
  [/UBERONE|UBER\*?ONE/, "Uber One", "Transport"],
  [/DELIVEROO/, "Deliveroo Plus", "Autres"],
  [/AXA|MAIF|MACIF|MMA|GROUPAMA|ALLIANZ|GMF|MATMUT|HELLOASSURANCE|LEOCARE|LEMONADE/, "Assurance", "Assurance & banque"],
];

/* ---------- Détection des paiements récurrents ---------- */

const NOISE = /\b(PAIEMENT|PAIEMT|ACHAT|CARTE|CARTES|CB|PRLV|PRELEVEMENT|PRELEVT|SEPA|TPE|REF|MANDAT|ECH|ECHEANCE|FACTURE|FACT|ABONNEMENT|ABO|WWW|HTTP|HTTPS|DE|DU|DES|LA|LE|LES|ET|SAS|SARL|SA|EUR|PAR|PAYPAL|PP|SQ|SUMUP|DEBIT|DIFFERE|MONTANT|OPERATION|OPE|NUM|AUTO)\b/g;
const NOT_SUBS = /RETRAIT|\bDAB\b|\bVIR\b|VIREMENT|CHEQUE|\bCHQ\b/;

function cleanTokens(raw) {
  let s = strip(raw).toUpperCase();
  s = s.replace(/WWW\./g, " ").replace(/\.(COM|FR|NET|IO|ORG|EU|CO|TV|APP)\b/g, " ");
  s = s.replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, " ");
  s = s.replace(/[^A-Z0-9 ]/g, " ").replace(NOISE, " ");
  return s.split(/\s+/).filter((t) => t.length >= 2 && !/\d/.test(t));
}

const compact = (s) => strip(s).toUpperCase().replace(/[^A-Z0-9+]/g, "");
const titleCase = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

function knownService(raw) {
  const c = compact(raw);
  for (const [re, name, category] of KNOWN) if (re.test(c)) return { name, category };
  return null;
}

const CYCLE_BY_DAYS = [
  ["weekly", 6, 8, 7, 2],
  ["monthly", 25, 36, 30.4, 5],
  ["quarterly", 80, 102, 91.3, 9],
  ["semiannual", 165, 200, 182.6, 14],
  ["yearly", 340, 390, 365, 20],
];
const MONTHS = { weekly: 0.25, monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function detectSubscriptions(transactions, existingSubs = []) {
  const expenses = transactions.filter((t) => t.amount < 0);
  const dates = transactions.map((t) => t.date).sort();
  const from = dates[0] || null;
  const to = dates[dates.length - 1] || null;

  const groups = new Map();
  for (const t of expenses) {
    const known = knownService(t.label);
    if (!known && NOT_SUBS.test(strip(t.label).toUpperCase())) continue;
    const tokens = cleanTokens(t.label);
    const key = known ? "k:" + known.name : tokens[0] && tokens[0].length >= 3 ? tokens[0] : null;
    if (!key) continue;
    const g = groups.get(key) || { key, known, tokens: [], tx: [] };
    g.tokens.push(tokens);
    g.tx.push({ date: t.date, amount: Math.abs(t.amount) });
    groups.set(key, g);
  }

  const existing = existingSubs.map((s) => compact(s.name)).filter((n) => n.length >= 3);
  const out = [];

  for (const g of groups.values()) {
    // Un seul prélèvement par jour (les doublons le même jour ne comptent pas comme répétition).
    const byDay = new Map();
    for (const t of g.tx) if (!byDay.has(t.date)) byDay.set(t.date, t);
    const tx = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    const amounts = tx.map((t) => t.amount);
    const medAmount = median(amounts);
    const stableShare = amounts.filter((a) => Math.abs(a - medAmount) <= medAmount * 0.03 + 0.01).length / amounts.length;
    const stable = stableShare >= 0.6;
    const variable = !stable && amounts.every((a) => Math.abs(a - medAmount) <= medAmount * 0.3);

    let cycle = null, ratio = 0;
    if (tx.length >= 2) {
      const gaps = tx.slice(1).map((t, i) => daysBetween(tx[i].date, t.date));
      const med = median(gaps);
      const def = CYCLE_BY_DAYS.find(([, lo, hi]) => med >= lo && med <= hi);
      if (def) {
        const [name, , , nominal, tol] = def;
        ratio = gaps.filter((d) => Math.abs(d - nominal) <= tol).length / gaps.length;
        if (!(name === "weekly" && tx.length < 4)) cycle = name;
      }
    }

    let confidence = null;
    if (cycle && tx.length >= 3 && stable && ratio >= 0.8) confidence = "high";
    else if (cycle && tx.length >= 3 && (stable || variable) && ratio >= 0.7) confidence = "medium";
    else if (cycle && tx.length === 2 && stable && ratio === 1) confidence = "low";
    if (!confidence && g.known) { confidence = "low"; if (!cycle) cycle = "monthly"; }
    if (!confidence) continue;

    const last = tx[tx.length - 1];
    let name;
    if (g.known) name = g.known.name;
    else {
      const first = g.tokens[0][0];
      const second = g.tokens.filter((t) => t[1] && t[1] === g.tokens[0][1]).length / g.tokens.length >= 0.8 ? g.tokens[0][1] : "";
      name = titleCase([first, second].filter(Boolean).join(" "));
    }
    const nominalDays = 30.4 * MONTHS[cycle];
    const stale = to ? daysBetween(last.date, to) > nominalDays * 1.6 + 5 : false;
    const compactName = compact(name);
    const already = existing.some((e) => e.includes(compactName) || compactName.includes(e));
    const category = g.known?.category && CATEGORIES.includes(g.known.category) ? g.known.category : "Autres";

    out.push({
      key: g.key,
      name,
      amount: Math.round((stable ? last.amount : medAmount) * 100) / 100,
      cycle,
      startDate: last.date,
      count: tx.length,
      confidence,
      variable: !stable && variable,
      stale,
      already,
      category,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => rank[a.confidence] - rank[b.confidence] || b.amount * MONTHS[b.cycle] ** -1 - a.amount * MONTHS[a.cycle] ** -1);
  return { candidates: out, from, to, analyzed: transactions.length };
}
