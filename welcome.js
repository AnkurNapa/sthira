// Sthira introduction pages: Welcome (first visit), About the teacher and Credits.
"use strict";

const TEN_MINUTE_IDS = ["desk", "morning"];

function markWelcomed() {
  writeStore({ welcomed: true });
}

function teacherTitle() {
  return `${TEACHER.name}, ${TEACHER.credential}`;
}

function reviewedLine() {
  return el("p", { class: "reviewed" }, icon("check", 14), TEACHER.reviewed);
}

/** The teacher band, shared by the landing page and the welcome page.
 * Photos next to the teacher's name show objects only, so no one is mistaken for him. */
function teacherBand() {
  return band("band-light teacher",
    el("div", { class: "two-up align-center" },
      el("div", {},
        el("h2", { class: "chapter-title" }, TEACHER.homeTitle),
        el("p", { class: "chapter-sub" }, TEACHER.homeBody),
        el("div", { class: "btn-row" }, el("a", { class: "pill pill-ghost", href: "#/about" }, `About ${TEACHER.name}`))),
      el("div", { class: "photo-tile" }, photo("photo-props-cork-blocks", { sizes: "(min-width: 834px) 45vw, 100vw" }))));
}

/* Welcome */

function welcomeHero() {
  const start = el("a", { class: "pill", href: "#/quiz", onclick: markWelcomed }, "Get started");
  const skip = el("a", { class: "text-link", href: "#/today", onclick: markWelcomed }, "I have done yoga before");
  return el("section", { class: "band band-dark hero welcome-hero" },
    el("div", { class: "hero-media", "aria-hidden": "true" }, loopVideo("hero-sunrise-silhouette", { eager: true, decorative: true }), el("div", { class: "hero-shade" })),
    el("div", { class: "band-inner" },
      el("p", { class: "hero-eyebrow" }, "Welcome to Sthira"),
      el("h1", { class: "hero-title" }, el("span", {}, "Yoga at home,"), el("span", {}, "made safe.")),
      el("p", { class: "hero-sub" }, "Learn each pose, follow a calm voice and practise at your own pace. Free, with nothing to sign up for."),
      el("div", { class: "hero-actions" }, start, skip),
      el("p", { class: "hero-note" }, "Sthira does not replace a qualified teacher or medical advice. Stop if anything hurts.")));
}

const SAMPLE_RINGS = [
  { label: "Practice", value: 45, goal: 60, unit: "min" },
  { label: "Breathing", value: 12, goal: 15, unit: "min" },
  { label: "Days", value: 3, goal: 3, unit: "days" },
];

function tourPanels() {
  const sampleBadge = el("div", { class: "mock badge-mock" },
    el("span", { class: "badge-icon won" }, icon("star", 22)), el("span", { class: "strong" }, "Three days"), el("span", { class: "muted small" }, "You practised three days in a row."));
  return [
    { title: "Learn every pose safely.", text: "Each pose shows clear steps, the mistakes that cause injury and an easier version.", visual: el("div", { class: "tour-visual pair" }, poseArt("virabhadrasana2", { size: "xl" }), avoidMock()) },
    { title: "A plan made for you.", text: "A short quiz finds your type and your health needs. Unsafe poses stay out of your plan.", visual: el("div", { class: "tour-visual pair" }, doshaMock(), journeyMock()) },
    { title: "Guided sessions with a calm voice.", text: "Asana, pranayama, meditation in every practice. Emma reads every step while a ring counts down each hold.", visual: el("div", { class: "tour-visual" }, ringMock()) },
    { title: "Breathe.", text: "Seven breathing practices. The circle grows as you breathe in and shrinks as you breathe out.", visual: el("div", { class: "tour-visual" }, pacerPreview("big")) },
    { title: "Your progress, on your device.", text: "Rings, streaks and badges. Everything stays in this browser.", visual: el("div", { class: "tour-visual pair" }, el("div", { class: "mock" }, ringsSvg(SAMPLE_RINGS, 160)), sampleBadge) },
  ];
}

function tourSection() {
  const panels = tourPanels();
  const track = el("div", { class: "tour-track", tabindex: "0", role: "group", "aria-roledescription": "carousel", "aria-label": "What Sthira does" },
    panels.map((p, i) => el("article", { class: "tour-card", "aria-roledescription": "slide", "aria-label": `${i + 1} of ${panels.length}` },
      p.visual, el("div", { class: "tour-copy" }, el("h3", {}, p.title), el("p", {}, p.text)))));
  const dots = panels.map((p, i) => el("button", { type: "button", class: "tour-dot", "aria-label": `Show ${p.title}`, onclick: () => go(i) }));
  const prev = el("button", { type: "button", class: "ctl small paddle", "aria-label": "Previous", onclick: () => go(current - 1) }, icon("back", 20));
  const next = el("button", { type: "button", class: "ctl small paddle", "aria-label": "Next", onclick: () => go(current + 1) }, icon("chevron", 20));
  let current = 0;
  function go(i) {
    const n = Math.max(0, Math.min(panels.length - 1, i));
    track.children[n].scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "nearest", inline: "start" });
    paint(n);
  }
  function paint(n) {
    current = n;
    dots.forEach((d, j) => d.setAttribute("aria-current", j === n ? "true" : "false"));
    prev.disabled = n === 0;
    next.disabled = n === panels.length - 1;
  }
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
  });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting && en.intersectionRatio > 0.6) paint([...track.children].indexOf(en.target)); });
    }, { root: track, threshold: [0.6] });
    [...track.children].forEach((c) => io.observe(c));
  }
  paint(0);
  return band("band-dark tour",
    chapterTitle("What Sthira does.", "Five things that make home practice safer and easier."),
    track,
    el("div", { class: "tour-controls" }, prev, el("div", { class: "tour-dots" }, dots), next));
}

function trustRow() {
  const item = (name, label) => el("li", {}, el("span", { class: "trust-icon" }, icon(name, 22)), label);
  return band("band-white trust",
    el("ul", { class: "trust-row", role: "list" },
      item("heart", "Free"), item("user", "No account"), item("shield", "No tracking"), item("offline", "Works offline")));
}

function safetyCard() {
  return band("band-white",
    el("div", { class: "card caution safety-card" },
      el("h2", { class: "offer-title" }, "Practise with care."),
      el("p", {}, "Sthira does not replace a qualified teacher or medical advice. Stop if anything hurts. If you have a health condition, talk to your doctor before you start."),
      el("a", { class: "pill pill-ghost", href: "#/learn/health" }, "When to check with a doctor")));
}

function welcomeClosing() {
  const ctx = planContext();
  const quick = TEN_MINUTE_IDS.map((id) => SESSION_BY_ID[id]).find((s) => s && sessionOffered(s, ctx)) || SESSION_BY_ID.nidra;
  return band("band-dark closing",
    el("h2", { class: "chapter-title" }, "Ready when you are."),
    el("div", { class: "hero-actions" },
      el("a", { class: "pill", href: "#/quiz", onclick: markWelcomed }, "Find your practice"),
      el("a", { class: "pill pill-ghost", href: `#/sessions/${quick.id}`, onclick: markWelcomed }, "Start a 10 minute session")));
}

function renderWelcome() {
  return el("div", { class: "landing welcome" },
    welcomeHero(), tourSection(), trustRow(), teacherBand(), safetyCard(), welcomeClosing());
}

/* About the teacher */

function trainingCard(t) {
  return el("article", { class: "training-card" },
    el("span", { class: "training-hours" }, String(t.hours)),
    el("span", { class: "eyebrow" }, "hours"),
    el("h3", {}, t.what),
    el("p", { class: "muted" }, t.where),
    el("p", { class: "muted small" }, t.when));
}

function renderAbout() {
  return el("div", { class: "page about" },
    pageHead("About", teacherTitle(), null),
    el("div", { class: "about-grid" },
      el("div", { class: "prose about-text" }, TEACHER.about.map((p) => el("p", {}, p))),
      el("div", { class: "photo-tile" }, photo("photo-rolled-mat-sunlight", { eager: true }))),
    el("h2", { class: "block-title" }, "Training"),
    el("div", { class: "grid training" }, TEACHER.training.map(trainingCard)));
}

/* Credits */

function creditRow(name, what, credit) {
  const url = (credit.match(/https?:\/\/\S+/) || [])[0];
  const who = credit.replace(/,?\s*https?:\/\/\S+/, "").trim();
  return el("li", { class: "credit" },
    el("span", { class: "strong" }, what),
    el("span", { class: "muted" }, name),
    el("span", {}, who, url && " · ", url && el("a", { href: url, rel: "noopener" }, "Licence")));
}

function posePhotoCredits() {
  return Object.entries(POSE_PHOTOS).map(([id, p]) => {
    const name = POSE_BY_ID[id] ? POSE_BY_ID[id].en : `Sun salutation, position ${Number(id.split("-")[1]) + 1}`;
    return el("li", { class: "credit" },
      el("span", { class: "strong" }, name),
      el("span", { class: "muted" }, p.alt),
      el("span", {}, `${p.by}, ${p.licence} · `, el("a", { href: p.url, rel: "noopener" }, "View on Pexels")));
  });
}

function musicCredits() {
  const list = el("ul", { class: "credit-list", role: "list" });
  musicTracks().then((tracks) => list.replaceChildren(...tracks.map((t) => creditRow(t.name, "Music", `${t.credit}, ${t.source}`))));
  return list;
}

function renderCredits() {
  return el("div", { class: "page credits" },
    pageHead("Credits", "Photo and video credits.", "Every photo, video, figure and voice here has a licence that allows public use."),
    el("h2", { class: "block-title" }, "Voice"),
    el("ul", { class: "credit-list", role: "list" },
      creditRow("Emma", "Voice", "Recorded with Kokoro, Apache 2.0 licence")),
    el("h2", { class: "block-title" }, "Music"),
    musicCredits(),
    el("h2", { class: "block-title" }, "Pose photos"),
    el("ul", { class: "credit-list", role: "list" }, posePhotoCredits()),
    el("h2", { class: "block-title" }, "Photos and videos"),
    el("ul", { class: "credit-list", role: "list" }, mediaCredits().map((m) => creditRow(m.alt, m.kind, m.credit))));
}
