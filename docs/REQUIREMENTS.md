# Sthira requirements

Version 0.1. Owner: Ankur Napa. Status: in build.

## 1. Purpose

Sthira is a free website for people who practise yoga alone at home. It teaches each pose step by step, shows how to avoid injury and builds a personal plan from a short quiz. It has no sign up, no server and no tracking.

## 2. Users

| User | Need |
| --- | --- |
| Complete beginner | Know where to start. Learn the basic shapes safely. |
| Returning practitioner | A guided session or a fresh flow for today. |
| Person with an injury or condition | A practice that leaves out what is unsafe for them. |
| Busy person | A short practice that fits 10 minutes. |

## 3. Functional requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| FR-01 | A first visit shows a welcome note with the safety disclaimer. | Shown once. Links to the doctor article. |
| FR-02 | A 10 question quiz finds the dosha mix plus experience, goal, time and health conditions. | One question per screen. Back works. Conditions allow several answers. |
| FR-03 | The plan shows the dosha profile, health tips, a pose list, breathing and a 6 month journey in 4 stages. | Rest only plans show breathing and relaxation only. |
| FR-04 | Every pose has steps, mistakes to avoid, an easier version, benefits and who should skip it. | 70 poses. A figure where one is available. |
| FR-05 | Guided sessions play step by step with a timer, voice and a chime. | Timer stays right when the screen locks. Sided poses play right then left. |
| FR-06 | Poses that are unsafe for the visitor are left out of sessions, flows and the pacer. | Verified by tests for every condition. |
| FR-07 | A flow generator builds a practice from length, level and focus. | Total time within 25 per cent of the request. Always ends in relaxation. |
| FR-08 | Visitors can build, save, edit and delete their own flows. | Warns about avoided poses. Offers to add relaxation. |
| FR-09 | A breath pacer guides 7 breathing practices. | Holds are removed when the plan says no holds. |
| FR-10 | Progress shows rings, a streak, badges, history and journey progress. | Stored on the device only. |
| FR-11 | Learn articles cover safety, set up, breathing, habit and background. | 9 articles. |
| FR-12 | Spoken cues use the Emma voice. | Falls back to the browser voice for any line without a recording. |

## 4. Non functional requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | Works on phones from 320 px wide to desktops at 1920 px. No sideways scroll. |
| NFR-02 | Apple style web design and navigation. Light and dark themes. |
| NFR-03 | Accessible: keyboard use, screen reader labels, reduced motion, AA contrast, 200 per cent zoom. |
| NFR-04 | Works offline after the first visit. |
| NFR-05 | No external requests, accounts, cookies or analytics. All data stays in the browser. |
| NFR-06 | Static files only, hosted on GitHub Pages. |
| NFR-07 | Copy in British English. No em or en dashes. No company names. |
| NFR-08 | Every image, video and voice asset has a licence that allows public use. Credits are listed. |

## 5. Out of scope for version 1

Accounts and sync across devices. Payments. Live classes. Push notifications. Languages other than English.

## 6. Safety principle

When in doubt, leave it out. Any pose or breath that a condition's own notes warn about is removed for that visitor. Sthira never presents itself as medical advice.
