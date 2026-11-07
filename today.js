// Sthira landing page (Today): hero, your week, chapters, breathing band, FAQ.
"use strict";

const FAQ = [
  ["Is Sthira free?", "Yes. Every pose, session and breathing practice is free. There is no account to create."],
  ["Do I need a mat?", "A non slip mat helps. A rug or carpet on a flat floor works too. A cushion, a belt and a wall make most poses safer."],
  ["I am a complete beginner. Where do I start?", "Take the quiz to get a plan. Or start with Morning Wake-Up three times a week. Every pose has an easier version."],
  ["I have an injury. Can I still practise?", "Tell the quiz about it. Sthira then leaves out the poses that could make it worse. Check with your doctor first if you are unsure."],
  ["What is a dosha?", "In Ayurveda the three doshas describe body types and temperaments. Sthira uses them as a traditional guide to the style of practice. It is not a diagnosis."],
  ["Does it work offline?", "Yes. After your first visit the whole site is saved on your device. Sessions and breathing practices then work without a connection."],
  ["Is my data private?", "Everything stays in this browser on this device. Nothing is sent anywhere. You can reset it all in Settings."],
  ["Can I install it on my phone?", "Yes. Open the site in your phone's browser. Then use Add to Home Screen from the share or browser menu."],
];

function greeting(hour) {
  if (hour < 12) return "Good morning";
  return hour < 18 ? "Good afternoon" : "Good evening";
}

/** Suggested session: from the plan stage when there is one, else by time of day. */
function suggestedSession(now = new Date()) {
  const plan = readPlan();
  const day = dayNumber(now);
  const ok = (s) => s && sessionOffered(s, planContext());
  if (plan) {
    const ids = plan.journey[currentStageIndex(plan, now)].sessions.filter((id) => ok(SESSION_BY_ID[id]));
    if (ids.length) return SESSION_BY_ID[ids[day % ids.length]];
  }
  const pool = promotableSessions().filter(ok);
  const hour = now.getHours();
  if (hour < 11 && pool.includes(SESSION_BY_ID.morning)) return SESSION_BY_ID.morning;
  if (hour >= 18 && pool.includes(SESSION_BY_ID.evening)) return SESSION_BY_ID.evening;
  return pool.length ? pool[day % pool.length] : SESSION_BY_ID.nidra;
}

function quickestSession() {
  const ctx = planContext();
  return promotableSessions()
    .filter((s) => sessionOffered(s, ctx))
    .map((s) => ({ s, flat: flattenSession(s, ctx) }))
    .sort((a, b) => a.flat.secs - b.flat.secs)[0] || { s: SESSION_BY_ID.nidra, flat: flattenSession(SESSION_BY_ID.nidra, ctx) };
}

function poseOfDay(now = new Date()) {
  const plan = readPlan();
  const ids = plan && plan.poses.length ? plan.poses : POSES.map((p) => p.id);
  return POSE_BY_ID[ids[dayNumber(now) % ids.length]];
}

function quizPill(cls = "pill") {
  return readPlan() ? el("a", { class: cls, href: "#/plan" }, "See your plan") : el("a", { class: cls, href: "#/quiz" }, "Take the quiz");
}

function band(cls, ...content) {
  return el("section", { class: `band ${cls}` }, el("div", { class: "band-inner" }, content));
}

function chapterTitle(text, sub) {
  return el("header", { class: "chapter-head" }, el("h2", { class: "chapter-title" }, text), sub && el("p", { class: "chapter-sub" }, sub));
}

/* 2. Hero */

function heroSection(now) {
  const stat = (num, label) => el("li", {}, el("span", { class: "stat-num" }, num), el("span", { class: "stat-label" }, label));
  const media = el("div", { class: "hero-media", "aria-hidden": "true" }, loopVideo("hero-sunrise-silhouette", { eager: true, decorative: true }), el("div", { class: "hero-shade" }));
  return band("band-dark hero has-media",
    media,
    el("p", { class: "hero-eyebrow" }, greeting(now.getHours())),
    el("h1", { class: "hero-title" }, el("span", {}, "Steady body."), el("span", {}, "Easy breath.")),
    el("p", { class: "hero-sub" }, "Guided yoga for your home practice. Learn each pose safely. Then follow along at your own pace."),
    el("div", { class: "hero-actions" }, quizPill(), el("a", { class: "pill pill-ghost", href: `#/sessions/${suggestedSession(now).id}` }, "Start a session")),
    el("div", { class: "hero-visual", "aria-hidden": "true" }, el("span", { class: "hero-glow" }), el("span", { class: "hero-orb" }), el("span", { class: "hero-orb-core" })),
    el("ul", { class: "stat-strip", role: "list" },
      stat(String(POSES.length), "poses with safety notes"),
      stat(String(SESSIONS.length), "guided sessions"),
      stat(String(BREATHS.length), "breathing practices")));
}

/* 3. Offer strip */

/** Minutes from the real length of the session, so the heading and the text always agree. */
const quickMinutes = (quick) => Math.max(1, Math.round(quick.flat.secs / 60));

function offerStrip(now) {
  const quick = quickestSession();
  const restOnly = planContext().restOnly;
  return band("band-light offers",
    el("div", { class: "two-up" },
      el("div", { class: "offer" },
        el("h2", { class: "offer-title" }, readPlan() ? "Your plan is ready." : "Find your practice."),
        el("p", {}, readPlan() ? "See your poses, your breathing and the next stage of your journey." : "Ten short questions. A plan that fits your body and leaves out unsafe poses."),
        quizPill()),
      el("div", { class: "offer" },
        el("h2", { class: "offer-title" }, `Start in ${plural(quickMinutes(quick), "minute")}.`),
        el("p", {}, restOnly ? `${quick.s.name} is calm and safe while you rest.` : `${quick.s.name} takes about ${plural(quickMinutes(quick), "minute")}. ${quick.s.focus}.`),
        el("a", { class: "pill", href: `#/sessions/${quick.s.id}` }, "Start now"))));
}

/* Your week: rings, streak, up next and resume */

function streakLine(store) {
  const streak = streakDays(store.log);
  const today = dayTotal(store.log[isoDate(new Date())]) > 0;
  if (today) return streak > 1 ? `You practised today. That makes ${streak} days in a row.` : "You practised today. Nice work.";
  if (streak) return `Practise today to keep your ${streak} day streak going.`;
  return "One short session starts a streak.";
}

function ringLegend(rings) {
  return el("ul", { class: "ring-legend", role: "list" }, rings.map((r, i) =>
    el("li", {}, el("span", { class: `dot dot-${i + 1}`, "aria-hidden": "true" }), el("span", { class: "ring-label" }, r.label),
      el("span", { class: "ring-value" }, `${r.value} of ${r.goal} ${r.unit}`))));
}

function upNextCard(now) {
  const plan = readPlan();
  if (!plan) return null;
  const i = currentStageIndex(plan, now);
  const stage = plan.journey[i];
  const prog = stageProgress(plan, i);
  const ids = stage.sessions.filter((id) => sessionOffered(SESSION_BY_ID[id], planContext()));
  if (!ids.length) return null;
  const session = SESSION_BY_ID[ids[prog.done % ids.length]];
  const card = el("a", { class: "upnext", href: `#/sessions/${session.id}` },
    el("span", { class: "eyebrow" }, `Up next · ${stage.title}`),
    el("span", { class: "upnext-name" }, session.name),
    el("span", { class: "muted" }, `${prog.done} of ${prog.target} sessions done in this stage`),
    progressBar(prog.pct, `${stage.title} progress`));
  card.style.setProperty("--c", session.color);
  return card;
}

function resumeCard() {
  const r = getResume();
  if (!r) return null;
  // Saved and generated flows resume too. A flow that no longer exists is not offered.
  const session = findSession(r.id);
  if (!session) return null;
  return el("a", { class: "upnext resume", href: `#/sessions/${session.id}` },
    el("span", { class: "eyebrow" }, "Continue where you left off"),
    el("span", { class: "upnext-name" }, session.name),
    el("span", { class: "muted" }, `You stopped at step ${r.idx + 1}. Open it to carry on.`));
}

function progressBar(pct, label) {
  const bar = el("span", { class: "progress light", role: "progressbar", "aria-label": label, "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(pct * 100)) }, el("span", { class: "progress-fill" }));
  bar.firstChild.style.width = `${Math.round(pct * 100)}%`;
  return bar;
}

function weekSection(now) {
  const store = readStore();
  if (!store.history.length && !readPlan() && !getResume()) return null;
  const rings = weeklyRings(now);
  return band("band-white week",
    chapterTitle("Your week.", streakLine(store)),
    el("div", { class: "week-grid" },
      el("div", { class: "tile-card rings-card" }, ringsSvg(rings, 160), ringLegend(rings)),
      el("div", { class: "week-side" }, resumeCard(), upNextCard(now))));
}

/* 4. Practise safely */

function avoidMock() {
  const pose = POSE_BY_ID.virabhadrasana2;
  return el("div", { class: "mock mock-sheet", "aria-hidden": "true" },
    el("p", { class: "mock-title" }, pose.sk),
    el("p", { class: "muted" }, pose.en),
    el("p", { class: "section-title caution-title" }, "Avoid injury"),
    el("ul", { class: "card caution bullets" }, pose.avoid.map((a) => el("li", {}, a))));
}

function ringMock() {
  const ring = ringSvg();
  ring.fg.style.strokeDashoffset = String(RING_C * 0.32);
  return el("div", { class: "mock mock-player", "aria-hidden": "true" },
    el("p", { class: "player-phase" }, "Poses"),
    el("p", { class: "mock-title" }, "Tree Pose"),
    el("p", { class: "muted" }, "Vrikshasana · Right side"),
    el("div", { class: "ring-wrap" }, ring.svg, el("span", { class: "player-clock" }, "0:24")));
}

function featureTile(title, text, visual, cls = "") {
  return el("article", { class: `feature-tile ${cls}`.trim() }, el("div", { class: "feature-copy" }, el("h3", {}, title), el("p", {}, text)), visual);
}

function safetyChapter() {
  return band("band-dark chapter",
    chapterTitle("Practise safely at home.", "Sthira is built around the mistakes that cause injury. You see them before you move."),
    el("div", { class: "two-up" },
      featureTile("Every pose shows the risks.", "Clear steps. The common mistakes to avoid. An easier version. Who should skip it.", avoidMock()),
      featureTile("Follow along, hands free.", "A calm voice reads each step. A ring counts down every hold. Your screen stays awake.", ringMock())),
    el("figure", { class: "photo-tile wide" }, photo("photo-senior-lunge-with-block", { sizes: "(min-width: 1200px) 1200px, 100vw" }),
      el("figcaption", {}, "A block, a cushion and a wall make most poses safer at any age.")));
}

/* 5. Plan chapter */

function doshaMock() {
  const plan = readPlan();
  const keys = plan ? doshaKeys(plan) : ["v", "p", "k"];
  return el("div", { class: "mock mock-dosha", "aria-hidden": "true" }, keys.map((k) => {
    const chip = el("span", { class: "dosha-chip" }, el("strong", {}, DOSHAS[k].name), el("span", {}, DOSHAS[k].elements));
    chip.style.setProperty("--c", DOSHAS[k].color);
    return chip;
  }));
}

function journeyMock() {
  const stages = ["Foundations", "Build the habit", "Go deeper", "Your own practice"];
  return el("ol", { class: "mock mock-journey", "aria-hidden": "true" }, stages.map((s, i) => el("li", { class: i === 0 ? "current" : "" }, el("span", { class: "dot" }), s)));
}

function planChapter() {
  return band("band-dark chapter",
    chapterTitle("A plan made for you.", "Your answers shape the poses, the breathing and the pace. Unsafe poses stay out."),
    el("div", { class: "two-up" },
      featureTile("Your dosha, your style.", "The traditional Ayurvedic types guide how you practise. Grounding, cooling or energising.", doshaMock()),
      featureTile("A six month journey.", "Four stages from first shapes to your own practice. Each with clear milestones.", journeyMock())),
    el("div", { class: "photo-tile wide video-tile" }, loopVideo("practice-deck-by-sea")),
    el("div", { class: "shelf", role: "list", "aria-label": "Sessions" }, promotableSessions().map((s) => el("div", { role: "listitem" }, sessionTile(s, "portrait")))));
}

/* 6. Poses chapter */

function poseChapter() {
  const counts = POSES.reduce((acc, p) => ({ ...acc, [p.cat]: (acc[p.cat] || 0) + 1 }), {});
  return band("band-light chapter-light",
    chapterTitle("Every pose, explained.", "Browse by family. Each card opens the steps and the safety notes."),
    el("div", { class: "shelf", role: "list", "aria-label": "Pose categories" }, Object.entries(CATEGORIES).map(([id, cat]) => {
      const card = el("a", { class: "cat-card", href: "#/poses", onclick: () => setPoseFilter({ cat: id, fav: false, q: "", lvl: 0 }) },
        el("span", { class: "cat-count" }, String(counts[id] || 0)),
        el("span", { class: "cat-name" }, cat.name),
        el("span", { class: "muted" }, plural(counts[id] || 0, "pose")));
      card.style.setProperty("--c", cat.color);
      return el("div", { role: "listitem" }, card);
    })),
    podRow(poseOfDay()));
}

/** The pose of the day with its own photo (or the calm card), never a photo of a different pose. */
function podRow(pose) {
  return el("div", { class: "pod-row" },
    el("div", { class: "pod" }, el("h3", { class: "block-title" }, "Pose of the day"), poseCard(pose)),
    el("a", { class: "pod-visual", href: `#/poses/${pose.id}`, "aria-label": `Open ${pose.en}` }, poseArt(pose.id, { size: "xl" })));
}

/* 7. Breathing band */

function breathBand() {
  return band("band-white",
    el("div", { class: "breath-band" },
      el("div", { class: "breath-band-visual" }, photo("photo-seated-breathing-wicker-chair", { sizes: "(min-width: 834px) 50vw, 100vw" }), pacerPreview("over")),
      el("div", { class: "breath-band-copy" },
        el("h2", { class: "chapter-title" }, "Breathe your way to calm."),
        el("p", { class: "chapter-sub" }, "Seven guided practices with a circle that paces every breath. One minute is enough to feel the change."),
        el("div", { class: "btn-row" },
          el("button", { type: "button", class: "pill", onclick: () => openPacer(BREATH_BY_ID.abdominal, 6) }, "One minute of Belly Breathing"),
          el("a", { class: "pill pill-ghost", href: "#/breathe" }, "All practices")))));
}

/* 8 to 9. Closing call, safety and FAQ */

function closingStrip(now) {
  return band("band-dark closing",
    el("h2", { class: "chapter-title" }, "Roll out your mat."),
    el("p", { class: "chapter-sub" }, "Your first session can start in the next minute."),
    el("div", { class: "hero-actions" }, quizPill(), el("a", { class: "pill pill-ghost", href: `#/sessions/${suggestedSession(now).id}` }, "Start a session")));
}

function safetyTeaser() {
  const rules = ARTICLE_BY_ID.safety.body.slice(0, 3).map((l) => l.replace(/^\* /, ""));
  return band("band-light",
    chapterTitle("The ten rules of safe practice.", "Read them once. They protect your back, knees and neck every time you practise."),
    el("ol", { class: "rule-list" }, rules.map((r) => el("li", {}, r))),
    el("div", { class: "btn-row" }, el("a", { class: "pill", href: "#/learn/safety" }, "Read all ten"), el("a", { class: "pill pill-ghost", href: "#/learn/health" }, "When to check with a doctor")));
}

function faqSection() {
  return band("band-white faq",
    chapterTitle("Questions.", null),
    el("div", { class: "faq-list" }, FAQ.map(([q, a]) => el("details", {}, el("summary", {}, q), el("p", {}, a)))));
}

function restBanner() {
  return el("div", { class: "band-inner" }, el("a", { class: "banner caution", href: "#/plan" },
    el("span", {}, el("strong", {}, "Rest and breathing only for now. "), "Your plan keeps to gentle breathing until your doctor clears you. Open your plan.")));
}

function todayFlowBand() {
  const flow = todaysFlow();
  return band("band-white",
    el("div", { class: "two-up align-center" },
      el("div", {},
        chapterTitle("Today's flow.", readPlan() ? "Made from your plan for today. It stays the same until midnight." : "A fresh sequence every day. Take the quiz and it will follow your plan."),
        el("div", { class: "btn-row" }, el("a", { class: "pill", href: `#/sessions/${TODAY_FLOW_ID}` }, "Open today's flow"), el("a", { class: "pill pill-ghost", href: "#/create" }, "Create your own"))),
      sessionTile(flow, "feature")));
}

function renderToday() {
  const now = new Date();
  const plan = readPlan();
  return el("div", { class: "landing" },
    heroSection(now),
    plan && plan.health.restOnly && restBanner(),
    offerStrip(now),
    weekSection(now),
    todayFlowBand(),
    safetyChapter(),
    planChapter(),
    poseChapter(),
    breathBand(),
    safetyTeaser(),
    closingStrip(now),
    teacherBand(),
    faqSection());
}
