// Sthira flow generator. Load after data.js and plan.js.
// generateFlow(options) returns a session object in the same shape as SESSIONS,
// so the session player can run it with no changes.

const FOCUS = {
  balanced: { name: "Balanced", cats: [] },
  flexibility: { name: "Flexibility", cats: ["forward", "seated", "twist"] },
  strength: { name: "Strength", cats: ["core", "standing", "balance"] },
  calm: { name: "Calm", cats: ["restore", "forward", "seated"] },
  back: { name: "Back care", cats: ["backbend", "twist", "restore"] },
  energy: { name: "Energy", cats: ["standing", "backbend", "core"] },
  balance: { name: "Balance", cats: ["balance", "standing"] },
};

// Share of the time budget for each part of the flow.
const SHAPE = [
  { phase: "Centring", share: 0.05 },
  { phase: "Warm-up", share: 0.12 },
  { phase: "Sun salutation", share: 0.15 },
  { phase: "Standing and balance", share: 0.28, cats: ["standing", "balance"] },
  { phase: "Floor", share: 0.22, cats: ["core", "backbend", "seated", "forward", "twist", "inversion"] },
  { phase: "Breathing", share: 0.06 },
  { phase: "Relaxation", share: 0.12 },
];

// Forward folds done on the feet belong with the standing work.
const STANDING_FOLDS = ["uttanasana", "prasarita"];
const WARMUPS = ["marjari", "vyaghrasana", "ardha-kati-chakrasana", "malasana", "shashankasana"];
const CENTRING = ["sukhasana", "vajrasana", "dandasana"];
const NEUTRAL_AFTER_BACKBEND = ["shashankasana", "jathara-parivartanasana", "pawanmuktasana"];
const FLOW_SUN_SECS = 30;
const MIN_RELAX_SECS = 180;
const DOSHA_BREATHS = { v: 7, p: 5, k: 4 };
const DOSHA_SUN = { v: 0.8, p: 1, k: 1.4 };

/** Small seeded random so a day's flow stays the same until the user shuffles. */
function seededRandom(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poseById(id) {
  return POSES.find((p) => p.id === id);
}

/** Seconds a pose step takes, matching the session player. */
function poseSecs(pose, breaths, breathSecs) {
  return (breaths * breathSecs + 5) * (pose.sided ? 2 : 1);
}

/** Order candidates: focus and dosha poses first, then the rest, shuffled within each group. */
function rankPoses(pool, focusCats, favourIds, rand) {
  const score = (p) => (focusCats.includes(p.cat) ? 2 : 0) + (favourIds.includes(p.id) ? 1 : 0) + rand();
  return pool.map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s).map((x) => x.p);
}

/** Fill a time budget from ranked poses. Every back bend is followed by a neutral pose. */
function fillBudget(ranked, budget, breaths, breathSecs, used, allowed) {
  const steps = [];
  let left = budget;
  for (const pose of ranked) {
    if (used.has(pose.id)) continue;
    const secs = poseSecs(pose, breaths, breathSecs);
    if (secs > left && steps.length > 0) continue;
    steps.push({ p: pose.id, b: breaths });
    used.add(pose.id);
    left -= secs;
    if (pose.cat === "backbend") {
      const n = NEUTRAL_AFTER_BACKBEND.find((id) => allowed(id) && !used.has(id));
      if (n) {
        steps.push({ p: n, b: 4 });
        used.add(n);
        left -= poseSecs(poseById(n), 4, breathSecs);
      }
    }
    if (left <= 0) break;
  }
  return steps;
}

/**
 * Build a flow.
 * options: { minutes, level 1 to 3, focus key of FOCUS, plan (optional, from buildPlan),
 *            seed (optional), breathSecs (optional) }
 */
function generateFlow(options) {
  const minutes = Math.max(5, Math.min(90, Number(options.minutes) || 20));
  const breathSecs = options.breathSecs || BREATH_SECS;
  const plan = options.plan || null;
  const level = Math.min(options.level || 1, plan ? plan.lvl : 3);
  const focusKey = FOCUS[options.focus] ? options.focus : "balanced";
  const rand = seededRandom(options.seed || new Date().toISOString().slice(0, 10) + focusKey + minutes);
  const avoid = new Set(plan ? plan.health.avoid : []);
  const allowed = (id) => {
    const p = poseById(id);
    return p && !avoid.has(id) && p.lvl <= level && (p.cat !== "inversion" || level >= 2 || id === "viparita-karani");
  };
  const dosha = plan ? plan.dosha.primary : "p";
  const breaths = DOSHA_BREATHS[dosha] || 5;
  const favour = plan ? plan.poses : [];
  const total = Math.max(240, minutes * 60 - OPEN_STEP.s - CLOSE_STEP.s); // the rituals come out of the budget
  const used = new Set(["savasana"]);
  const steps = [];

  if (plan && plan.health.restOnly) {
    return restFlow(minutes, breathSecs);
  }

  steps.push("Opening", OPEN_STEP);
  const centre = CENTRING.find(allowed) || "sukhasana";
  steps.push("Centring", { p: centre, b: Math.max(4, Math.round((total * SHAPE[0].share) / breathSecs)) });
  used.add(centre);

  steps.push("Warm-up", ...fillBudget(WARMUPS.filter(allowed).map(poseById), total * SHAPE[1].share, 5, breathSecs, used, allowed));

  const sunOk = SUN_STEP_POSES.every((id) => !avoid.has(id));
  if (sunOk && minutes > 10) {
    const rounds = Math.max(2, Math.round(((total * SHAPE[2].share) / FLOW_SUN_SECS) * (DOSHA_SUN[dosha] || 1)));
    steps.push("Sun salutation", { sun: rounds });
  }

  const focusCats = FOCUS[focusKey].cats;
  [SHAPE[3], SHAPE[4]].forEach((part) => {
    const standing = part === SHAPE[3];
    const fits = (p) => (standing ? part.cats.includes(p.cat) || STANDING_FOLDS.includes(p.id) : part.cats.includes(p.cat) && !STANDING_FOLDS.includes(p.id));
    const pool = POSES.filter((p) => fits(p) && allowed(p.id));
    const ranked = rankPoses(pool, focusCats, favour, rand);
    const share = sunOk && minutes > 10 ? part.share : part.share + SHAPE[2].share / 2;
    const picked = fillBudget(ranked, total * share, breaths, breathSecs, used, allowed);
    if (picked.length) steps.push(part.phase, ...picked);
  });

  const breathId = pickBreath(plan, rand);
  const breath = BREATHS.find((b) => b.id === breathId);
  steps.push("Breathing", { t: breath.name, say: breath.how.join(" "), s: Math.max(minutes > 10 ? 60 : 45, Math.round(total * SHAPE[5].share)) });

  const relax = Math.max(minutes > 10 ? MIN_RELAX_SECS : 120, total * SHAPE[6].share);
  steps.push("Relaxation", { p: "savasana", b: Math.round(relax / breathSecs) });
  steps.push("Closing", CLOSE_STEP);

  return {
    id: "flow-" + Math.floor(rand() * 1e9).toString(36),
    name: FOCUS[focusKey].name + " flow",
    lvl: level, focus: minutes + " minutes", color: plan ? DOSHAS[dosha].color : "#E8743B",
    about: plan ? "Built for your " + DOSHAS[dosha].name + " profile with your health answers in mind." : "A balanced flow built for you just now.",
    generated: true, steps,
  };
}

function pickBreath(plan, rand) {
  const pool = plan && plan.breaths.length ? plan.breaths : ["abdominal", "yogic", "nadi", "bhramari"];
  const safe = pool.filter((id) => id !== "kapalabhati");
  const list = safe.length ? safe : ["abdominal"];
  return list[Math.floor(rand() * list.length)];
}

function restFlow(minutes, breathSecs) {
  const total = minutes * 60;
  return {
    id: "flow-rest", name: "Gentle rest", lvl: 1, focus: minutes + " minutes", color: "#64D2FF",
    about: "Breathing and relaxation only, until your doctor clears you for poses.", generated: true,
    steps: [
      "Centring", { p: "sukhasana", b: 8 },
      "Breathing", { t: "Belly Breathing", say: BREATHS[0].how.join(" "), s: Math.round(total * 0.4) },
      "Relaxation", { p: "savasana", b: Math.round((total * 0.5) / breathSecs) },
    ],
  };
}

/** Total seconds of a session, matching the player's rules. */
function sessionSecs(session, breathSecs) {
  const bs = breathSecs || BREATH_SECS;
  return session.steps.reduce((sum, s) => {
    if (typeof s === "string") return sum;
    if (s.sun) return sum + SURYA.length * bs + (s.sun - 1) * FLOW_SUN_SECS;
    if (s.p) return sum + poseSecs(poseById(s.p), s.b, bs);
    return sum + (s.s || 0);
  }, 0);
}

// Self check: cat data.js plan.js generator.js > x.js then STHIRA_CHECK=1 node x.js
if (typeof process !== "undefined" && process.env && process.env.STHIRA_CHECK) {
  const assert = require("assert");
  const base = { frame: "k", skin: "k", energy: "k", sleep: "k", stress: "k", weather: "k", experience: "some", goal: "strength", time: "20" };
  [10, 20, 30, 45, 60].forEach((m) => {
    Object.keys(FOCUS).forEach((f) => {
      [1, 2, 3].forEach((lvl) => {
        const flow = generateFlow({ minutes: m, level: lvl, focus: f, seed: "t" + m + f + lvl });
        const secs = sessionSecs(flow);
        assert.ok(secs > m * 60 * 0.75 && secs < m * 60 * 1.3, `${m} ${f} ${lvl} gave ${Math.round(secs / 60)} min`);
        const poseSteps = flow.steps.filter((s) => s.p);
        assert.strictEqual(poseSteps[poseSteps.length - 1].p, "savasana", "the last pose is always relaxation");
        assert.strictEqual(flow.steps[flow.steps.length - 1], CLOSE_STEP, "ends with the closing ritual");
        flow.steps.filter((s) => s.p).forEach((s) => assert.ok(poseById(s.p).lvl <= lvl, `level ${lvl} got ${s.p}`));
      });
    });
  });
  ["wrist", "lowback", "pregnancy", "highbp", "knee"].forEach((c) => {
    const plan = buildPlan({ ...base, conditions: [c] });
    const flow = generateFlow({ minutes: 30, level: 2, focus: "strength", plan, seed: c });
    flow.steps.filter((s) => s.p).forEach((s) => assert.ok(!plan.health.avoid.includes(s.p), `${c} flow has ${s.p}`));
  });
  const rest = generateFlow({ minutes: 20, plan: buildPlan({ ...base, conditions: ["surgery"] }) });
  assert.strictEqual(rest.id, "flow-rest");
  const a = generateFlow({ minutes: 20, focus: "calm", seed: "same" });
  const b = generateFlow({ minutes: 20, focus: "calm", seed: "same" });
  assert.deepStrictEqual(a.steps, b.steps, "same seed gives the same flow");
  process.stdout.write("generator.js self check passed\n");
}
