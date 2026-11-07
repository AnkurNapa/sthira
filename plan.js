// Sthira personal plan: the quiz, dosha profiles, health filters and the journey.
// Load after data.js. buildPlan(answers) turns quiz answers into a plan object.

// Ten questions. Dosha questions score v, p or k. The rest set the profile.
const QUIZ = [
  {
    id: "frame", kind: "dosha", q: "Which best describes your body frame?",
    options: [
      { v: "v", label: "Slim and light", hint: "I find it hard to gain weight" },
      { v: "p", label: "Medium and muscular", hint: "My weight stays fairly stable" },
      { v: "k", label: "Broad and solid", hint: "I gain weight easily" },
    ],
  },
  {
    id: "skin", kind: "dosha", q: "How is your skin most of the time?",
    options: [
      { v: "v", label: "Dry or rough", hint: "Often cool to the touch" },
      { v: "p", label: "Warm or sensitive", hint: "Flushes or gets rashes easily" },
      { v: "k", label: "Soft or oily", hint: "Smooth and cool" },
    ],
  },
  {
    id: "energy", kind: "dosha", q: "How does your energy run through the day?",
    options: [
      { v: "v", label: "In bursts", hint: "I start fast then tire quickly" },
      { v: "p", label: "Strong and driven", hint: "I push hard until the job is done" },
      { v: "k", label: "Steady but slow to start", hint: "Once going I can keep going" },
    ],
  },
  {
    id: "sleep", kind: "dosha", q: "How do you sleep?",
    options: [
      { v: "v", label: "Lightly", hint: "I wake easily or struggle to fall asleep" },
      { v: "p", label: "Fairly well", hint: "Sometimes I wake up feeling hot" },
      { v: "k", label: "Deeply and long", hint: "Mornings are hard for me" },
    ],
  },
  {
    id: "stress", kind: "dosha", q: "Under stress you tend to feel",
    options: [
      { v: "v", label: "Anxious or worried", hint: "My mind races" },
      { v: "p", label: "Irritable or impatient", hint: "I get frustrated quickly" },
      { v: "k", label: "Withdrawn or heavy", hint: "I shut down or avoid things" },
    ],
  },
  {
    id: "weather", kind: "dosha", q: "Which weather do you like least?",
    options: [
      { v: "v", label: "Cold and windy", hint: "I am always reaching for a jumper" },
      { v: "p", label: "Hot and sunny", hint: "Heat makes me cranky" },
      { v: "k", label: "Cold and damp", hint: "Grey wet days drag me down" },
    ],
  },
  {
    id: "experience", kind: "profile", q: "How much yoga have you done?",
    options: [
      { v: "new", label: "None yet", hint: "I am a complete beginner" },
      { v: "some", label: "A little", hint: "A few classes or videos" },
      { v: "regular", label: "I practise regularly", hint: "At least once a week for months" },
    ],
  },
  {
    id: "goal", kind: "profile", q: "What do you most want from yoga?",
    options: [
      { v: "flexibility", label: "Flexibility", hint: "Looser hips, hamstrings and back" },
      { v: "strength", label: "Strength", hint: "A stronger core and legs" },
      { v: "calm", label: "Calm and sleep", hint: "Less stress, better rest" },
      { v: "back", label: "A healthier back", hint: "Better posture, less stiffness" },
      { v: "energy", label: "Energy and stamina", hint: "Feel more awake and fit" },
    ],
  },
  {
    id: "time", kind: "profile", q: "How much time can you give most days?",
    options: [
      { v: "10", label: "About 10 minutes", hint: "Short and regular" },
      { v: "20", label: "About 20 minutes", hint: "A proper session" },
      { v: "30", label: "30 minutes or more", hint: "I have time to go deeper" },
    ],
  },
  {
    id: "conditions", kind: "health", multi: true,
    q: "Do any of these apply to you right now?",
    note: "Pick all that apply. This keeps unsafe poses out of your plan.",
    options: [
      { v: "none", label: "None of these" },
      { v: "lowback", label: "Lower back pain or a disc problem" },
      { v: "neck", label: "Neck pain or injury" },
      { v: "knee", label: "Knee pain or injury" },
      { v: "wrist", label: "Wrist pain or injury" },
      { v: "shoulder", label: "Shoulder pain or injury" },
      { v: "highbp", label: "High blood pressure or a heart condition" },
      { v: "lowbp", label: "Low blood pressure or dizziness" },
      { v: "eyes", label: "Glaucoma or high eye pressure" },
      { v: "pregnancy", label: "Pregnant or recently given birth" },
      { v: "surgery", label: "Surgery or a serious injury in the last 3 months" },
    ],
  },
];

const DOSHAS = {
  v: {
    name: "Vata", elements: "Air and space", color: "#5E5CE6",
    traits: "Quick, creative and light on your feet. When out of balance you may feel scattered, anxious, cold or tired.",
    practice: "Slow, steady and grounding. Hold poses a little longer. Keep warm. Keep the same time each day.",
    avoidStyle: "Very fast flows. Long sessions of rapid breathing.",
    bestTime: "Early morning or early evening, at the same time every day.",
    poses: ["tadasana", "vrikshasana", "virabhadrasana2", "malasana", "shashankasana", "paschimottanasana", "baddha-konasana", "supta-padangusthasana", "jathara-parivartanasana", "viparita-karani", "savasana"],
    breaths: ["abdominal", "nadi", "bhramari"],
    session: "evening",
  },
  p: {
    name: "Pitta", elements: "Fire and water", color: "#FF375F",
    traits: "Focused, sharp and driven. When out of balance you may feel irritable, overheated or competitive.",
    practice: "Cool, calm and non competitive. Work at about 70 per cent effort. Enjoy the pose rather than chase it.",
    avoidStyle: "Practising in the midday heat. Pushing to your limit.",
    bestTime: "Early morning or evening when it is cooler.",
    poses: ["trikonasana", "ardha-chandrasana", "janu-sirsasana", "upavistha-konasana", "ardha-matsyendrasana", "bhujangasana", "setu-bandha", "jathara-parivartanasana", "ananda-balasana", "savasana"],
    breaths: ["sheetali", "nadi", "bhramari"],
    session: "flexibility",
  },
  k: {
    name: "Kapha", elements: "Earth and water", color: "#34C759",
    traits: "Calm, steady and strong. When out of balance you may feel sluggish, heavy or unmotivated.",
    practice: "Warming and energising. Keep moving. Do more sun salutations. Shorten the rests.",
    avoidStyle: "Long passive holds as your whole practice. Practising straight after a meal.",
    bestTime: "Morning, ideally before 10.",
    poses: ["utkatasana", "virabhadrasana1", "virabhadrasana3", "phalakasana", "navasana", "shalabhasana", "dhanurasana", "ushtrasana", "garudasana", "vasisthasana"],
    breaths: ["kapalabhati", "yogic"],
    session: "stamina",
  },
};

// Health conditions. avoid lists pose ids, avoidBreaths lists breath ids.
const CONDITIONS = {
  lowback: {
    avoid: ["uttanasana", "paschimottanasana", "upavistha-konasana", "ardha-matsyendrasana", "janu-sirsasana", "navasana", "dhanurasana", "ushtrasana", "urdhva-mukha", "halasana", "sarvangasana", "prasarita", "parsvottanasana", "parivrtta-trikonasana", "tada-kapotasana", "tiryak-bhujangasana", "chakrasana", "bharadvajasana"],
    avoidBreaths: [],
    tip: "Bend your knees in every forward fold. Choose Reclined Hamstring Stretch over seated folds.",
  },
  neck: {
    avoid: ["halasana", "sarvangasana", "setu-bandha", "ushtrasana", "dhanurasana", "ardha-pincha-mayurasana", "purvottanasana", "tiryak-bhujangasana", "matsyasana", "chakrasana"],
    avoidBreaths: [],
    tip: "Keep the neck in line with the spine. Look down rather than up in standing poses.",
  },
  knee: {
    avoid: ["malasana", "vajrasana", "garudasana", "gomukhasana", "janu-sirsasana", "ushtrasana", "ananda-balasana", "dhanurasana", "baddha-konasana", "shashankasana", "kaliasana", "anjaneyasana", "ardha-hanumanasana", "skandasana", "tada-kapotasana", "eka-pada-rajakapotasana", "parighasana"],
    avoidBreaths: [],
    tip: "Pad the knees with a folded blanket. Keep the bend in Chair and Warrior poses small.",
  },
  wrist: {
    avoid: ["adho-mukha", "urdhva-mukha", "phalakasana", "vasisthasana", "vyaghrasana", "eka-pada-adho-mukha", "chaturanga", "purvottanasana", "bakasana", "chakrasana"],
    avoidBreaths: [],
    tip: "Do Cat-Cow on fists or forearms. In sun salutations, use a wall instead of the floor.",
  },
  shoulder: {
    avoid: ["vasisthasana", "phalakasana", "gomukhasana", "urdhva-mukha", "halasana", "sarvangasana", "garudasana", "eka-pada-adho-mukha", "ardha-pincha-mayurasana", "chaturanga", "purvottanasana", "bakasana", "sarpasana", "chakrasana"],
    avoidBreaths: [],
    tip: "Keep the arms below shoulder height when it hurts. Hands on hips is fine.",
  },
  highbp: {
    avoid: ["prasarita", "uttanasana", "adho-mukha", "dhanurasana", "ushtrasana", "viparita-karani", "halasana", "sarvangasana", "parsvottanasana", "eka-pada-adho-mukha", "ardha-pincha-mayurasana", "bakasana", "matsyasana", "chakrasana"],
    avoidBreaths: ["kapalabhati"],
    tip: "Keep the head above the heart. Never hold the breath. Skip every hold in breathing practices.",
  },
  lowbp: {
    avoid: ["ushtrasana", "ardha-chandrasana", "parivrtta-trikonasana", "matsyasana", "chakrasana"],
    avoidBreaths: ["sheetali"],
    tip: "Come up slowly from forward folds and from lying down. In sun salutations, pause in each forward fold and rise on a slow breath.",
  },
  eyes: {
    avoid: ["prasarita", "uttanasana", "adho-mukha", "viparita-karani", "halasana", "sarvangasana", "parsvottanasana", "eka-pada-adho-mukha", "ardha-pincha-mayurasana", "bakasana", "chakrasana"],
    avoidBreaths: ["kapalabhati"],
    tip: "Avoid poses where the head hangs below the heart. In Child's Pose rest the forehead on stacked fists. Never hold the breath.",
  },
  pregnancy: {
    avoid: ["navasana", "bhujangasana", "shalabhasana", "dhanurasana", "urdhva-mukha", "ardha-matsyendrasana", "jathara-parivartanasana", "pawanmuktasana", "ananda-balasana", "halasana", "sarvangasana", "viparita-karani", "adho-mukha", "phalakasana", "vasisthasana", "ushtrasana", "kati-chakrasana", "parivrtta-trikonasana", "eka-pada-adho-mukha", "ardha-pincha-mayurasana", "chaturanga", "bakasana", "sarpasana", "tiryak-bhujangasana", "chakrasana", "bharadvajasana", "sucirandhrasana", "makarasana"],
    avoidBreaths: ["kapalabhati"],
    tip: "Please check with your doctor first. A prenatal teacher is the best guide. Skip every breath hold. Lie on your left side to relax.",
  },
  surgery: {
    restOnly: true, avoid: [], avoidBreaths: ["kapalabhati"],
    tip: "Get your doctor's clearance before doing poses. Until then your plan is gentle breathing and relaxation only.",
  },
};

const GOAL_SESSION = { flexibility: "flexibility", strength: "strength", calm: "evening", back: "desk", energy: "stamina" };
const SAFE_IN_REST = ["sukhasana", "savasana"];

/** Score the six dosha answers. Returns { scores, primary, secondary }. */
function scoreDosha(answers = {}) {
  const scores = { v: 0, p: 0, k: 0 };
  QUIZ.filter((q) => q.kind === "dosha").forEach((q) => {
    const a = answers[q.id];
    if (Object.prototype.hasOwnProperty.call(scores, a)) scores[a] += 1;
  });
  const order = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  const answered = scores.v + scores.p + scores.k > 0;
  const close = answered && scores[order[0]] - scores[order[1]] <= 1;
  const tri = answered && scores[order[0]] - scores[order[2]] <= 1;
  return { scores, primary: order[0], secondary: close ? order[1] : null, tertiary: tri ? order[2] : null, answered };
}

/** Collect the poses and breaths to avoid for the chosen conditions. */
function healthFilter(conditionIds) {
  const list = Array.isArray(conditionIds) ? conditionIds : conditionIds ? [conditionIds] : [];
  const ids = list.filter((c) => CONDITIONS[c]);
  const restOnly = ids.some((c) => CONDITIONS[c].restOnly);
  const avoid = new Set(ids.flatMap((c) => CONDITIONS[c].avoid));
  if (restOnly) POSES.forEach((p) => { if (!SAFE_IN_REST.includes(p.id)) avoid.add(p.id); });
  const avoidBreaths = new Set(ids.flatMap((c) => CONDITIONS[c].avoidBreaths));
  const noHolds = restOnly || ids.some((c) => ["highbp", "pregnancy", "eyes"].includes(c));
  return { ids, restOnly, avoid, avoidBreaths, noHolds, tips: ids.map((c) => CONDITIONS[c].tip) };
}

/** True when every pose in a session is allowed. */
function sessionIsSafe(session, avoid) {
  return session.steps.every((s) => !s.p || !avoid.has(s.p));
}

// The player drops the whole sun salutation when any of these is avoided.
const SUN_STEP_POSES = ["uttanasana", "phalakasana", "bhujangasana", "adho-mukha"];

/** True when a session still works after the player leaves out unsafe poses:
 *  at least half its poses remain. */
function sessionUsable(session, avoid) {
  const poses = session.steps.filter((s) => s.p);
  const out = poses.filter((s) => avoid.has(s.p)).length;
  if (poses.length === 0) return true; // breathing or relaxation only
  return out < poses.length && out <= poses.length / 2;
}

function maxLevel(experience) {
  return experience === "regular" ? 3 : experience === "some" ? 2 : 1;
}

/** Pick a session id that exists, fits the level and stays usable, else fall back. */
function pickSession(preferred, avoid, maxLvl = 3, exclude = []) {
  const order = [preferred, "morning", "evening", "desk", "nidra"];
  const ok = (sid) => {
    const s = SESSIONS.find((x) => x.id === sid);
    return s && s.lvl <= maxLvl && !exclude.includes(sid) && sessionUsable(s, avoid);
  };
  return order.find(ok) || "nidra";
}

/** Pick several sessions with no repeats. */
function pickMany(prefs, avoid, maxLvl) {
  return prefs.reduce((out, p) => {
    const sid = pickSession(p, avoid, maxLvl, out);
    return out.includes(sid) ? out : [...out, sid];
  }, []);
}

/** Build the 6 month journey in four stages. */
function buildJourney(ctx) {
  const { lvl, goalSession, doshaSession, health, poses, minutes } = ctx;
  const start = String(minutes) === "10" ? "desk" : "morning";
  const next = Math.min(lvl + 1, 3);
  const upTo = (n) => (id) => POSES.find((p) => p.id === id).lvl <= n;
  const easy = (ids) => ids.filter((id) => POSES.find((p) => p.id === id).lvl === 1);
  if (health.restOnly) {
    return [{
      title: "Until your doctor clears you", when: "Now", days: 5,
      sessions: ["nidra"], breaths: ["abdominal", "yogic"], poses: ["sukhasana", "savasana"],
      focus: "Rest and gentle breathing only. Come back and retake the quiz once you have the all clear.",
      milestone: "Ten minutes of calm breathing without strain.",
    }];
  }
  return [
    {
      title: "Foundations", when: "Weeks 1 to 2", days: 3,
      sessions: [pickSession(start, health.avoid, lvl)],
      breaths: ["abdominal"], poses: easy(poses).slice(0, 5), articles: ["start", "safety", "setup"],
      focus: "Learn the basic shapes slowly. Read the injury notes for every pose before you try it.",
      milestone: "You can hold your first five poses with easy breathing.",
    },
    {
      title: "Build the habit", when: "Weeks 3 to 6", days: 4,
      sessions: pickMany([start, lvl > 1 ? goalSession : "evening"], health.avoid, lvl),
      breaths: ["yogic", "bhramari"], poses: easy(poses).slice(0, 8), articles: ["breath", "class"],
      focus: "Practise at the same time each day. Add one breathing practice after each session.",
      milestone: "Four sessions a week for four weeks in a row.",
    },
    {
      title: "Go deeper", when: "Weeks 7 to 12", days: 5,
      sessions: pickMany([goalSession, doshaSession], health.avoid, next),
      breaths: ["nadi"], poses: poses.filter(upTo(next)).slice(0, 10), articles: ["habit"],
      focus: "Hold poses a few breaths longer. Try the level 2 version of poses that now feel easy.",
      milestone: "You can follow your goal session without stopping.",
    },
    {
      title: "Your own practice", when: "Months 4 to 6", days: 6,
      sessions: pickMany([goalSession, doshaSession, "nidra"], health.avoid, next),
      breaths: ctx.breaths, poses: poses.filter(upTo(next)), articles: ["limbs"],
      focus: "Build your own sequence in the shape of a practice. Keep one Yoga Nidra a week.",
      milestone: "A daily practice that you look forward to.",
    },
  ];
}

/** Turn quiz answers into a full plan. */
function buildPlan(answers = {}) {
  const dosha = scoreDosha(answers);
  const health = healthFilter(answers.conditions);
  const lvl = maxLevel(answers.experience);
  const keys = [dosha.primary, dosha.secondary, dosha.tertiary].filter(Boolean);
  const allowed = (id) => !health.avoid.has(id) && POSES.find((p) => p.id === id).lvl <= lvl;
  const poses = [...new Set(keys.flatMap((k) => DOSHAS[k].poses))].filter(allowed);
  if (!poses.includes("savasana") && allowed("savasana")) poses.push("savasana");
  const breaths = [...new Set(keys.flatMap((k) => DOSHAS[k].breaths))]
    .filter((id) => !health.avoidBreaths.has(id))
    .filter((id) => BREATHS.find((b) => b.id === id).lvl <= lvl);
  const planBreaths = health.restOnly ? ["abdominal", "yogic"] : breaths;
  const goalSession = GOAL_SESSION[answers.goal] || "morning";
  const doshaSession = DOSHAS[dosha.primary].session;
  const ctx = { lvl, goalSession, doshaSession, health, poses, breaths: planBreaths, minutes: answers.time };
  return {
    created: new Date().toISOString().slice(0, 10),
    answers, dosha, lvl, poses, breaths: planBreaths,
    health: { ids: health.ids, restOnly: health.restOnly, avoid: [...health.avoid], avoidBreaths: [...health.avoidBreaths], noHolds: health.noHolds, tips: health.tips },
    journey: buildJourney(ctx),
  };
}

// Self check: cat data.js plan.js > /tmp/sthira.js then STHIRA_CHECK=1 node /tmp/sthira.js
if (typeof process !== "undefined" && process.env && process.env.STHIRA_CHECK) {
  const assert = require("assert");
  const kapha = buildPlan({ frame: "k", skin: "k", energy: "k", sleep: "k", stress: "p", weather: "k", experience: "new", goal: "strength", time: "20", conditions: ["wrist"] });
  assert.strictEqual(kapha.dosha.primary, "k");
  assert.ok(!kapha.poses.includes("phalakasana"), "wrist plan must drop plank");
  assert.ok(kapha.poses.every((id) => POSES.find((p) => p.id === id).lvl === 1), "beginner gets level 1 only");
  const rest = buildPlan({ frame: "v", skin: "v", energy: "v", sleep: "v", stress: "v", weather: "v", experience: "regular", goal: "calm", time: "30", conditions: ["surgery"] });
  assert.strictEqual(rest.journey.length, 1);
  assert.ok(rest.poses.every((id) => SAFE_IN_REST.includes(id)));
  const preg = buildPlan({ frame: "p", skin: "p", energy: "p", sleep: "v", stress: "p", weather: "p", experience: "some", goal: "energy", time: "20", conditions: ["pregnancy"] });
  preg.journey.forEach((st) => st.sessions.forEach((sid) => assert.ok(sessionUsable(SESSIONS.find((s) => s.id === sid), new Set(preg.health.avoid)), sid)));
  assert.ok(!preg.breaths.includes("kapalabhati"));
  process.stdout.write("plan.js self check passed\n");
}
