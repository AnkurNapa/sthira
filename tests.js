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
  ["data.js", "plan.js", "generator.js", "core.js"].forEach((f) => {
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
  assert.deepStrictEqual(flat.steps.map((s) => s.phase), ["Breathing"]);
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
  const log = `{ "2026-11-07": { s: 10, b: 0 }, "2026-11-06": { s: 0, b: 2 }, "2026-11-05": { s: 5, b: 0 }, "2026-11-03": { s: 5, b: 0 } }`;
  assert.strictEqual(run(`streakDays(${log}, ${today})`), 3);
  const noToday = `{ "2026-11-06": { s: 4, b: 0 }, "2026-11-05": { s: 5, b: 0 } }`;
  assert.strictEqual(run(`streakDays(${noToday}, ${today})`), 2);
  const stale = `{ "2026-11-05": { s: 5, b: 0 } }`;
  assert.strictEqual(run(`streakDays(${stale}, ${today})`), 0);
});

test("dates use local calendar days around midnight", () => {
  const run = sandbox(memoryStorage());
  assert.strictEqual(run("isoDate(new Date(2026, 10, 7, 23, 59))"), "2026-11-07");
  assert.strictEqual(run("isoDate(new Date(2026, 10, 8, 0, 1))"), "2026-11-08");
  assert.strictEqual(run("dayNumber(new Date(2026, 10, 8, 0, 1)) - dayNumber(new Date(2026, 10, 7, 23, 59))"), 1);
  run(`recordSession({ session: SESSION_BY_ID.morning, minutes: 20, completed: true, dateKey: "2026-11-07" })`);
  assert.strictEqual(run(`readStore().log["2026-11-07"].s`), 20);
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
  assert.strictEqual(run("readStore().schema"), 2);
});

test("corrupt or old saved data migrates safely", () => {
  const store = memoryStorage();
  store.data["sthira.v1"] = "{not json";
  assert.strictEqual(sandbox(store)("readStore().sessions"), 0);
  const old = memoryStorage();
  old.data["sthira.v1"] = JSON.stringify({ days: { "2026-11-06": 14, bad: 3 }, sessions: 4, welcomed: true });
  const run = sandbox(old);
  assert.deepStrictEqual(run(`readStore().log`), { "2026-11-06": { s: 14, b: 0 } });
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
  const missing = run("POSES.map((p) => p.id)").filter((id) => !listed.includes(id));
  assert.ok(missing.length < 20, `poses without a figure use the tile: ${missing.join(" ")}`);
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
