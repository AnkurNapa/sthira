// Sthira shell: hash routes, navigation, the welcome flow and offline support.
// Routes: #/today, #/plan, #/sessions/<id>, #/poses/<id>, #/breathe/<id>, #/learn/<id>, #/quiz.
"use strict";

const PAGES = [
  { id: "today", label: "Today", render: () => renderToday() },
  { id: "plan", label: "My Plan", render: () => renderPlan() },
  { id: "sessions", label: "Sessions", render: () => renderSessions() },
  { id: "create", label: "Create", render: () => renderCreate() },
  { id: "poses", label: "Poses", render: () => renderPoses() },
  { id: "breathe", label: "Breathe", render: () => renderBreathe() },
  { id: "learn", label: "Learn", render: () => renderLearn() },
];

const ROUTE_SHOW = {
  sessions: showSessionSheet,
  poses: showPoseSheet,
  breathe: showBreathSheet,
  learn: showArticleSheet,
};

let renderedPage = null;
let booted = false;
// Each history entry gets a number so Back can restore where the visitor was.
let entryCount = 0;
let currentEntry = 0;
const scrollMemory = new Map();
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function renderPage(id) {
  const page = PAGES.find((p) => p.id === id) || PAGES[0];
  const changed = renderedPage !== page.id;
  renderedPage = page.id;
  const view = document.getElementById("view");
  view.replaceChildren(page.render());
  if (changed) {
    view.classList.remove("page-enter");
    void view.offsetWidth;
    view.classList.add("page-enter");
  }
  document.querySelectorAll("[data-page]").forEach((n) => {
    if (n.dataset.page === page.id) n.setAttribute("aria-current", "page");
    else n.removeAttribute("aria-current");
  });
  document.title = page.id === "today" ? "Sthira · Yoga at home" : `${page.label} · Sthira`;
  paintSubnav();
}

/** Rebuild the current page after data changes, keeping the scroll position. */
function refreshView() {
  const y = window.scrollY;
  renderPage(renderedPage);
  if (!sheetStack.length) window.scrollTo(0, y);
}

function openRouteSheet(key) {
  if (key === "quiz") return showQuiz(key);
  const [page, id] = key.split("/");
  return ROUTE_SHOW[page](id, key);
}

/** Make the open sheets match the route: close the ones above it, open it if missing. */
function syncRouteSheets(key) {
  const routeSheets = sheetStack.filter((s) => s.routeKey);
  const match = key ? routeSheets.findIndex((s) => s.routeKey === key) : -1;
  if (match >= 0 || !key) routeSheets.slice(match + 1).reverse().forEach((s) => s.close(true, true));
  if (key && match < 0) {
    const entry = openRouteSheet(key);
    if (entry) entry.pushed = booted;
  }
}

/** Note which history entry we are on. Returns the saved scroll position when we came back to it. */
function trackEntry() {
  const state = history.state || {};
  if (typeof state.n === "number") {
    currentEntry = state.n;
    return scrollMemory.has(state.n) ? scrollMemory.get(state.n) : 0;
  }
  entryCount += 1;
  currentEntry = entryCount;
  history.replaceState({ ...state, n: currentEntry }, "");
  return 0;
}

function route() {
  scrollMemory.set(currentEntry, sheetStack.length ? lockedY : window.scrollY);
  const r = parseRoute(location.hash, renderedPage);
  if (!r.ok) history.replaceState(history.state, "", `#/${r.page}`);
  const y = trackEntry();
  if (r.page !== renderedPage) {
    renderPage(r.page);
    if (sheetStack.length) lockedY = y;
    else window.scrollTo({ top: y, behavior: "instant" });
    scrollToPending();
  }
  syncRouteSheets(r.key);
}

/** Close a route sheet. Use history when we pushed it so Back and Done agree. */
function leaveRoute(entry) {
  if (entry.pushed) {
    history.back();
    return;
  }
  history.replaceState(history.state, "", `#/${renderedPage}`);
  entry.close(true, true);
}

function replaceRoute(path) {
  history.replaceState(history.state, "", `#/${path}`);
  route();
}

/* Welcome and launch */

function openQuizOffer() {
  const sheet = openSheet(el("div", { class: "sheet-content welcome" },
    el("h2", { class: "sheet-title" }, "Find your practice"),
    el("p", {}, "Ten short questions about your body and your health. Sthira builds a plan that fits you. It leaves out the poses that are not safe for you."),
    el("div", { class: "btn-stack" },
      el("a", { class: "pill wide", href: "#/quiz", onclick: () => sheet.close(true) }, "Take the 2 minute quiz"),
      el("button", { type: "button", class: "pill pill-ghost wide", onclick: () => sheet.close(true) }, "Skip for now"))), { label: "Find your practice" });
}

function maybeWelcome() {
  if (readStore().welcomed) return;
  let started = false;
  const sheet = openSheet(el("div", { class: "sheet-content welcome" },
    el("img", { class: "welcome-mark", src: "icon.svg", alt: "", width: 72, height: 72 }),
    el("h2", { class: "sheet-title" }, "Welcome to Sthira"),
    el("p", {}, "Sthira guides your yoga practice at home. Follow a session, learn each pose step by step or slow down with a breathing exercise."),
    el("p", {}, "Every pose shows how to avoid injury. It also shows an easier version and who should skip it."),
    el("div", { class: "card caution" }, el("p", {}, "Sthira does not replace a qualified teacher or medical advice. Stop if anything hurts.")),
    el("div", { class: "btn-stack" },
      el("button", { type: "button", class: "pill wide", onclick: () => { started = true; sheet.close(); } }, "Get started"),
      el("a", { class: "pill pill-ghost wide", href: "#/learn/health" }, "When to check with a doctor"))), {
    label: "Welcome to Sthira",
    onClose: () => {
      writeStore({ welcomed: true });
      if (started && !readPlan()) setTimeout(openQuizOffer, reducedMotion.matches ? 0 : SHEET_MS);
    },
  });
}

/* Offline support with an update prompt */

function watchForUpdate(reg) {
  const offer = (worker) => showToast("Update ready. Tap to refresh.", () => worker.postMessage("skipWaiting"));
  if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) offer(worker);
    });
  });
}

function registerWorker() {
  if (!/^https?:$/.test(location.protocol) || !("serviceWorker" in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register("sw.js").then(watchForUpdate).catch(() => {
    // Offline support is optional. The site works without it.
  });
}

window.addEventListener("hashchange", route);

document.addEventListener("DOMContentLoaded", () => {
  buildNav();
  route();
  booted = true;
  maybeWelcome();
  registerWorker();
});
