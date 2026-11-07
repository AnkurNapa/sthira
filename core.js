// Sthira logic with no DOM: storage, progress, plan helpers and session maths.
// tests.js loads this file in Node, so nothing here may touch the page at load time.
"use strict";

const STORE_KEY = "sthira.v1";
const PLAN_KEY = "sthira.plan";
const FLOWS_KEY = "sthira.flows";
const TODAY_FLOW_ID = "today-flow";
const SCHEMA = 3;
const LEVELS = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };
const POSE_BY_ID = Object.fromEntries(POSES.map((p) => [p.id, p]));
const BREATH_BY_ID = Object.fromEntries(BREATHS.map((b) => [b.id, b]));
const SESSION_BY_ID = Object.fromEntries(SESSIONS.map((s) => [s.id, s]));
const ARTICLE_BY_ID = Object.fromEntries(ARTICLES.map((a) => [a.id, a]));
const SETUP_SECS = 5;
const SUN_ROUND_SECS = 30;
// Poses inside a sun salutation. If the plan avoids any of them the whole salutation is left out.
const SUN_POSE_IDS = ["uttanasana", "phalakasana", "bhujangasana", "adho-mukha"];
// Phases where a timed step means moving the body. Rest only plans leave these out.
const MOVE_PHASES = ["Warm-up", "Sun salutation", "Poses", "Seated", "Standing"];
const RESUME_MS = 12 * 60 * 60 * 1000;
const HISTORY_MAX = 200;
const DEFAULT_SETTINGS = { voice: true, rate: 0.9, chime: true, breathSecs: BREATH_SECS, weeklyGoal: 0, apmSplit: [70, 15, 15] };

/* APM: asana, pranayama and meditation. Rest (opening, relaxation, closing) counts in totals only. */
const APM_KEYS = ["a", "p", "m", "r"];
const APM_INFO = {
  a: { letter: "A", name: "Asana" },
  p: { letter: "P", name: "Pranayama" },
  m: { letter: "M", name: "Meditation" },
  r: { letter: "R", name: "Rest" },
};
const REST_PHASES = ["Opening", "Relaxation", "Closing"];
const MEDITATION_SESSIONS = ["nidra", "meditate"];
const emptyCats = () => ({ a: 0, p: 0, m: 0, r: 0 });

/** The APM category of a step from its phase. Yoga Nidra and the meditation session count as meditation. */
function phaseCategory(phase, sessionId) {
  if (REST_PHASES.includes(phase)) return "r";
  if (MEDITATION_SESSIONS.includes(sessionId)) return "m";
  if (phase === "Breathing") return "p";
  if (phase === "Meditation") return "m";
  return "a";
}

function cleanSplit(raw) {
  const nums = Array.isArray(raw) ? raw.map(Number) : [];
  const ok = nums.length === 3 && nums.every((n) => n >= 0) && Math.round(nums[0] + nums[1] + nums[2]) === 100;
  return ok ? nums : [...DEFAULT_SETTINGS.apmSplit];
}

/* Small utilities */

const isObj = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const positive = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
const round1 = (n) => Math.round(n * 10) / 10;

/* Storage. Every access is guarded so the site still runs when storage throws. */

function safeGet(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function cleanSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(isObj(raw) ? raw : {}) };
  return {
    voice: s.voice !== false,
    chime: s.chime !== false,
    rate: clamp(Number(s.rate) || DEFAULT_SETTINGS.rate, 0.6, 1.2),
    breathSecs: clamp(Math.round(Number(s.breathSecs)) || BREATH_SECS, 5, 8),
    weeklyGoal: clamp(Math.round(Number(s.weeklyGoal)) || 0, 0, 1000),
    apmSplit: cleanSplit(s.apmSplit),
  };
}

/** One day of the log. Schema 2 stored s (session) and b (breath pacer): s becomes asana, b pranayama. */
function cleanDay(v) {
  if (!isObj(v)) return null;
  if (APM_KEYS.some((k) => k in v)) return { a: positive(v.a), p: positive(v.p), m: positive(v.m), r: positive(v.r) };
  return { a: positive(v.s), p: positive(v.b), m: 0, r: 0 };
}

function cleanLog(raw) {
  const log = {};
  const dateKey = /^\d{4}-\d{2}-\d{2}$/;
  if (isObj(raw.log)) {
    Object.entries(raw.log).forEach(([d, v]) => {
      const day = dateKey.test(d) ? cleanDay(v) : null;
      if (day) log[d] = day;
    });
  } else if (isObj(raw.days)) {
    // Schema 1 stored plain minutes per day.
    Object.entries(raw.days).forEach(([d, v]) => {
      if (dateKey.test(d)) log[d] = { a: positive(v), p: 0, m: 0, r: 0 };
    });
  }
  return log;
}

/** Bring any saved shape up to the current schema. Broken data starts fresh. */
function migrateStore(raw) {
  const base = {
    schema: SCHEMA, log: {}, sessions: 0, history: [], badges: {}, favPoses: [], favSessions: [],
    breathsTried: [], stagesDone: [], resume: null, welcomed: false, iosHint: false, settings: cleanSettings(null), poseSecs: {},
  };
  if (!isObj(raw)) return base;
  return {
    ...base,
    log: cleanLog(raw),
    sessions: Math.floor(positive(raw.sessions)),
    history: Array.isArray(raw.history) ? raw.history.filter((h) => isObj(h) && typeof h.date === "string").slice(-HISTORY_MAX) : [],
    badges: isObj(raw.badges) ? raw.badges : {},
    favPoses: strings(raw.favPoses),
    favSessions: strings(raw.favSessions),
    breathsTried: strings(raw.breathsTried),
    stagesDone: strings(raw.stagesDone),
    resume: isObj(raw.resume) ? raw.resume : null,
    welcomed: raw.welcomed === true,
    iosHint: raw.iosHint === true,
    settings: cleanSettings(raw.settings),
    poseSecs: cleanPoseSecs(raw.poseSecs),
  };
}

function cleanPoseSecs(raw) {
  const out = {};
  if (isObj(raw)) Object.entries(raw).forEach(([id, secs]) => { if (positive(secs)) out[id] = Math.round(positive(secs)); });
  return out;
}

let memStore = null;

function readStore() {
  if (!memStore) memStore = migrateStore(safeGet(STORE_KEY));
  return memStore;
}

function writeStore(patch) {
  memStore = { ...readStore(), ...patch, schema: SCHEMA };
  safeSet(STORE_KEY, memStore);
  return memStore;
}

function settings() {
  return readStore().settings;
}

function updateSettings(patch) {
  return writeStore({ settings: cleanSettings({ ...settings(), ...patch }) });
}

function resetAll() {
  safeSet(STORE_KEY, null);
  safeSet(PLAN_KEY, null);
  safeSet(FLOWS_KEY, null);
  memStore = migrateStore(null);
  memPlan = null;
  memFlows = [];
}

/* Dates. Always local time. */

function isoDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Whole days since a fixed point, counted in local calendar days. */
function dayNumber(d = new Date()) {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

/* Progress */

const dayTotal = (entry) => (entry ? APM_KEYS.reduce((sum, k) => sum + (entry[k] || 0), 0) : 0);

function streakDays(log, today = new Date()) {
  let day = dayTotal(log[isoDate(today)]) > 0 ? today : addDays(today, -1);
  let count = 0;
  while (dayTotal(log[isoDate(day)]) > 0) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

/** Minutes per APM category since Monday, plus the number of days practised. */
function weekStats(log, today = new Date()) {
  const sinceMonday = (today.getDay() + 6) % 7;
  const out = { ...emptyCats(), days: 0 };
  for (let i = 0; i <= sinceMonday; i += 1) {
    const entry = log[isoDate(addDays(today, -i))];
    if (!entry) continue;
    APM_KEYS.forEach((k) => { out[k] += entry[k] || 0; });
    if (dayTotal(entry) > 0) out.days += 1;
  }
  APM_KEYS.forEach((k) => { out[k] = Math.round(out[k]); });
  return out;
}

function addToLog(store, dateKey, cats) {
  const prev = store.log[dateKey] || emptyCats();
  const next = { ...emptyCats(), ...prev };
  APM_KEYS.forEach((k) => { next[k] = round1(next[k] + Math.max(0, cats[k] || 0)); });
  return { ...store.log, [dateKey]: next };
}

/** Category minutes for a session that recorded none: all of it counts as asana. */
function catsOrAsana(cats, minutes) {
  const total = cats ? APM_KEYS.reduce((sum, k) => sum + (cats[k] || 0), 0) : 0;
  return total > 0 ? { ...emptyCats(), ...cats } : { ...emptyCats(), a: Math.max(0, minutes) };
}

function pushHistory(store, item) {
  return [...store.history, { ts: Date.now(), ...item }].slice(-HISTORY_MAX);
}

function addPoseSecs(current, extra) {
  const out = { ...current };
  Object.entries(extra || {}).forEach(([id, secs]) => { out[id] = Math.round((out[id] || 0) + secs); });
  return out;
}

/**
 * Save a session. dateKey is the day it started, so a session past midnight counts on its start date.
 * poses maps pose ids to the seconds spent in them.
 */
function recordSession({ session, minutes, completed, dateKey, poses, cats }) {
  const store = readStore();
  if (!(minutes > 0) && !completed) return store;
  const date = dateKey || isoDate(new Date());
  const split = catsOrAsana(cats, minutes);
  const rounded = Object.fromEntries(APM_KEYS.map((k) => [k, round1(split[k])]));
  return writeStore({
    poseSecs: addPoseSecs(store.poseSecs, poses),
    log: addToLog(store, date, split),
    sessions: store.sessions + (completed ? 1 : 0),
    history: pushHistory(store, { date, kind: "session", id: session.id, title: session.name, min: round1(minutes), done: Boolean(completed), cats: rounded }),
    resume: completed ? null : store.resume,
  });
}

function recordBreath({ breath, minutes, dateKey }) {
  const store = readStore();
  if (!(minutes > 0)) return store;
  const date = dateKey || isoDate(new Date());
  const tried = store.breathsTried.includes(breath.id) ? store.breathsTried : [...store.breathsTried, breath.id];
  return writeStore({
    log: addToLog(store, date, { p: minutes }),
    breathsTried: tried,
    history: pushHistory(store, { date, kind: "breath", id: breath.id, title: breath.name, min: round1(minutes), done: true }),
  });
}

/* Favourites and resume */

function isFav(kind, id) {
  return readStore()[kind === "pose" ? "favPoses" : "favSessions"].includes(id);
}

function toggleFav(kind, id) {
  const key = kind === "pose" ? "favPoses" : "favSessions";
  const list = readStore()[key];
  writeStore({ [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  return isFav(kind, id);
}

function saveResume(sessionId, idx) {
  writeStore({ resume: { id: sessionId, idx, ts: Date.now() } });
}

function getResume(now = Date.now()) {
  const r = readStore().resume;
  if (!r || !findSession(r.id) || !(now - r.ts < RESUME_MS) || !(r.idx > 0)) return null;
  return r;
}

function clearResume() {
  writeStore({ resume: null });
}

/* Plan access. plan.js builds the plan. This side keeps it safe to read. */

let memPlan;

function knownIds(list, map) {
  return strings(list).filter((id) => map[id]);
}

function cleanStage(st) {
  return {
    ...st,
    title: String(st.title || "Stage"),
    when: String(st.when || ""),
    days: clamp(Math.round(Number(st.days)) || 3, 1, 7),
    focus: String(st.focus || ""),
    milestone: String(st.milestone || ""),
    sessions: knownIds(st.sessions, SESSION_BY_ID),
    poses: knownIds(st.poses, POSE_BY_ID),
    breaths: knownIds(st.breaths, BREATH_BY_ID),
    articles: knownIds(st.articles, ARTICLE_BY_ID),
  };
}

/** Accept a plan from any quiz version. Unknown ids are dropped. A broken plan returns null. */
function cleanPlan(raw) {
  if (!isObj(raw) || !isObj(raw.dosha) || !DOSHAS[raw.dosha.primary] || !isObj(raw.health) || !Array.isArray(raw.journey)) return null;
  const journey = raw.journey.filter(isObj).map(cleanStage);
  if (!journey.length) return null;
  const healthIds = strings(raw.health.ids).filter((c) => CONDITIONS[c]);
  return {
    ...raw,
    created: /^\d{4}-\d{2}-\d{2}$/.test(raw.created) ? raw.created : isoDate(new Date()),
    answers: isObj(raw.answers) ? raw.answers : {},
    dosha: {
      ...raw.dosha,
      secondary: DOSHAS[raw.dosha.secondary] ? raw.dosha.secondary : null,
      tertiary: DOSHAS[raw.dosha.secondary] && DOSHAS[raw.dosha.tertiary] ? raw.dosha.tertiary : null,
    },
    lvl: clamp(Math.round(Number(raw.lvl)) || 1, 1, 3),
    poses: knownIds(raw.poses, POSE_BY_ID),
    breaths: knownIds(raw.breaths, BREATH_BY_ID),
    health: {
      ids: healthIds,
      restOnly: raw.health.restOnly === true,
      avoid: strings(raw.health.avoid),
      avoidBreaths: strings(raw.health.avoidBreaths),
      noHolds: raw.health.noHolds === true,
      tips: strings(raw.health.tips),
    },
    journey,
  };
}

function readPlan() {
  if (memPlan === undefined) memPlan = cleanPlan(safeGet(PLAN_KEY));
  return memPlan;
}

function savePlan(plan) {
  memPlan = cleanPlan(plan);
  safeSet(PLAN_KEY, memPlan);
  return memPlan;
}

/** The health context every safety check reads. */
function planContext() {
  const plan = readPlan();
  return {
    avoid: new Set(plan ? plan.health.avoid : []),
    avoidBreaths: new Set(plan ? plan.health.avoidBreaths : []),
    restOnly: Boolean(plan && plan.health.restOnly),
    noHolds: Boolean(plan && plan.health.noHolds),
    breathSecs: settings().breathSecs,
  };
}

function conditionLabel(id) {
  const q = QUIZ.find((x) => x.id === "conditions");
  const option = q && q.options.find((o) => o.v === id);
  return option ? option.label : id;
}

/** Why a pose or breath is left out of the plan, in plain words. */
function avoidReason(id, kind) {
  const plan = readPlan();
  if (!plan) return "";
  const field = kind === "breath" ? "avoidBreaths" : "avoid";
  let ids = plan.health.ids.filter((c) => (CONDITIONS[c][field] || []).includes(id));
  if (!ids.length && plan.health.restOnly) ids = plan.health.ids.filter((c) => CONDITIONS[c].restOnly);
  return ids.map(conditionLabel).join("; ");
}

/* Journey stages */

function stageWeeks(stage) {
  const m = /^(Weeks|Months) (\d+) to (\d+)$/.exec(stage.when);
  if (!m) return { start: 1, end: 2 };
  const a = Number(m[2]);
  const b = Number(m[3]);
  return m[1] === "Weeks" ? { start: a, end: b } : { start: (a - 1) * 4 + 1, end: Math.round((b * 52) / 12) };
}

function weekNumber(plan, today = new Date()) {
  return Math.floor((dayNumber(today) - dayNumber(parseIso(plan.created))) / 7) + 1;
}

function currentStageIndex(plan, today = new Date()) {
  const week = weekNumber(plan, today);
  let idx = 0;
  plan.journey.forEach((st, i) => { if (stageWeeks(st).start <= week) idx = i; });
  return idx;
}

function stageProgress(plan, i, store = readStore()) {
  const { start, end } = stageWeeks(plan.journey[i]);
  const created = parseIso(plan.created);
  const from = isoDate(addDays(created, (start - 1) * 7));
  const to = isoDate(addDays(created, end * 7 - 1));
  const done = store.history.filter((h) => h.kind === "session" && h.done && h.date >= from && h.date <= to).length;
  const target = plan.journey[i].days * (end - start + 1);
  return { done, target, pct: Math.min(1, done / target) };
}

function checkStages(today = new Date()) {
  const plan = readPlan();
  if (!plan) return;
  const store = readStore();
  const finished = plan.journey
    .map((st, i) => `${plan.created}:${i}`)
    .filter((key, i) => !store.stagesDone.includes(key) && stageProgress(plan, i, store).pct >= 1);
  if (finished.length) writeStore({ stagesDone: [...store.stagesDone, ...finished] });
}

/* Badges */

const BADGES = [
  { id: "first", name: "First session", text: "You finished your first session.", test: (s) => s.sessions >= 1 },
  { id: "streak3", name: "Three days", text: "You practised three days in a row.", test: (s, c) => c.streak >= 3 },
  { id: "streak7", name: "One week", text: "You practised seven days in a row.", test: (s, c) => c.streak >= 7 },
  { id: "ten", name: "Ten sessions", text: "You finished ten sessions.", test: (s) => s.sessions >= 10 },
  { id: "nidra", name: "Deep rest", text: "You finished a full Yoga Nidra.", test: (s) => s.history.some((h) => h.id === "nidra" && h.done) },
  { id: "breaths", name: "Every breath", text: "You tried every breathing practice.", test: (s) => BREATHS.every((b) => s.breathsTried.includes(b.id)) },
  { id: "stage", name: "Stage complete", text: "You finished a stage of your journey.", test: (s) => s.stagesDone.length > 0 },
];

/** Unlock any badges earned. Returns the new ones. */
function checkBadges(today = new Date()) {
  checkStages(today);
  const store = readStore();
  const ctx = { streak: streakDays(store.log, today) };
  const fresh = BADGES.filter((b) => !store.badges[b.id] && b.test(store, ctx));
  if (fresh.length) writeStore({ badges: { ...store.badges, ...Object.fromEntries(fresh.map((b) => [b.id, isoDate(today)])) } });
  return fresh;
}

/* Weekly rings */

function weeklyRings(today = new Date()) {
  const store = readStore();
  const plan = readPlan();
  const week = weekStats(store.log, today);
  const days = plan ? plan.journey[currentStageIndex(plan, today)].days : 3;
  const perDay = (plan && Number(plan.answers.time)) || 20;
  const goal = store.settings.weeklyGoal || perDay * days;
  const [sa, sp, sm] = store.settings.apmSplit;
  const part = (share) => Math.max(1, Math.round((goal * share) / 100));
  return [
    { id: "a", label: "A · Asana", value: week.a, goal: part(sa), unit: "min" },
    { id: "p", label: "P · Pranayama", value: week.p, goal: part(sp), unit: "min" },
    { id: "m", label: "M · Meditation", value: week.m, goal: part(sm), unit: "min" },
  ];
}

/** Seconds per APM category for a flattened session. */
function apmSplit(flatSteps, sessionId) {
  const out = emptyCats();
  flatSteps.forEach((st) => { out[phaseCategory(st.phase, sessionId)] += st.secs; });
  return out;
}

/** A short line on the balance of the week. */
function balanceLine(week) {
  const core = week.a + week.p + week.m;
  if (core === 0) return "Nothing yet this week. Any practice starts the rings.";
  const asana = week.a / core;
  if (asana > 0.75) return "Mostly asana this week. Try a Breath and mind flow.";
  if (asana < 0.4) return "Mostly breath and meditation this week. Try an Asana focus flow.";
  return "A good balance of asana, pranayama and meditation this week.";
}

/* Session maths */

const SIDE_SWAP = { right: "left", left: "right", Right: "Left", Left: "Right" };
const swapSides = (text) => text.replace(/\b(right|left|Right|Left)\b/g, (m) => SIDE_SWAP[m]);

function poseSteps(phase, st, breathSecs) {
  const pose = POSE_BY_ID[st.p];
  const secs = st.b * breathSecs + SETUP_SECS;
  const base = { phase, title: pose.en, text: pose.steps.join(" "), secs, poseId: pose.id, art: pose.id, side: "" };
  if (!pose.sided) return [{ ...base, subtitle: `${pose.sk} · ${st.b} breaths` }];
  return [
    { ...base, side: "Right side", subtitle: `${pose.sk} · Right side · ${st.b} breaths` },
    { ...base, side: "Left side", subtitle: `${pose.sk} · Left side · ${st.b} breaths`, text: swapSides(base.text) },
  ];
}

function sunSteps(phase, rounds, breathSecs) {
  const guided = SURYA.map(([sk, en, cue], i) => ({
    phase, title: en, subtitle: `${sk} · Round 1 · ${i + 1} of ${SURYA.length}`, text: cue, secs: breathSecs, poseId: null, art: `surya-${i}`, side: "",
  }));
  if (rounds < 2) return guided;
  return [...guided, {
    phase,
    title: rounds === 2 ? "Round 2" : `Rounds 2 to ${rounds}`,
    subtitle: `About ${SUN_ROUND_SECS} seconds a round`,
    text: "Continue at your own breath pace. Lead with the left leg in round 2. Then alternate the leading leg each round.",
    secs: (rounds - 1) * SUN_ROUND_SECS,
    poseId: null,
    side: "",
  }];
}

function customStep(phase, st) {
  return { phase, title: st.t, subtitle: "", text: st.say, secs: st.s, poseId: null, side: "" };
}

/** True when a custom step names poses (step.uses) that the plan avoids. */
const usesAvoided = (st, ctx) => Array.isArray(st.uses) && st.uses.some((id) => ctx.avoid.has(id));

function isLeftOut(phase, st, ctx) {
  if (st.p) return !POSE_BY_ID[st.p] || ctx.avoid.has(st.p);
  if (st.sun) return ctx.restOnly || SUN_POSE_IDS.some((id) => ctx.avoid.has(id));
  return usesAvoided(st, ctx) || (ctx.restOnly && MOVE_PHASES.includes(phase));
}

/** Poses a session cannot run without (session.requires) that the plan avoids. */
function blockingPoses(session, ctx = NO_FILTER) {
  return Array.isArray(session.requires) ? session.requires.filter((id) => ctx.avoid.has(id)) : [];
}

const NO_FILTER = { avoid: new Set(), restOnly: false, breathSecs: BREATH_SECS };

/**
 * Flatten a session into timed steps.
 * Returns { steps, leftOut, secs, posesTotal, posesOut } where leftOut lists the skipped source steps.
 */
function flattenSession(session, ctx = NO_FILTER) {
  const steps = [];
  const leftOut = [];
  let phase = "";
  for (const st of session.steps) {
    if (typeof st === "string") {
      phase = st;
    } else if (isObj(st) && (st.p || st.sun || st.t)) {
      if (isLeftOut(phase, st, ctx)) leftOut.push(st);
      else if (st.p) steps.push(...poseSteps(phase, st, ctx.breathSecs));
      else if (st.sun) steps.push(...sunSteps(phase, st.sun, ctx.breathSecs));
      else steps.push(customStep(phase, st));
    }
  }
  const posesTotal = session.steps.filter((st) => isObj(st) && (st.p || st.sun || st.uses)).length;
  const posesOut = leftOut.filter((st) => st.p || st.sun || st.uses).length;
  return { steps, leftOut, secs: steps.reduce((a, s) => a + s.secs, 0), posesTotal, posesOut };
}

/** True when a session can still be offered after the health filter. plan.js decides the pose rule. */
function sessionOffered(session, ctx = NO_FILTER) {
  if (blockingPoses(session, ctx).length) return false;
  return sessionUsable(session, ctx.avoid) && flattenSession(session, ctx).steps.length > 0;
}

/** Breath pattern for the pacer. noHolds drops the hold phases. */
function breathPattern(breath, noHolds) {
  const pattern = breath.pattern.filter(([label]) => !(noHolds && /^hold/i.test(label)));
  return pattern.length ? pattern : breath.pattern;
}

function breathTotalSecs(breath, rounds, noHolds) {
  return breathPattern(breath, noHolds).reduce((a, [, s]) => a + s, 0) * rounds;
}

/* Saved flows ("Build your own") and generated flows */

let memFlows = null;
const generatedFlows = new Map();

function cleanFlowStep(st) {
  if (typeof st === "string") return st.slice(0, 60);
  if (!isObj(st)) return null;
  if (st.p) return POSE_BY_ID[st.p] ? { p: st.p, b: clamp(Math.round(Number(st.b)) || 5, 1, 60) } : null;
  if (st.sun) return { sun: clamp(Math.round(Number(st.sun)) || 2, 1, 12) };
  if (st.t) return { t: String(st.t).slice(0, 60), say: String(st.say || ""), s: clamp(Math.round(Number(st.s)) || 60, 10, 1800) };
  return null;
}

/** Accept a saved flow in any older shape. Unknown poses are dropped. */
function cleanFlow(raw) {
  if (!isObj(raw) || typeof raw.id !== "string" || !Array.isArray(raw.steps)) return null;
  const steps = raw.steps.map(cleanFlowStep).filter(Boolean);
  if (!steps.some((st) => typeof st !== "string")) return null;
  return {
    id: raw.id,
    name: String(raw.name || "My flow").slice(0, 60),
    lvl: clamp(Math.round(Number(raw.lvl)) || 1, 1, 3),
    focus: String(raw.focus || "My own sequence"),
    color: /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : "#E8743B",
    about: String(raw.about || "A sequence you built yourself."),
    custom: true,
    steps,
  };
}

function readFlows() {
  if (!memFlows) {
    const raw = safeGet(FLOWS_KEY);
    memFlows = Array.isArray(raw) ? raw.map(cleanFlow).filter(Boolean) : [];
  }
  return memFlows;
}

function writeFlows(list) {
  memFlows = list;
  safeSet(FLOWS_KEY, list);
  return list;
}

function newFlowId() {
  return `my-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

/** Insert or update a flow. Returns the cleaned flow, or null when it has no steps. */
function saveFlow(flow) {
  const clean = cleanFlow({ ...flow, id: flow.id && flow.id.startsWith("my-") ? flow.id : newFlowId() });
  if (!clean) return null;
  const list = readFlows();
  const exists = list.some((f) => f.id === clean.id);
  writeFlows(exists ? list.map((f) => (f.id === clean.id ? clean : f)) : [...list, clean]);
  return clean;
}

function deleteFlow(id) {
  writeFlows(readFlows().filter((f) => f.id !== id));
  const store = readStore();
  if (store.favSessions.includes(id)) writeStore({ favSessions: store.favSessions.filter((x) => x !== id) });
}

function duplicateFlow(id) {
  const flow = readFlows().find((f) => f.id === id);
  return flow ? saveFlow({ ...flow, id: "", name: `${flow.name} copy`.slice(0, 60) }) : null;
}

/** Today's flow from the plan. The seed is the local date so it holds all day. */
function todaysFlow(now = new Date()) {
  const plan = readPlan();
  const focus = plan && FOCUS[plan.answers.goal] ? plan.answers.goal : "balanced";
  const flow = generateFlow({
    minutes: (plan && Number(plan.answers.time)) || 20,
    level: plan ? plan.lvl : 1,
    focus,
    plan,
    seed: `${isoDate(now)}${focus}`,
    breathSecs: settings().breathSecs,
  });
  return { ...flow, id: TODAY_FLOW_ID, name: "Today's flow" };
}

function rememberFlow(flow) {
  generatedFlows.set(flow.id, flow);
  return flow;
}

/** Find any session by id: built in, saved, today's flow or a flow generated this visit. */
function findSession(id) {
  if (SESSION_BY_ID[id]) return SESSION_BY_ID[id];
  if (id === TODAY_FLOW_ID) return todaysFlow();
  return readFlows().find((f) => f.id === id) || generatedFlows.get(id) || null;
}

/* Routes. Pure so tests.js can check them. Pages: #/today, #/sessions/<id> and so on. */

const PAGE_IDS = ["today", "plan", "progress", "sessions", "create", "poses", "breathe", "learn", "about", "welcome", "credits"];
const hasKey = (map) => (id) => Object.prototype.hasOwnProperty.call(map, id);
const ROUTE_FINDERS = {
  sessions: (id) => Boolean(findSession(id)),
  poses: hasKey(POSE_BY_ID),
  breathe: hasKey(BREATH_BY_ID),
  learn: hasKey(ARTICLE_BY_ID),
};

function decodePart(part) {
  try {
    return decodeURIComponent(part);
  } catch (e) {
    return "";
  }
}

/**
 * Read a hash into { page, key, ok }. key names the dialog to show, such as "poses/tadasana" or "quiz".
 * ok is false when the hash should be rewritten, for example an unknown page or item.
 */
function parseRoute(hash, current = "today") {
  const parts = String(hash).replace(/^#\/?/, "").split("/").filter(Boolean).map(decodePart);
  if (parts[0] === "quiz") return { page: current || "today", key: "quiz", ok: true };
  if (!PAGE_IDS.includes(parts[0])) return { page: "today", key: null, ok: parts.length === 0 };
  const find = ROUTE_FINDERS[parts[0]];
  const item = parts[1] && find && find(parts[1]) ? parts[1] : null;
  return { page: parts[0], key: item ? `${parts[0]}/${item}` : null, ok: parts.length < 2 || Boolean(item) };
}
