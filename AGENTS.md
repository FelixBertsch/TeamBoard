# Teamboard: developer guide for agents

Read this file completely before changing anything. It holds the rules that apply to every change. Details per area live in `docs/`; the table under "Files" says which one to read before you touch a file.

## What the Teamboard is

A planning tool for a team lead with a small team. Per person it shows topics (multi-day work) on a timeline, todos with due dates (also recurring), absences, project assignments (customer, period, billable) and points for the next one-on-one. Topics and todos have one responsible person and may mention further people, including contacts outside the team. A history view and a yearly review per person show what was done, holidays and projects. One user, no multi-user editing.

It runs as a static web app (GitHub Pages) on three kinds of devices: a large monitor for planning, a laptop for the same with less space, and a phone for looking things up and quick capture. Anyone can use the app with their own private GitHub repository for the data; nothing about a specific user lives in this repository.

## Ground rules

- **No build, no npm, no frameworks.** Plain HTML, CSS and JavaScript, served as static files.
- **Small tool, single user.** Prefer the simplest thing that works. No abstractions "for later".
- **Language:** code, comments and docs in English. The UI is German and addresses the user with "du".
- **Design:** own tokens in `styles/tokens.css` (navy, coral, Nunito Sans), light theme only. See "Design".
- **Browsers:** current Chrome/Edge on Windows, Safari on iPhone (fully supported).
- **Public repository:** no user data, no personal names, e-mail addresses, repository names or URLs of a specific user, in code, docs, tests or commits. The pre-commit hook (`.githooks/pre-commit`) blocks JSON files, data folders and GitHub tokens. Sample data uses invented people and companies.
- **Deliberately not included:** multiple users, own server, notifications, calendar integration. On the phone: resizing topics by dragging, drag-to-create, keyboard shortcuts (moving a topic by hold and drag in the team grid is included). No tablet layout. Discuss with the maintainer before adding any of these.
- **Settled questions** are listed under "Decisions". Do not reopen them without a new reason.

## Working on this repo

- The maintainer communicates in German and decides on scope. Ask before architecture changes, new dependencies or anything under "Deliberately not included". Small, focused changes over rewrites.
- `main` is production: GitHub Pages deploys every push within a minute. Run `python tests/smoke_test.py` before every commit; all checks must pass.
- **Keep the docs current.** When a change alters behavior, a rule or a name described here or in `docs/`, update the text in the same commit. Outdated docs are worse than none.
- Commit messages: short English subject line, body only when it helps. Keep the configured author (`git config user.name/email`, a GitHub noreply address); never commit with a private e-mail address. Activate the hook once per clone: `git config core.hooksPath .githooks`.
- Agents usually cannot push (no GitHub credentials). Commit locally and tell the maintainer to push.
- Never read, modify or commit user data: `data/`, `Backups/` and every `*.json` outside `tests/fixtures/` are real data or exports. `tests/screenshots/` and `.venv/` are local output. Never ask for or handle a GitHub token or passphrase; users enter them in the app only.

## Files

| Path | Purpose | Read first |
| --- | --- | --- |
| `index.html` | Page skeleton, loads styles and scripts in order | |
| `styles/tokens.css` | Font face and design tokens | "Design" |
| `styles/components.css` | Components (sidebar, buttons, cards, timeline, lists, drawer, tour …) | |
| `styles/layout.css` | Laptop icon bar, phone, wide monitors, bottom sheet | "Layout and devices" |
| `src/config.js` | `CFG`: developer settings. User settings live in the data (`S.settings`) | |
| `src/core/model.js` | State `S`, `ui`, undo, demo data, `normalize()` with migrations, settings, routing, people helpers, recurring todos | `docs/data-model.md` |
| `src/core/util.js`, `holidays.js` | Dates, formatting, `esc`, `$`; public holidays per state and own days off | `docs/dates.md` |
| `src/core/quick-parse.js` | `parseQuick()`, `parseMentions()` | `docs/quick-capture.md` |
| `src/core/issues.js` | "Zu klären" | |
| `src/ui/` | Rendering and interaction, one file per area | `docs/ui.md` |
| `src/ui/timeline.js`, `drag.js` | Timeline and its pointer interactions | `docs/timeline.md` |
| `src/ui/suggest.js`, `capture.js` | `@`/`#` suggestion list, phone "+" sheet | `docs/quick-capture.md` |
| `src/storage/` | Modes and sync, GitHub client, encryption, merge, backups, IndexedDB | `docs/storage.md` |
| `src/main.js` | Global browser events, `startup()`, service worker, `window.TB` | |
| `sw.js`, `manifest.webmanifest`, `assets/icons/` | Offline start and home screen app | `docs/storage.md` |
| `assets/brand/` | Logos, trimmed to the drawn area. Never recolor or redraw them | |
| `assets/fonts/` | Nunito Sans subset and `OFL.txt` | `docs/ui.md` |
| `tests/smoke_test.py` | End-to-end test (Playwright) | `docs/testing.md` |

## Architecture

**Classic scripts, one global scope.** `index.html` loads every file with `<script defer>` in dependency order. Top-level `const`, `let` and functions are shared across files. Functions may call functions in later files (they run after everything is loaded); top-level code may only use what earlier files define. A new file goes into `index.html` at the right position. ES modules were left out on purpose: the code shares mutable state (`S`, `ui`, `drag`), and modules would add ceremony without benefit at this size.

**State and rendering.** All data lives in `S`. Every change mutates `S`, then calls `save()`, then `render()`. `save()` pushes the previous state onto the undo stack and calls `Store.changed()`. `render()` rebuilds sidebar and main area via `innerHTML`. No components, no virtual DOM.

**Events.** Delegated on `document`. Controls carry `data-action="…"` and `data-id="…"`; the `switch` in `src/ui/events.js` runs them. No inline `onclick`.

Three rules follow:

1. **After every mutation of `S`: `save()`, then `render()`.** Forgetting `save()` loses data and breaks undo and sync. Never write data any other way.
2. **`render()` destroys the DOM.** It keeps text, caret and focus of fields in `#main` that have an `id` or `data-add`+`data-person` (`keepFields()`/`restoreFields()`). Everything else is gone. Automatic re-renders (resize, sync) therefore check `Store.busy()` first. To clear a field after submit, set `value=''` before `render()`.
3. **New controls get a `data-action`** and a `case` in `src/ui/events.js`.

**Data in one sentence each** (details in `docs/data-model.md`): `personId: "me"` is the user. People are archived, never deleted. Contacts are their own list and never responsible. `with` lists further involved people, information only. Recurring todos keep exactly one open instance; complete them only via `completeTodo()`/`reopenTodo()`. New entries come from `newEntry()` or `newTodo()` (id and `createdAt`). Sick days expire into "Abwesend" after 7 days and never appear in history or counts. Dates are `YYYY-MM-DD`, `end` inclusive, and day arithmetic uses day numbers (`dn()`/`ds()`), never `Date` objects.

## Layout and devices

`applyLayout()` (`src/ui/layout.js`) is the single source: it sets classes on `<html>`; CSS and `render()` follow them.

| Area | `layoutKey()` | Class | Applies | Test viewports |
| --- | --- | --- | --- | --- |
| Phone | `phone` | `lay-phone` (+ `lay-land` when wider than high) | below 700 px wide, or touch and below 500 px high | 440 × 956, 393 × 852, 956 × 440 |
| Laptop | `rail` | `lay-rail` | 700 to 1439 px | 1280 × 800, 1280 × 700 |
| Monitor | `side` | none | from 1440 px | 1920 × 1080, 2560 × 1440 |

Plus `touch` for a coarse pointer.

- **Monitor:** 264 px sidebar. At the bottom: "Mehr" (contacts, backups, holidays, tour, sign-out), the shortcut list (`KEYS`) and the sync status. Below the timeline the cards form a board of equal columns (as many as fit at 420 px, at most four), placed once per page session so they never jump (`placeBoards()`, `docs/ui.md`).
- **Laptop:** the sidebar becomes a 76 px icon bar (avatars with counters, absence dot, name as `title`). Sync status as a dot; the shortcut list only in "Mehr".
- **Phone:** own views with the same data, actions and forms. Bottom tab bar: Heute, Team, "+", Ich, Mehr. Forms are bottom sheets. The page scrolls as a whole. Tap targets at least 44 px, inputs at least 16 px font, safe areas via `env(safe-area-inset-*)`. "Heute" has folding cards; "Team" is a grid of workdays (one week upright with the tapped day listed below; sideways, class `lay-land`, two weeks visible in a horizontal scroller without the tab bar). Topic bars there move by hold and drag. Details in `docs/ui.md` and `docs/timeline.md`.
- **Resize and rotation:** `applyLayout()` runs at once, `render()` only when width or layout area changes. Height-only changes (Safari's address bar, keyboard) never re-render.
- Decide layout differences via `.lay-phone`/`.lay-rail`/`.lay-land` and `isPhone()`/`isLand()`/`layoutKey()`, never via own media queries. The board counts its columns from its own width.

## Design

Values are CSS variables in `styles/tokens.css`; role variables point to base colors. Change values there only.

| Role | Variable | Value |
| --- | --- | --- |
| Page | `--bg-page` | `paper` #f7f7fa |
| Cards | `--surface-card` | `white`, 1px `neutral-200`, radius 28 px, `shadow-sm` |
| Navigation | `--side-bg` | `navy-800` with `paper` text |
| Headings / body / secondary | `--text-strong` / `--text-body` / `--text-muted` | `navy-800` / `neutral-800` / `neutral-600` |
| Main action | `--accent` | `coral-500`, hover `coral-600`, pressed `coral-700` |
| Default button | `--primary` | `navy-800` |
| Topic bars | `--bar`, `--bar-2`, `--bar-3` | `navy-800`, `navy-600`, `navy-200` (text `navy-800`) |
| Involved lane | `--with-bg`, `--with-line` | `white`, dashed `neutral-400` |
| Today | `--today`, `--accent-text` | `coral-50`, `coral-700` |
| Status | `--late*`, `--warn*` | `error-*`, `warning-*` |

Rules most often broken:

- **Coral sparingly:** exactly one main action per view (desktop "Thema anlegen", phone "+"), plus active states, focus ring, today and "Mein To-do".
- **Color carries status only.** Topic bars alternate three navy tones so parallel topics differ; color never means anything else. Status always has a word or icon as well.
- **Nothing is sharp:** buttons, tags, badges, bars and cards are pills (`999px`); fields 12 px; cards 28 px; toasts 20 px.
- **Fields and outlined elements have a 2 px border**, surfaces 1 px.
- **Shadows are navy-tinted**, never black. No gradients, no colored left edges on cards.
- **Typography:** Nunito Sans only. `h1` 48 px 900, section titles `.h4` 22 px 700, body 16 px, labels and buttons 700 to 800, caps only in `.overline`.
- **Icons:** Lucide 0.544.0, 2 px stroke, `currentColor`, as path strings in `ICONS`. Never emoji or Unicode symbols.

## UI texts (German)

- Address the user with "du", sentence case, short sentences.
- Buttons are verbs: "Thema anlegen", "Eintragen", "Speichern". No "OK".
- Errors state cause and fix, without apologizing: "Bitte gib einen Titel ein."
- Empty states say what will appear and how to add it.
- Typographic quotes „…“ and apostrophe ’ in visible text; straight quotes only in code.
- No dashes as a stylistic device, no emoji, no exclamation marks in messages.
- Every text containing user data goes through `esc()`.

## Recipes

- **New entry in any list:** `newEntry({...})` (or `newTodo()`), so it gets `id` and `createdAt`.
- **New field:** handle missing values with `??`; no migration needed. Renames or changed meaning need a `DATA_VERSION` bump and a migration in `normalize()`. A new top-level list goes into `empty()` and `Store.serialize()`. See `docs/data-model.md`.
- **New action:** element with `data-action="name"` and `data-id`, `case'name':` in `events.js`: change `S`, `save()`, `render()`, `toast(text, true)` for undo.
- **New panel:** a function returning `<section class="card card-pad">` with `<div class="panel-head"><h2 class="h4">Titel</h2></div>` and `.prow` rows (model: `issuesPanel()`). Desktop as `[id, html]` into the `boardHTML()` list of `viewOverview()`/`viewPerson()` (`''` = not shown), phone into the `.m-stack` of `viewToday()`/`viewPersonPhone()`. Everything must stay reachable on the iPhone.
- **New "Zu klären" rule:** push `{kind:'late'|'warn', act, id, pid, text}` in `allIssues(pid)`; `act` is an existing action like `edit-topic`. A yellow rule also sets `ack` (a stable id with its own prefix), `sig` (the date it hangs on) and, if absences cause it, `items`, so it can be acknowledged (`acks` in `docs/data-model.md`).
- **New setting:** developer setting into `CFG` with a comment; a user setting for every device into `S.settings` via `setSetting()` (document the id in `docs/data-model.md`); a device-only preference into `localStorage` under `KEY`.
- **New keyboard shortcut:** in the keyboard handler inside `if(!typing&&!open&&…)` and in `KEYS` (`sidebar.js`), which feeds the sidebar footer and "Mehr". Taken: N, W, 2, 6, Ctrl+Z, Esc, Enter.
- **New entry in "Mehr":** add `[action, icon, label]` to `storageActions()` (`setup.js`) and a `case` in `events.js`. Rarely used functions belong there, not in the sidebar.
- **New tour step:** `{hash, sel, title, text}` in `TOUR.desktop` and/or `TOUR.phone` (`onboarding.js`). Give the target a `data-tour="…"` attribute. The tour runs on `demo()` data, so the target must exist there.
- **New "Erste Schritte" item:** `[done, label, action]` in `firstSteps()`; `done` is derived from the data, never stored.
- **New quick capture command or tag:** `parseQuick()`, `previewHTML()`, `TAG_HELP`. See `docs/quick-capture.md`.
- **New event type in the history:** push `{type, day, pid, title, sub, act, id}` in `historyEvents()` and add the type to `HIST_TYPES` and `HIST_ICONS`.
- **New type in the phone capture sheet:** `CAP_TYPES` and a branch in `openCapture()`, built from the same pieces as the other types (title "Neu erfassen", people as `pid` chips, dates as chips plus "Anderes Datum"). The text field gets `autofocus` so Safari opens the keyboard inside the tap gesture.

## Testing

Local: `python -m http.server 8000`, then `http://localhost:8000/?demo=1`. `file://` does not work. Before every commit: `python tests/smoke_test.py` (needs `pip install playwright` and `python -m playwright install chromium`). It covers the main flows on every test viewport and writes screenshots to `tests/screenshots/`; look at them after visual changes. Add a `check(…)` only for things that broke before or are easy to break. Details and flaky spots: `docs/testing.md`.

## Decisions

Each with its date and reason, so they are not reopened without a new argument.

- **GitHub as storage**, not a server or database: free, no own domain, versioned history, works from Safari on the iPhone. OneDrive/SharePoint via Graph API was rejected (needs an app registration in the company tenant); a local-file mode was removed because iOS Safari cannot write files.
- **Client-side encryption** because the data includes absences such as sick days and one-on-one notes. The data repo is private on top of that.
- **No sick-day history** (7.11.2026): sick days are health data. The board shows who is sick now and turns the entry into "Abwesend" 7 days after its end. Do not add a sick-day count or list anywhere.
- **Projects as assignments with periods**, not a field on the person: the user needs to see later who was on which project when. `billable` per assignment. No project directory; names are free text with suggestions.
- **Suggestion list inserts text**, not a hidden id: the resolution lives in the field value, so it survives `render()`.
- **Per-entry merge, local wins on true conflicts:** single user, conflicts are rare, GitHub history keeps every version.
- **No build, classic scripts:** the tool is small and maintained occasionally; a toolchain would cost more than it saves.
- **Network-first service worker:** the user always gets the latest version online and can still start offline.
- **One responsible person per entry, others only mentioned** (8.11.2026): responsibility stays clear and `kind` keeps its meaning. Several equal owners per entry were rejected.
- **Involved team members see the topic in their timeline row as a separate lane** (8.11.2026, replaces "only under ‚Beteiligt an‘"): otherwise the overview shows them as free while they work on it. The lane is thin, dashed and names the responsible person; it does not drag or resize, so moving the topic stays with the owner. Todos are not mirrored, so markers and counts stay per responsible person.
- **Contacts as their own list**, not a flag on `people` (8.11.2026): every team view keeps reading the team, and contacts never land in counts.
- **Archive instead of delete** (8.11.2026): the user wants past entries of people who left, for the history and a later search.
- **Recurring todos with one open instance** (8.11.2026): no future copies on the timeline, the rhythm never drifts, late completion creates no backlog.
- **Data repository per device, not in the code** (8.11.2026): anyone can use the published app with their own private repository, without a fork.
- **Holidays per state as a synced setting** (8.11.2026): computed, no data source; every device shows the same days off.
- **Own days off in the data, not in `CFG`** (9.11.2026): companies give days like Heiligabend off without a law behind them. They are a synced setting (`ownDays`) edited under "Mehr" → "Feiertage" and count like holidays; only labels say "frei". `CFG.extraHolidays` was removed, because the config lives in the public repository. The form applies changes at once with undo, so closing it never drops an added day.
- **Tour on sample data** (8.11.2026): a tour across an empty board explains nothing. No tour library.
- **Absence warnings only where the finish of a main topic is at risk** (9.11.2026): long topics that run on the side collected one warning per day off. Topics are main or side topics (`side`); side topics get no absence warnings, main topics only for an absence on the end date or the three workdays before it, or absences over more than half of the remaining workdays. One entry per topic.
- **Half days as part of an absence of one day** (9.11.2026): `half: am|pm`, entered with „Tageszeit“ in the form or `#vormittags`/`#nachmittags` next to an absence tag. A leave that starts or ends with half a day is two entries; the overview merges them into one block. Half days raise no warnings.
- **Board cards placed once per page session** (9.11.2026): cards below the timeline fill equal columns by height, but keep their place until reload or a change of the column count. Cards that jump while you tick off tasks or open „Mehr anzeigen“ were the bigger annoyance than a less balanced layout.
- **Acknowledge per warning, not per absence** (9.11.2026): a yellow "Zu klären" entry can be marked as clarified and comes back when its date or its absences change. Red entries (late) cannot be hidden, because they mean the data is wrong.
- **Phone team view as a grid of workdays, not a strip per person** (9.11.2026, replaces the two-week strip per person of 7.11.): separate cards with their own unlabelled time axis made it hard to see who works on what on which day. Upright one week (two weeks would leave 34 px per day), the tapped day listed below; sideways two weeks with free horizontal scrolling. A web app cannot force landscape on iOS, so turning the phone switches the view.
- **Moving topics on the phone by hold and drag** (9.11.2026): the maintainer wants it, and the 60 to 90 px columns are wide enough. Hold first, because swiping is scrolling and the grid is mostly bars. Start and end shift by workdays. Resizing and drag-to-create stay desktop only: thumb-sized edges are too fiddly, the form changes the length.
- **Folding cards on the phone's "Heute", not closing** (9.11.2026): a closed card hides news such as a new absence; a folded one keeps a summary in its head. "Zu klären" opens again for a new red issue. "Projekte heute" left the phone, the project shows per person in the team day list.
- **One capture sheet on the phone, only the form below the tabs changes** (9.11.2026): switching to „Abwesend“ used to open another form: the sheet changed height, dropped when the keyboard closed, and the typed text was lost. Now title, tabs and height stay (the sheet is anchored near the top, so a closing keyboard only lengthens it), people are chips everywhere, and typed text survives a switch.
- **No data waits in an open form, and windows do not overwrite each other's cache** (9.11.2026): contacts vanished twice after a release. The contacts list saves while it stays open, but sync waited until it closed; a second window of the same browser then overwrote the shared IndexedDB cache, and reloading the first window lost the contact. Forms that save at once are `live` and do not hold back sync; `cache()` takes over another window's uncommitted changes before it writes (`docs/storage.md`).
- **Rarely used functions under "Mehr"** (8.11.2026): contacts, backups, holidays, tour and sign-out sit in "Mehr" on every layout. The sidebar keeps navigation, the team, the shortcut list and the sync status; the repository name shows only in the tooltip and in "Mehr".

## Pitfalls

- **`render()` during input:** only fields in `#main` with `id` or `data-add` survive. Check `Store.busy()` before automatic re-renders.
- **`kind` for `personId: "me"`** must be `team`, otherwise the todo disappears from "Meine Planung". This rule lives in `parseQuick`, `openTodo` and dragging.
- **Folder pickers and permission prompts need a user gesture.** Never call them on load.
- **Hash names** only letters, digits and hyphens.
- **Grid and flex children on the phone** need `min-width:0`, otherwise horizontally scrolling content widens the page.
- **Safari zooms into inputs below 16 px.** Keep all inputs at 16 px or more.
- **Nothing only on hover.** Provide a visible form under `@media (hover:none)` or `.lay-phone`.
- **Safari fires `resize` when its address bar moves.** The resize handler re-renders only on a different width or layout area.
- **iPhone keyboard** opens only if a field gets focus inside the tap gesture. `openDrawer()` focuses `[autofocus]` synchronously.
- **Home screen app on iOS** has its own storage, separate from Safari.
- **Date fields** are always `dateIn()`, never a bare `<input type="date">` (Chrome and Edge show it in the browser language).
- **New pointer logic on the timeline** must set `suppressUntil` after a drag, so the following click does not open a form.
- **A drawer that saves while it stays open** (`onSubmit` returns `KEEP_OPEN`, buttons that save inside the form) needs `live: true` in `openDrawer()`, or the change waits on the device until the form closes. Only forms that keep no reference to an entry of `S` may be live.
- **The tour layer (`#tour`) takes every click and key** while it runs and counts as `Store.busy()`.
- **Never put user data into `localStorage`.** Only `teamboard.v1.ui` (timeline range, folded cards on the phone) and `teamboard.v1.tour` live there.
- **Class `lg` is taken** by the large avatar (`.av.lg`); the sideways team grid is `.wg-land`.
