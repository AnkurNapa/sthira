// Sthira Create page: the flow generator, the sequence builder and My flows.
"use strict";

const FLOW_LENGTHS = [10, 20, 30, 45, 60];
const BUILDER_BREATHS = { min: 1, max: 40, start: 5 };
const SAVASANA_BREATHS = 30;

let genState = { minutes: 20, level: 1, focus: "balanced", apm: "balanced", seed: "", flow: null };

function planLevel() {
  const plan = readPlan();
  return plan ? plan.lvl : 3;
}

function profileLine(plan) {
  return plan ? `Built for your ${doshaName(plan)} profile. Unsafe poses for you are left out.` : "A balanced flow built just now.";
}

function generate(newSeed) {
  const plan = readPlan();
  const level = Math.min(genState.level, planLevel());
  const seed = newSeed ? `${Date.now()}` : genState.seed || `${isoDate(new Date())}${genState.focus}${genState.minutes}${level}${genState.apm}`;
  const flow = generateFlow({ minutes: genState.minutes, level, focus: genState.focus, apm: genState.apm, plan, seed, breathSecs: settings().breathSecs });
  const named = { ...flow, about: profileLine(plan) };
  genState = { ...genState, level, seed, flow: rememberFlow(named) };
  return genState.flow;
}

/* Generator */

function flowPreview(flow) {
  const ctx = planContext();
  const flat = flattenSession(flow, ctx);
  const card = el("div", { class: "flow-preview" },
    el("div", { class: "session-hero" },
      el("div", {},
        el("p", { class: "session-tile-meta" }, `${LEVELS[flow.lvl]} · ${fmtMinutes(flat.secs)} · ${plural(flat.steps.length, "step")}`),
        el("h3", { class: "sheet-title" }, flow.name),
        el("p", {}, flow.about)),
      sessionHeart(flow)),
    apmBar(apmSplit(flat.steps, flow.id)),
    el("div", { class: "btn-row" },
      el("button", { type: "button", class: "pill", onclick: (e) => startSession(flow, 0, e.currentTarget) }, "Start"),
      el("button", { type: "button", class: "pill pill-ghost", onclick: () => { generate(true); paintCreate(); } }, "Shuffle"),
      el("button", { type: "button", class: "pill pill-ghost", onclick: () => openBuilder(flowForEditing(flow)) }, "Edit as my own")),
    phaseList(flow, ctx));
  card.querySelector(".session-hero").style.setProperty("--c", flow.color);
  return card;
}

function generatorPanel() {
  const cap = planLevel();
  const levels = [1, 2, 3].map((n) => [n, LEVELS[n]]);
  const levelChips = chipRow("Level", levels, Math.min(genState.level, cap), (v) => { genState = { ...genState, level: Number(v), seed: "" }; });
  levelChips.querySelectorAll(".chip").forEach((c) => { if (Number(c.dataset.v) > cap) c.disabled = true; });
  return el("section", { class: "create-panel" },
    el("h2", { class: "block-title" }, "Create a flow"),
    el("p", { class: "muted" }, "Choose a length, a level and a focus. Sthira puts the poses in a safe order."),
    sectionTitle("Length"),
    chipRow("Length", FLOW_LENGTHS.map((m) => [m, `${m} min`]), genState.minutes, (v) => { genState = { ...genState, minutes: Number(v), seed: "" }; }),
    sectionTitle("Level"),
    levelChips,
    cap < 3 && el("p", { class: "note" }, `Your plan caps the level at ${LEVELS[cap]} for now.`),
    sectionTitle("APM balance"),
    chipRow("APM balance", Object.entries(APM).map(([k, a]) => [k, a.name]), genState.apm, (v) => { genState = { ...genState, apm: v, seed: "" }; }),
    el("p", { class: "apm-note" }, "Every flow runs asana, then pranayama, then meditation. Choose how the time is shared."),
    sectionTitle("Focus"),
    chipRow("Focus", Object.entries(FOCUS).map(([k, f]) => [k, f.name]), genState.focus, (v) => { genState = { ...genState, focus: v, seed: "" }; }),
    el("div", { class: "btn-row" }, el("button", { type: "button", class: "pill", onclick: () => { generate(false); paintCreate(); } }, genState.flow ? "Generate again" : "Generate")));
}

/* My flows */

function flowForEditing(flow) {
  const steps = flow.steps.filter((st) => st && st.p).map((st) => ({ p: st.p, b: st.b }));
  return { id: flow.custom ? flow.id : "", name: flow.custom ? flow.name : `My ${flow.name.toLowerCase()}`, steps };
}

function myFlowCard(flow) {
  const flat = flattenSession(flow, planContext());
  const poses = flow.steps.filter((st) => st.p).length;
  return el("article", { class: "my-flow" },
    el("a", { class: "my-flow-main", href: `#/sessions/${flow.id}` },
      el("span", { class: "my-flow-name" }, flow.name),
      el("span", { class: "muted" }, `${plural(poses, "pose")} · ${fmtMinutes(flat.secs)}`)),
    el("div", { class: "my-flow-actions" },
      el("button", { type: "button", class: "pill small", onclick: (e) => startSession(flow, 0, e.currentTarget), disabled: sessionOffered(flow, planContext()) ? null : true }, "Start"),
      el("button", { type: "button", class: "pill small pill-ghost", onclick: () => openBuilder(flowForEditing(flow)) }, "Edit"),
      el("button", { type: "button", class: "pill small pill-ghost", onclick: () => { duplicateFlow(flow.id); paintCreate(); showToast("Flow copied."); } }, "Duplicate"),
      el("button", { type: "button", class: "pill small pill-ghost", onclick: () => {
        if (!window.confirm(`Delete ${flow.name}? This cannot be undone.`)) return;
        deleteFlow(flow.id);
        paintCreate();
      } }, "Delete")));
}

function myFlowsSection() {
  const flows = readFlows();
  return el("section", { class: "plan-section" },
    el("div", { class: "section-head" },
      el("h2", { class: "block-title" }, "My flows"),
      el("button", { type: "button", class: "pill", onclick: () => openBuilder({ id: "", name: "", steps: [] }) }, "Build your own")),
    flows.length
      ? el("div", { class: "my-flows" }, flows.map(myFlowCard))
      : emptyState("No flows yet.", "Build your own sequence from the pose library. Or generate one above and tap the heart to keep it."));
}

/* Page */

let createRoot = null;

function paintCreate() {
  if (!createRoot) return;
  createRoot.replaceChildren(
    el("div", { class: "create-grid" }, generatorPanel(), el("div", { class: "create-result" }, genState.flow ? flowPreview(genState.flow) : todayFlowTeaser())),
    myFlowsSection());
}

function todayFlowTeaser() {
  const flow = todaysFlow();
  return el("div", { class: "today-flow" },
    el("p", { class: "eyebrow" }, "Today's flow"),
    sessionTile(flow, "feature"),
    el("p", { class: "muted small" }, "It stays the same all day. Come back tomorrow for a new one."));
}

function renderCreate() {
  createRoot = el("div", {});
  const page = el("div", { class: "page" },
    pageHead("Create", "Make it yours.", "Generate a flow in seconds. Or build your own sequence pose by pose."),
    createRoot);
  paintCreate();
  return page;
}

/* Builder */

function stepper(value, onChange, label) {
  const out = el("span", { class: "stepper-value", "aria-live": "polite" }, String(value));
  const set = (v) => {
    const next = clamp(v, BUILDER_BREATHS.min, BUILDER_BREATHS.max);
    out.textContent = String(next);
    onChange(next);
  };
  let current = value;
  return el("span", { class: "stepper", role: "group", "aria-label": label },
    el("button", { type: "button", class: "step-btn", "aria-label": `Fewer breaths for ${label}`, onclick: () => { current = clamp(current - 1, BUILDER_BREATHS.min, BUILDER_BREATHS.max); set(current); } }, "−"),
    out,
    el("button", { type: "button", class: "step-btn", "aria-label": `More breaths for ${label}`, onclick: () => { current = clamp(current + 1, BUILDER_BREATHS.min, BUILDER_BREATHS.max); set(current); } }, "+"));
}

function openBuilder(initial) {
  let draft = { id: initial.id, name: initial.name, steps: initial.steps.map((st) => ({ ...st })) };
  let lib = { q: "", cat: "all" };
  const listEl = el("ol", { class: "builder-list" });
  const libEl = el("div", { class: "builder-lib-results" });
  const nameInput = el("input", { type: "text", class: "text-input", value: draft.name, placeholder: "Name your flow", "aria-label": "Flow name", maxlength: "60" });
  nameInput.addEventListener("input", () => { draft = { ...draft, name: nameInput.value }; });
  const summary = el("p", { class: "muted", "aria-live": "polite" });

  const setSteps = (steps) => {
    draft = { ...draft, steps };
    paintList();
  };

  function builderRow(st, i) {
    const pose = POSE_BY_ID[st.p];
    const reason = planContext().avoid.has(pose.id) ? avoidReason(pose.id, "pose") : "";
    const move = (to) => {
      const steps = [...draft.steps];
      [steps[i], steps[to]] = [steps[to], steps[i]];
      setSteps(steps);
      listEl.querySelectorAll(".builder-item")[to].querySelector(i < to ? ".move-down" : ".move-up").focus();
    };
    return el("li", { class: "builder-item" },
      el("div", { class: "builder-main" },
        poseArt(pose.id),
        el("span", { class: "builder-text" }, el("span", { class: "row-title" }, pose.en), el("span", { class: "row-sub" }, `${pose.sk}${pose.sided ? " · each side" : ""}`)),
        stepper(st.b, (b) => { draft = { ...draft, steps: draft.steps.map((x, j) => (j === i ? { ...x, b } : x)) }; paintSummary(); }, pose.en)),
      reason && el("p", { class: "note caution-note" }, icon("alert", 16), `Not in your plan because of: ${reason}. It will be left out when you practise.`),
      el("div", { class: "builder-actions" },
        el("button", { type: "button", class: "pill small pill-ghost move-up", disabled: i === 0 ? true : null, "aria-label": `Move ${pose.en} up`, onclick: () => move(i - 1) }, "Up"),
        el("button", { type: "button", class: "pill small pill-ghost move-down", disabled: i === draft.steps.length - 1 ? true : null, "aria-label": `Move ${pose.en} down`, onclick: () => move(i + 1) }, "Down"),
        el("button", { type: "button", class: "pill small pill-ghost", "aria-label": `Remove ${pose.en}`, onclick: () => setSteps(draft.steps.filter((_, j) => j !== i)) }, "Remove")));
  }

  function paintSummary() {
    const secs = sessionSecs({ steps: draft.steps }, settings().breathSecs);
    summary.textContent = draft.steps.length ? `${plural(draft.steps.length, "pose")} · about ${fmtMinutes(secs)}` : "No poses yet. Add some from the library below.";
  }

  function paintList() {
    listEl.replaceChildren(...draft.steps.map(builderRow));
    const last = draft.steps[draft.steps.length - 1];
    if (draft.steps.length && (!last || last.p !== "savasana")) {
      listEl.append(el("li", { class: "note caution-note savasana-offer" }, "A flow should end with relaxation.",
        el("button", { type: "button", class: "pill small", onclick: () => setSteps([...draft.steps, { p: "savasana", b: SAVASANA_BREATHS }]) }, "Add Savasana")));
    }
    paintSummary();
  }

  function paintLib() {
    const q = lib.q.trim().toLowerCase();
    const list = POSES.filter((p) => (lib.cat === "all" || p.cat === lib.cat) && (!q || p.sk.toLowerCase().includes(q) || p.en.toLowerCase().includes(q)));
    libEl.replaceChildren(list.length
      ? group(list.map((p) => row({
        lead: poseArt(p.id), title: p.en, sub: `${p.sk} · ${LEVELS[p.lvl]}`,
        badge: planContext().avoid.has(p.id) ? cautionBadge() : null,
        detail: "Add",
        onClick: () => { setSteps([...draft.steps, { p: p.id, b: BUILDER_BREATHS.start }]); showToast(`${p.en} added.`); },
      })))
      : emptyState("No poses match.", "Try another word or category."));
  }

  const search = el("input", { type: "search", class: "search", placeholder: "Search poses", "aria-label": "Search the pose library" });
  search.addEventListener("input", () => { lib = { ...lib, q: search.value }; paintLib(); });

  function save() {
    const name = draft.name.trim() || "My flow";
    if (!draft.steps.length) {
      showToast("Add at least one pose first.");
      return;
    }
    const maxLvl = Math.max(...draft.steps.map((st) => POSE_BY_ID[st.p].lvl));
    const saved = saveFlow({ id: draft.id, name, lvl: maxLvl, color: "#E8743B", focus: "My own sequence", about: "A sequence you built yourself.", steps: ["Sequence", ...draft.steps] });
    if (!saved) return;
    sheet.close(true);
    refreshView();
    showToast(`${saved.name} saved.`);
  }

  const sheet = openSheet(el("div", { class: "sheet-content builder" },
    el("h2", { class: "sheet-title" }, draft.id ? "Edit flow" : "Build your own"),
    el("label", { class: "field" }, el("span", { class: "section-title" }, "Name"), nameInput),
    sectionTitle("Your sequence"),
    summary,
    listEl,
    el("div", { class: "btn-row" }, el("button", { type: "button", class: "pill", onclick: save }, "Save flow")),
    sectionTitle("Add poses"),
    el("label", { class: "search-wrap" }, icon("search", 18), search),
    chipRow("Category", [["all", "All"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.name])], "all", (v) => { lib = { ...lib, cat: v }; paintLib(); }),
    libEl), { label: draft.id ? "Edit flow" : "Build your own" });
  paintList();
  paintLib();
}
