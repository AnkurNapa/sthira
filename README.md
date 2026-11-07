# Sthira

Sthira is a free website for yoga at home. It teaches each pose step by step and shows the mistakes that cause injury. It builds a personal plan from a short quiz. Guided sessions read every step aloud and keep time by your breath. A breath pacer leads seven breathing practices.

There is no sign up and no server. Everything you do stays in your browser. After the first visit the site works offline.

## Run it locally

Plain files only. There is no build step.

```
cd yoga-site
python3 -m http.server 8811
```

Then open http://localhost:8811/ in a browser. Opening index.html straight from disk also works, but offline support needs a web server.

## Check it before you ship

```
bash tools/check.sh
```

This runs the logic tests (`node tests.js`), the plan and generator self checks, the script and offline cache checks plus the copy rules. CI runs the same gate on every push.

## Publish on GitHub Pages

1. Push this folder to a GitHub repository.
2. Open Settings, then Pages.
3. Under Build and deployment choose Deploy from a branch.
4. Pick the branch `main` and the folder `/ (root)`. Save.

The site then lives at `https://<user>.github.io/<repository>/`. Every link is relative, so it works from that sub path. The empty `.nojekyll` file tells Pages to serve the files as they are.

## Files

| File | What it does |
| --- | --- |
| `data.js` | Poses, sessions, breathing practices and articles |
| `plan.js` | Quiz, dosha profiles, health filters and the journey |
| `generator.js` | Builds a flow from length, level and focus |
| `core.js` | Storage, progress, badges, saved flows and session timing. No DOM, so Node can test it |
| `ui.js` | Element helper, dialogs, shared cards and the pose figure list |
| `views.js`, `today.js`, `planview.js`, `flows.js` | The pages |
| `player.js` | Session player and breath pacer |
| `nav.js`, `app.js` | Navigation, routes and start up |
| `voice.js`, `voice/` | Recorded Emma voice clips |
| `sw.js` | Offline cache |

## Docs

Requirements, design, test plan and release steps live in [docs](docs/). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Credits

- Pose photos: see photos/poses/CREDITS.md and the Credits page.
- Emma voice: recorded with Kokoro, Apache 2.0 licence.
- Photos and videos: see [media/CREDITS.md](media/CREDITS.md).

## Safety

Sthira is a learning guide. It does not replace a qualified teacher or medical advice.
