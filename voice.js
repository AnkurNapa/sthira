// Emma voice playback. Plays pre-recorded sentence clips from voice/ in order.
// Load after voice/clips.js. emmaSpeak returns false when any sentence has no clip,
// so the caller can fall back to the browser voice.
"use strict";

const emma = { audio: null, queue: [], token: 0 };

function clipKey(sentence) {
  const s = sentence.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function emmaSentences(text) {
  return String(text).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

/** Call once inside a tap so mobile browsers allow later playback. */
function emmaUnlock() {
  if (!emma.audio) emma.audio = new Audio();
  emma.audio.muted = true;
  const first = typeof EMMA_CLIPS !== "undefined" && EMMA_CLIPS.values().next().value;
  if (!first) return;
  emma.audio.src = "voice/" + first + ".mp3";
  const p = emma.audio.play();
  if (p && p.then) p.then(() => emma.audio.pause()).catch(() => {});
}

function emmaStop() {
  emma.token += 1;
  emma.queue = [];
  if (emma.audio) {
    emma.audio.pause();
    emma.audio.removeAttribute("src");
  }
}

/** Speak text in the Emma voice. Returns false if it cannot, true if playback started. */
function emmaSpeak(text, rate = 1) {
  if (typeof EMMA_CLIPS === "undefined") return false;
  const keys = emmaSentences(text).map(clipKey);
  if (!keys.length || !keys.every((k) => EMMA_CLIPS.has(k))) return false;
  emmaStop();
  if (!emma.audio) emma.audio = new Audio();
  const token = emma.token;
  emma.queue = keys;
  const next = () => {
    if (token !== emma.token || !emma.queue.length) return;
    const k = emma.queue.shift();
    emma.audio.muted = false;
    emma.audio.src = "voice/" + k + ".mp3";
    emma.audio.playbackRate = rate;
    emma.audio.onended = () => setTimeout(next, 180);
    const p = emma.audio.play();
    if (p && p.catch) p.catch(() => {});
  };
  next();
  return true;
}
