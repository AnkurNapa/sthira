# Sthira design

## Architecture

A static site. Plain HTML, CSS and JavaScript with no build step. Classic scripts load in order with `defer` and share globals, so no two scripts may declare the same top level name. `tools/check.sh` enforces that.

| Layer | Files | Role |
| --- | --- | --- |
| Content | data.js | Poses, sun salutation, sessions, breathing practices, articles. |
| Rules | plan.js, generator.js | Quiz scoring, health filter, journey, flow generator. Pure functions with self checks. |
| State | core.js | Storage, progress, streaks, badges, session flattening. |
| Interface | ui.js, nav.js, views.js, today.js, planview.js, flows.js | Rendering, routing, navigation. |
| Players | player.js, voice.js | Session player, breath pacer, Emma voice playback. |
| Shell | index.html, style.css, sw.js, manifest.webmanifest | Page, design tokens, offline cache. |
| Assets | figures/, voice/, media/ | Pose illustrations, recorded cues, photos and video. |

## Data and storage

All state lives in `localStorage` on the visitor's device. Every read and write is wrapped so the site still works when storage is blocked. Saved data carries a schema number and is migrated or reset safely.

| Key | Holds |
| --- | --- |
| sthira.v1 | Progress, history, settings, badges, favourites. |
| sthira.plan | The quiz answers and the built plan. |
| sthira.flows | Flows the visitor saved. |

## Routing

Hash routes such as `#/poses/tadasana` so refresh, Back and shared links work on GitHub Pages without server rules.

## Key decisions

| Decision | Reason |
| --- | --- |
| No framework or build step | Easy to host, audit and maintain. Nothing to break on install. |
| Safety rules as data in plan.js | Reviewable by a yoga teacher without reading interface code. |
| Sessions keep running when a pose is left out | A visitor with one condition still gets a full practice. A session is offered only if at least half its poses remain. |
| Voice recorded per sentence | A wording change only needs the changed sentences recorded again. Missing lines fall back to the browser voice. |
| Real photos, no drawn figures | Visitors found the drawn figures unclear. Photos come from Pexels after a check of every pose. Poses without a good photo show a calm name card. Pocket Yoga art is not licensed for reuse. |
| Original writing only | The trainer manual used as a fact source is copyrighted. Nothing is copied from it. |

## Asset pipeline

| Asset | Tool | Command |
| --- | --- | --- |
| Voice clips | Kokoro bf_emma | `node tools/voice_lines.js > lines.json` then `~/tts/kokoro-env/bin/python tools/voice_build.py lines.json` |
| Pose photos | Pexels, reviewed by hand | See photos/poses/CREDITS.md and manifest.json |
| Music | Singing bowls made in code, Om chant CC0, four Mixkit loops | `python3 tools/bowls.py`. See audio/CREDITS.md |
| Share card | Pillow | `python3 tools/og.py` |
| Photos and video | Pexels and Mixkit | See media/CREDITS.md |
