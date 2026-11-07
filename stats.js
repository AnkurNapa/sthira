// Sthira progress maths with no DOM: periods, totals, charts data, heatmap, favourites, export and import.
// tests.js loads this file in Node after core.js.
"use strict";

const PERIODS = ["week", "month", "year"];
const PERIOD_WORD = { week: "week", month: "month", year: "year" };
const HEATMAP_WEEKS = 12;
const EXPORT_APP = "sthira";
const EXPORT_VERSION = 1;
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const countText = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const isFlowId = (id) => /^(my-|flow-)/.test(id) || id === TODAY_FLOW_ID;

function startOfWeek(d) {
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
}

/** The first and last local date of a period. offset -1 is the period before. */
function periodRange(period, today = new Date(), offset = 0) {
  if (period === "week") {
    const from = addDays(startOfWeek(today), offset * 7);
    return { from: isoDate(from), to: isoDate(addDays(from, 6)) };
  }
  if (period === "month") {
    const from = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    return { from: isoDate(from), to: isoDate(to) };
  }
  const year = today.getFullYear() + offset;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

const inRange = (date, r) => date >= r.from && date <= r.to;

/**
 * Totals for a period. With sameSpan an earlier period stops at the same point as today,
 * so a part finished week is never compared with a whole one.
 */
function periodTotals(store, period, today = new Date(), offset = 0, sameSpan = false) {
  const full = periodRange(period, today, offset);
  const elapsed = dayNumber(today) - dayNumber(parseIso(periodRange(period, today).from));
  const capped = isoDate(addDays(parseIso(full.from), elapsed));
  const r = sameSpan && offset !== 0 && capped < full.to ? { ...full, to: capped } : full;
  const cats = emptyCats();
  let days = 0;
  Object.entries(store.log).forEach(([date, e]) => {
    if (!inRange(date, r)) return;
    APM_KEYS.forEach((k) => { cats[k] += e[k] || 0; });
    if (dayTotal(e) > 0) days += 1;
  });
  const sessions = store.history.filter((h) => h.kind === "session" && h.done && inRange(h.date, r)).length;
  const minutes = Math.round(APM_KEYS.reduce((sum, k) => sum + cats[k], 0));
  return { minutes, a: Math.round(cats.a), p: Math.round(cats.p), m: Math.round(cats.m), sessions, days };
}

/** Plain words for a change against the previous period. */
function changeText(now, before, period, unit) {
  const word = PERIOD_WORD[period];
  const diff = now - before;
  if (before === 0 && now === 0) return `None so far, same as this time last ${word}`;
  if (diff === 0) return `Same as this time last ${word}`;
  const amount = `${Math.abs(diff)} ${unit}`;
  return diff > 0 ? `${amount} more than this time last ${word}` : `${amount} fewer than this time last ${word}`;
}

/** Bars for the chart: days for a week or month, months for a year. Each has a, p, m and r minutes. */
function periodBars(store, period, today = new Date()) {
  const r = periodRange(period, today);
  if (period === "year") {
    const year = Number(r.from.slice(0, 4));
    return MONTHS_SHORT.map((label, m) => {
      const prefix = `${year}-${String(m + 1).padStart(2, "0")}`;
      const sums = emptyCats();
      Object.entries(store.log).forEach(([date, e]) => {
        if (date.startsWith(prefix)) APM_KEYS.forEach((k) => { sums[k] += e[k] || 0; });
      });
      return { label, key: prefix, ...Object.fromEntries(APM_KEYS.map((k) => [k, Math.round(sums[k])])) };
    });
  }
  const bars = [];
  for (let d = parseIso(r.from); isoDate(d) <= r.to; d = addDays(d, 1)) {
    const key = isoDate(d);
    const e = store.log[key] || emptyCats();
    const label = period === "week" ? d.toLocaleDateString("en-GB", { weekday: "short" }) : String(d.getDate());
    bars.push({ label, key, ...Object.fromEntries(APM_KEYS.map((k) => [k, Math.round(e[k] || 0)])) });
  }
  return bars;
}

/** Heatmap columns for the last weeks, Monday first. Future days are marked. */
function heatmapWeeks(store, today = new Date(), weeks = HEATMAP_WEEKS) {
  const todayKey = isoDate(today);
  const start = addDays(startOfWeek(today), -(weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (__, d) => {
    const day = addDays(start, w * 7 + d);
    const key = isoDate(day);
    return { key, minutes: Math.round(dayTotal(store.log[key])), future: key > todayKey };
  }));
}

/** Longest run of consecutive practice days ever. */
function bestStreak(log) {
  const days = Object.keys(log).filter((k) => dayTotal(log[k]) > 0).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  days.forEach((key) => {
    run = prev && dayNumber(parseIso(key)) - dayNumber(parseIso(prev)) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  });
  return best;
}

function topBy(list, keyFn, limit) {
  const map = new Map();
  list.forEach((h) => {
    const key = keyFn(h);
    const prev = map.get(key) || { id: h.id, title: h.title, count: 0, min: 0 };
    map.set(key, { ...prev, count: prev.count + 1, min: prev.min + (h.min || 0) });
  });
  return [...map.values()].sort((a, b) => b.count - a.count || b.min - a.min).slice(0, limit).map((x) => ({ ...x, min: Math.round(x.min) }));
}

function practiceMost(store, limit = 5) {
  const sessions = topBy(store.history.filter((h) => h.kind === "session"), (h) => h.id, limit);
  const breaths = topBy(store.history.filter((h) => h.kind === "breath"), (h) => h.id, limit);
  const poses = Object.entries(store.poseSecs || {})
    .filter(([id]) => POSE_BY_ID[id])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, secs]) => ({ id, secs: Math.round(secs) }));
  return { sessions, breaths, poses };
}

/** The badge closest to unlocking, with progress from 0 to 1. */
function nextBadge(store, today = new Date()) {
  const streak = streakDays(store.log, today);
  const plan = readPlan();
  const stagePct = plan ? Math.max(...plan.journey.map((_, i) => stageProgress(plan, i, store).pct)) : 0;
  const progress = {
    first: Math.min(1, store.sessions),
    streak3: streak / 3,
    streak7: streak / 7,
    ten: store.sessions / 10,
    nidra: 0,
    breaths: store.breathsTried.filter((id) => BREATH_BY_ID[id]).length / BREATHS.length,
    stage: stagePct,
  };
  const open = BADGES.filter((b) => !store.badges[b.id]).map((b) => ({ badge: b, progress: Math.min(1, progress[b.id] || 0) }));
  return open.sort((a, b) => b.progress - a.progress)[0] || null;
}

function historyKind(h) {
  if (h.kind === "breath") return "breathing";
  return isFlowId(h.id) ? "flows" : "sessions";
}

/* Export and import */

function exportData() {
  return { app: EXPORT_APP, version: EXPORT_VERSION, exported: new Date().toISOString(), store: readStore(), plan: readPlan(), flows: readFlows() };
}

function mergeLogs(a, b) {
  const out = { ...a };
  Object.entries(b).forEach(([date, e]) => {
    const prev = out[date] || emptyCats();
    out[date] = Object.fromEntries(APM_KEYS.map((k) => [k, Math.max(prev[k] || 0, e[k] || 0)]));
  });
  return out;
}

function mergeHistory(a, b) {
  const seen = new Set(a.map((h) => `${h.ts}|${h.id}`));
  return [...a, ...b.filter((h) => !seen.has(`${h.ts}|${h.id}`))].sort((x, y) => (x.ts || 0) - (y.ts || 0)).slice(-HISTORY_MAX);
}

function mergePoseSecs(a, b) {
  const out = { ...a };
  Object.entries(b).forEach(([id, secs]) => { out[id] = Math.max(out[id] || 0, secs); });
  return out;
}

/**
 * Import a file made by exportData. Days take the larger of the two values so nothing counts twice.
 * Returns { ok, message }. Nothing is written unless the file is valid.
 */
function importData(raw) {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return { ok: false, message: "That file is not valid JSON." };
    }
  }
  if (!isObj(data) || data.app !== EXPORT_APP || !isObj(data.store)) return { ok: false, message: "That file is not a Sthira export." };
  if (Number(data.version) > EXPORT_VERSION) return { ok: false, message: "That file comes from a newer version of Sthira." };
  const incoming = migrateStore(data.store);
  const current = readStore();
  const badges = { ...incoming.badges };
  Object.entries(current.badges).forEach(([id, date]) => { if (!badges[id] || date < badges[id]) badges[id] = date; });
  const union = (x, y) => [...new Set([...x, ...y])];
  const history = mergeHistory(current.history, incoming.history);
  writeStore({
    log: mergeLogs(current.log, incoming.log),
    history,
    sessions: Math.max(current.sessions, incoming.sessions, history.filter((h) => h.kind === "session" && h.done).length),
    badges,
    favPoses: union(current.favPoses, incoming.favPoses),
    favSessions: union(current.favSessions, incoming.favSessions),
    breathsTried: union(current.breathsTried, incoming.breathsTried),
    stagesDone: union(current.stagesDone, incoming.stagesDone),
    poseSecs: mergePoseSecs(current.poseSecs || {}, incoming.poseSecs || {}),
  });
  if (!readPlan() && data.plan) savePlan(data.plan);
  const flows = Array.isArray(data.flows) ? data.flows.map(cleanFlow).filter(Boolean) : [];
  const have = new Set(readFlows().map((f) => f.id));
  const added = flows.filter((f) => !have.has(f.id));
  if (added.length) writeFlows([...readFlows(), ...added]);
  return { ok: true, message: `Imported ${countText(incoming.history.length, "history item")} and ${countText(added.length, "flow")}.` };
}
