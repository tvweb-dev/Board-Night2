# Board Night - App Scaffold

A starting point for the Board Night MVP, built with **plain HTML, CSS, and JavaScript** with a lightweight Node SSR layer. The frontend talks to the real Board Night API/database server on `https://board-night-server-594j5.ondigitalocean.app`.

> This is a scaffold, not a finished app. It gives you working pages and a clean place to plug in real logic.

## How to run

1. Use Node.js 18+.
2. Use the production API/database server at `https://board-night-server-594j5.ondigitalocean.app`.
3. Start the SSR frontend server:

	`node server.js`

4. Open `http://localhost:5173`.

Optional environment variables:

- `PORT` (default `5173`)
- `BOARD_NIGHT_API_URL` (default production API URL)
- `BOARD_NIGHT_SITE_URL` (used for canonical/OG URLs)
- `BOARD_NIGHT_SSR_USER_ID` (default `1`, used for server pre-rendered dashboard/group/event snapshots)

Sign in with a user that exists in the API database. Use **Clear session** to remove the browser session.

## File structure

```
board-night/
├── index.html        Sign-in page
├── dashboard.html    Your groups + create a group        (Story 1)
├── group.html        Members, invite member, events list  (Stories 2, 3)
├── event-edit.html   Create / edit an event               (Stories 3, 10)
├── event.html        Event details, RSVP, who's coming,
│                     host controls                         (Stories 4,6,7,8,9,13)
├── rsvp.html         Invite landing page (email link)      (Story 5)
├── css/
│   └── styles.css    Shared styles
├── js/
│   ├── data.js       API-backed data layer for the production server
│   └── app.js        Shared helpers (used by every page)
└── README.md
```

## How the pieces fit

Every page talks to the data layer through the `DB` object in `js/data.js`. Pages never touch the API directly in browser code. `js/data.js` points to `https://board-night-server-594j5.ondigitalocean.app` by default, or to `window.BOARD_NIGHT_API_URL` if you set one before loading `js/data.js`.

The SSR server in `server.js` renders route-level SEO tags (title, description, canonical, Open Graph, Twitter, JSON-LD) and pre-renders core page content for crawlers and first paint.

`js/app.js` holds small shared helpers: reading URL params (`qs`), escaping text (`esc`), formatting dates, and rendering the top bar.

## What's wired up (MVP / Version 1)

| Story | Where | Status |
|-------|-------|--------|
| 1 Create group | dashboard.html | working |
| 2 Invite members | group.html | working |
| 3 Create event | event-edit.html | working |
| 4 RSVP to event | event.html | working |
| 6 Change RSVP | event.html (dropdown + save) | working |
| 7 / 13 Who's coming + count | event.html | working |
| 8 Cancel event | event.html (host) | UI present; not in MVP API yet |
| 9 Change host | event.html (host) | UI present; not in MVP API yet |
| 5 Invite event members | event.html + rsvp.html | working through the invite API; real email sending TODO |

## What's left to do

- Real email sending for Story 5.
- Event update/cancel/change-host endpoints if those are added to the API.
- Description persistence once the API supports it.

## Out of scope for now (V2 / V3)

Description field is stubbed in; everything else from V2/V3 (game voting, rules links, dice/timer, snack list, profiles) is intentionally not built yet.

---

*Frontend scaffold connected to the production Board Night API/database server.*
