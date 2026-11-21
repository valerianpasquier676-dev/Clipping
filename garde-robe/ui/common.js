import { h } from "../dom.js";
import { CAT, SLOT_LABEL, THEME } from "../data.js";
import { parseISO } from "../engine.js";
import { colorName } from "../scan.js";

export const catLabel = (key) => CAT[key]?.label || key;
export const fmtDay = (iso, opts = { weekday: "long", day: "numeric", month: "long" }) => new Intl.DateTimeFormat("fr-FR", opts).format(parseISO(iso));
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const themeLabel = (k) => (THEME[k] ? `${THEME[k].emoji} ${THEME[k].label}` : k);

export function visual(item, cls = "vis") {
  if (item?.photo) return h("img", { class: cls, src: item.photo, alt: item.name, loading: "lazy" });
  const c = item?.colors?.[0] || "#9aa0aa";
  return h("div", { class: cls + " ph", style: `background:${c}` }, h("span", {}, CAT[item?.category]?.emoji || "👕"));
}

export const colorLabel = (item) => (item.colors?.[0] ? colorName(item.colors[0]) : "");

const BOARD_ROWS = [
  ["hat", "glasses", "scarf", "earrings", "necklace"],
  ["outer", "mid", "top", "dress"],
  ["bottom"],
  ["shoes", "socks"],
  ["bracelet", "watch", "ring", "gloves", "belt", "bag"],
];
// Planche 2D : les vraies photos détourées des pièces, disposées comme une tenue posée à plat.
export function board(outfit, { compact = false } = {}) {
  const el = h("div", { class: "board" + (compact ? " compact" : "") });
  for (const row of BOARD_ROWS) {
    const tiles = row.filter((s) => outfit[s]).map((s) =>
      h("div", { class: `tile t-${s}`, title: `${SLOT_LABEL[s]} : ${outfit[s].name}` }, visual(outfit[s]), compact ? null : h("span", { class: "cap" }, outfit[s].name)));
    if (tiles.length) el.append(h("div", { class: "brow r-" + row[0] }, tiles));
  }
  if (!el.children.length) el.append(h("p", { class: "muted" }, "Aucune pièce dans cette tenue."));
  return el;
}

export function openDialog({ title, body, actions = [], wide = false, onClose }) {
  const dlg = h("dialog", { class: "dlg" + (wide ? " wide" : "") });
  const close = () => { try { dlg.close(); } catch {} };
  dlg.append(
    h("div", { class: "dlg-in" },
      h("div", { class: "dlg-head" }, h("h2", {}, title), h("button", { class: "btn ghost icon", type: "button", "aria-label": "Fermer", onclick: close }, "✕")),
      h("div", { class: "dlg-body" }, body),
      actions.length ? h("div", { class: "dlg-foot" }, actions.map((a) => h("button", { class: "btn " + (a.kind || ""), type: "button", onclick: () => a.onClick?.(close) }, a.label))) : null));
  dlg.addEventListener("close", () => { onClose?.(); dlg.remove(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  document.getElementById("dialogs").append(dlg);
  dlg.showModal();
  return { dlg, close };
}

export function chips(options, selected, onToggle, { single = false } = {}) {
  const set = new Set((single ? [selected] : selected).map(String));
  return h("div", { class: "chips" }, Object.entries(options).map(([k, label]) =>
    h("button", { type: "button", class: "chip", "aria-pressed": String(set.has(k)), onclick: (e) => {
      const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
      if (single) e.currentTarget.parentElement.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      e.currentTarget.setAttribute("aria-pressed", String(single ? true : on));
      onToggle(k, single ? true : on);
    } }, label)));
}

export function field(label, control, hint) {
  return h("label", { class: "field" }, h("span", { class: "lbl" }, label), control, hint ? h("small", {}, hint) : null);
}
