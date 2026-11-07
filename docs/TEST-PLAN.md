# Sthira test plan

## Levels

| Level | What | How | When |
| --- | --- | --- | --- |
| Unit | Session timing, health filter, streaks, storage failure, saved flows | `node tests.js` | Every change |
| Rules | Quiz scoring, plans for every condition, 105 generated flows | Self checks in plan.js and generator.js | Every change |
| Static | Missing scripts, duplicate global names, offline cache list, copy rules | `bash tools/check.sh` | Every change and in CI |
| End to end | Quiz, plan, session player, pacer, generator, builder, navigation | Playwright at the sizes below | Before each release |
| Safety review | Pose text and condition lists checked by a yoga teacher | Review against docs/REQUIREMENTS.md section 6 | When poses or rules change |
| Exploratory | A first time visitor walk through on phone and desktop | Manual with screenshots | Before each release |

## Matrix

Sizes: 320, 390, 430, 768, 1024, 1280, 1440, 1920. Landscape phone for the player.
Themes: light and dark.
Browsers: Chrome, Safari, Firefox.
Input: mouse, touch and keyboard only.

## Edge cases that must pass

- The screen locks during a session. The timer is still right on return.
- Storage is blocked or full. The site still works.
- Saved data is corrupt or from an older version.
- A plan removes every pose in a session. Start is not offered.
- Double taps on Start or Skip advance only once.
- Back closes an open dialog or menu.
- Offline after the first visit.
- No voice support. The voice option hides.
- A session crosses midnight. It counts on the start date.

## Exit criteria for a release

All automated checks pass. No open safety finding. The end to end pass shows no console errors. Screenshots of each main page at 390 and 1440 in both themes are reviewed.
