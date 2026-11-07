// Sthira pages: Sessions, Poses, Breathe and Learn with their detail sheets.
"use strict";

function pageHead(eyebrow, title, sub, action) {
  return el("header", { class: "page-head" },
    el("div", { class: "page-head-text" },
      eyebrow && el("p", { class: "eyebrow" }, eyebrow),
      el("h1", { class: "page-title" }, title),
      sub && el("p", { class: "page-sub" }, sub)),
    action);
}

/* Sessions */

function sessionMeta(session, flat) {
  return `${LEVELS[session.lvl]} · ${fmtMinutes(flat.secs)}`;
}

function sessionTile(session, cls = "") {
  const ctx = planContext();
  const flat = flattenSession(session, ctx);
  const adjusted = readPlan() && (!sessionIsSafe(session, ctx.avoid) || flat.leftOut.length > 0);
  const card = el("a", { class: `session-tile ${cls}`.trim(), href: `#/sessions/${session.id}` },
    el("span", { class: "session-tile-meta" }, sessionMeta(session, flat)),
    el("span", { class: "session-tile-name" }, session.name),
    el("span", { class: "session-tile-focus" }, session.focus),
    adjusted && el("span", { class: "badge on-colour" }, sessionOffered(session, ctx) ? "Adjusted for you" : "Not for you right now"));
  card.style.setProperty("--c", session.color);
  return card;
}

/** Sessions a rest only plan may promote. Other plans may promote any session. */
function promotableSessions() {
  const ctx = planContext();
  if (!ctx.restOnly) return SESSIONS;
  return SESSIONS.filter((s) => flattenSession(s, ctx).leftOut.length === 0);
}

function renderSessions() {
  return el("div", { class: "page" },
    pageHead("Sessions", "Guided sessions.", "Each one reads every step aloud and keeps time by your breath. Pick one and press start."),
    el("div", { class: "grid grid-sessions" }, SESSIONS.map((s) => sessionTile(s))));
}

function leftOutNote(flat) {
  const poses = flat.leftOut.filter((st) => st.p).length;
  const sun = flat.leftOut.some((st) => st.sun);
  const other = flat.leftOut.some((st) => st.t);
  const parts = [];
  if (poses) parts.push(`${plural(poses, "pose")} left out for your safety.`);
  if (sun) parts.push("The sun salutation is left out too.");
  if (other) parts.push("Movement steps are left out until your doctor clears you.");
  return parts.join(" ");
}

function planRow(phase, st, ctx) {
  const out = isLeftOut(phase, st, ctx);
  const badge = out && readPlan() ? cautionBadge("Left out for you") : null;
  const cls = out ? "is-out" : "";
  if (st.p) {
    const pose = POSE_BY_ID[st.p];
    if (!pose) return null;
    const sub = `${st.b} breaths${pose.sided ? " each side" : ""}`;
    return row({ lead: poseArt(pose.id), title: pose.en, sub, badge, href: `#/poses/${pose.id}`, cls });
  }
  if (st.sun) return row({ lead: poseArt("surya-0"), title: "Sun salutation", sub: `${plural(st.sun, "round")}. Round 1 is guided.`, badge, onClick: openSuryaSheet, cls });
  return row({ lead: tile(st.t[0], "#8E8E93"), title: st.t, sub: fmtDur(st.s), badge, cls });
}

function phaseList(session, ctx) {
  const sections = [];
  let phase = "";
  for (const st of session.steps) {
    if (typeof st === "string") {
      phase = st;
      sections.push({ name: st, rows: [] });
    } else {
      if (!sections.length) sections.push({ name: "Practice", rows: [] });
      const r = planRow(phase, st, ctx);
      if (r) sections[sections.length - 1].rows.push(r);
    }
  }
  return sections.flatMap((sec) => [sectionTitle(sec.name), group(sec.rows)]);
}

function startButtons(session, flat, offered) {
  if (!offered) {
    return el("div", { class: "card caution" },
      el("p", {}, "Too many poses in this session are left out for your safety. Try Yoga Nidra or a breathing practice instead."),
      el("div", { class: "btn-row" },
        el("a", { class: "pill", href: "#/sessions/nidra" }, "Yoga Nidra"),
        el("a", { class: "pill pill-ghost", href: "#/breathe" }, "Breathing")));
  }
  const resume = getResume();
  const canResume = resume && resume.id === session.id && resume.idx < flat.steps.length;
  return el("div", { class: "btn-row" },
    canResume && el("button", { type: "button", class: "pill", onclick: (e) => startSession(session, resume.idx, e.currentTarget) }, "Continue where you left off"),
    el("button", { type: "button", class: canResume ? "pill pill-ghost" : "pill", onclick: (e) => startSession(session, 0, e.currentTarget) }, canResume ? "Start again" : "Start session"));
}

/** Generated flows are saved to My flows when favourited, so they keep a stable id. */
function sessionHeart(session) {
  if (!session.generated) return heartButton("session", session.id, session.name);
  const btn = el("button", { type: "button", class: "heart", "aria-pressed": "false", "aria-label": `Save ${session.name} to My flows` }, icon("heart", 22));
  btn.addEventListener("click", () => {
    if (btn.getAttribute("aria-pressed") === "true") return;
    const label = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const saved = saveFlow({ ...session, id: "", name: `${session.name} ${label}` });
    if (!saved) return;
    toggleFav("session", saved.id);
    btn.setAttribute("aria-pressed", "true");
    showToast("Saved to My flows.");
  });
  return btn;
}

function showSessionSheet(id, routeKey) {
  const session = findSession(id);
  const ctx = planContext();
  const flat = flattenSession(session, ctx);
  const hero = el("div", { class: "session-hero" },
    el("div", {},
      el("p", { class: "session-tile-meta" }, `${sessionMeta(session, flat)} · ${plural(flat.steps.length, "step")}`),
      el("h2", { class: "sheet-title" }, session.name),
      el("p", {}, session.focus)),
    sessionHeart(session));
  hero.style.setProperty("--c", session.color);
  const offered = sessionOffered(session, ctx);
  const note = readPlan() && flat.leftOut.length && offered ? el("p", { class: "note caution-note" }, icon("alert", 16), leftOutNote(flat)) : null;
  return openSheet(el("div", { class: "sheet-content" },
    hero, el("p", { class: "lede" }, session.about), note, startButtons(session, flat, offered), phaseList(session, ctx)), { label: session.name, routeKey });
}

function openSuryaSheet() {
  openSheet(el("div", { class: "sheet-content" },
    el("h2", { class: "sheet-title" }, "Sun salutation"),
    el("p", { class: "sheet-sub" }, "Surya Namaskara. One breath for each position."),
    el("ol", { class: "card steps" }, SURYA.map(([sk, en, cue]) => el("li", {}, el("strong", {}, `${en} `), el("span", { class: "muted" }, `(${sk}) `), cue)))), { label: "Sun salutation" });
}

/* Poses */

let poseFilter = { q: "", cat: "all", lvl: 0, fav: false };

function setPoseFilter(patch) {
  poseFilter = { ...poseFilter, ...patch };
}

function poseMatches(pose, f) {
  const q = f.q.trim().toLowerCase();
  if (q && !pose.sk.toLowerCase().includes(q) && !pose.en.toLowerCase().includes(q)) return false;
  if (f.cat !== "all" && pose.cat !== f.cat) return false;
  if (f.lvl && pose.lvl !== f.lvl) return false;
  return !f.fav || isFav("pose", pose.id);
}

function poseCard(pose) {
  const avoided = planContext().avoid.has(pose.id);
  return el("a", { class: "pose-card", href: `#/poses/${pose.id}` },
    poseArt(pose.id, { size: "lg" }),
    el("span", { class: "pose-card-text" },
      el("span", { class: "pose-card-sk" }, pose.sk),
      el("span", { class: "pose-card-en" }, pose.en),
      el("span", { class: "pose-card-meta" }, `${CATEGORIES[pose.cat].name} · ${LEVELS[pose.lvl]}`),
      avoided && cautionBadge()));
}

function chipRow(label, options, current, onPick) {
  const wrap = el("div", { class: "chips", role: "group", "aria-label": label });
  options.forEach(([value, text]) => {
    wrap.append(el("button", { type: "button", class: "chip", "aria-pressed": String(value === current), onclick: () => {
      wrap.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      wrap.querySelector(`[data-v="${value}"]`).setAttribute("aria-pressed", "true");
      onPick(value);
    }, "data-v": String(value) }, text));
  });
  return wrap;
}

function poseResults(clearAll) {
  const list = POSES.filter((p) => poseMatches(p, poseFilter));
  if (!list.length) {
    const msg = poseFilter.fav && !readStore().favPoses.length ? "Tap the heart on any pose to save it here." : "Try another word or clear the filters.";
    return emptyState("No poses match.", msg, el("button", { type: "button", class: "pill", onclick: clearAll }, "Clear filters"));
  }
  return el("div", {}, el("p", { class: "count", "aria-live": "polite" }, plural(list.length, "pose")), el("div", { class: "grid grid-poses" }, list.map(poseCard)));
}

function renderPoses() {
  const results = el("div", {});
  const filters = el("div", { class: "filters" });
  const update = () => results.replaceChildren(poseResults(clearAll));
  const search = el("input", { type: "search", class: "search", placeholder: "Search poses", "aria-label": "Search poses in Sanskrit or English", autocomplete: "off", value: poseFilter.q });
  search.addEventListener("input", () => { setPoseFilter({ q: search.value }); update(); });
  const buildChips = () => [
    chipRow("Category", [["all", "All"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.name]), ["fav", "Favourites"]], poseFilter.fav ? "fav" : poseFilter.cat,
      (v) => { setPoseFilter(v === "fav" ? { fav: true, cat: "all" } : { fav: false, cat: v }); update(); }),
    chipRow("Level", [[0, "All levels"], [1, "Beginner"], [2, "Intermediate"], [3, "Advanced"]], poseFilter.lvl,
      (v) => { setPoseFilter({ lvl: Number(v) }); update(); }),
  ];
  function clearAll() {
    setPoseFilter({ q: "", cat: "all", lvl: 0, fav: false });
    search.value = "";
    filters.replaceChildren(el("label", { class: "search-wrap" }, icon("search", 18), search), ...buildChips());
    update();
    search.focus();
  }
  filters.append(el("label", { class: "search-wrap" }, icon("search", 18), search), ...buildChips());
  update();
  return el("div", { class: "page" },
    pageHead("Poses", "Every pose, explained.", `${POSES.length} poses with clear steps, the mistakes that cause injury and an easier version.`),
    filters, results);
}

function infoCard(title, body, cls = "") {
  return [sectionTitle(title, cls), typeof body === "string" ? el("p", { class: `card ${cls}`.trim() }, body) : body];
}

function showPoseSheet(id, routeKey) {
  const pose = POSE_BY_ID[id];
  const cat = CATEGORIES[pose.cat];
  const reason = planContext().avoid.has(pose.id) ? avoidReason(pose.id, "pose") : "";
  return openSheet(el("div", { class: "sheet-content" },
    reason && el("p", { class: "note caution-note" }, icon("alert", 16), `Not in your plan because of: ${reason}.`),
    FIGURE_IDS.has(pose.id) && el("div", { class: "pose-figure" }, poseArt(pose.id, { size: "xl" })),
    el("div", { class: "pose-head" }, !FIGURE_IDS.has(pose.id) && poseArt(pose.id, { size: "xl" }),
      el("div", { class: "pose-head-text" }, el("h2", { class: "sheet-title" }, pose.sk), el("p", { class: "sheet-sub" }, pose.en)),
      heartButton("pose", pose.id, pose.en)),
    el("div", { class: "tags" }, el("span", { class: "tag" }, cat.name), el("span", { class: "tag" }, LEVELS[pose.lvl]), pose.sided && el("span", { class: "tag" }, "Both sides")),
    pose.sided && el("p", { class: "note" }, "Do the right side first. Then repeat on the left."),
    infoCard("How to do it", el("ol", { class: "card steps" }, pose.steps.map((s) => el("li", {}, s)))),
    infoCard("Avoid injury", el("ul", { class: "card caution bullets" }, pose.avoid.map((s) => el("li", {}, s))), "caution-title"),
    infoCard("Make it easier", pose.easier),
    infoCard("Benefits", pose.benefits),
    infoCard("Skip it if", pose.skip)), { label: `${pose.sk}, ${pose.en}`, routeKey });
}

/* Breathe */

function breathMeta(breath) {
  const ctx = planContext();
  return `${LEVELS[breath.lvl]} · ${fmtMinutes(breathTotalSecs(breath, breath.rounds, ctx.noHolds))}`;
}

function pacerPreview(cls = "") {
  return el("span", { class: `pacer-preview ${cls}`.trim(), "aria-hidden": "true" }, el("span", {}));
}

function breathCard(breath) {
  const avoided = planContext().avoidBreaths.has(breath.id);
  return el("a", { class: "breath-card", href: `#/breathe/${breath.id}` },
    pacerPreview(),
    el("span", { class: "breath-card-text" },
      el("span", { class: "eyebrow" }, breathMeta(breath)),
      el("span", { class: "breath-card-name" }, breath.name),
      el("span", { class: "muted" }, breath.sk),
      el("span", { class: "breath-card-about" }, breath.about),
      avoided && cautionBadge()));
}

function renderBreathe() {
  return el("div", { class: "page" },
    pageHead("Breathe", "Slow down with your breath.", "Follow the circle. It grows as you breathe in and shrinks as you breathe out."),
    el("div", { class: "grid grid-breaths" }, BREATHS.map(breathCard)));
}

function showBreathSheet(id, routeKey) {
  const breath = BREATH_BY_ID[id];
  const ctx = planContext();
  const reason = ctx.avoidBreaths.has(breath.id) ? avoidReason(breath.id, "breath") : "";
  const hasHolds = breath.pattern.some(([label]) => /^hold/i.test(label));
  return openSheet(el("div", { class: "sheet-content" },
    reason && el("p", { class: "note caution-note" }, icon("alert", 16), `Not in your plan because of: ${reason}.`),
    el("h2", { class: "sheet-title" }, breath.name),
    el("p", { class: "sheet-sub" }, `${breath.sk} · ${breathMeta(breath)}`),
    el("p", { class: "lede" }, breath.about),
    ctx.noHolds && hasHolds && el("p", { class: "note caution-note" }, icon("alert", 16), "Holds are left out for you. The pacer moves straight from in to out."),
    el("div", { class: "btn-row" }, el("button", { type: "button", class: "pill", onclick: () => openPacer(breath, breath.rounds) }, "Start")),
    infoCard("How", el("ol", { class: "card steps" }, breath.how.map((s) => el("li", {}, s)))),
    infoCard("Caution", breath.caution, "caution")), { label: breath.name, routeKey });
}

/* Learn */

function articleCard(article) {
  return el("a", { class: "article-card", href: `#/learn/${article.id}` },
    el("span", { class: "article-icon", "aria-hidden": "true" }, article.icon),
    el("span", { class: "article-card-title" }, article.title),
    el("span", { class: "muted" }, article.sub));
}

function renderLearn() {
  return el("div", { class: "page" },
    pageHead("Learn", "Practise with confidence.", "Short guides on safety, breath and building a habit."),
    el("div", { class: "grid grid-articles" }, ARTICLES.map(articleCard)));
}

function showArticleSheet(id, routeKey) {
  const article = ARTICLE_BY_ID[id];
  return openSheet(el("article", { class: "sheet-content reading" },
    el("p", { class: "article-icon big", "aria-hidden": "true" }, article.icon),
    el("h2", { class: "sheet-title" }, article.title),
    el("p", { class: "sheet-sub" }, article.sub),
    el("div", { class: "prose" }, articleBlocks(article.body))), { label: article.title, routeKey });
}
