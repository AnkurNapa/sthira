// Sthira players: the guided session player and the breath pacer.
// Timers read the clock instead of counting ticks, so they stay right when the tab sleeps.
"use strict";

const TICK_MS = 250;
const MAX_TICK_MS = 2000;
const TAP_GUARD_MS = 400;
const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;

/* Voice */

const voice = { synth: "speechSynthesis" in window ? window.speechSynthesis : null, pick: null };

function chooseVoice() {
  if (!voice.synth) return;
  const voices = voice.synth.getVoices();
  const lang = (v) => v.lang.replace("_", "-");
  voice.pick = voices.find((v) => lang(v) === "en-GB") || voices.find((v) => lang(v) === "en-IN") || voices.find((v) => /^en/.test(lang(v))) || null;
}

if (voice.synth) {
  chooseVoice();
  voice.synth.addEventListener("voiceschanged", chooseVoice);
}

const hasEmma = () => typeof emmaSpeak === "function" && typeof EMMA_CLIPS !== "undefined";
const canSpeak = () => Boolean(voice.synth) || hasEmma();
// Emma clips are recorded at natural pace. The Normal setting (0.9) plays them at 1x.
const EMMA_RATE_BASE = 0.9;

/** Speak in the Emma voice when a clip exists for every sentence, else in the browser voice. */
function speak(text) {
  if (!settings().voice) return;
  if (hasEmma() && emmaSpeak(text, settings().rate / EMMA_RATE_BASE)) {
    if (voice.synth) voice.synth.cancel();
    return;
  }
  if (!voice.synth) return;
  if (typeof emmaStop === "function") emmaStop();
  voice.synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = settings().rate;
  u.lang = voice.pick ? voice.pick.lang : "en-GB";
  if (voice.pick) u.voice = voice.pick;
  voice.synth.speak(u);
}

function stopSpeech() {
  if (voice.synth) voice.synth.cancel();
  if (typeof emmaStop === "function") emmaStop();
}

/** Audio needs a tap before it may play on phones. Call inside the Start tap. */
function unlockVoice() {
  if (typeof emmaUnlock === "function") emmaUnlock();
}

/* Chime. The audio context is only created or resumed inside a tap. */

let audioCtx = null;

function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx && Ctx) audioCtx = new Ctx();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {
    audioCtx = null;
  }
}

function chime() {
  if (!audioCtx || audioCtx.state !== "running" || !settings().chime) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = 660;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 1);
}

/* Wake lock */

const wake = { lock: null, wanted: false };

async function keepAwake() {
  wake.wanted = true;
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try {
    wake.lock = await navigator.wakeLock.request("screen");
  } catch (e) {
    wake.lock = null;
  }
}

function releaseAwake() {
  wake.wanted = false;
  if (wake.lock) wake.lock.release().catch(() => {});
  wake.lock = null;
}

/* A clock based countdown shared by both players. */

function makeCountdown({ onTick, onEnd }) {
  let endAt = 0;
  let remainingMs = 0;
  let lastTick = 0;
  let timer = null;
  const api = {
    playedMs: 0,
    get running() { return timer !== null; },
    get remaining() { return timer ? Math.max(0, endAt - Date.now()) : remainingMs; },
    set(secs) { remainingMs = secs * 1000; endAt = Date.now() + remainingMs; },
    start() {
      if (timer) return;
      endAt = Date.now() + remainingMs;
      lastTick = Date.now();
      timer = setInterval(tick, TICK_MS);
    },
    stop() {
      if (!timer) return;
      remainingMs = api.remaining;
      clearInterval(timer);
      timer = null;
    },
  };
  function tick() {
    const now = Date.now();
    api.playedMs += Math.min(MAX_TICK_MS, now - lastTick);
    lastTick = now;
    if (endAt - now <= 0) onEnd();
    else onTick(endAt - now);
  }
  return api;
}

/* Visibility: pause while hidden, offer to carry on when back. */

const visibilityHooks = new Set();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && wake.wanted) keepAwake();
  visibilityHooks.forEach((fn) => fn(document.visibilityState));
});

function fmtClock(ms) {
  const secs = Math.ceil(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

function ctlButton(name, label, onClick, cls = "") {
  return el("button", { type: "button", class: `ctl ${cls}`.trim(), "aria-label": label, onclick: onClick }, icon(name, cls.includes("main") ? 34 : 26));
}

function voiceToggle(onChange) {
  if (!canSpeak()) return null;
  const btn = el("button", { type: "button", class: "ctl small", "aria-pressed": String(settings().voice), "aria-label": "Voice guidance" });
  const paint = () => {
    btn.replaceChildren(icon(settings().voice ? "sound" : "mute", 22));
    btn.setAttribute("aria-pressed", String(settings().voice));
  };
  btn.addEventListener("click", () => {
    updateSettings({ voice: !settings().voice });
    if (!settings().voice) stopSpeech();
    paint();
    if (onChange) onChange(settings().voice);
  });
  paint();
  return btn;
}

function ringSvg() {
  const svg = svgEl("svg", { viewBox: "0 0 120 120", class: "ring", "aria-hidden": "true" });
  svg.append(svgEl("circle", { cx: 60, cy: 60, r: RING_R, class: "ring-track" }));
  const fg = svgEl("circle", { cx: 60, cy: 60, r: RING_R, class: "ring-fg", "stroke-dasharray": RING_C, transform: "rotate(-90 60 60)" });
  svg.append(fg);
  return { svg, fg };
}

/* Session player */

let playerOpen = false;

function buildPlayerUI() {
  const ring = ringSvg();
  const ui = {
    phase: el("p", { class: "player-phase" }),
    title: el("h2", { class: "player-title" }),
    sub: el("p", { class: "player-sub" }),
    clock: el("span", { class: "player-clock" }),
    cue: el("p", { class: "player-cue" }),
    next: el("p", { class: "player-next" }),
    notice: el("p", { class: "player-notice", role: "status" }),
    art: el("div", { class: "player-art" }),
    bar: el("span", { class: "progress-fill" }),
    progress: el("div", { class: "progress", role: "progressbar", "aria-label": "Session progress", "aria-valuemin": "0", "aria-valuemax": "100" }),
    ringFg: ring.fg,
  };
  ui.progress.append(ui.bar);
  ui.live = el("div", { class: "player-live", "aria-live": "polite" }, ui.title, ui.sub);
  ui.visual = el("div", { class: "player-visual" }, ui.art, el("div", { class: "ring-wrap" }, ring.svg, ui.clock));
  ui.stage = el("div", { class: "player-main" },
    ui.visual,
    el("div", { class: "player-text" }, ui.phase, ui.live, ui.cue, ui.next, ui.notice));
  return ui;
}

function startSession(session, startIdx = 0, trigger) {
  if (playerOpen) return;
  const ctx = planContext();
  if (!sessionOffered(session, ctx)) return;
  const flat = flattenSession(session, ctx);
  if (trigger) trigger.disabled = true;
  setTimeout(() => { if (trigger) trigger.disabled = false; }, TAP_GUARD_MS * 2);
  playerOpen = true;
  unlockAudio();
  unlockVoice();
  keepAwake();
  runPlayer(session, flat.steps, Math.min(startIdx, flat.steps.length - 1));
}

function runPlayer(session, steps, startIdx) {
  const ui = buildPlayerUI();
  const dateKey = isoDate(new Date());
  const totalSecs = steps.reduce((a, s) => a + s.secs, 0);
  const before = steps.map((_, i) => steps.slice(0, i).reduce((a, s) => a + s.secs, 0));
  let idx = startIdx;
  let finished = false;
  let earned = [];
  let lastJump = 0;
  const clock = makeCountdown({ onTick: paintTime, onEnd: () => go(idx + 1) });

  const playBtn = ctlButton("pause", "Pause", togglePlay, "main");
  const backBtn = ctlButton("prev", "Previous step", () => jump(idx - 1));
  const skipBtn = ctlButton("skip", "Next step", () => jump(idx + 1));
  const closeBtn = ctlButton("close", "Close session", () => sheet.close(), "small");
  const controls = el("div", { class: "player-controls" }, backBtn, playBtn, skipBtn);
  const view = el("div", { class: "player" },
    el("div", { class: "player-top" }, closeBtn, el("p", { class: "player-name" }, session.name), voiceToggle((on) => { if (on) speakStep(); })),
    ui.stage,
    el("div", { class: "player-bottom" }, ui.progress, controls));

  function speakStep() {
    const s = steps[idx];
    speak([s.title, s.side, s.text].filter(Boolean).join(". "));
  }

  function paintStep() {
    const s = steps[idx];
    const next = steps[idx + 1];
    const art = s.art ? poseArt(s.art, { size: "player", figureOnly: true }) : null;
    ui.art.replaceChildren(art || "");
    ui.visual.classList.toggle("has-art", Boolean(art));
    ui.phase.textContent = s.phase;
    ui.title.textContent = s.title;
    ui.sub.textContent = s.subtitle;
    ui.cue.textContent = s.text;
    ui.next.textContent = next ? `Next: ${next.title}${next.side ? `, ${next.side.toLowerCase()}` : ""}` : "Next: rest and finish";
    backBtn.disabled = idx === 0;
  }

  function paintTime(ms = clock.remaining) {
    const s = steps[idx];
    ui.clock.textContent = fmtClock(ms);
    ui.ringFg.style.strokeDashoffset = String(RING_C * (1 - ms / (s.secs * 1000)));
    const pct = Math.round(((before[idx] + s.secs - ms / 1000) / totalSecs) * 100);
    ui.bar.style.width = `${pct}%`;
    ui.progress.setAttribute("aria-valuenow", String(pct));
  }

  function go(n) {
    if (finished) return;
    if (n >= steps.length) {
      finish();
      return;
    }
    idx = Math.max(0, n);
    clock.set(steps[idx].secs);
    ui.notice.textContent = "";
    paintStep();
    paintTime();
    chime();
    speakStep();
  }

  function jump(n) {
    const now = Date.now();
    if (now - lastJump < TAP_GUARD_MS || n < 0) return;
    lastJump = now;
    go(n);
  }

  function setPlaying(on) {
    if (on) clock.start();
    else clock.stop();
    playBtn.replaceChildren(icon(on ? "pause" : "play", 34));
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
  }

  function togglePlay() {
    unlockAudio();
    const on = !clock.running;
    setPlaying(on);
    if (on) {
      ui.notice.textContent = "";
      speakStep();
    } else {
      stopSpeech();
    }
  }

  function onVisibility(state) {
    if (state === "hidden" && clock.running) {
      setPlaying(false);
      stopSpeech();
      ui.notice.textContent = "Paused while you were away. Press play to carry on.";
    }
  }

  function finish() {
    finished = true;
    clock.stop();
    stopSpeech();
    recordSession({ session, minutes: clock.playedMs / 60000, completed: true, dateKey });
    clearResume();
    view.replaceChildren(completionView(session, clock.playedMs, () => sheet.close()));
    chime();
    speak("Well done. Your session is complete.");
    earned = afterPractice();
  }

  function beforeClose() {
    if (finished) return true;
    if (idx > 1 && !window.confirm("End this session? We will keep the time you have practised so far.")) return false;
    return true;
  }

  function cleanup() {
    clock.stop();
    stopSpeech();
    releaseAwake();
    visibilityHooks.delete(onVisibility);
    playerOpen = false;
    if (!finished) {
      if (idx > 0) saveResume(session.id, idx);
      recordSession({ session, minutes: clock.playedMs / 60000, completed: false, dateKey });
      earned = afterPractice();
    }
    celebrateLater(earned);
  }

  const sheet = openSheet(view, { label: `${session.name} player`, full: true, dark: true, bare: true, beforeClose, onClose: cleanup });
  visibilityHooks.add(onVisibility);
  go(idx);
  setPlaying(true);
}

function completionView(session, playedMs, onDone) {
  const mins = Math.round(playedMs / 60000);
  const store = readStore();
  const streak = streakDays(store.log);
  return el("div", { class: "done-view" },
    el("span", { class: "done-check" }, icon("check", 44)),
    el("h2", { class: "player-title", tabindex: "-1" }, "Well done"),
    el("p", { class: "player-sub" }, mins ? `You practised ${session.name} for ${plural(mins, "minute")}.` : `You finished ${session.name} in under a minute.`),
    el("div", { class: "done-stats" },
      el("span", {}, el("strong", {}, String(streak)), streak === 1 ? " day streak" : " day streak"),
      el("span", {}, el("strong", {}, String(store.sessions)), store.sessions === 1 ? " session in all" : " sessions in all")),
    el("button", { type: "button", class: "pill", onclick: onDone }, "Done"));
}

/** Refresh the page and return any badges just earned. */
function afterPractice() {
  refreshView();
  return checkBadges();
}

/** Celebrate once the player has closed, so the dialog never sits on top of it. */
function celebrateLater(badges) {
  if (badges.length) setTimeout(() => openCelebration(badges), reducedMotion.matches ? 0 : SHEET_MS);
}

/* Breath pacer */

const SCALE_IN = 1;
const SCALE_OUT = 0.5;
const PULSE_SCALE = 0.75;

function phaseMotion(breath, label, i) {
  if (breath.id === "kapalabhati") return i === 0 ? "pulse" : "hold";
  if (/\bin\b/i.test(label)) return "in";
  if (/\bout\b/i.test(label)) return "out";
  return "hold";
}

function makeCircle() {
  const core = el("span", { class: "pacer-core" });
  const circle = el("span", { class: "pacer-circle" }, core);
  let target = SCALE_OUT;
  const set = (scale, secs) => {
    target = scale;
    void circle.offsetWidth;
    circle.style.transition = secs ? `transform ${secs}s ease-in-out` : "none";
    circle.style.transform = `scale(${scale})`;
  };
  const freeze = () => {
    const t = getComputedStyle(circle).transform;
    if (!t || t === "none") return;
    circle.style.transition = "none";
    circle.style.transform = `scale(${new DOMMatrixReadOnly(t).a})`;
  };
  set(SCALE_OUT, 0);
  return { circle, core, set, freeze, resume: (secs) => set(target, secs) };
}

function openPacer(breath, rounds) {
  if (playerOpen) return;
  playerOpen = true;
  unlockAudio();
  unlockVoice();
  keepAwake();
  const ctx = planContext();
  const pattern = breathPattern(breath, ctx.noHolds);
  const dateKey = isoDate(new Date());
  const shape = makeCircle();
  const label = el("p", { class: "pacer-label", "aria-live": "polite" });
  const count = el("p", { class: "pacer-count", "aria-hidden": "true" });
  const left = el("p", { class: "player-sub" });
  const notice = el("p", { class: "player-notice", role: "status" });
  let round = 1;
  let pi = 0;
  let finished = false;
  let earned = [];
  const clock = makeCountdown({ onTick: (ms) => { count.textContent = String(Math.ceil(ms / 1000)); }, onEnd: advance });
  const playBtn = ctlButton("pause", "Pause", togglePlay, "main");
  const controls = el("div", { class: "player-controls" }, playBtn);

  function startPhase() {
    const [text, secs] = pattern[pi];
    const motion = phaseMotion(breath, text, pi);
    clock.set(secs);
    label.textContent = text;
    count.textContent = String(secs);
    const remainingRounds = rounds - round + 1;
    left.textContent = `${plural(remainingRounds, "round")} left`;
    shape.core.classList.toggle("pulse", motion === "pulse");
    if (motion === "in") shape.set(SCALE_IN, secs);
    else if (motion === "out") shape.set(SCALE_OUT, secs);
    else if (motion === "pulse") shape.set(PULSE_SCALE, 0.6);
    speak(text);
  }

  function advance() {
    pi += 1;
    if (pi >= pattern.length) {
      pi = 0;
      round += 1;
      if (round > rounds) {
        finish();
        return;
      }
    }
    startPhase();
  }

  function setPlaying(on) {
    if (on) {
      clock.start();
      shape.resume(clock.remaining / 1000);
    } else {
      clock.stop();
      shape.freeze();
    }
    shape.core.classList.toggle("paused", !on);
    playBtn.replaceChildren(icon(on ? "pause" : "play", 34));
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
  }

  function togglePlay() {
    unlockAudio();
    setPlaying(!clock.running);
    if (clock.running) notice.textContent = "";
    else stopSpeech();
  }

  function onVisibility(state) {
    if (state === "hidden" && clock.running) {
      setPlaying(false);
      stopSpeech();
      notice.textContent = "Paused while you were away. Press play to carry on.";
    }
  }

  function save() {
    recordBreath({ breath, minutes: clock.playedMs / 60000, dateKey });
    clock.playedMs = 0;
  }

  function finish() {
    finished = true;
    clock.stop();
    shape.core.classList.remove("pulse");
    label.textContent = "Well done";
    count.textContent = "";
    left.textContent = `${breath.name} complete.`;
    controls.replaceChildren(el("button", { type: "button", class: "pill", onclick: () => sheet.close() }, "Done"));
    save();
    speak("Well done.");
    chime();
    earned = afterPractice();
  }

  function cleanup() {
    clock.stop();
    stopSpeech();
    releaseAwake();
    visibilityHooks.delete(onVisibility);
    playerOpen = false;
    if (!finished) {
      save();
      earned = afterPractice();
    }
    celebrateLater(earned);
  }

  const holdsNote = ctx.noHolds && pattern.length < breath.pattern.length ? el("p", { class: "player-sub" }, "Holds left out for your safety.") : null;
  const view = el("div", { class: "player pacer" },
    el("div", { class: "player-top" }, ctlButton("close", "Close breathing", () => sheet.close(), "small"), el("p", { class: "player-name" }, breath.name), voiceToggle()),
    el("div", { class: "player-main pacer-main" },
      el("div", { class: "pacer-stage" }, shape.circle, el("div", { class: "pacer-text" }, label, count)),
      el("div", { class: "player-text" }, left, holdsNote, notice)),
    el("div", { class: "player-bottom" }, controls));
  const sheet = openSheet(view, { label: `${breath.name} pacer`, full: true, dark: true, bare: true, onClose: cleanup });
  visibilityHooks.add(onVisibility);
  startPhase();
  setPlaying(true);
}
