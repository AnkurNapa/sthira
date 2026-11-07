// Sthira background music. Tracks come from audio/manifest.json and loop seamlessly through WebAudio.
// Music fades in and out over two seconds and ducks while the voice speaks.
"use strict";

const MUSIC_FADE_S = 2;
const MUSIC_DUCK = 0.3;
const MUSIC_DUCK_S = 0.3;
const MUSIC_DEFAULT_TRACKS = ["bowls", "ambient"];

const music = { tracks: null, buffers: new Map(), source: null, gain: null, on: false, ducked: false, loading: null };

/** The track list from the manifest. Loaded once, only when music is first wanted. */
async function musicTracks() {
  if (music.tracks) return music.tracks;
  try {
    const res = await fetch("audio/manifest.json");
    const list = res.ok ? await res.json() : [];
    const valid = Array.isArray(list) ? list.filter((t) => t && typeof t.id === "string" && t.files) : [];
    // The default track first, Om second, then the rest in manifest order.
    const rank = (t) => (t.default ? 0 : t.id === "om" ? 1 : 2);
    music.tracks = valid.map((t, i) => ({ t, i })).sort((x, y) => rank(x.t) - rank(y.t) || x.i - y.i).map((x) => x.t);
  } catch (e) {
    music.tracks = [];
  }
  return music.tracks;
}

function musicTrack(tracks) {
  const wanted = settings().musicTrack;
  return tracks.find((t) => t.id === wanted)
    || tracks.find((t) => t.default)
    || MUSIC_DEFAULT_TRACKS.map((id) => tracks.find((t) => t.id === id)).find(Boolean)
    || tracks[0] || null;
}

function musicFile(track) {
  const probe = document.createElement("audio");
  const mp4 = probe.canPlayType("audio/mp4");
  return mp4 || !track.files.ogg ? track.files.m4a : track.files.ogg;
}

async function musicBuffer(track) {
  if (music.buffers.has(track.id)) return music.buffers.get(track.id);
  const res = await fetch(musicFile(track));
  const data = await res.arrayBuffer();
  const buffer = await new Promise((resolve, reject) => audioCtx.decodeAudioData(data, resolve, reject));
  music.buffers.set(track.id, buffer);
  return buffer;
}

function musicLevel() {
  return settings().musicVolume * (music.ducked ? MUSIC_DUCK : 1);
}

function rampTo(value, secs) {
  if (!music.gain || !audioCtx) return;
  const t = audioCtx.currentTime;
  music.gain.gain.cancelScheduledValues(t);
  music.gain.gain.setValueAtTime(music.gain.gain.value, t);
  music.gain.gain.linearRampToValueAtTime(value, t + secs);
}

async function musicStart() {
  if (!audioCtx || music.source || music.loading) return;
  music.loading = (async () => {
    const track = musicTrack(await musicTracks());
    if (!track) return;
    const buffer = await musicBuffer(track);
    if (!music.on || music.source) return;
    music.gain = audioCtx.createGain();
    music.gain.gain.value = 0;
    music.gain.connect(audioCtx.destination);
    music.source = audioCtx.createBufferSource();
    music.source.buffer = buffer;
    music.source.loop = true;
    music.source.connect(music.gain);
    music.source.start();
    rampTo(musicLevel(), MUSIC_FADE_S);
  })().catch(() => {
    // Music is a nice extra. If it cannot load, the practice carries on in silence.
  }).finally(() => { music.loading = null; });
}

function musicStopNow() {
  if (music.source) {
    try {
      music.source.stop();
    } catch (e) {
      // Already stopped.
    }
    music.source.disconnect();
  }
  if (music.gain) music.gain.disconnect();
  music.source = null;
  music.gain = null;
}

/** Ask for music on or off. Changes fade over two seconds. */
function musicSet(on) {
  if (on === music.on) return;
  music.on = on;
  if (on) {
    if (music.source) rampTo(musicLevel(), MUSIC_FADE_S);
    else musicStart();
    return;
  }
  if (!music.source) return;
  rampTo(0, MUSIC_FADE_S);
  const source = music.source;
  setTimeout(() => { if (!music.on && music.source === source) musicStopNow(); }, MUSIC_FADE_S * 1000 + 100);
}

/** Lower the music to 30 per cent while the voice speaks. */
function musicDuck(on) {
  music.ducked = on;
  if (music.source && music.on) rampTo(musicLevel(), MUSIC_DUCK_S);
}

/** Apply a new volume straight away, for the Settings slider. */
function musicVolumeChanged() {
  if (music.source && music.on) rampTo(musicLevel(), 0.2);
}

/** A new track takes effect the next time music starts. */
function musicTrackChanged() {
  if (!music.source) return;
  musicStopNow();
  if (music.on) {
    music.on = false;
    musicSet(true);
  }
}
