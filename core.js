// Sthira logic with no DOM: storage, progress, plan helpers and session maths.
// tests.js loads this file in Node, so nothing here may touch the page at load time.
"use strict";

const STORE_KEY = "sthira.v1";
const PLAN_KEY = "sthira.plan";
const FLOWS_KEY = "sthira.flows";
const TODAY_FLOW_ID = "today-flow";
const SCHEMA = 3;
const LEVELS = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };
/** True only for a key the object holds itself, so "constructor" or "__proto__" never match. */
const own = (obj, key) => obj != null && typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key);
/** An id map with no prototype, so lookups like map["toString"] are undefined. */
const byId = (list) => Object.assign(Object.create(null), Object.fromEntries(list.map((x) => [x.id, x])));
const POSE_BY_ID = byId(POSES);
const BREATH_BY_ID = byId(BREATHS);
const SESSION_BY_ID = byId(SESSIONS);
const ARTICLE_BY_ID = byId(ARTICLES);
// Practice shorter than this leaves no history row and no minutes.
const MIN_RECORD_SECS = 30;
// A session counts as finished only when this share of its planned time was played.
const COMPLETE_SHARE = 0.5;
const SETUP_SECS = 5;
const SUN_ROUND_SECS = 30;
// Phases where a timed step means moving the body. Rest only plans leave these out.
const MOVE_PHASES = ["Warm-up", "Sun salutation", "Poses", "Seated", "Standing"];
// Rest only plans keep only these gentle breathing practices.
const REST_BREATHS = ["abdominal", "yogic"];
const RESUME_MS = 12 * 60 * 60 * 1000;
const HISTORY_MAX = 200;
const DEFAULT_SETTINGS = { voice: true, rate: 0.9, chime: true, breathSecs: BREATH_SECS, weeklyGoal: 0, apmSplit: [70, 15, 15], music: "calm", musicTrack: "", musicVolume: 0.4 };
// Music modes: off, calm (meditation and relaxation only) or all (the whole session).
const MUSIC_MODES = ["off", "calm", "all"];

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
    music: MUSIC_MODES.includes(s.music) ? s.music : DEFAULT_SETTINGS.music,
    musicTrack: typeof s.musicTrack === "string" ? s.musicTrack.slice(0, 40) : "",
    musicVolume: clamp(Number(s.musicVolume), 0, 1) || (Number(s.musicVolume) === 0 ? 0 : DEFAULT_SETTINGS.musicVolume),
  };
}

/* Alignment cues (align.js). Spoken through each hold after the entry instructions. */

const CUE_START_SHARE = 0.4;
const WORDS_PER_SEC = 2.5;
const CUE_GAP_SECS = 1;
const CUE_END_MARGIN = 0.5;

/** Seconds a line takes to say at the chosen voice speed, a little on the long side. */
function speechSecs(text, rate = DEFAULT_SETTINGS.rate) {
  const words = String(text).split(/\s+/).filter(Boolean).length;
  return words / (WORDS_PER_SEC * (rate / DEFAULT_SETTINGS.rate)) + 0.4;
}

/** The cues for a player step. Left side cues swap right and left like the step text. */
function alignCues(step) {
  if (typeof ALIGN === "undefined") return { cues: [], speak: false };
  if (step.poseId && own(ALIGN, step.poseId)) {
    const cues = ALIGN[step.poseId].map((c) => (step.side === "Left side" ? swapSides(c) : c));
    return { cues, speak: true };
  }
  if (Number.isInteger(step.suryaIndex) && typeof SURYA_ALIGN !== "undefined" && Array.isArray(SURYA_ALIGN[step.suryaIndex])) {
    // One breath is too short to speak these, so they are shown only.
    return { cues: SURYA_ALIGN[step.suryaIndex], speak: false };
  }
  return { cues: [], speak: false };
}

/**
 * When to say each cue: from 40 per cent into the hold (and after the entry instructions),
 * spaced through the rest. A cue that would not finish before the step ends is left out.
 */
function cueSchedule(stepSecs, entryText, cues, rate) {
  if (!cues.length) return [];
  const start = Math.max(stepSecs * CUE_START_SHARE, speechSecs(entryText, rate) + CUE_GAP_SECS);
  const gap = (stepSecs - start) / cues.length;
  return cues.map((text, i) => ({ i, text, at: start + i * gap }))
    .filter((c) => c.at + speechSecs(c.text, rate) <= stepSecs - CUE_END_MARGIN);
}

/** True when background music should play for this step. */
function musicShouldPlay(mode, phase, cat) {
  if (mode === "all") return true;
  if (mode === "calm") return cat === "m" || phase === "Relaxation";
  return false;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** One history row in a safe shape, or null when it cannot be shown. */
function cleanHistoryItem(h) {
  if (!isObj(h) || typeof h.date !== "string" || !ISO_DATE.test(h.date) || isNaN(parseIso(h.date).getTime())) return null;
  if (h.kind !== "session" && h.kind !== "breath") return null;
  const title = typeof h.title === "string" && h.title.trim() ? h.title.trim().slice(0, 80) : null;
  if (!title || typeof h.id !== "string") return null;
  const cats = isObj(h.cats) ? Object.fromEntries(APM_KEYS.map((k) => [k, positive(h.cats[k])])) : undefined;
  return { ts: positive(h.ts), date: h.date, kind: h.kind, id: h.id.slice(0, 80), title, min: positive(h.min), done: h.done === true, ...(cats ? { cats } : {}) };
}

/** Badge dates keyed by known badge ids only. */
function cleanBadges(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  Object.entries(raw).forEach(([id, date]) => {
    if (typeof date === "string" && ISO_DATE.test(date) && !isNaN(parseIso(date).getTime()) && /^[a-z0-9-]{1,40}$/.test(id)) out[id] = date;
  });
  return out;
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
    history: Array.isArray(raw.history) ? raw.history.map(cleanHistoryItem).filter(Boolean).slice(-HISTORY_MAX) : [],
    badges: cleanBadges(raw.badges),
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
/** True when enough of a session was played for it to count as finished. */
function countsAsComplete(playedSecs, plannedSecs) {
  return plannedSecs > 0 && playedSecs >= plannedSecs * COMPLETE_SHARE;
}

/** Add minutes to the day log only. Used to save progress when the page is hidden mid practice. */
function addMinutes(dateKey, cats) {
  const store = readStore();
  return writeStore({ log: addToLog(store, dateKey, cats) });
}

function subtractCats(cats, logged) {
  return Object.fromEntries(APM_KEYS.map((k) => [k, Math.max(0, (cats[k] || 0) - ((logged && logged[k]) || 0))]));
}

function recordSession({ session, minutes, completed, dateKey, poses, cats, logged }) {
  const store = readStore();
  if (!(minutes * 60 >= MIN_RECORD_SECS)) return store;
  const date = dateKey || isoDate(new Date());
  const split = catsOrAsana(cats, minutes);
  const rounded = Object.fromEntries(APM_KEYS.map((k) => [k, round1(split[k])]));
  return writeStore({
    poseSecs: addPoseSecs(store.poseSecs, poses),
    log: addToLog(store, date, subtractCats(split, logged)),
    sessions: store.sessions + (completed ? 1 : 0),
    history: pushHistory(store, { date, kind: "session", id: session.id, title: session.name, min: round1(minutes), done: Boolean(completed), cats: rounded }),
    resume: completed ? null : store.resume,
  });
}

/**
 * Save a breathing practice. done means at least one full round was breathed.
 * Under 30 seconds nothing is saved. Only a done practice counts towards Every breath.
 */
function recordBreath({ breath, minutes, dateKey, done, logged }) {
  const store = readStore();
  if (!(minutes * 60 >= MIN_RECORD_SECS)) return store;
  const date = dateKey || isoDate(new Date());
  const tried = done && !store.breathsTried.includes(breath.id) ? [...store.breathsTried, breath.id] : store.breathsTried;
  return writeStore({
    log: addToLog(store, date, { p: Math.max(0, minutes - (logged || 0)) }),
    breathsTried: tried,
    history: pushHistory(store, { date, kind: "breath", id: breath.id, title: breath.name, min: round1(minutes), done: Boolean(done) }),
  });
}

/** True when the plan allows this breathing practice. The pacer and every Start button check it. */
function breathAllowed(breathId, ctx = planContext()) {
  return own(BREATH_BY_ID, breathId) && !ctx.avoidBreaths.has(breathId);
}

/** A safe breathing practice to offer instead: the first plan breath that is allowed, else Belly Breathing. */
function safeBreathFor(ctx = planContext()) {
  const plan = readPlan();
  const pool = [...(plan ? plan.breaths : []), "abdominal", "yogic"];
  return BREATH_BY_ID[pool.find((id) => breathAllowed(id, ctx))] || BREATH_BY_ID.abdominal;
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
  return strings(list).filter((id) => own(map, id));
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

/** Quiz answers in a safe shape: strings for single answers, a list of known ids for conditions. */
function cleanAnswers(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  QUIZ.forEach((q) => {
    if (!own(raw, q.id)) return;
    if (q.multi) out[q.id] = strings(raw[q.id]).filter((v) => q.options.some((o) => o.v === v));
    else if (typeof raw[q.id] === "string" && q.options.some((o) => o.v === raw[q.id])) out[q.id] = raw[q.id];
  });
  return out;
}

function healthBlock(conditions) {
  const h = healthFilter(conditions);
  return { ids: h.ids, restOnly: h.restOnly, avoid: [...h.avoid], avoidBreaths: [...h.avoidBreaths], noHolds: h.noHolds, tips: h.tips };
}

function shapePlan(raw, health, answers, created) {
  const journey = raw.journey.filter(isObj).map(cleanStage);
  if (!journey.length) return null;
  const avoid = new Set(health.avoid);
  const avoidBreaths = new Set(health.avoidBreaths);
  return {
    ...raw,
    created,
    answers,
    dosha: {
      ...raw.dosha,
      secondary: own(DOSHAS, raw.dosha.secondary) ? raw.dosha.secondary : null,
      tertiary: own(DOSHAS, raw.dosha.secondary) && own(DOSHAS, raw.dosha.tertiary) ? raw.dosha.tertiary : null,
    },
    lvl: clamp(Math.round(Number(raw.lvl)) || 1, 1, 3),
    poses: knownIds(raw.poses, POSE_BY_ID).filter((id) => !avoid.has(id)),
    breaths: knownIds(raw.breaths, BREATH_BY_ID).filter((id) => !avoidBreaths.has(id)),
    health,
    journey,
  };
}

/**
 * Accept a plan from any version. The health block is never trusted: it is rebuilt from the
 * conditions with today's safety rules, so an old plan cannot keep an older, shorter avoid list.
 * When the quiz answers are complete the whole plan is rebuilt. Unknown ids are dropped.
 */
function cleanPlan(raw) {
  if (!isObj(raw) || !isObj(raw.dosha) || !own(DOSHAS, raw.dosha.primary) || !isObj(raw.health) || !Array.isArray(raw.journey)) return null;
  const created = ISO_DATE.test(raw.created) ? raw.created : isoDate(new Date());
  const answers = cleanAnswers(raw.answers);
  const storedIds = strings(raw.health.ids).filter((c) => own(CONDITIONS, c));
  const conditions = answers.conditions && answers.conditions.length ? answers.conditions : storedIds;
  if (scoreDosha(answers).answered) {
    const rebuilt = buildPlan({ ...answers, conditions });
    return shapePlan(rebuilt, healthBlock(conditions), { ...answers, conditions }, created);
  }
  return shapePlan(raw, healthBlock(conditions), answers, created);
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
    phase, title: en, subtitle: `${sk} · Round 1 · ${i + 1} of ${SURYA.length}`, text: cue, secs: breathSecs, poseId: null, art: `surya-${i}`, suryaIndex: i, side: "",
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
  // The sun salutation list lives in plan.js (SUN_STEP_POSES) so both files agree.
  if (st.p) return !own(POSE_BY_ID, st.p) || ctx.avoid.has(st.p) || (ctx.restOnly && !SAFE_IN_REST.includes(st.p));
  if (st.sun) return ctx.restOnly || SUN_STEP_POSES.some((id) => ctx.avoid.has(id));
  if (st.breath && (ctx.restOnly ? !REST_BREATHS.includes(st.breath) : false)) return true;
  if (st.breath && ctx.avoidBreaths && ctx.avoidBreaths.has(st.breath)) return true;
  return usesAvoided(st, ctx) || (ctx.restOnly && MOVE_PHASES.includes(phase));
}

/** Poses a session cannot run without (session.requires) that the plan avoids. */
function blockingPoses(session, ctx = NO_FILTER) {
  return Array.isArray(session.requires) ? session.requires.filter((id) => ctx.avoid.has(id)) : [];
}

const NO_FILTER = { avoid: new Set(), avoidBreaths: new Set(), restOnly: false, breathSecs: BREATH_SECS };

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

/** Spoken texts a saved flow may keep without a uses tag: the rituals and the meditations. */
function trustedSay(say) {
  const rituals = [OPEN_STEP, CLOSE_STEP, typeof SEATED_CLOSE_STEP === "undefined" ? null : SEATED_CLOSE_STEP].filter(Boolean);
  return rituals.some((r) => r.say === say) || MEDITATIONS.some((m) => m.say === say);
}

/** The breathing practice a step's spoken text comes from, as written by the generator. */
function breathForSay(say) {
  return BREATHS.find((b) => b.how.join(" ") === say) || null;
}

function cleanCustomStep(st) {
  const say = String(st.say || "");
  const step = { t: String(st.t).slice(0, 60), say, s: clamp(Math.round(Number(st.s)) || 60, 10, 1800) };
  const uses = strings(st.uses).filter((id) => own(POSE_BY_ID, id));
  const fromSay = breathForSay(say);
  const breath = own(BREATH_BY_ID, st.breath) ? st.breath : fromSay ? fromSay.id : null;
  if (uses.length) step.uses = uses;
  if (breath) step.breath = breath;
  // A custom step must say what it is. Untagged movement text could be anything, so it is dropped.
  return uses.length || breath || trustedSay(say) ? step : null;
}

function cleanFlowStep(st) {
  if (typeof st === "string") return st.slice(0, 60);
  if (!isObj(st)) return null;
  if (st.p) return own(POSE_BY_ID, st.p) ? { p: st.p, b: clamp(Math.round(Number(st.b)) || 5, 1, 60) } : null;
  if (st.sun) return { sun: clamp(Math.round(Number(st.sun)) || 2, 1, 12) };
  if (st.t) return cleanCustomStep(st);
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
    ...(strings(raw.requires).filter((id) => own(POSE_BY_ID, id)).length ? { requires: strings(raw.requires).filter((id) => own(POSE_BY_ID, id)) } : {}),
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
  const focus = plan && own(FOCUS, plan.answers.goal) ? plan.answers.goal : "balanced";
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
  if (typeof id !== "string") return null;
  if (own(SESSION_BY_ID, id)) return SESSION_BY_ID[id];
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
  const path = String(hash).split("?")[0];
  const parts = path.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodePart);
  if (parts[0] === "quiz") return { page: current || "today", key: "quiz", ok: true };
  if (!PAGE_IDS.includes(parts[0])) return { page: "today", key: null, ok: parts.length === 0 };
  const find = ROUTE_FINDERS[parts[0]];
  const item = parts[1] && find && find(parts[1]) ? parts[1] : null;
  return { page: parts[0], key: item ? `${parts[0]}/${item}` : null, ok: parts.length < 2 || Boolean(item) };
}
