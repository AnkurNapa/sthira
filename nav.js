// Sthira navigation: global nav with flyouts, the sticky sub nav and the full screen menu.
"use strict";

const FLYOUT_OPEN_MS = 150;
const FLYOUT_CLOSE_MS = 120;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");

/** Quick links for each section, built fresh so favourites and plans are current. */
function navSections() {
  const resetPoses = (patch) => () => setPoseFilter({ q: "", cat: "all", lvl: 0, fav: false, ...patch });
  const link = (label, href, extra = {}) => ({ label, href, ...extra });
  return {
    plan: [
      { title: "My Plan", links: [link("Your plan", "#/plan"), link("Your journey", "#/plan", { scroll: "journey" }), link("Badges", "#/plan", { scroll: "badges" }), link("History", "#/plan", { scroll: "history" })] },
      { title: "More", links: [link("Progress", "#/progress"), link("Today's flow", `#/sessions/${TODAY_FLOW_ID}`), link("Retake the quiz", "#/quiz"), link("Settings", null, { action: openSettings })] },
    ],
    sessions: [
      { title: "Guided sessions", links: SESSIONS.map((s) => link(s.name, `#/sessions/${s.id}`)) },
      { title: "Make your own", links: [link("Create a flow", "#/create"), link("Today's flow", `#/sessions/${TODAY_FLOW_ID}`), link("All sessions", "#/sessions")] },
    ],
    poses: [
      { title: "Browse by family", links: Object.entries(CATEGORIES).map(([k, c]) => link(c.name, "#/poses", { before: resetPoses({ cat: k }) })) },
      { title: "Quick links", links: [link("All poses", "#/poses", { before: resetPoses({}) }), link("Favourites", "#/poses", { before: resetPoses({ fav: true }) }), link("Pose of the day", `#/poses/${poseOfDay().id}`)] },
    ],
    breathe: [
      { title: "Breathing practices", links: BREATHS.map((b) => link(b.name, `#/breathe/${b.id}`)) },
      { title: "Start now", links: [link("One minute of calm", null, { action: () => openPacer(BREATH_BY_ID.abdominal, 6) }), link("All practices", "#/breathe")] },
    ],
    learn: [{ title: "Guides", links: [...ARTICLES.map((a) => link(a.title, `#/learn/${a.id}`)), link("All guides", "#/learn")] }],
  };
}

let pendingScrollTarget = null;

/** Follow a quick link: run its setup, then navigate or rerender when the page is the same. */
function followLink(item) {
  if (item.before) item.before();
  if (item.action) {
    item.action();
    return;
  }
  pendingScrollTarget = item.scroll || null;
  if (location.hash === item.href) {
    refreshView();
    scrollToPending();
  } else {
    location.hash = item.href;
  }
}

function scrollToPending() {
  if (!pendingScrollTarget) return;
  const target = document.getElementById(pendingScrollTarget);
  pendingScrollTarget = null;
  if (target) target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
}

function linkNode(item, onDone) {
  const attrs = { class: "nav-link", onclick: (e) => { e.preventDefault(); if (onDone) onDone(); followLink(item); } };
  return item.href ? el("a", { ...attrs, href: item.href }, item.label) : el("button", { ...attrs, type: "button" }, item.label);
}

/* Desktop flyouts */

const flyout = { openId: null, timer: null, nodes: {} };

function setDim(on) {
  document.body.classList.toggle("nav-dimmed", on);
}

function openFlyout(id, focusFirst) {
  clearTimeout(flyout.timer);
  if (flyout.openId && flyout.openId !== id) closeFlyout(false);
  const node = flyout.nodes[id];
  if (!node) return;
  node.panel.replaceChildren(el("div", { class: "flyout-inner" }, navSections()[id].map((col) =>
    el("div", { class: "flyout-col" }, el("p", { class: "flyout-title" }, col.title),
      el("ul", { role: "list" }, col.links.map((item) => el("li", {}, linkNode(item, () => closeFlyout(false)))))))));
  node.panel.hidden = false;
  void node.panel.offsetWidth;
  node.panel.classList.add("open");
  node.toggle.setAttribute("aria-expanded", "true");
  flyout.openId = id;
  setDim(true);
  if (focusFirst) node.panel.querySelector(".nav-link").focus();
}

function closeFlyout(returnFocus) {
  clearTimeout(flyout.timer);
  const node = flyout.nodes[flyout.openId];
  if (!node) return;
  node.panel.classList.remove("open");
  node.panel.hidden = true;
  node.toggle.setAttribute("aria-expanded", "false");
  if (returnFocus) node.link.focus();
  flyout.openId = null;
  setDim(false);
}

function scheduleFlyout(id) {
  clearTimeout(flyout.timer);
  flyout.timer = setTimeout(() => (id ? openFlyout(id, false) : closeFlyout(false)), id ? FLYOUT_OPEN_MS : FLYOUT_CLOSE_MS);
}

function navItem(page) {
  const link = el("a", { class: "top-link", href: `#/${page.id}`, "data-page": page.id }, page.label);
  const sections = navSections();
  if (!sections[page.id]) return el("div", { class: "nav-item" }, link);
  const panelId = `flyout-${page.id}`;
  const toggle = el("button", { type: "button", class: "flyout-toggle", "aria-expanded": "false", "aria-controls": panelId, "aria-label": `Show ${page.label} links` }, icon("chevron", 12));
  const panel = el("div", { class: "flyout", id: panelId, hidden: true });
  flyout.nodes[page.id] = { link, toggle, panel };
  const hoverOpen = (e) => { if (canHover.matches && e.pointerType === "mouse") scheduleFlyout(page.id); };
  link.addEventListener("pointerenter", hoverOpen);
  panel.addEventListener("pointerenter", () => clearTimeout(flyout.timer));
  link.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openFlyout(page.id, true);
    }
  });
  toggle.addEventListener("click", () => (flyout.openId === page.id ? closeFlyout(true) : openFlyout(page.id, true)));
  return el("div", { class: "nav-item" }, link, toggle, panel);
}

function bindFlyoutClose(topnav) {
  topnav.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") scheduleFlyout(null); });
  topnav.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && flyout.openId) {
      e.stopPropagation();
      closeFlyout(true);
    }
  });
  topnav.addEventListener("focusout", (e) => {
    if (flyout.openId && !topnav.contains(e.relatedTarget)) closeFlyout(false);
  });
  document.querySelector(".nav-dim").addEventListener("click", () => closeFlyout(false));
}

/* Mobile and tablet menu */

let menuEntry = null;

function menuIcon() {
  return el("span", { class: "menu-icon", "aria-hidden": "true" }, el("span", {}), el("span", {}));
}

function menuList(items) {
  return el("ul", { role: "list", class: "menu-list" }, items.map((node, i) => {
    const li = el("li", {}, node);
    li.style.setProperty("--i", String(i));
    return li;
  }));
}

function menuTopLevel(panel, close) {
  const sections = navSections();
  return menuList(NAV_PAGES.map((page) => {
    if (!sections[page.id]) return el("a", { href: `#/${page.id}`, class: "menu-link", "data-page": page.id, "aria-current": page.id === renderedPage ? "page" : null, onclick: (e) => { e.preventDefault(); close(`#/${page.id}`); } }, page.label);
    return el("button", { type: "button", class: "menu-link has-children", "aria-current": page.id === renderedPage ? "page" : null, onclick: () => showSubmenu(panel, page, close) }, page.label, icon("chevron", 18));
  }));
}

function showSubmenu(panel, page, close) {
  const cols = navSections()[page.id];
  // Each section already has its own overview link, such as All poses, so there is no extra one here.
  const items = cols.flatMap((col) => col.links.map((item) => el(item.href ? "a" : "button", { class: "menu-sublink", href: item.href || null, type: item.href ? null : "button", onclick: (e) => { e.preventDefault(); close(null, item); } }, item.label)));
  const back = el("button", { type: "button", class: "menu-back", onclick: () => { panel.replaceChildren(menuTopLevel(panel, close)); panel.querySelector(".menu-link").focus(); } }, icon("back", 18), "Menu");
  panel.replaceChildren(el("div", { class: "menu-level sub" }, back, el("p", { class: "menu-heading" }, page.label), menuList(items)));
  back.focus();
}

/** Open the full screen menu. It takes a history entry so the Back button closes it. */
function openMenu() {
  if (menuEntry) return;
  const btn = document.querySelector(".menu-btn");
  const panel = el("div", { class: "menu-body" });
  let viaHistory = false;
  history.pushState({ ...(history.state || {}), menu: true }, "", location.href);
  const close = (href, item) => {
    viaHistory = true;
    if (href) history.replaceState(null, "", href);
    menuEntry.close(true);
    if (href) route();
    else if (item) {
      history.back();
      setTimeout(() => followLink(item), 0);
    }
  };
  menuEntry = openSheet(el("nav", { class: "menu", "aria-label": "Pages" },
    el("div", { class: "menu-top" }, el("span", { class: "wordmark" }, "Sthira"),
      el("button", { type: "button", class: "menu-close", "aria-label": "Close menu", onclick: () => menuEntry.close() }, menuIcon())),
    panel), {
    label: "Menu", full: true, dark: true, bare: true,
    beforeClose: () => {
      if (viaHistory) return true;
      viaHistory = true;
      history.back();
      return false;
    },
    onClose: () => {
      menuEntry = null;
      btn.setAttribute("aria-expanded", "false");
    },
  });
  menuEntry.root.classList.add("menu-sheet");
  menuEntry.closeFromHistory = () => { viaHistory = true; menuEntry.close(true); };
  panel.append(menuTopLevel(panel, close));
  btn.setAttribute("aria-expanded", "true");
}

window.addEventListener("popstate", () => {
  if (menuEntry && !(history.state && history.state.menu)) menuEntry.closeFromHistory();
});

/* Sub nav: sticks once the global nav has scrolled away. */

function paintSubnav() {
  const slot = document.getElementById("subnav-action");
  if (!slot) return;
  slot.replaceChildren(readPlan() ? el("a", { class: "pill small", href: "#/plan" }, "My Plan") : el("a", { class: "pill small", href: "#/quiz" }, "Take the quiz"));
  const page = PAGES.find((p) => p.id === renderedPage);
  document.getElementById("subnav-title").textContent = page && !["today", "welcome"].includes(page.id) ? page.label : "Sthira";
}

function watchSubnav(topnav, subnav) {
  if (!("IntersectionObserver" in window)) {
    subnav.classList.add("stuck");
    return;
  }
  new IntersectionObserver(([entry]) => subnav.classList.toggle("stuck", !entry.isIntersecting)).observe(topnav);
}

function buildNav() {
  const menuBtn = el("button", { type: "button", class: "menu-btn", "aria-label": "Open menu", "aria-expanded": "false", onclick: openMenu }, menuIcon());
  const topnav = el("header", { class: "topnav" },
    el("div", { class: "topnav-inner" },
      el("a", { class: "wordmark", href: "#/today" }, "Sthira"),
      el("nav", { class: "topnav-links", "aria-label": "Pages" }, NAV_PAGES.map(navItem)),
      menuBtn));
  const subnav = el("div", { class: "subnav" },
    el("div", { class: "subnav-inner" }, el("p", { class: "subnav-title", id: "subnav-title" }, "Sthira"), el("div", { id: "subnav-action" })));
  document.body.prepend(topnav, subnav, el("div", { class: "nav-dim", "aria-hidden": "true" }));
  bindFlyoutClose(topnav);
  watchSubnav(topnav, subnav);
}
