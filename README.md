# Board Night — App Scaffold

A starting point for the Board Night MVP, built with **plain HTML, CSS, and JavaScript** (no framework, no build step). It runs in the browser and stores data in `localStorage` so the team can see the core loop working before there's a real backend.

> This is a scaffold, not a finished app. It gives you working pages and a clean place to plug in real logic.

## How to run

No install needed. Either:

- **Easiest:** double-click `index.html` to open it in your browser, **or**
- **Recommended (avoids browser file limits):** serve the folder locally:
  ```
  # from inside the board-night/ folder
  python -m http.server 8000
  ```
  Then open <http://localhost:8000>.

Click **"Enter demo"** on the sign-in page. Demo data (one group, one event) is seeded automatically. Use **"Reset demo data"** to start fresh.

## File structure

```
board-night/
├── index.html        Sign-in page (login not wired yet — Sprint 0)
├── dashboard.html    Your groups + create a group        (Story 1)
├── group.html        Members, invite member, events list  (Stories 2, 3)
├── event-edit.html   Create / edit an event               (Stories 3, 10)
├── event.html        Event details, RSVP, who's coming,
│                     host controls                         (Stories 4,6,7,8,9,13)
├── rsvp.html         Invite landing page (email link)      (Story 5)
├── css/
│   └── styles.css    Shared styles
├── js/
│   ├── data.js       Data store (localStorage) — SWAP THIS for a real backend
│   └── app.js        Shared helpers (used by every page)
└── README.md
```

## How the pieces fit

Every page talks to the data layer through the `DB` object in `js/data.js`. Pages never touch storage directly. **When you're ready for a real backend, you only rewrite `js/data.js`** to call your API/database — the pages stay the same.

`js/app.js` holds small shared helpers: reading URL params (`qs`), escaping text (`esc`), formatting dates, and rendering the top bar.

## What's wired up (MVP / Version 1)

| Story | Where | Status |
|-------|-------|--------|
| 1 Create group | dashboard.html | ✅ working |
| 2 Invite members | group.html | ✅ working |
| 3 Create event | event-edit.html | ✅ working |
| 4 RSVP to event | event.html | ✅ working |
| 6 Change RSVP | event.html (dropdown + save) | ✅ working |
| 7 / 13 Who's coming + count | event.html | ✅ working |
| 8 Cancel event | event.html (host) | ✅ working |
| 9 Change host | event.html (host) | ✅ working |
| 5 Email invite | rsvp.html (link works) | 🟡 link works, real email sending TODO |

## What's left to do (good first tasks)

- **Real login / users** — right now there's one fake "current user" in `data.js`. (Sprint 0)
- **Real email sending** for Story 5 — the RSVP link page exists; hook up an email service. (Sprint 2)
- **Real backend + database** — replace `js/data.js` with API calls. (Sprint 0/1)
- Maybe/not-going handling is in place; review wording and edge cases.

## Out of scope for now (V2 / V3)

Description field is stubbed in; everything else from V2/V3 (game voting, rules links, dice/timer, snack list, profiles) is intentionally **not** built yet — see the Project Starter doc, Section 9.

---

*Front-end-only scaffold. Data lives in your browser until a backend is added.*
