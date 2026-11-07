// Sthira Progress page: rings, period totals, the minutes chart, the calendar heatmap,
// journey, favourites, badges, history and the data controls. Reads local storage only.
"use strict";

const CHART_H = 220;
const CHART_PAD = { top: 16, right: 8, bottom: 28, left: 40 };
const BAR_MAX = 24;
const BAR_GAP = 2;
const BAR_RADIUS = 4;
const HEAT_STEPS = [0, 1, 10, 20, 40];
const HISTORY_FILTERS = [["all", "All"], ["sessions", "Sessions"], ["flows", "Flows"], ["breathing", "Breathing"]];
const HISTORY_SHOWN = 30;

let progressPeriod = "week";
let historyFilter = "all";

const longDate = (key) => parseIso(key).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const minutesText = (n) => plural(Math.round(n), "minute");

function tileBox(title, cls, ...content) {
  return el("section", { class: `bento-tile ${cls || ""}`.trim() }, title && el("h2", { class: "tile-title" }, title), content);
}

/* 1. Summary */

function summaryTile(store) {
  const rings = weeklyRings();
  const streak = streakDays(store.log);
  return tileBox("Weekly rings", "wide summary",
    el("div", { class: "summary-body" },
      ringsSvg(rings, 200),
      ringLegend(rings),
      el("div", { class: "streaks" },
        el("div", {}, el("span", { class: "hero-num" }, String(streak)), el("span", { class: "muted" }, "day streak now")),
        el("div", {}, el("span", { class: "hero-num small-num" }, String(bestStreak(store.log))), el("span", { class: "muted" }, "best streak")))),
    el("p", { class: "balance-line" }, balanceLine(weekStats(store.log))));
}

/* 2. Period totals */

function periodSwitch() {
  return el("div", { class: "segmented", role: "group", "aria-label": "Period" }, PERIODS.map((p) =>
    el("button", { type: "button", "aria-pressed": String(p === progressPeriod), onclick: () => { progressPeriod = p; refreshView(); } }, p[0].toUpperCase() + p.slice(1))));
}

function statTile(label, value, delta) {
  return el("div", { class: "stat-tile" },
    el("span", { class: "stat-label" }, label),
    el("span", { class: "stat-value" }, String(value)),
    el("span", { class: "stat-delta" }, delta));
}

function periodTile(store) {
  const now = periodTotals(store, progressPeriod);
  const before = periodTotals(store, progressPeriod, new Date(), -1, true);
  const p = progressPeriod;
  return tileBox(null, "wide period",
    el("div", { class: "period-head" }, el("h2", { class: "tile-title" }, `This ${p}`), periodSwitch()),
    el("div", { class: "stat-grid" },
      statTile("Total minutes", now.minutes, changeText(now.minutes, before.minutes, p, "minutes")),
      statTile("A · Asana minutes", now.a, changeText(now.a, before.a, p, "minutes")),
      statTile("P · Pranayama minutes", now.p, changeText(now.p, before.p, p, "minutes")),
      statTile("M · Meditation minutes", now.m, changeText(now.m, before.m, p, "minutes")),
      statTile("Sessions finished", now.sessions, changeText(now.sessions, before.sessions, p, "sessions")),
      statTile("Active days", now.days, changeText(now.days, before.days, p, "days"))));
}

/* 3. Minutes chart */

function niceMax(n) {
  const steps = [10, 20, 30, 60, 90, 120, 180, 240, 300, 600, 900, 1200, 1800];
  return steps.find((s) => s >= n) || Math.ceil(n / 600) * 600;
}

/** A column path with a rounded data end and a square base. */
function columnPath(x, y, w, h, roundTop) {
  if (h <= 0) return "";
  const r = roundTop ? Math.min(BAR_RADIUS, h, w / 2) : 0;
  return `M${x},${y + h}V${y + r}${r ? `Q${x},${y} ${x + r},${y}` : ""}H${x + w - r}${r ? `Q${x + w},${y} ${x + w},${y + r}` : ""}V${y + h}Z`;
}

const barTotal = (b) => APM_KEYS.reduce((sum, k) => sum + (b[k] || 0), 0);

/** Stack asana, pranayama, meditation and rest from the baseline with a 2px gap. Only the top end is rounded. */
function stackSegments(g, b, x, barW, y) {
  const keys = APM_KEYS.filter((k) => b[k] > 0);
  let base = 0;
  keys.forEach((k, i) => {
    const top = y(base + b[k]);
    const bottom = y(base) - (i > 0 ? BAR_GAP : 0);
    g.append(svgEl("path", { d: columnPath(x, top, barW, bottom - top, i === keys.length - 1), class: `seg-${k}` }));
    base += b[k];
  });
}

function barLabel(bar) {
  return progressPeriod === "year" ? `${bar.label}` : longDate(bar.key);
}

function showTip(tip, host, target, text) {
  tip.textContent = text;
  tip.hidden = false;
  const box = host.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  const left = Math.min(Math.max(0, r.left - box.left + r.width / 2 - tip.offsetWidth / 2), box.width - tip.offsetWidth);
  tip.style.transform = `translate(${left}px, ${Math.max(0, r.top - box.top - tip.offsetHeight - 8)}px)`;
}

function drawBars(host, bars, goal) {
  const width = Math.max(260, host.clientWidth);
  const plotW = width - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const max = niceMax(Math.max(goal, ...bars.map(barTotal), 1));
  const y = (v) => CHART_PAD.top + plotH - (v / max) * plotH;
  const band = plotW / bars.length;
  const barW = Math.min(BAR_MAX, Math.max(3, band * 0.62));
  const every = Math.ceil(bars.length / Math.floor(plotW / 34));
  const svg = svgEl("svg", { width, height: CHART_H, viewBox: `0 0 ${width} ${CHART_H}`, class: "bars-svg", role: "group", "aria-label": `Minutes per ${progressPeriod === "year" ? "month" : "day"}` });
  [0, max / 2, max].forEach((t) => {
    svg.append(svgEl("line", { x1: CHART_PAD.left, x2: width - CHART_PAD.right, y1: y(t), y2: y(t), class: "grid" }));
    const label = svgEl("text", { x: CHART_PAD.left - 8, y: y(t) + 4, class: "tick", "text-anchor": "end" });
    label.textContent = String(Math.round(t));
    svg.append(label);
  });
  const tip = host.querySelector(".chart-tip");
  bars.forEach((b, i) => {
    const x = CHART_PAD.left + band * i + (band - barW) / 2;
    const text = `${barLabel(b)}. ${APM_KEYS.map((k) => `${APM_INFO[k].name} ${minutesText(b[k])}`).join(". ")}.`;
    const g = svgEl("g", { class: "bar", tabindex: "0", role: "img", "aria-label": text });
    g.append(svgEl("rect", { x: CHART_PAD.left + band * i, y: CHART_PAD.top, width: band, height: plotH, class: "hit" }));
    stackSegments(g, b, x, barW, y);
    ["pointerenter", "focus"].forEach((ev) => g.addEventListener(ev, () => showTip(tip, host, g, text)));
    ["pointerleave", "blur"].forEach((ev) => g.addEventListener(ev, () => { tip.hidden = true; }));
    svg.append(g);
    if (i % every === 0) {
      const t = svgEl("text", { x: x + barW / 2, y: CHART_H - 8, class: "tick", "text-anchor": "middle" });
      t.textContent = b.label;
      svg.append(t);
    }
  });
  if (goal > 0) {
    svg.append(svgEl("line", { x1: CHART_PAD.left, x2: width - CHART_PAD.right, y1: y(goal), y2: y(goal), class: "goal" }));
    const gl = svgEl("text", { x: width - CHART_PAD.right, y: y(goal) - 6, class: "tick goal-label", "text-anchor": "end" });
    gl.textContent = `Goal ${Math.round(goal)}`;
    svg.append(gl);
  }
  host.querySelector("svg") ? host.querySelector("svg").replaceWith(svg) : host.prepend(svg);
}

function chartTable(bars) {
  return el("table", { class: "visually-hidden" },
    el("caption", {}, "Minutes practised"),
    el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "When"), APM_KEYS.map((k) => el("th", { scope: "col" }, `${APM_INFO[k].name} minutes`)))),
    el("tbody", {}, bars.map((b) => el("tr", {}, el("th", { scope: "row" }, barLabel(b)), APM_KEYS.map((k) => el("td", {}, String(b[k])))))));
}

function legend() {
  return el("ul", { class: "chart-legend", role: "list" },
    APM_KEYS.map((k) => el("li", {}, el("span", { class: `swatch ${k}` }), k === "r" ? "Rest and closing" : `${APM_INFO[k].letter} · ${APM_INFO[k].name}`)),
    el("li", {}, el("span", { class: "swatch goal-key" }), "Goal"));
}

/** Redraw a chart whenever its box changes width. */
function responsive(host, draw) {
  if ("ResizeObserver" in window) {
    let last = 0;
    new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w && w !== last) {
        last = w;
        draw();
      }
    }).observe(host);
  } else {
    requestAnimationFrame(draw);
  }
}

function chartTile(store) {
  const bars = periodBars(store, progressPeriod);
  const weekly = weeklyRings()[0].goal;
  const goal = progressPeriod === "year" ? (weekly * 52) / 12 : weekly / 7;
  const host = el("div", { class: "chart" }, el("div", { class: "chart-tip", role: "status", hidden: true }));
  responsive(host, () => drawBars(host, bars, goal));
  const unit = progressPeriod === "year" ? "month" : "day";
  return tileBox(`Minutes per ${unit}`, "wide", legend(), host, chartTable(bars),
    el("p", { class: "muted small" }, progressPeriod === "year" ? "The goal line is your weekly goal spread over a month." : "The goal line is your weekly goal spread over seven days."));
}

/* 4. Calendar heatmap */

function heatLevel(min) {
  let level = 0;
  HEAT_STEPS.forEach((step, i) => { if (min >= step && step > 0) level = i; });
  return level;
}

function drawHeatmap(host, weeks) {
  const labelW = 34;
  const gap = 3;
  const cell = Math.max(12, Math.min(28, Math.floor((host.clientWidth - labelW) / weeks.length) - gap));
  const width = labelW + weeks.length * (cell + gap);
  const height = 18 + 7 * (cell + gap);
  const svg = svgEl("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "heat-svg", role: "group", "aria-label": "Practice calendar for the last 12 weeks" });
  ["Mon", "", "Wed", "", "Fri", "", ""].forEach((d, i) => {
    if (!d) return;
    const t = svgEl("text", { x: 0, y: 18 + i * (cell + gap) + cell * 0.75, class: "tick" });
    t.textContent = d;
    svg.append(t);
  });
  const tip = host.querySelector(".chart-tip");
  let lastMonth = "";
  weeks.forEach((week, w) => {
    const month = parseIso(week[0].key).toLocaleDateString("en-GB", { month: "short" });
    if (month !== lastMonth) {
      const t = svgEl("text", { x: labelW + w * (cell + gap), y: 11, class: "tick" });
      t.textContent = month;
      svg.append(t);
      lastMonth = month;
    }
    week.forEach((c, d) => {
      if (c.future) return;
      const label = `${longDate(c.key)}: ${minutesText(c.minutes)}`;
      const rect = svgEl("rect", { x: labelW + w * (cell + gap), y: 18 + d * (cell + gap), width: cell, height: cell, rx: 3, class: `heat heat-${heatLevel(c.minutes)}`, tabindex: "0", role: "img", "aria-label": label });
      ["pointerenter", "focus"].forEach((ev) => rect.addEventListener(ev, () => showTip(tip, host, rect, label)));
      ["pointerleave", "blur"].forEach((ev) => rect.addEventListener(ev, () => { tip.hidden = true; }));
      svg.append(rect);
    });
  });
  host.querySelector("svg") ? host.querySelector("svg").replaceWith(svg) : host.prepend(svg);
}

function heatmapTile(store) {
  const weeks = heatmapWeeks(store);
  const host = el("div", { class: "chart heat" }, el("div", { class: "chart-tip", role: "status", hidden: true }));
  responsive(host, () => drawHeatmap(host, weeks));
  const scale = el("div", { class: "heat-scale", "aria-hidden": "true" }, el("span", {}, "Less"), HEAT_STEPS.map((_, i) => el("span", { class: `heat-key heat-${i}` })), el("span", {}, "More"));
  return tileBox("Last 12 weeks", "", host, scale);
}

/* 5. Journey */

function journeyTile() {
  const plan = readPlan();
  if (!plan) {
    return tileBox("Your journey", "",
      el("p", { class: "muted" }, "Take the quiz to get a six month plan. Your progress through it will show here."),
      el("a", { class: "pill", href: "#/quiz" }, "Take the quiz"));
  }
  const i = currentStageIndex(plan);
  const stage = plan.journey[i];
  const prog = stageProgress(plan, i);
  const total = stageWeeks(plan.journey[plan.journey.length - 1]).end;
  const through = Math.min(1, (weekNumber(plan) - 1) / total);
  return tileBox("Your journey", "",
    el("p", { class: "eyebrow" }, `${stage.when} · Stage ${i + 1} of ${plan.journey.length}`),
    el("p", { class: "tile-big" }, stage.title),
    el("p", { class: "muted" }, `${Math.round(through * 100)} per cent of the way through your plan.`),
    progressBar(through, "Plan progress"),
    el("p", { class: "muted small" }, `${prog.done} of ${prog.target} sessions done in this stage.`),
    progressBar(prog.pct, "Stage progress"),
    el("a", { class: "text-link", href: "#/plan" }, "Open your plan"));
}

/* 6. What you practise most */

function mostTile(store) {
  const most = practiceMost(store);
  const sessionRow = (s) => {
    const found = findSession(s.id);
    return row({ lead: tile(s.title[0], found ? found.color : "#8E8E93"), title: s.title, sub: `${plural(s.count, "time")} · ${s.min} min`, href: found ? `#/sessions/${s.id}` : null });
  };
  const poseRow = (p) => row({ lead: poseArt(p.id), title: POSE_BY_ID[p.id].en, sub: fmtDur(p.secs), href: `#/poses/${p.id}` });
  const breathRow = (b) => row({ lead: tile(b.title[0], "var(--accent)"), title: b.title, sub: `${plural(b.count, "time")} · ${b.min} min`, href: BREATH_BY_ID[b.id] ? `#/breathe/${b.id}` : null });
  const part = (title, items, render, empty) => [el("h3", { class: "section-title" }, title), items.length ? group(items.map(render)) : el("p", { class: "muted small" }, empty)];
  return tileBox("What you practise most", "",
    part("Sessions and flows", most.sessions, sessionRow, "No sessions yet."),
    part("Poses", most.poses, poseRow, "Time in each pose shows after your next session."),
    part("Breathing", most.breaths, breathRow, "No breathing practices yet."));
}

/* 7. Badges */

function badgesTile(store) {
  const earned = BADGES.filter((b) => store.badges[b.id]);
  const next = nextBadge(store);
  return tileBox("Badges", "",
    earned.length
      ? el("ul", { class: "badge-row", role: "list" }, earned.map((b) => badgeChip(b, store.badges[b.id])))
      : el("p", { class: "muted" }, "No badges yet."),
    next && el("div", { class: "next-badge" },
      el("p", { class: "eyebrow" }, "Next badge"),
      el("p", { class: "strong" }, next.badge.name),
      el("p", { class: "muted small" }, next.badge.text),
      progressBar(next.progress, `${next.badge.name} progress`)));
}

/* 8. History */

function historyTile(store) {
  const list = el("div", {});
  const paint = () => {
    const items = store.history.slice().reverse().filter((h) => historyFilter === "all" || historyKind(h) === historyFilter).slice(0, HISTORY_SHOWN);
    const fmt = (d) => parseIso(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    list.replaceChildren(items.length
      ? group(items.map((h) => row({ lead: tile(h.title[0], h.kind === "breath" ? "var(--accent)" : "#8E8E93"), title: h.title, sub: `${fmt(h.date)} · ${h.done ? "Completed" : "Stopped early"}`, detail: `${Math.max(1, Math.round(h.min))} min` })))
      : emptyState("Nothing here yet.", "Try another filter."));
  };
  paint();
  return tileBox("History", "wide",
    chipRow("Show", HISTORY_FILTERS, historyFilter, (v) => { historyFilter = v; paint(); }),
    list);
}

/* 9. Your data */

function downloadExport() {
  const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: `sthira-progress-${isoDate(new Date())}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const res = importData(String(reader.result));
    if (res.ok) checkBadges();
    showToast(res.message);
    if (res.ok) refreshView();
  };
  reader.onerror = () => showToast("That file could not be read.");
  reader.readAsText(file);
  input.value = "";
}

function dataTile() {
  const input = el("input", { type: "file", accept: "application/json,.json", class: "visually-hidden", id: "import-file", tabindex: "-1" });
  input.addEventListener("change", () => importFile(input));
  return tileBox("Your data", "",
    el("p", { class: "muted" }, "Everything stays in this browser on this device. Nothing is sent anywhere. Export a file to keep a copy or to move to another device."),
    el("div", { class: "btn-row" },
      el("button", { type: "button", class: "pill", onclick: downloadExport }, "Export"),
      el("button", { type: "button", class: "pill pill-ghost", onclick: () => input.click() }, "Import"),
      el("button", { type: "button", class: "pill pill-danger", onclick: () => {
        if (!window.confirm("Reset all data? This removes your plan, history, flows and badges from this browser.")) return;
        resetAll();
        refreshView();
        showToast("All data has been reset.");
      } }, "Reset all data")),
    input);
}

/* Page */

function progressEmpty() {
  return el("div", { class: "empty progress-empty" },
    el("p", { class: "empty-title" }, "Your progress starts with one session."),
    el("p", {}, "Practise once and your minutes, streaks and badges appear here."),
    el("div", { class: "btn-row centre" },
      el("a", { class: "pill", href: "#/sessions/morning" }, "Start your first session"),
      el("a", { class: "pill pill-ghost", href: "#/quiz" }, "Take the quiz")));
}

function renderProgress() {
  const store = readStore();
  const head = pageHead("Progress", "Your progress.", "Everything you have practised, kept on this device.");
  if (!store.history.length) return el("div", { class: "page progress-page" }, head, progressEmpty(), el("div", { class: "bento" }, dataTile()));
  return el("div", { class: "page progress-page" }, head,
    el("div", { class: "bento" },
      summaryTile(store), periodTile(store), chartTile(store), heatmapTile(store), journeyTile(),
      mostTile(store), badgesTile(store), historyTile(store), dataTile()));
}
