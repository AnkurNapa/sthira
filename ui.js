// Sthira UI kit: element helper, icons, sheets with focus trap plus shared rows and cards.
"use strict";

const SHEET_MS = 380;
const BACKDROP_GUARD_MS = 400;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : String(kid));
  }
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const ICONS = {
  today: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z",
  plan: "M8 3h8v3H8zM6 5H4v16h16V5h-2M8 11h8M8 15h5",
  sessions: "M7 4.5l12 7.5-12 7.5z",
  poses: "M12 6.5a2 2 0 1 0 0-4a2 2 0 1 0 0 4zM4 10l8 1.5 8-1.5M12 11.5v4.5M7.5 21l4.5-5 4.5 5",
  breathe: "M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7",
  learn: "M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z",
  chevron: "M9 6l6 6-6 6",
  back: "M15 6l-6 6 6 6",
  close: "M6 6l12 12M18 6L6 18",
  play: "M8 5l11 7-11 7z",
  pause: "M8 5v14M16 5v14",
  prev: "M17 6l-8 6 8 6zM6 6v12",
  skip: "M7 6l8 6-8 6zM18 6v12",
  sound: "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  mute: "M4 9v6h4l5 4V5L8 9zM16.5 9.5l5 5M21.5 9.5l-5 5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 3l10 18H2zM12 10v5M12 18h.01",
  search: "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM15.5 15.5L21 21",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4A4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z",
  gear: "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 2v3M12 19v3M4.9 4.9L7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1",
  share: "M12 3v12M8 7l4-4 4 4M5 11v9h14v-9",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  user: "M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8zM4 21a8 8 0 0 1 16 0",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6z",
  offline: "M3 3l18 18M17 17H7a4 4 0 0 1-1-7.9M9.5 6.3A6 6 0 0 1 18 10a3.5 3.5 0 0 1 2.4 6",
};

function icon(name, size = 24, cls = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  const attrs = { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false", class: `icon ${cls}`.trim() };
  Object.entries(attrs).forEach(([k, v]) => svg.setAttribute(k, v));
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICONS[name]);
  svg.append(path);
  return svg;
}

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function fmtDur(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  if (!m) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

const fmtMinutes = (secs) => `${Math.max(1, Math.round(secs / 60))} min`;

/* Scroll lock that also holds on iOS Safari */

let lockedY = 0;

function setScrollLock(on) {
  const body = document.body;
  const locked = body.classList.contains("locked");
  if (on && !locked) {
    lockedY = window.scrollY;
    body.style.top = `-${lockedY}px`;
    body.classList.add("locked");
  } else if (!on && locked) {
    body.classList.remove("locked");
    body.style.top = "";
    window.scrollTo(0, lockedY);
  }
}

function forgetScroll() {
  lockedY = 0;
}

/* Sheets */

const sheetStack = [];

function syncSheets() {
  const open = sheetStack.length > 0;
  document.querySelectorAll("#app, .tabbar, .topnav").forEach((n) => { n.inert = open; });
  sheetStack.forEach((s, i) => { s.root.inert = i !== sheetStack.length - 1; });
  setScrollLock(open);
}

/**
 * Open a sheet. opts: label, full, dark, bare, routeKey, beforeClose, onClose.
 * Returns the sheet entry. entry.close() asks to close. entry.close(true) skips beforeClose.
 * Route sheets leave their route on close so the browser history stays in step.
 */
function openSheet(body, opts = {}) {
  const returnFocus = document.activeElement;
  const openedAt = Date.now();
  const entry = { routeKey: opts.routeKey || null, pushed: false, closed: false, beforeClose: opts.beforeClose || null, historyOpen: false };
  // internal: true when the router (route sheets) or the Back button (history sheets) asked for the close.
  entry.close = (force, internal) => {
    if (entry.closed || (!force && opts.beforeClose && opts.beforeClose() === false)) return;
    if (entry.routeKey && !internal) {
      leaveRoute(entry);
      return;
    }
    if (entry.historyOpen && !internal) {
      entry.leaving = true;
      history.back();
      return;
    }
    entry.closed = true;
    entry.root.classList.remove("open");
    sheetStack.splice(sheetStack.indexOf(entry), 1);
    syncSheets();
    setTimeout(() => entry.root.remove(), reducedMotion.matches ? 0 : SHEET_MS);
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    if (opts.onClose) opts.onClose();
  };
  const bar = opts.bare ? null : el("div", { class: "sheet-bar" },
    el("span", { class: "grabber", "aria-hidden": "true" }),
    el("button", { type: "button", class: "link-btn", onclick: () => entry.close() }, "Done"));
  const cls = ["sheet-panel", opts.full && "full", opts.dark && "dark"].filter(Boolean).join(" ");
  const panel = el("div", { class: cls, role: "dialog", "aria-modal": "true", "aria-label": opts.label || "Sthira", tabindex: "-1" }, bar, body);
  // A second click of a double click lands on the new backdrop. Ignore clicks just after opening.
  const onBackdrop = () => { if (Date.now() - openedAt >= BACKDROP_GUARD_MS) entry.close(); };
  entry.root = el("div", { class: `sheet${opts.full ? " sheet-full" : ""}` }, el("div", { class: "sheet-backdrop", onclick: onBackdrop }), panel);
  if (opts.history) {
    // Full screen players take a history entry, so the Back button closes them like any page.
    history.pushState({ ...(history.state || {}), overlay: true }, "", location.href);
    entry.historyOpen = true;
  }
  document.body.append(entry.root);
  sheetStack.push(entry);
  syncSheets();
  void entry.root.offsetWidth;
  entry.root.classList.add("open");
  panel.focus({ preventScroll: true });
  return entry;
}

window.addEventListener("popstate", () => {
  const top = [...sheetStack].reverse().find((s) => s.historyOpen);
  if (!top) return;
  if (!top.leaving && top.beforeClose && top.beforeClose() === false) {
    history.pushState({ ...(history.state || {}), overlay: true }, "", location.href);
    return;
  }
  top.historyOpen = false;
  top.close(true, true);
});

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea, summary, [tabindex]:not([tabindex="-1"])';

function trapFocus(e, root) {
  const items = [...root.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length > 0);
  if (!items.length) {
    e.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const inside = root.contains(document.activeElement);
  if (e.shiftKey && (!inside || document.activeElement === first || document.activeElement.classList.contains("sheet-panel"))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
    e.preventDefault();
    first.focus();
  }
}

document.addEventListener("keydown", (e) => {
  const top = sheetStack[sheetStack.length - 1];
  if (!top) return;
  if (e.key === "Escape") {
    e.preventDefault();
    top.close();
  } else if (e.key === "Tab") {
    trapFocus(e, top.root);
  }
});

/* Toast */

function showToast(text, onClick) {
  document.querySelectorAll(".toast").forEach((n) => n.remove());
  const toast = el(onClick ? "button" : "div", { class: "toast", type: onClick ? "button" : null, role: "status", onclick: onClick || null }, text);
  document.body.append(toast);
  void toast.offsetWidth;
  toast.classList.add("show");
  if (!onClick) setTimeout(() => toast.remove(), 4000);
  return toast;
}

/* Shared building blocks */

function pageHeader(title, eyebrow, action) {
  return el("header", { class: "large-title" },
    el("div", {}, eyebrow && el("p", { class: "eyebrow" }, eyebrow), el("h1", {}, title)),
    action);
}

function sectionTitle(text, cls = "") {
  return el("h3", { class: `section-title ${cls}`.trim() }, text);
}

function block(title, ...content) {
  return el("section", { class: "block" }, title && el("h2", { class: "block-title" }, title), content);
}

function group(items, cls = "") {
  return el("ul", { class: `group ${cls}`.trim(), role: "list" }, items.map((item) => el("li", {}, item)));
}

function row({ lead, title, sub, detail, badge, onClick, href, cls }) {
  const body = el("span", { class: "row-body" },
    el("span", { class: "row-text" },
      el("span", { class: "row-title" }, title),
      sub && el("span", { class: "row-sub" }, sub),
      badge),
    detail && el("span", { class: "row-detail" }, detail),
    (onClick || href) && icon("chevron", 14, "chev"));
  const className = `row ${cls || ""}`.trim();
  if (href) return el("a", { class: className, href }, lead, body);
  if (onClick) return el("button", { type: "button", class: className, onclick: onClick }, lead, body);
  return el("div", { class: className }, lead, body);
}

function tile(letter, color, cls = "") {
  const t = el("span", { class: `tile ${cls}`.trim(), "aria-hidden": "true" }, letter);
  t.style.background = color;
  return t;
}

function cautionBadge(text = "Not in your plan") {
  return el("span", { class: "badge caution-badge" }, text);
}

function infoBadge(text) {
  return el("span", { class: "badge info-badge" }, text);
}

function heartButton(kind, id, label) {
  const btn = el("button", { type: "button", class: "heart", "aria-pressed": String(isFav(kind, id)), "aria-label": `Favourite ${label}` }, icon("heart", 22));
  btn.addEventListener("click", () => {
    btn.setAttribute("aria-pressed", String(toggleFav(kind, id)));
  });
  return btn;
}

/** An iOS style switch built on a real checkbox. */
function switchRow(label, checked, onChange) {
  const input = el("input", { type: "checkbox", role: "switch", class: "switch", checked: checked ? true : null });
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", { class: "row setting" }, el("span", { class: "row-body" }, el("span", { class: "row-text" }, el("span", { class: "row-title" }, label)), input));
}

function selectRow(label, value, options, onChange) {
  const select = el("select", { class: "select", "aria-label": label },
    options.map(([v, text]) => el("option", { value: String(v), selected: String(v) === String(value) ? true : null }, text)));
  select.addEventListener("change", () => onChange(select.value));
  return el("label", { class: "row setting" }, el("span", { class: "row-body" }, el("span", { class: "row-text" }, el("span", { class: "row-title" }, label)), select));
}

function emptyState(title, text, action) {
  return el("div", { class: "empty" }, el("p", { class: "empty-title" }, title), text && el("p", {}, text), action);
}

const SUBHEAD_MAX = 60;

/** Short lines with no closing punctuation are subheadings in article bodies. */
function isSubheading(line) {
  return line.length <= SUBHEAD_MAX && !/[.?!:]$/.test(line.trim());
}

function articleBlocks(lines) {
  const out = [];
  let list = null;
  for (const line of lines) {
    if (line.startsWith("* ")) {
      if (!list) {
        list = el("ul", { class: "bullets" });
        out.push(list);
      }
      list.append(el("li", {}, line.slice(2)));
    } else if (isSubheading(line)) {
      list = null;
      out.push(el("h3", { class: "article-subhead" }, line));
    } else {
      list = null;
      out.push(el("p", {}, line));
    }
  }
  return out;
}

/** Weekly activity rings as one SVG. rings: [{ value, goal }] from weeklyRings(). */
function ringsSvg(rings, size = 120) {
  const colours = ["var(--ring-1)", "var(--ring-2)", "var(--ring-3)"];
  const svg = svgEl("svg", { viewBox: "0 0 120 120", width: size, height: size, class: "rings", role: "img", "aria-label": rings.map((r) => `${r.label} ${r.value} of ${r.goal} ${r.unit}`).join(". ") });
  rings.forEach((r, i) => {
    const radius = 52 - i * 15;
    const circ = 2 * Math.PI * radius;
    const pct = r.goal ? Math.min(1, r.value / r.goal) : 0;
    const common = { cx: 60, cy: 60, r: radius, fill: "none", "stroke-width": 12 };
    svg.append(svgEl("circle", { ...common, stroke: colours[i], opacity: 0.22 }));
    const arc = svgEl("circle", { ...common, stroke: colours[i], "stroke-linecap": "round", "stroke-dasharray": circ, "stroke-dashoffset": circ, transform: "rotate(-90 60 60)", class: "ring-arc" });
    svg.append(arc);
    requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDashoffset = String(circ * (1 - pct)); }));
  });
  return svg;
}

const ART_PX = { "": 40, lg: 60, xl: 220, player: 200 };
const SMALL_ART = ["", "lg"];

/** The Sanskrit name and category colour of a pose or a sun position (surya-0 to surya-11). */
function artInfo(id) {
  if (own(POSE_BY_ID, id)) return { name: POSE_BY_ID[id].sk, color: CATEGORIES[POSE_BY_ID[id].cat].color };
  const m = /^surya-(\d+)$/.exec(id);
  const pos = m ? SURYA[Number(m[1])] : null;
  return { name: pos ? pos[0] : "", color: "var(--accent)" };
}

/** A calm card for a pose with no photo: the Sanskrit name on a soft panel in the category colour. */
function noPhotoCard(id, size) {
  const info = artInfo(id);
  const card = el("span", { class: `pose-art pose-nophoto pose-art-${size || "md"}`, "aria-hidden": "true" },
    SMALL_ART.includes(size) ? null : el("span", { class: "nophoto-name" }, info.name));
  card.style.setProperty("--c", info.color);
  return card;
}

function posePhoto(id, size) {
  const p = POSE_PHOTOS[id];
  const px = ART_PX[size] || ART_PX[""];
  const small = SMALL_ART.includes(size);
  const dir = "photos/poses/";
  const srcset = small ? `${dir}${p.base}-400.webp 400w` : `${dir}${p.base}-400.webp 400w, ${dir}${p.base}-800.webp 800w`;
  const img = el("img", { src: `${dir}${p.base}-800.jpg`, alt: p.alt, width: px, height: Math.round((px * p.h) / p.w), loading: small ? "lazy" : "eager", decoding: "async" });
  const pic = el("picture", { class: `pose-art pose-photo pose-art-${size || "md"}` },
    el("source", { type: "image/webp", srcset, sizes: `${px}px` }), img);
  // A photo that cannot load (offline and not cached) becomes the calm card, never a broken icon.
  img.addEventListener("error", () => pic.replaceWith(noPhotoCard(id, size)), { once: true });
  return pic;
}

/**
 * Art for a pose or a sun position: the real photo when there is one, else the calm no photo card.
 * opts: { size: "lg" | "xl" | "player" | "" }
 */
function poseArt(id, opts = {}) {
  const size = opts.size || "";
  return own(POSE_PHOTOS, id) ? posePhoto(id, size) : noPhotoCard(id, size);
}

/* APM display */

const APM_CORE = ["a", "p", "m"];

function apmLetter(cat) {
  const info = APM_INFO[cat];
  return el("span", { class: `apm-letter apm-${cat}`, title: info.name, "aria-hidden": "true" }, info.letter);
}

/**
 * A thin three part bar for asana, pranayama and meditation, with a text key so colour is never the only cue.
 * split holds seconds per category, as from apmSplit().
 */
function apmBar(split, opts = {}) {
  const mins = Object.fromEntries(APM_CORE.map((k) => [k, Math.round((split[k] || 0) / 60)]));
  const total = APM_CORE.reduce((sum, k) => sum + (split[k] || 0), 0) || 1;
  const label = APM_CORE.map((k) => `${APM_INFO[k].name} ${mins[k]} min`).join(", ");
  const bar = el("span", { class: "apm-track" }, APM_CORE.filter((k) => split[k] > 0).map((k) => {
    const seg = el("span", { class: `apm-seg apm-${k}` });
    seg.style.flexGrow = String(split[k] / total);
    return seg;
  }));
  const key = el("span", { class: "apm-key" }, APM_CORE.map((k) => `${APM_INFO[k].letter} ${mins[k]}`).join(" · "), " min");
  return el("span", { class: `apm-bar ${opts.cls || ""}`.trim(), role: "img", "aria-label": label }, bar, opts.noKey ? null : key);
}
