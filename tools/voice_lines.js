// Prints every sentence the site can speak, as JSON, for tools/voice_build.py.
// Usage: node tools/voice_lines.js > lines.json
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = {};
vm.createContext(ctx);
["data.js", "plan.js", "generator.js", "align.js"].forEach((f) => {
  // Top level const names are not globals in a vm context, so expose them.
  const src = fs.readFileSync(path.join(root, f), "utf8");
  vm.runInContext(src + "\n;globalThis.__x = { POSES, SURYA, SESSIONS, BREATHS, MEDITATIONS, ALIGN: typeof ALIGN === \"undefined\" ? {} : ALIGN, SURYA_ALIGN: typeof SURYA_ALIGN === \"undefined\" ? [] : SURYA_ALIGN };", ctx);
});
const { POSES, SURYA, SESSIONS, BREATHS, MEDITATIONS, ALIGN, SURYA_ALIGN } = ctx.__x;

const SIDE_SWAP = { right: "left", left: "right", Right: "Left", Left: "Right" };
const swapSides = (t) => t.replace(/\b(right|left|Right|Left)\b/g, (m) => SIDE_SWAP[m]);
const texts = new Set();
const add = (t) => t && texts.add(String(t));

POSES.forEach((p) => {
  add(p.en);
  const cue = p.steps.join(" ");
  add(cue);
  if (p.sided) add(swapSides(cue));
});
add("Right side. Left side.");
SURYA.forEach(([, en, cue]) => { add(en); add(cue); });
add("Round 2.");
for (let n = 3; n <= 30; n += 1) add(`Rounds 2 to ${n}.`);
add("Continue at your own breath pace. Lead with the left leg in round 2. Then alternate the leading leg each round.");
SESSIONS.forEach((s) => s.steps.forEach((st) => { if (st.t) { add(st.t); add(st.say); } }));
BREATHS.forEach((b) => {
  add(b.name);
  add(b.how.join(" "));
  b.pattern.forEach(([label]) => add(label));
});
add("Gentle rest. Belly Breathing.");
MEDITATIONS.forEach((m) => { add(m.t); add(m.say); });
POSES.forEach((p) => (ALIGN[p.id] || []).forEach((c) => { add(c); if (p.sided) add(swapSides(c)); }));
SURYA_ALIGN.forEach((cues) => cues.forEach(add));
add("Well done. Your session is complete.");

// Split exactly like voice.js does.
const sentences = new Set();
texts.forEach((t) => t.split(/(?<=[.!?])\s+/).forEach((s) => s.trim() && sentences.add(s.trim())));
process.stdout.write(JSON.stringify([...sentences], null, 0));
