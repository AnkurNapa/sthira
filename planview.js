// Sthira personal plan: the quiz, the My Plan page, settings and badges.
"use strict";

const doshaKeys = (plan) => [plan.dosha.primary, plan.dosha.secondary, plan.dosha.tertiary].filter(Boolean);

function doshaName(plan) {
  return doshaKeys(plan).map((k) => DOSHAS[k].name).join("-");
}

function doshaElements(plan) {
  return doshaKeys(plan).map((k) => DOSHAS[k].elements).join(" · ");
}

const DOSHA_NOTE = "Doshas come from traditional Ayurvedic guidance. They are a guide to your practice, not a diagnosis.";

/* Quiz */

function showQuiz(routeKey) {
  const answers = {};
  let step = 0;
  const view = el("div", { class: "quiz" });
  const sheet = openSheet(view, { label: "Find your practice", full: true, bare: true, routeKey });

  function header() {
    const pct = Math.round((step / QUIZ.length) * 100);
    const bar = el("span", { class: "progress", role: "progressbar", "aria-label": "Quiz progress", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct) }, el("span", { class: "progress-fill" }));
    bar.firstChild.style.width = `${pct}%`;
    return el("div", { class: "quiz-top" },
      el("button", { type: "button", class: "ctl small light", "aria-label": "Previous question", disabled: step === 0 ? true : null, onclick: () => show(step - 1) }, icon("back", 22)),
      el("div", { class: "quiz-progress" }, bar, el("span", { class: "muted" }, `${step + 1} of ${QUIZ.length}`)),
      el("button", { type: "button", class: "ctl small light", "aria-label": "Close quiz", onclick: () => sheet.close() }, icon("close", 22)));
  }

  function optionCard(q, o, picked, onPick) {
    return el("button", { type: "button", class: "option", "aria-pressed": String(picked), onclick: onPick },
      el("span", { class: "option-text" }, el("span", { class: "option-label" }, o.label), o.hint && el("span", { class: "muted" }, o.hint)),
      el("span", { class: "option-mark", "aria-hidden": "true" }, icon("check", 16)));
  }

  function singleOptions(q) {
    return q.options.map((o) => optionCard(q, o, answers[q.id] === o.v, () => {
      answers[q.id] = o.v;
      show(step + 1);
    }));
  }

  function multiOptions(q) {
    const picked = new Set(answers[q.id] || []);
    const cont = el("button", { type: "button", class: "pill wide", disabled: picked.size ? null : true, onclick: () => { answers[q.id] = [...picked]; show(step + 1); } }, "Continue");
    const cards = q.options.map((o) => {
      const card = optionCard(q, o, picked.has(o.v), () => {
        if (picked.has(o.v)) picked.delete(o.v);
        else if (o.v === "none") {
          picked.clear();
          picked.add("none");
        } else {
          picked.delete("none");
          picked.add(o.v);
        }
        cards.forEach((c, i) => c.setAttribute("aria-pressed", String(picked.has(q.options[i].v))));
        cont.disabled = picked.size === 0;
        answers[q.id] = [...picked];
      });
      return card;
    });
    return [...cards, cont];
  }

  function show(n) {
    if (n >= QUIZ.length) {
      finishQuiz();
      return;
    }
    step = Math.max(0, n);
    const q = QUIZ[step];
    const heading = el("h2", { class: "quiz-q", tabindex: "-1" }, q.q);
    view.replaceChildren(header(), el("div", { class: "quiz-body" },
      heading,
      q.note && el("p", { class: "muted" }, q.note),
      el("div", { class: "options", role: "group", "aria-label": q.q }, q.multi ? multiOptions(q) : singleOptions(q))));
    heading.focus({ preventScroll: true });
    view.scrollTop = 0;
  }

  function finishQuiz() {
    const firstMissing = QUIZ.findIndex((q) => answers[q.id] === undefined);
    if (firstMissing >= 0 || !scoreDosha(answers).answered) {
      show(Math.max(0, firstMissing));
      showToast("Please answer this question to see your plan.");
      return;
    }
    const plan = savePlan({ ...buildPlan(answers), created: isoDate(new Date()) });
    view.replaceChildren(resultView(plan, () => replaceRoute("plan")));
    view.querySelector("h2").focus({ preventScroll: true });
  }

  show(0);
  return sheet;
}

function resultView(plan, onSee) {
  const primary = DOSHAS[plan.dosha.primary];
  const hero = el("div", { class: "result-hero" },
    el("p", { class: "eyebrow" }, "Your type"),
    el("h2", { class: "result-name", tabindex: "-1" }, doshaName(plan)),
    el("p", {}, doshaElements(plan)));
  hero.style.setProperty("--c", primary.color);
  const left = plan.health.avoid.length;
  return el("div", { class: "quiz-body" },
    hero,
    el("p", { class: "muted small" }, DOSHA_NOTE),
    el("div", { class: "dosha-profiles" }, doshaProfiles(plan)),
    left ? el("p", { class: "note caution-note" }, icon("alert", 16), `${plural(left, "pose")} left out of your plan for your safety.`) : null,
    plan.health.restOnly ? el("p", { class: "note caution-note" }, icon("alert", 16), "Your plan is rest and breathing only until your doctor clears you.") : null,
    el("button", { type: "button", class: "pill wide", onclick: onSee }, "See my plan"));
}

/* My Plan page */

function planIntro() {
  return el("div", { class: "page" },
    pageHead("My Plan", "Your plan.", "Answer ten short questions. Sthira picks your poses, breathing and pace. It keeps unsafe poses out.",
      settingsButton()),
    el("div", { class: "btn-row" }, el("a", { class: "pill", href: "#/quiz" }, "Take the 2 minute quiz")),
    el("div", { class: "plan-extras" }, badgesSection(), historySection()));
}

function settingsButton() {
  return el("button", { type: "button", class: "ctl small light gear", "aria-label": "Settings", onclick: openSettings }, icon("gear", 22));
}

function doshaCard(plan) {
  const d = DOSHAS[plan.dosha.primary];
  const card = el("div", { class: "dosha-card" },
    el("p", { class: "eyebrow" }, "Your type"),
    el("h2", { class: "result-name" }, doshaName(plan)),
    el("p", {}, doshaElements(plan)),
    el("p", { class: "small" }, DOSHA_NOTE));
  card.style.setProperty("--c", d.color);
  return card;
}

/** One profile card per dosha in the mix, each in its own colour. */
function doshaProfiles(plan) {
  return doshaKeys(plan).map((k) => {
    const d = DOSHAS[k];
    const card = el("article", { class: "dosha-profile" },
      el("h3", { class: "dosha-profile-name" }, d.name, el("span", { class: "muted" }, ` · ${d.elements}`)),
      el("p", {}, d.traits),
      el("h4", {}, "How to practise"), el("p", {}, d.practice),
      el("h4", {}, "What to avoid"), el("p", {}, d.avoidStyle),
      el("h4", {}, "Best time"), el("p", {}, d.bestTime));
    card.style.setProperty("--c", d.color);
    return card;
  });
}

function healthCards(plan) {
  if (!plan.health.ids.length) return null;
  return [sectionTitle("Health notes", "caution-title"), plan.health.ids.map((id, i) =>
    el("div", { class: "card caution" }, el("p", { class: "strong" }, conditionLabel(id)), el("p", {}, plan.health.tips[i] || CONDITIONS[id].tip)))];
}

function planAside(plan) {
  const rings = weeklyRings();
  return el("aside", { class: "plan-aside" },
    doshaCard(plan),
    sectionTitle(doshaKeys(plan).length > 1 ? "Your doshas" : "Your dosha"),
    el("div", { class: "dosha-profiles" }, doshaProfiles(plan)),
    healthCards(plan),
    sectionTitle("This week"), el("div", { class: "card rings-card small-rings" }, ringsSvg(rings, 110), ringLegend(rings)),
    el("div", { class: "btn-row" }, el("a", { class: "pill pill-ghost", href: "#/quiz" }, "Retake quiz")));
}

function linkChips(ids, kind) {
  const map = { sessions: SESSION_BY_ID, poses: POSE_BY_ID, breathe: BREATH_BY_ID, learn: ARTICLE_BY_ID };
  const name = (item) => item.name || item.en || item.title;
  return el("div", { class: "link-chips" }, ids.map((id) => el("a", { class: "chip-link", href: `#/${kind}/${id}` }, name(map[kind][id]))));
}

function stageItem(plan, stage, i, current) {
  const prog = stageProgress(plan, i);
  const state = i < current ? "past" : i === current ? "current" : "future";
  const part = (label, ids, kind) => ids && ids.length ? [el("p", { class: "stage-label" }, label), linkChips(ids, kind)] : null;
  return el("li", { class: `stage ${state}` },
    el("span", { class: "stage-dot", "aria-hidden": "true" }),
    el("div", { class: "stage-card" },
      el("p", { class: "eyebrow" }, stage.when, state === "current" && el("span", { class: "badge info-badge" }, "You are here")),
      el("h3", { class: "stage-title" }, stage.title),
      el("p", { class: "muted" }, `${plural(stage.days, "day")} a week`),
      el("p", {}, stage.focus),
      progressBar(prog.pct, `${stage.title} progress`),
      el("p", { class: "muted small" }, `${prog.done} of ${prog.target} sessions done`),
      part("Sessions", stage.sessions, "sessions"),
      part("Poses", stage.poses, "poses"),
      part("Breathing", stage.breaths, "breathe"),
      part("Read", stage.articles, "learn"),
      stage.milestone && el("p", { class: "milestone" }, icon("star", 16), stage.milestone)));
}

function journeySection(plan) {
  const current = currentStageIndex(plan);
  return el("section", { class: "plan-section" },
    el("h2", { class: "block-title" }, "Your journey"),
    el("ol", { class: "timeline" }, plan.journey.map((st, i) => stageItem(plan, st, i, current))));
}

function plannedBreathRow(id) {
  const b = BREATH_BY_ID[id];
  return row({ lead: tile(b.name[0], "var(--accent)"), title: b.name, sub: `${b.sk} · ${breathMeta(b)}`, href: `#/breathe/${b.id}` });
}

function planMain(plan) {
  return el("div", { class: "plan-main" },
    el("section", { class: "plan-section" }, el("h2", { class: "block-title" }, "Today's flow"), sessionTile(todaysFlow(), "feature"),
      el("p", { class: "muted small" }, "Made from your plan. It stays the same all day.")),
    journeySection(plan),
    el("section", { class: "plan-section" }, el("h2", { class: "block-title" }, "Your poses"),
      plan.poses.length ? el("div", { class: "grid grid-poses" }, plan.poses.map((id) => poseCard(POSE_BY_ID[id]))) : emptyState("No poses for now.", "Rest and breathing come first.")),
    el("section", { class: "plan-section" }, el("h2", { class: "block-title" }, "Your breathing"),
      plan.breaths.length ? group(plan.breaths.map(plannedBreathRow)) : emptyState("No breathing practices yet.", "Belly Breathing is safe for everyone.")),
    badgesSection(),
    historySection(),
    el("section", { class: "plan-section" }, el("h2", { class: "block-title" }, "Learn"),
      el("div", { class: "grid grid-articles" }, ARTICLES.slice(0, 3).map(articleCard)),
      el("a", { class: "pill pill-ghost", href: "#/learn" }, "All guides")));
}

function renderPlan() {
  const plan = readPlan();
  if (!plan) return planIntro();
  return el("div", { class: "page" },
    pageHead("My Plan", `${doshaName(plan)}.`, `Since ${parseIso(plan.created).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. ${plural(plan.poses.length, "pose")}. ${plural(plan.breaths.length, "breathing practice")}.`, settingsButton()),
    plan.health.restOnly && el("p", { class: "banner caution" }, icon("alert", 20), el("span", {}, el("strong", {}, "Rest and breathing only. "), "Get your doctor's clearance before doing poses. Then retake the quiz.")),
    el("div", { class: "plan-layout" }, planAside(plan), planMain(plan)));
}

/* Badges and history */

function badgeChip(b, date) {
  return el("li", { class: `badge-chip ${date ? "won" : "locked"}` },
    el("span", { class: "badge-icon", "aria-hidden": "true" }, icon("star", 22)),
    el("span", { class: "strong" }, b.name),
    el("span", { class: "muted small" }, date ? `Earned ${parseIso(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : b.text));
}

function badgesSection() {
  const store = readStore();
  const won = BADGES.filter((b) => store.badges[b.id]).length;
  return el("section", { class: "plan-section" },
    el("h2", { class: "block-title" }, "Badges"),
    el("p", { class: "muted" }, won ? `${won} of ${BADGES.length} earned.` : "No badges yet. Finish your first session to earn one."),
    el("ul", { class: "badge-row", role: "list" }, BADGES.map((b) => badgeChip(b, store.badges[b.id]))));
}

function historySection() {
  const items = readStore().history.slice(-15).reverse();
  const fmt = (d) => parseIso(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return el("section", { class: "plan-section" },
    el("h2", { class: "block-title" }, "History"),
    items.length
      ? group(items.map((h) => row({ lead: tile(h.title[0], h.kind === "breath" ? "var(--accent)" : "#8E8E93"), title: h.title, sub: `${fmt(h.date)} · ${h.done ? "Finished" : "Partly done"}`, detail: `${Math.max(1, Math.round(h.min))} min` })))
      : emptyState("Nothing here yet.", "Your sessions and breathing practices will show up here."));
}

function openCelebration(badges) {
  const sheet = openSheet(el("div", { class: "sheet-content celebrate" },
    el("span", { class: "celebrate-star", "aria-hidden": "true" }, icon("star", 48)),
    el("h2", { class: "sheet-title" }, badges.length > 1 ? "New badges" : "New badge"),
    badges.map((b) => el("p", {}, el("strong", {}, `${b.name}. `), b.text)),
    el("button", { type: "button", class: "pill wide", onclick: () => sheet.close() }, "Lovely")), { label: "New badge" });
}

/* Settings */

function openSettings() {
  const s = settings();
  const offline = "serviceWorker" in navigator && navigator.serviceWorker.controller;
  const sheet = openSheet(el("div", { class: "sheet-content" },
    el("h2", { class: "sheet-title" }, "Settings"),
    sectionTitle("Guidance"),
    group([
      canSpeak() && switchRow("Voice (Emma)", s.voice, (v) => updateSettings({ voice: v })),
      canSpeak() && selectRow("Voice speed", s.rate, [[0.8, "Slow"], [0.9, "Normal"], [1, "Brisk"]], (v) => updateSettings({ rate: Number(v) })),
      switchRow("Chime between steps", s.chime, (v) => updateSettings({ chime: v })),
      selectRow("Seconds per breath", s.breathSecs, [5, 6, 7, 8].map((n) => [n, `${n} seconds`]), (v) => { updateSettings({ breathSecs: Number(v) }); refreshView(); }),
    ].filter(Boolean)),
    sectionTitle("Goal"),
    group([selectRow("APM split of the goal", s.apmSplit.join("/"), [["70/15/15", "70 asana, 15 pranayama, 15 meditation"], ["60/20/20", "60, 20, 20"], ["50/25/25", "50, 25, 25"], ["40/30/30", "40, 30, 30"]], (v) => { updateSettings({ apmSplit: v.split("/").map(Number) }); refreshView(); }),
      selectRow("Weekly practice goal", s.weeklyGoal, [[0, "From my plan"], [30, "30 minutes"], [60, "60 minutes"], [90, "90 minutes"], [120, "120 minutes"], [180, "180 minutes"]], (v) => { updateSettings({ weeklyGoal: Number(v) }); refreshView(); })]),
    sectionTitle("Your data"),
    el("p", { class: "muted small" }, "Everything stays in this browser. Nothing is sent anywhere."),
    offline && el("p", { class: "muted small" }, "Available offline."),
    el("div", { class: "btn-row" },
      el("a", { class: "pill pill-ghost", href: "#/quiz", onclick: () => sheet.close(true) }, "Retake quiz"),
      el("a", { class: "pill pill-ghost", href: "#/welcome", onclick: () => sheet.close(true) }, "Show the welcome again"),
      el("button", { type: "button", class: "pill pill-danger", onclick: () => {
        if (!window.confirm("Reset all data? This removes your plan, history and badges from this browser.")) return;
        resetAll();
        sheet.close(true);
        replaceRoute("today");
        showToast("All data has been reset.");
      } }, "Reset all data"))), { label: "Settings" });
}
