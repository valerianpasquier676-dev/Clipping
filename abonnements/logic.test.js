import test from "node:test";
import assert from "node:assert/strict";
import {
  nextRenewal,
  addMonths,
  parseDate,
  toISO,
  toMonthly,
  toYearly,
  totals,
  groupMonthly,
  upcoming,
  cleanData,
  cleanSub,
  toCSV,
} from "./logic.js";

const sub = (o) => ({ id: o.name, name: "X", amount: 10, cycle: "monthly", startDate: "2026-01-15", cardId: "", category: "Autres", status: "active", ...o });

test("conversion en coût mensuel et annuel", () => {
  assert.equal(toMonthly(sub({ amount: 120, cycle: "yearly" })), 10);
  assert.equal(toYearly(sub({ amount: 10, cycle: "monthly" })), 120);
  assert.equal(toMonthly(sub({ amount: 30, cycle: "quarterly" })), 10);
  assert.equal(toMonthly(sub({ amount: 60, cycle: "semiannual" })), 10);
  assert.ok(Math.abs(toMonthly(sub({ amount: 3, cycle: "weekly" })) - 13) < 1e-9);
});

test("addMonths ramène le jour à la fin du mois sans dériver", () => {
  const jan31 = parseDate("2026-01-31");
  assert.equal(toISO(addMonths(jan31, 1)), "2026-02-28");
  assert.equal(toISO(addMonths(jan31, 2)), "2026-03-31");
  assert.equal(toISO(addMonths(parseDate("2028-01-31"), 1)), "2028-02-29");
  assert.equal(toISO(addMonths(parseDate("2026-11-15"), 3)), "2027-02-15");
});

test("prochain prélèvement mensuel, annuel, hebdomadaire", () => {
  assert.equal(nextRenewal("2026-01-15", "monthly", "2026-11-21"), "2026-12-15");
  assert.equal(nextRenewal("2026-01-15", "monthly", "2026-11-15"), "2026-11-15");
  assert.equal(nextRenewal("2026-01-31", "monthly", "2026-02-10"), "2026-02-28");
  assert.equal(nextRenewal("2024-03-02", "yearly", "2026-11-21"), "2027-03-02");
  assert.equal(nextRenewal("2026-11-01", "weekly", "2026-11-21"), "2026-11-22");
  assert.equal(nextRenewal("2027-05-05", "monthly", "2026-11-21"), "2027-05-05");
  assert.equal(nextRenewal("2025-12-20", "quarterly", "2026-11-21"), "2026-12-20");
  assert.equal(nextRenewal("pas une date", "monthly", "2026-11-21"), null);
});

test("les totaux ignorent les abonnements en pause ou résiliés", () => {
  const subs = [sub({ name: "a", amount: 10 }), sub({ name: "b", amount: 120, cycle: "yearly" }), sub({ name: "c", amount: 99, status: "paused" }), sub({ name: "d", amount: 99, status: "cancelled" })];
  const t = totals(subs);
  assert.equal(t.count, 2);
  assert.equal(t.monthly, 20);
  assert.equal(t.yearly, 240);
});

test("regroupement par carte, trié du plus cher au moins cher", () => {
  const subs = [sub({ name: "a", amount: 5, cardId: "c1" }), sub({ name: "b", amount: 20, cardId: "c2" }), sub({ name: "c", amount: 7, cardId: "c1" })];
  const g = groupMonthly(subs, (s) => s.cardId);
  assert.deepEqual(g.map((x) => [x.key, x.monthly, x.count]), [["c2", 20, 1], ["c1", 12, 2]]);
});

test("prochains prélèvements sur 30 jours, triés par date", () => {
  const subs = [
    sub({ name: "tard", startDate: "2026-12-30" }),
    sub({ name: "bientôt", startDate: "2026-11-25" }),
    sub({ name: "annuel loin", cycle: "yearly", startDate: "2026-03-01" }),
    sub({ name: "pause", startDate: "2026-11-23", status: "paused" }),
    sub({ name: "semaine", cycle: "weekly", startDate: "2026-11-01" }),
  ];
  const up = upcoming(subs, "2026-11-21", 30);
  const names = up.map((u) => u.sub.name);
  assert.ok(!names.includes("annuel loin") && !names.includes("pause") && !names.includes("tard"));
  assert.equal(names.filter((n) => n === "semaine").length, 5);
  assert.deepEqual(up.slice(0, 2).map((u) => u.date), ["2026-11-22", "2026-11-25"]);
});

test("validation : données invalides écartées, carte inconnue détachée", () => {
  const d = cleanData({
    cards: [{ id: "c1", name: " Visa ", last4: "12 34 5678" }, { name: "" }, null],
    subs: [
      { name: "Ok", amount: "9,99", cycle: "monthly", cardId: "c1", category: "Musique" },
      { name: "Carte fantôme", amount: 5, cardId: "zzz" },
      { name: "", amount: 5 },
      { name: "Négatif", amount: -3 },
      { name: "NaN", amount: "abc" },
    ],
  });
  assert.equal(d.cards.length, 1);
  assert.equal(d.cards[0].last4, "5678");
  assert.equal(d.subs.length, 2);
  assert.equal(d.subs[0].amount, 9.99);
  assert.equal(d.subs[1].cardId, "");
  assert.equal(cleanSub({ name: "x", amount: 1, url: "javascript:alert(1)" }).url, "");
});

test("export CSV : échappement et protection contre les formules", () => {
  const data = { cards: [{ id: "c1", name: "Visa", last4: "4242", color: "#000000" }], subs: [sub({ name: '=HYPERLINK("x")', cardId: "c1", notes: 'a;b "c"' })] };
  const csv = toCSV(data, "2026-11-21");
  assert.ok(csv.includes("\"'=HYPERLINK(\"\"x\"\")\"") || csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('"a;b ""c"""'));
  assert.ok(csv.includes("Visa ••••4242"));
  assert.equal(csv.split("\r\n").length, 2);
});
