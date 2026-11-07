// Sthira logic checks. Run with: node tests.js
// Loads data.js, plan.js, generator.js and core.js into one sandbox the same way the browser does.
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function sandbox(storage) {
  const ctx = vm.createContext({ console, Date, Math, JSON, Set, Map, Object, Array, Number, String, Boolean, RegExp });
  if (storage) ctx.localStorage = storage;
  ["data.js", "plan.js", "generator.js", "core.js", "stats.js"].forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
  });
  // Clone results out of the sandbox so deep equality does not trip on realm differences.
  return (code) => {
    const value = vm.runInContext(code, ctx);
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
  };
}

function memoryStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    data,
  };
}

const throwing = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("full"); },
  removeItem() { throw new Error("blocked"); },
};

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("session minutes follow the brief's formula", () => {
  const run = sandbox(memoryStorage());
  const sessions = run("SESSIONS");
  const poses = Object.fromEntries(run("POSES").map((p) => [p.id, p]));
  for (const s of sessions) {
    let expected = 0;
    for (const st of s.steps) {
      if (st.p) expected += (st.b * 6 + 5) * (poses[st.p].sided ? 2 : 1);
      else if (st.t) expected += st.s;
      else if (st.sun) expected += 12 * 6 + (st.sun - 1) * 30;
    }
    const flat = run(`flattenSession(SESSION_BY_ID["${s.id}"])`);
    assert.strictEqual(flat.secs, expected, s.id);
  }
});

test("sided poses become right then left with sides swapped", () => {
  const run = sandbox(memoryStorage());
  const flat = run("flattenSession(SESSION_BY_ID.morning)");
  const tree = flat.steps.filter((st) => st.poseId === "vrikshasana");
  assert.strictEqual(tree.length, 2);
  assert.strictEqual(tree[0].side, "Right side");
  assert.strictEqual(tree[1].side, "Left side");
  assert.ok(tree[0].text.includes("right sole"));
  assert.ok(tree[1].text.includes("left sole"));
});

test("sun rounds become 12 guided steps plus one block", () => {
  const run = sandbox(memoryStorage());
  const flat = run("flattenSession(SESSION_BY_ID.stamina)");
  const sun = flat.steps.filter((st) => st.phase === "Sun salutation");
  assert.strictEqual(sun.length, 13);
  assert.strictEqual(sun[12].title, "Rounds 2 to 8");
  assert.strictEqual(sun[12].secs, 7 * 30);
});

test("health filter removes avoided poses and the sun salutation", () => {
  const run = sandbox(memoryStorage());
  const flat = run(`flattenSession(SESSION_BY_ID.strength, { avoid: new Set(healthFilter(["wrist"]).avoid), restOnly: false, breathSecs: 6 })`);
  assert.ok(!flat.steps.some((st) => ["phalakasana", "vasisthasana"].includes(st.poseId)));
  assert.ok(!flat.steps.some((st) => st.phase === "Sun salutation"));
  const expected = run(`SESSION_BY_ID.strength.steps.filter((st) => (st.p && healthFilter(["wrist"]).avoid.has(st.p)) || st.sun).length`);
  assert.strictEqual(flat.posesOut, expected);
});

test("rest only plans keep breathing and relaxation only", () => {
  const run = sandbox(memoryStorage());
  const flat = run(`flattenSession(SESSION_BY_ID.desk, { avoid: new Set(healthFilter(["surgery"]).avoid), restOnly: true, breathSecs: 6 })`);
  assert.deepStrictEqual(flat.steps.map((s) => s.phase), ["Breathing", "Meditation"]);
  const rest = "{ avoid: new Set(healthFilter(['surgery']).avoid), restOnly: true, breathSecs: 6 }";
  assert.ok(!run(`sessionOffered(SESSION_BY_ID.desk, ${rest})`));
  assert.ok(!run(`sessionOffered(SESSION_BY_ID.morning, ${rest})`));
  assert.ok(run(`sessionOffered(SESSION_BY_ID.nidra, ${rest})`));
});

test("no holds drops hold phases from the pacer", () => {
  const run = sandbox(memoryStorage());
  assert.deepStrictEqual(run("breathPattern(BREATH_BY_ID.sama, true).map((p) => p[0])"), ["Breathe in", "Breathe out"]);
  assert.strictEqual(run("breathTotalSecs(BREATH_BY_ID.sama, 8, false)"), 128);
});

test("streak counts back from today or yesterday and stops at a gap", () => {
  const run = sandbox(memoryStorage());
  const today = "new Date(2026, 10, 7, 9)";
  const log = `{ "2026-11-07": { a: 10, p: 0, m: 0, r: 0 }, "2026-11-06": { a: 0, p: 2, m: 0, r: 0 }, "2026-11-05": { a: 5, p: 0, m: 0, r: 0 }, "2026-11-03": { a: 5, p: 0, m: 0, r: 0 } }`;
  assert.strictEqual(run(`streakDays(${log}, ${today})`), 3);
  const noToday = `{ "2026-11-06": { a: 4, p: 0, m: 0, r: 0 }, "2026-11-05": { a: 5, p: 0, m: 0, r: 0 } }`;
  assert.strictEqual(run(`streakDays(${noToday}, ${today})`), 2);
  const stale = `{ "2026-11-05": { a: 5, p: 0, m: 0, r: 0 } }`;
  assert.strictEqual(run(`streakDays(${stale}, ${today})`), 0);
});

test("dates use local calendar days around midnight", () => {
  const run = sandbox(memoryStorage());
  assert.strictEqual(run("isoDate(new Date(2026, 10, 7, 23, 59))"), "2026-11-07");
  assert.strictEqual(run("isoDate(new Date(2026, 10, 8, 0, 1))"), "2026-11-08");
  assert.strictEqual(run("dayNumber(new Date(2026, 10, 8, 0, 1)) - dayNumber(new Date(2026, 10, 7, 23, 59))"), 1);
  run(`recordSession({ session: SESSION_BY_ID.morning, minutes: 20, completed: true, dateKey: "2026-11-07" })`);
  assert.strictEqual(run(`readStore().log["2026-11-07"].a`), 20);
  assert.strictEqual(run(`readStore().log["2026-11-08"]`), undefined);
});

test("storage that throws still works in memory", () => {
  const run = sandbox(throwing);
  run(`recordSession({ session: SESSION_BY_ID.morning, minutes: 12, completed: true })`);
  assert.strictEqual(run("readStore().sessions"), 1);
  assert.strictEqual(run("savePlan(buildPlan({ frame: 'v', conditions: ['none'] })).dosha.primary"), "v");
  run("resetAll()");
  assert.strictEqual(run("readStore().sessions"), 0);
});

test("missing localStorage still works", () => {
  const run = sandbox(null);
  assert.strictEqual(run("readStore().schema"), 3);
});

test("corrupt or old saved data migrates safely", () => {
  const store = memoryStorage();
  store.data["sthira.v1"] = "{not json";
  assert.strictEqual(sandbox(store)("readStore().sessions"), 0);
  const old = memoryStorage();
  old.data["sthira.v1"] = JSON.stringify({ days: { "2026-11-06": 14, bad: 3 }, sessions: 4, welcomed: true });
  const run = sandbox(old);
  assert.deepStrictEqual(run(`readStore().log`), { "2026-11-06": { a: 14, p: 0, m: 0, r: 0 } });
  assert.strictEqual(run("readStore().sessions"), 4);
  assert.strictEqual(run("readStore().welcomed"), true);
});

test("plans with unknown ids are cleaned, broken plans are ignored", () => {
  const store = memoryStorage();
  store.data["sthira.plan"] = JSON.stringify({
    created: "2026-11-01", dosha: { primary: "p", secondary: "zz" }, answers: {}, poses: ["tadasana", "gone"], breaths: ["nadi", "gone"],
    health: { ids: ["knee", "gone"], avoid: ["malasana"], avoidBreaths: [], restOnly: false, noHolds: false, tips: [] },
    journey: [{ title: "A", when: "Weeks 1 to 2", days: 3, sessions: ["morning", "gone"], poses: ["gone"], breaths: [], articles: ["gone"] }],
  });
  const run = sandbox(store);
  assert.deepStrictEqual(run("readPlan().poses"), ["tadasana"]);
  assert.deepStrictEqual(run("readPlan().journey[0].sessions"), ["morning"]);
  assert.deepStrictEqual(run("readPlan().health.ids"), ["knee"]);
  assert.strictEqual(run("readPlan().dosha.secondary"), null);
  const broken = memoryStorage();
  broken.data["sthira.plan"] = JSON.stringify({ dosha: { primary: "x" } });
  assert.strictEqual(sandbox(broken)("readPlan()"), null);
});

test("journey stage and progress follow the weeks since the plan began", () => {
  const run = sandbox(memoryStorage());
  run(`savePlan({ ...buildPlan({ experience: "new", goal: "calm", time: "20", conditions: ["none"] }), created: "2026-11-01" })`);
  assert.strictEqual(run("currentStageIndex(readPlan(), new Date(2026, 10, 7))"), 0);
  assert.strictEqual(run("currentStageIndex(readPlan(), new Date(2026, 10, 16))"), 1);
  assert.strictEqual(run("currentStageIndex(readPlan(), new Date(2027, 1, 20))"), 3);
  run(`recordSession({ session: SESSION_BY_ID.morning, minutes: 20, completed: true, dateKey: "2026-11-02" })`);
  assert.deepStrictEqual(run("stageProgress(readPlan(), 0)"), { done: 1, target: 6, pct: 1 / 6 });
});

test("badges unlock once", () => {
  const run = sandbox(memoryStorage());
  run(`recordSession({ session: SESSION_BY_ID.nidra, minutes: 12, completed: true })`);
  const first = run("checkBadges().map((b) => b.id)");
  assert.ok(first.includes("first") && first.includes("nidra"));
  assert.deepStrictEqual(run("checkBadges()"), []);
});

test("resume is offered within 12 hours only", () => {
  const run = sandbox(memoryStorage());
  run("saveResume('morning', 4)");
  assert.strictEqual(run("getResume().idx"), 4);
  assert.strictEqual(run("getResume(Date.now() + 13 * 3600 * 1000)"), null);
});

test("player totals agree with generator sessionSecs", () => {
  const run = sandbox(memoryStorage());
  assert.ok(run("SESSIONS.every((s) => flattenSession(s).secs === sessionSecs(s, 6))"));
  assert.ok(run("[10, 30, 60].every((m) => { const f = generateFlow({ minutes: m, focus: 'calm', seed: 'x' + m }); return flattenSession(f).secs === sessionSecs(f, 6); })"));
});

test("saved flows are cleaned, found and deleted", () => {
  const store = memoryStorage();
  store.data["sthira.flows"] = JSON.stringify([{ id: "my-a", name: "A", steps: ["Seq", { p: "tadasana", b: 99 }, { p: "gone", b: 3 }] }, { id: "my-b", steps: [] }, "junk"]);
  const run = sandbox(store);
  assert.strictEqual(run("readFlows().length"), 1);
  assert.deepStrictEqual(run("findSession('my-a').steps"), ["Seq", { p: "tadasana", b: 60 }]);
  const saved = run("saveFlow({ name: 'B', steps: ['Seq', { p: 'savasana', b: 30 }] })");
  assert.ok(saved.id.startsWith("my-"));
  run(`deleteFlow("${saved.id}")`);
  assert.strictEqual(run("readFlows().length"), 1);
  assert.strictEqual(run("findSession('today-flow').id"), "today-flow");
});

test("three dosha names survive a saved plan", () => {
  const run = sandbox(memoryStorage());
  run("savePlan(buildPlan({ frame: 'v', skin: 'p', energy: 'k', sleep: 'v', stress: 'p', weather: 'k', conditions: ['none'] }))");
  assert.deepStrictEqual(run("[readPlan().dosha.primary, readPlan().dosha.secondary, readPlan().dosha.tertiary].filter(Boolean).length"), 3);
});

test("routes parse pages, items, the quiz and unknown hashes", () => {
  const run = sandbox(memoryStorage());
  assert.deepStrictEqual(run("parseRoute('#/poses/tadasana')"), { page: "poses", key: "poses/tadasana", ok: true });
  assert.deepStrictEqual(run("parseRoute('#/sessions/today-flow')"), { page: "sessions", key: "sessions/today-flow", ok: true });
  assert.deepStrictEqual(run("parseRoute('#/quiz', 'breathe')"), { page: "breathe", key: "quiz", ok: true });
  assert.deepStrictEqual(run("parseRoute('#/poses/nope')"), { page: "poses", key: null, ok: false });
  assert.deepStrictEqual(run("parseRoute('#/nowhere')"), { page: "today", key: null, ok: false });
  assert.deepStrictEqual(run("parseRoute('')"), { page: "today", key: null, ok: true });
  assert.deepStrictEqual(run("parseRoute('#/learn/%E0%A4')"), { page: "learn", key: null, ok: false });
});

test("figure list in ui.js matches the files in figures/", () => {
  const src = fs.readFileSync(path.join(__dirname, "ui.js"), "utf8");
  const listed = JSON.parse(`[${src.match(/FIGURE_IDS = new Set\(\[([\s\S]*?)\]\)/)[1].trim().replace(/,$/, "")}]`);
  const files = fs.readdirSync(path.join(__dirname, "figures")).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4));
  assert.deepStrictEqual([...listed].sort(), files.sort());
  const run = sandbox(memoryStorage());
  const sun = run("SURYA.map((_, i) => 'surya-' + i)");
  sun.forEach((id) => assert.ok(listed.includes(id), id));
});

test("media.js agrees with media/manifest.json and every name used exists", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "media", "manifest.json"), "utf8"));
  const src = fs.readFileSync(path.join(__dirname, "media.js"), "utf8");
  const ctx = vm.createContext({});
  vm.runInContext(src.split("// Save-Data")[0] + "; this.P = PHOTOS; this.V = VIDEOS;", ctx);
  const files = new Set(manifest.map((m) => m.file));
  Object.values(ctx.P).forEach((p) => {
    assert.ok(files.has(p.jpg), p.jpg);
    p.webp.forEach(([f]) => assert.ok(files.has(f), f));
    assert.ok(p.alt.length > 10 && p.w > 0 && p.h > 0);
  });
  Object.keys(ctx.V).forEach((v) => ["mp4", "webm"].forEach((ext) => assert.ok(files.has(`${v}.${ext}`), v)));
  const code = ["today.js", "views.js", "welcome.js"].map((f) => fs.readFileSync(path.join(__dirname, f), "utf8")).join("\n");
  const used = [...code.matchAll(/photo\("(photo-[a-z-]+)"|^\s+\w+: "(photo-[a-z-]+)",$/gm)].map((m) => m[1] || m[2]);
  assert.ok(used.length >= 10, `found ${used.length} photo uses`);
  used.forEach((name) => assert.ok(ctx.P[name], `missing photo ${name}`));
  assert.ok(!code.includes("breathing-closeup"), "breathing-closeup must not be used");
});

function seeded(storage) {
  const run = sandbox(storage || memoryStorage());
  run(`writeStore({ log: {
    "2026-10-27": { a: 20, p: 0, m: 0, r: 0 }, "2026-10-31": { a: 0, p: 5, m: 0, r: 0 },
    "2026-11-02": { a: 10, p: 2, m: 0, r: 0 }, "2026-11-03": { a: 30, p: 0, m: 0, r: 0 }, "2026-11-07": { a: 15, p: 3, m: 0, r: 0 },
    "2025-12-31": { a: 9, p: 0, m: 0, r: 0 } },
    history: [
      { ts: 1, date: "2026-10-27", kind: "session", id: "morning", title: "Morning Wake-Up", min: 20, done: true },
      { ts: 2, date: "2026-11-03", kind: "session", id: "morning", title: "Morning Wake-Up", min: 30, done: true },
      { ts: 3, date: "2026-11-07", kind: "session", id: "my-abc", title: "My flow", min: 15, done: false },
      { ts: 4, date: "2026-11-07", kind: "breath", id: "nadi", title: "Alternate Nostril", min: 3, done: true } ] })`);
  return run;
}

test("period totals and the change against the previous period", () => {
  const run = seeded();
  const today = "new Date(2026, 10, 7, 21)";
  assert.deepStrictEqual(run(`periodRange("week", ${today})`), { from: "2026-11-02", to: "2026-11-08" });
  assert.deepStrictEqual(run(`periodRange("month", ${today}, -1)`), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepStrictEqual(run(`periodTotals(readStore(), "week", ${today})`), { minutes: 60, a: 55, p: 5, m: 0, sessions: 1, days: 3 });
  assert.deepStrictEqual(run(`periodTotals(readStore(), "week", ${today}, -1)`), { minutes: 25, a: 20, p: 5, m: 0, sessions: 1, days: 2 });
  assert.strictEqual(run(`changeText(60, 25, "week", "minutes")`), "35 minutes more than this time last week");
  assert.strictEqual(run(`changeText(1, 3, "month", "sessions")`), "2 sessions fewer than this time last month");
  assert.strictEqual(run(`periodTotals(readStore(), "month", new Date(2026, 10, 2), -1, true).minutes`), 0);
  assert.strictEqual(run(`periodTotals(readStore(), "month", new Date(2026, 10, 30), -1, true).minutes`), 20);
  assert.strictEqual(run(`changeText(4, 4, "year", "days")`), "Same as this time last year");
  assert.strictEqual(run(`periodTotals(readStore(), "year", ${today}, -1).minutes`), 9);
  assert.strictEqual(run(`periodBars(readStore(), "month", ${today}).length`), 30);
  assert.strictEqual(run(`periodBars(readStore(), "year", ${today})[10].a`), 55);
});

test("heatmap buckets local dates across midnight and month ends", () => {
  const run = seeded();
  const weeks = run("heatmapWeeks(readStore(), new Date(2026, 10, 7, 23, 59))");
  assert.strictEqual(weeks.length, 12);
  const cells = weeks.flat();
  assert.strictEqual(cells[cells.length - 1].key, "2026-11-08");
  assert.ok(cells[cells.length - 1].future);
  assert.strictEqual(cells.find((c) => c.key === "2026-10-31").minutes, 5);
  assert.strictEqual(cells.find((c) => c.key === "2026-11-07").minutes, 18);
  assert.ok(!cells.find((c) => c.key === "2026-11-07").future);
  const keys = cells.map((c) => c.key);
  assert.strictEqual(new Set(keys).size, 84);
  assert.ok(keys.includes("2026-10-31") && keys.includes("2026-11-01"));
  const jan = run("heatmapWeeks(readStore(), new Date(2026, 0, 1, 0, 5)).flat().map((c) => c.key)");
  assert.ok(jan.includes("2025-12-31") && jan.includes("2026-01-01"));
});

test("best streak, most practised and history kinds", () => {
  const run = seeded();
  assert.strictEqual(run("bestStreak(readStore().log)"), 2);
  const most = run("practiceMost(readStore())");
  assert.strictEqual(most.sessions[0].id, "morning");
  assert.strictEqual(most.sessions[0].count, 2);
  assert.strictEqual(most.breaths[0].id, "nadi");
  assert.deepStrictEqual(run("readStore().history.map(historyKind)"), ["sessions", "sessions", "flows", "breathing"]);
});

test("import validates the file and merges without double counting", () => {
  const run = seeded();
  assert.strictEqual(run(`importData("{nope").ok`), false);
  assert.strictEqual(run(`importData({ app: "other", store: {} }).ok`), false);
  assert.strictEqual(run(`importData({ app: "sthira", version: 99, store: {} }).ok`), false);
  const exported = run("exportData()");
  const res = run(`importData(${JSON.stringify(JSON.stringify(exported))})`);
  assert.ok(res.ok, res.message);
  assert.strictEqual(run(`readStore().log["2026-11-03"].a`), 30);
  assert.strictEqual(run("readStore().history.length"), 4);
  const other = { app: "sthira", version: 1, store: { log: { "2026-11-05": { s: 12, b: 0 } }, history: [{ ts: 9, date: "2026-11-05", kind: "session", id: "desk", title: "Desk Relief", min: 12, done: true }], poseSecs: { tadasana: 40 } }, flows: [{ id: "my-x", name: "X", steps: ["S", { p: "tadasana", b: 5 }] }] };
  assert.ok(run(`importData(${JSON.stringify(other)})`).ok);
  assert.strictEqual(run(`readStore().log["2026-11-05"].a`), 12);
  assert.strictEqual(run("readStore().history.length"), 5);
  assert.strictEqual(run("readFlows().length"), 1);
  assert.strictEqual(run("readStore().poseSecs.tadasana"), 40);
});

test("pose seconds add up across sessions", () => {
  const run = sandbox(memoryStorage());
  run(`recordSession({ session: SESSION_BY_ID.desk, minutes: 5, completed: true, poses: { tadasana: 35.4 } })`);
  run(`recordSession({ session: SESSION_BY_ID.desk, minutes: 5, completed: true, poses: { tadasana: 20 } })`);
  assert.strictEqual(run("readStore().poseSecs.tadasana"), 55);
});

test("pose photos agree with photos/poses/manifest.json and every file exists", () => {
  const dir = path.join(__dirname, "photos", "poses");
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const ctx = vm.createContext({});
  vm.runInContext(`${fs.readFileSync(path.join(__dirname, "pose-photos.js"), "utf8")}; this.P = POSE_PHOTOS;`, ctx);
  const run = sandbox(memoryStorage());
  const poseIds = new Set(run("POSES.map((p) => p.id)"));
  const surya = run("SURYA.length");
  manifest.forEach((m) => {
    const sun = /^surya-(\d+)$/.exec(m.id);
    if (sun) assert.ok(Number(sun[1]) >= 1 && Number(sun[1]) <= surya, `${m.id} maps to a SURYA index`);
    else assert.ok(poseIds.has(m.id), `${m.id} is a pose`);
    const artId = sun ? `surya-${Number(sun[1]) - 1}` : m.id;
    assert.ok(ctx.P[artId], `${m.id} is in pose-photos.js as ${artId}`);
    assert.strictEqual(ctx.P[artId].alt, m.alt);
    ["-400.webp", "-800.webp", "-800.jpg"].forEach((suffix) => assert.ok(fs.existsSync(path.join(dir, m.file_base + suffix)), m.file_base + suffix));
  });
  assert.strictEqual(Object.keys(ctx.P).length, manifest.length);
  ["surya-0", "surya-5", "surya-11"].forEach((id) => assert.ok(!ctx.P[id], `${id} has no photo`));
});

function planCtx(run, conditions) {
  return `{ avoid: new Set(buildPlan({ experience: "regular", conditions: ${JSON.stringify(conditions)} }).health.avoid), restOnly: false, breathSecs: 6 }`;
}

test("a high blood pressure plan cannot start moon or salutations-ab", () => {
  const run = sandbox(memoryStorage());
  const ctx = planCtx(run, ["highbp"]);
  ["moon", "salutations-ab"].forEach((id) => {
    assert.ok(run(`blockingPoses(SESSION_BY_ID["${id}"], ${ctx}).length > 0`), `${id} is blocked`);
    assert.strictEqual(run(`sessionOffered(SESSION_BY_ID["${id}"], ${ctx})`), false, `${id} not offered`);
  });
});

test("a knee plan gets spine without the Child's Pose to Cobra step", () => {
  const run = sandbox(memoryStorage());
  const ctx = planCtx(run, ["knee"]);
  const flat = run(`flattenSession(SESSION_BY_ID.spine, ${ctx})`);
  assert.ok(!flat.steps.some((st) => st.title === "Child's Pose to Cobra"));
  assert.ok(flat.leftOut.some((st) => st.t === "Child's Pose to Cobra"));
  assert.ok(flat.posesOut >= 1);
  assert.ok(run(`sessionOffered(SESSION_BY_ID.spine, ${ctx})`));
});

test("a plan with no conditions gets all four new sessions in full", () => {
  const run = sandbox(memoryStorage());
  const ctx = planCtx(run, ["none"]);
  ["moon", "spine", "meditate", "salutations-ab"].forEach((id) => {
    assert.ok(run(`sessionOffered(SESSION_BY_ID["${id}"], ${ctx})`), id);
    assert.strictEqual(run(`flattenSession(SESSION_BY_ID["${id}"], ${ctx}).leftOut.length`), 0, id);
  });
});

test("every breath pattern moves the pacer in, out or holds", () => {
  const run = sandbox(memoryStorage());
  const labels = run("BREATHS.flatMap((b) => b.pattern.map((p) => p[0]))");
  assert.ok(labels.length > 30);
  assert.ok(run("BREATHS.every((b) => b.pattern.every(([l, s]) => typeof l === 'string' && s > 0))"));
  assert.ok(run("BREATHS.every((b) => breathPattern(b, true).length > 0)"));
});

test("APM minutes per session follow the phases", () => {
  const run = sandbox(memoryStorage());
  const split = (id) => run(`apmSplit(flattenSession(SESSION_BY_ID["${id}"]).steps, "${id}")`);
  const morning = split("morning");
  assert.ok(morning.a > morning.p && morning.p > 0 && morning.m > 0 && morning.r > 0, JSON.stringify(morning));
  const nidra = split("nidra");
  assert.strictEqual(nidra.a + nidra.p, 0);
  assert.ok(nidra.m > 0);
  const meditate = split("meditate");
  assert.strictEqual(meditate.a, 0);
  run("SESSIONS").forEach((sess) => {
    const sp = split(sess.id);
    assert.strictEqual(sp.a + sp.p + sp.m + sp.r, run(`flattenSession(SESSION_BY_ID["${sess.id}"]).secs`), sess.id);
  });
  assert.strictEqual(run(`phaseCategory("Breathing", "morning")`), "p");
  assert.strictEqual(run(`phaseCategory("Relaxation", "nidra")`), "r");
});

test("old history migrates: session minutes to asana, pacer minutes to pranayama", () => {
  const old = memoryStorage();
  old.data["sthira.v1"] = JSON.stringify({ schema: 2, log: { "2026-11-01": { s: 30, b: 6 } }, history: [{ ts: 1, date: "2026-11-01", kind: "session", id: "morning", title: "Morning Wake-Up", min: 30, done: true }], sessions: 1 });
  const run = sandbox(old);
  assert.deepStrictEqual(run(`readStore().log["2026-11-01"]`), { a: 30, p: 6, m: 0, r: 0 });
  assert.deepStrictEqual(run(`weekStats(readStore().log, new Date(2026, 10, 1))`), { a: 30, p: 6, m: 0, r: 0, days: 1 });
  run(`recordSession({ session: SESSION_BY_ID.morning, minutes: 10, completed: true, dateKey: "2026-11-01", cats: { a: 6, p: 2, m: 1, r: 1 } })`);
  assert.deepStrictEqual(run(`readStore().log["2026-11-01"]`), { a: 36, p: 8, m: 1, r: 1 });
  run(`recordSession({ session: SESSION_BY_ID.morning, minutes: 5, completed: true, dateKey: "2026-11-01" })`);
  assert.strictEqual(run(`readStore().log["2026-11-01"].a`), 41);
});

test("rings split the weekly goal 70 15 15 and Settings can change it", () => {
  const run = sandbox(memoryStorage());
  run("updateSettings({ weeklyGoal: 100 })");
  assert.deepStrictEqual(run("weeklyRings().map((r) => r.goal)"), [70, 15, 15]);
  run("updateSettings({ apmSplit: [50, 25, 25] })");
  assert.deepStrictEqual(run("weeklyRings().map((r) => r.goal)"), [50, 25, 25]);
  run("updateSettings({ apmSplit: [90, 90, 90] })");
  assert.deepStrictEqual(run("settings().apmSplit"), [70, 15, 15]);
  assert.strictEqual(run("balanceLine({ a: 90, p: 5, m: 5 })"), "Mostly asana this week. Try a Breath and mind flow.");
});

test("generator APM presets move time from asana to breath and mind", () => {
  const run = sandbox(memoryStorage());
  const share = (apm) => run(`(() => { const f = generateFlow({ minutes: 30, focus: "balanced", apm: "${apm}", seed: "apm" }); const s = apmSplit(flattenSession(f).steps, f.id); const core = s.a + s.p + s.m; return { a: s.a / core, pm: (s.p + s.m) / core }; })()`);
  const asana = share("asana");
  const balanced = share("balanced");
  const mind = share("mind");
  assert.ok(asana.a > balanced.a && balanced.a > mind.a, JSON.stringify({ asana, balanced, mind }));
  assert.ok(mind.pm > balanced.pm && balanced.pm > asana.pm);
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    process.stdout.write(`ok   ${name}\n`);
  } catch (e) {
    failed += 1;
    process.stdout.write(`FAIL ${name}\n     ${e.message}\n`);
  }
}
process.stdout.write(`${tests.length - failed} of ${tests.length} passed\n`);
process.exitCode = failed ? 1 : 0;
