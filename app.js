// Sthira shell: hash routes, navigation, the welcome flow and offline support.
// Routes: #/today, #/plan, #/sessions/<id>, #/poses/<id>, #/breathe/<id>, #/learn/<id>, #/quiz.
"use strict";

const PAGES = [
  { id: "today", label: "Today", render: () => renderToday() },
  { id: "plan", label: "My Plan", render: () => renderPlan() },
  { id: "progress", label: "Progress", render: () => renderProgress() },
  { id: "sessions", label: "Sessions", render: () => renderSessions() },
  { id: "create", label: "Create", render: () => renderCreate() },
  { id: "poses", label: "Poses", render: () => renderPoses() },
  { id: "breathe", label: "Breathe", render: () => renderBreathe() },
  { id: "learn", label: "Learn", render: () => renderLearn() },
  { id: "about", label: "About", render: () => renderAbout() },
  { id: "welcome", label: "Welcome", render: () => renderWelcome(), nav: false },
  { id: "credits", label: "Credits", render: () => renderCredits(), nav: false },
];

const NAV_PAGES = PAGES.filter((p) => p.nav !== false);

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

/**
 * Make the open sheets match the route. One detail replaces another rather than stacking.
 * Back returns to the previous detail because each one has its own history entry.
 */
function syncRouteSheets(key) {
  const routeSheets = sheetStack.filter((s) => s.routeKey);
  const match = key ? routeSheets.findIndex((s) => s.routeKey === key) : -1;
  routeSheets.slice(match + 1).reverse().forEach((s) => s.close(true, true));
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

/* First visit */

/** Send a first time visitor to the welcome page once. Deep links are left alone. */
function firstVisitRoute() {
  const bare = !location.hash || location.hash === "#" || location.hash === "#/" || location.hash === "#/today";
  if (!readStore().welcomed && bare) history.replaceState(history.state, "", "#/welcome");
}

function fillFooter() {
  const slot = document.getElementById("footer-teacher");
  if (slot) slot.textContent = TEACHER.footer;
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
  fillFooter();
  firstVisitRoute();
  route();
  booted = true;
  registerWorker();
});
