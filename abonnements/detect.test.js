import test from "node:test";
import assert from "node:assert/strict";
import { parseAmount, parseDateLoose, parseCSV, readStatement, detectSubscriptions } from "./detect.js";

test("montants à la française et à l'anglaise", () => {
  assert.equal(parseAmount("-13,49"), -13.49);
  assert.equal(parseAmount("1 234,56 €"), 1234.56);
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("-1,234.56"), -1234.56);
  assert.equal(parseAmount("12.50-"), -12.5);
  assert.equal(parseAmount("(8,00)"), -8);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(""), null);
});

test("dates : JJ/MM/AAAA, AAAA-MM-JJ, JJ-MM-AA, OFX", () => {
  assert.equal(parseDateLoose("05/03/2026"), "2026-03-05");
  assert.equal(parseDateLoose("2026-03-05"), "2026-03-05");
  assert.equal(parseDateLoose("5-3-26"), "2026-03-05");
  assert.equal(parseDateLoose("20260305120000[0:GMT]"), "2026-03-05");
  assert.equal(parseDateLoose("31/02/2026"), null);
  assert.equal(parseDateLoose("Date"), null);
});

test("CSV : guillemets et séparateur détecté", () => {
  const rows = parseCSV('a;b;c\n"x;y";"he said ""hi""";3\n');
  assert.deepEqual(rows[1], ["x;y", 'he said "hi"', "3"]);
});

// Relevé fictif sur ~6 mois, séparateur ; décimales virgule, lignes parasites avant l'en-tête.
function statement() {
  const lines = ["Compte courant;12345678;", "Période du 01/06/2026 au 21/11/2026;;", ";;", "Date operation;Libelle;Montant;Solde"];
  const add = (d, label, amount) => lines.push(`${d};${label};${String(amount).replace(".", ",")};1000,00`);
  for (const m of ["06", "07", "08", "09", "10", "11"]) {
    add(`04/${m}/2026`, "PAIEMENT CB NETFLIX.COM 04/" + m + " AMSTERDAM CARTE X1234", -13.49);
    add(`${m === "11" ? "09" : "10"}/${m}/2026`, "PRLV SEPA SPOTIFY AB REF 9988" + m, -10.99);
    add(`15/${m}/2026`, "PRLV SEPA ORANGE SA FACTURE " + m, [-20.99, -20.99, -23.4, -20.99, -22.1, -20.99][+m - 6]);
    add(`28/${m}/2026`, "VIR SEPA LOYER APPARTEMENT", -750);
    add(`25/${m}/2026`, "VIR SEPA SALAIRE ENTREPRISE", 2100);
  }
  // Courses : montants et rythme irréguliers
  add("02/06/2026", "CARTE 02/06 CARREFOUR MARKET LYON", -43.2);
  add("09/06/2026", "CARTE 09/06 CARREFOUR MARKET LYON", -12.8);
  add("21/06/2026", "CARTE 21/06 CARREFOUR MARKET LYON", -88.15);
  add("03/07/2026", "CARTE 03/07 CARREFOUR MARKET LYON", -31.4);
  add("13/08/2026", "CARTE 13/08 BOULANGERIE DU COIN", -4.2);
  add("19/08/2026", "RETRAIT DAB 19/08", -50);
  // Salle de sport (hebdo exclue), Disney vu une seule fois -> "à confirmer"
  add("12/11/2026", "PAIEMENT CB DISNEYPLUS.COM", -9.99);
  // Salle de sport : 2 prélèvements identiques seulement
  add("07/10/2026", "PRLV SEPA FITNESS ZEN CLUB", -29.9);
  add("06/11/2026", "PRLV SEPA FITNESS ZEN CLUB", -29.9);
  // Ancien abonnement résilié (arrêt en août)
  for (const m of ["06", "07", "08"]) add(`20/${m}/2026`, "PAIEMENT CB DEEZER.COM", -11.99);
  return lines.join("\n");
}

test("détecte les abonnements, ignore courses, loyer, salaire et retraits", () => {
  const tx = readStatement(statement());
  assert.ok(tx.length > 30);
  const { candidates, from, to } = detectSubscriptions(tx, []);
  const by = Object.fromEntries(candidates.map((c) => [c.name, c]));
  assert.equal(from, "2026-06-02");
  assert.equal(to, "2026-11-28");

  assert.equal(by["Netflix"].cycle, "monthly");
  assert.equal(by["Netflix"].amount, 13.49);
  assert.equal(by["Netflix"].confidence, "high");
  assert.equal(by["Netflix"].count, 6);
  assert.equal(by["Netflix"].startDate, "2026-11-04");
  assert.equal(by["Spotify"].confidence, "high");

  assert.equal(by["Orange"].cycle, "monthly");
  assert.equal(by["Orange"].variable, false); // 4 montants sur 6 identiques => stable
  assert.equal(by["Orange"].amount, 20.99);

  assert.equal(by["Disney+"].confidence, "low");
  assert.equal(by["Fitness Zen"]?.confidence, "low");
  assert.equal(by["Deezer"].stale, true);
  assert.equal(by["Netflix"].stale, false);

  const names = candidates.map((c) => c.name.toLowerCase());
  for (const bad of ["carrefour", "loyer", "salaire", "boulangerie", "retrait"]) assert.ok(!names.some((n) => n.includes(bad)), bad);
});

test("déjà suivi : marqué pour ne pas créer de doublon", () => {
  const { candidates } = detectSubscriptions(readStatement(statement()), [{ name: "netflix premium" }]);
  assert.equal(candidates.find((c) => c.name === "Netflix").already, true);
  assert.equal(candidates.find((c) => c.name === "Spotify").already, false);
});

test("colonnes débit / crédit séparées, dates en AAAA-MM-JJ", () => {
  const csv = ["Date,Description,Debit,Credit"];
  for (const m of ["08", "09", "10", "11"]) csv.push(`2026-${m}-03,"ADOBE SYSTEMS SOFTWARE",65.99,`, `2026-${m}-25,SALAIRE,,2000.00`);
  const { candidates } = detectSubscriptions(readStatement(csv.join("\n")));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, "Adobe");
  assert.equal(candidates[0].category, "Cloud & logiciels");
  assert.equal(candidates[0].amount, 65.99);
});

test("fichier sans en-tête : colonnes devinées, dépenses en positif", () => {
  const rows = ["03/09/2026;MYSTERY GYM;29,90", "03/10/2026;MYSTERY GYM;29,90", "03/11/2026;MYSTERY GYM;29,90", "05/11/2026;AUTRE CHOSE;7,00"];
  const { candidates } = detectSubscriptions(readStatement(rows.join("\n")));
  assert.equal(candidates[0].name, "Mystery Gym");
  assert.equal(candidates[0].cycle, "monthly");
});

test("OFX", () => {
  const ofx = "<OFX><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260904<TRNAMT>-9.99<NAME>NETFLIX.COM</STMTTRN><STMTTRN><DTPOSTED>20261004<TRNAMT>-9.99<NAME>NETFLIX.COM</STMTTRN><STMTTRN><DTPOSTED>20261104<TRNAMT>-9.99<NAME>NETFLIX.COM</STMTTRN></OFX>";
  const tx = readStatement(ofx);
  assert.equal(tx.length, 3);
  const { candidates } = detectSubscriptions(tx);
  assert.equal(candidates[0].name, "Netflix");
  assert.equal(candidates[0].amount, 9.99);
});

test("fichier illisible : aucune opération, pas d'exception", () => {
  assert.deepEqual(readStatement("n'importe quoi"), []);
  assert.deepEqual(readStatement(""), []);
  assert.equal(detectSubscriptions([]).candidates.length, 0);
});
