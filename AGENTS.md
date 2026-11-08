# Teamboard: developer guide for agents

Read this file completely before changing anything. It tells you where changes almost always go.

## What the Teamboard is

A planning tool for a team lead with a small team. Per person it shows topics (multi-day work) on a timeline, todos with due dates (also recurring), absences, project assignments (customer, period, billable) and points for the next one-on-one. Topics and todos have one responsible person and may mention further people, including contacts outside the team (boss, colleagues). A history view and a yearly review per person show what was done, holidays and projects. One user, no multi-user editing.

It runs as a static web app (GitHub Pages) and is designed for three kinds of devices: a large monitor for planning, a laptop for the same with less space, and a phone for looking things up and quick capture. Each has its own layout (see "Layout and devices"). Anyone can use the app with their own private GitHub repository for the data; nothing about a specific user lives in this repository.

Ground rules:

- **No build, no npm, no frameworks.** Plain HTML, CSS and JavaScript, served as static files. Keep it that way unless the user asks.
- **Small tool, single user.** Prefer the simplest thing that works. No abstractions "for later".
- **Language:** code, comments and docs in English. The UI is German and addresses the user with "du".
- **Design:** own design tokens in `styles/tokens.css` (navy, coral, Nunito Sans), see "Design". Light theme only.
- **Browsers:** current Chrome/Edge on Windows, Safari on iPhone (fully supported).
- **Public repository:** no user data, no personal names, e-mail addresses, repository names or URLs of a specific user, in code, docs, tests or commits. The pre-commit hook (`.githooks/pre-commit`) blocks JSON files, data folders and GitHub tokens. Sample data uses invented people and companies.

## Working on this repo

- The maintainer communicates in German and decides on scope. Ask before architecture changes, new dependencies or anything under "Deliberately not included". Small, focused changes are preferred over rewrites.
- `main` is production: GitHub Pages deploys every push within a minute. Run `python tests/smoke_test.py` before every commit; all checks must pass.
- Commit messages: short English subject line, body only when it helps. Keep the configured author (`git config user.name/email`, a GitHub noreply address); never commit with a private e-mail address.
- Agents usually cannot push (no GitHub credentials in their environment). Commit locally and tell the maintainer to push. GitHub Pages deploys `main` within a minute.
- Never read, modify or commit user data (see "Local files"). Never ask for or handle a GitHub token or passphrase; users enter them in the app only.

## Local files that are not part of the project

A working folder may contain files that git ignores. Do not use them as a source of truth:

| Path | What it is |
| --- | --- |
| `data/`, `Backups/`, `*.json` | Real user data, e.g. a backup folder (`teamboard-daten.json`, `Backups/`) or exports. Never open, change or commit them. |
| `tests/screenshots/`, `.venv/` | Test output and local Python environment. |

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Page skeleton, loads styles and scripts in order |
| `styles/tokens.css` | Font face and design tokens (CSS variables) |
| `styles/components.css` | Components: sidebar, buttons, tags, cards, timeline, lists, drawer, toast, setup, "Erste Schritte", tour |
| `styles/layout.css` | Layout areas: laptop icon bar, phone, wide monitors, bottom sheet |
| `src/config.js` | `CFG`: developer settings (data file name, sync interval, backup settings, `sickVisibleDays`, `extraHolidays`). User settings live in the data (`S.settings`) |
| `src/core/` | `util.js` (dates, formatting, `esc`, `$`), `holidays.js` (public holidays per German state), `model.js` (state `S`, `ui`, undo, demo data, `newEntry()`, `normalize()` with migrations, settings `getSetting()`/`setSetting()`, routing, people helpers `team()`, `isActive()`, `mentionable()`, `withOf()`, assignment helpers, `newTodo()`, recurring todos, `expireSick()`), `quick-parse.js` (`parseQuick()`, `parseMentions()`), `issues.js` ("Zu klären") |
| `src/ui/` | Rendering and interaction (one file per area, see below) |
| `src/storage/` | `store.js` (modes and sync), `github.js` (API client), `vault.js` (encryption), `merge.js`, `backup.js` (backup folder, export, import), `idb.js` |
| `src/main.js` | Global browser events, `startup()`, service worker registration, `window.TB` |
| `sw.js`, `manifest.webmanifest`, `assets/icons/` | Offline start and home screen app. App icons and favicon show the logo symbol on a `navy-800` tile |
| `assets/brand/` | Logo: `logo-dark.svg` (on navy, sidebar), `logo-light.svg` (on light surfaces, setup page on the phone), `symbol-dark.svg` (laptop icon bar). Trimmed to the drawn area; never recolor or redraw them |
| `assets/fonts/` | `nunito-sans.woff2`, Nunito Sans subset (Latin, German, typography), and its license `OFL.txt` |
| `LICENSE` | MIT for the code |
| `tests/smoke_test.py` | End-to-end test (Playwright) |

## Architecture

**Classic scripts, one global scope.** `index.html` loads every file with `<script defer>` in dependency order. Top-level `const`, `let` and functions are shared across files. Functions may call functions in later files (they run after everything is loaded); top-level code may only use what earlier files define. A new file goes into `index.html` at the right position. ES modules were left out on purpose: the code shares mutable state (`S`, `ui`, `drag`), and modules would add ceremony without benefit for a tool this size.

**State and rendering.** All data lives in `S` (see "Data model"). Every change mutates `S`, then calls `save()`, then `render()`. `save()` pushes the previous state onto the undo stack and calls `Store.changed()`. `render()` rebuilds sidebar and main area via `innerHTML`. No components, no virtual DOM.

**Events.** Delegated on `document`. Controls carry `data-action="…"` and `data-id="…"`; the `switch` in `src/ui/events.js` runs them. No inline `onclick`.

Three rules follow:

1. **After every mutation of `S`: `save()`, then `render()`.** Forgetting `save()` loses data and breaks undo and sync.
2. **`render()` destroys the DOM.** It saves and restores text, caret and focus of fields in `#main` (`keepFields()`/`restoreFields()`, keyed by `id` or `data-add`+`data-person`). Everything else is gone, e.g. the inline field of the timeline. Automatic re-renders (resize, sync) therefore check `Store.busy()` first. To clear a field after submit, set `value=''` before `render()`.
3. **New controls get a `data-action`** and a `case` in `src/ui/events.js`.

**UI files**

| File | Contents |
| --- | --- |
| `layout.js` | `MQ_PHONE`, `isPhone()`, `layoutKey()`, `applyLayout()` |
| `icons.js` | `ICONS` (Lucide paths) and `ic(name, size, stroke)` |
| `feedback.js` | `toast(text, withUndo)`, `showDialog()`, `closeDialog()` |
| `sidebar.js` | `renderSide()`: sidebar, icon bar or phone tab bar |
| `timeline.js` | `tlAvail()`, `layout()`, `pos()`, `dayAt()`, headers, bars (`toneMap()`), todo cards and markers, `timeline()`, `tlSection()`, hover card of markers (`showPop()`, `hidePop()`) |
| `views-desktop.js` | `quickBlock()`, `todoRow()`, overview (`viewOverview()`, `todoGroups()`, `todoListHTML()`, panels incl. `projectsPanel()`), person page (`personParts()`, `assignmentsPanel()`, `involvedPanel()`, `viewPerson()`), filter "Für" of "Meine Planung" (`forPeople()`, `forList()`) |
| `views-phone.js` | `viewToday()`, `viewTeam()` with `stripHTML()`, `viewPersonPhone()`, `awayChips()` |
| `views-history.js` | `viewHistory()` (`#verlauf`, desktop and phone), `historyEvents()`, `historyLink()`, `reviewPanel()` (yearly review on person pages) |
| `render.js` | `render()` incl. setup page and demo banner |
| `datepicker.js` | Own calendar for date fields on laptop and monitor: `openDp()`, `closeDp()`, `dpKey()` (called first in the keyboard handler) |
| `drawer.js` | `dateIn()`, `withField()`/`parseWith()` ("Beteiligt"), `openDrawer()` and the forms `openTopic()`, `openAbsence()`, `openAssignment()`, `openTalk()`, `openTodo()`, `openPerson()` (with `archivePerson()`), `openContacts()`, `openContact()`, `openMore()`. An `onSubmit` that opens another form itself returns `KEEP_OPEN`. |
| `capture.js` | Phone "+" sheet: `openCapture()`, `dueChoices()`, `capPreview()` |
| `setup.js` | Setup page (three steps with prefilled GitHub links, repository detection), demo mode, disconnect, `syncHTML()`, `storageActions()` |
| `onboarding.js` | "Erste Schritte" card (`firstStepsPanel()`), holiday form `openRegion()`, `notePhone()`, `phoneHint()`, the tour (`TOUR`, `offerTour()`, `startTour()`, `endTour()`, `tourStep()`, `tourPlace()`) |
| `suggest.js` | Suggestion list for `@` (team and contacts, or "als Kontakt anlegen" for an unknown name) and `#` (tags) in `#quick`, `#capText` and `#withIn`: `updateSuggest()`, `suggestKey()`, `pickSuggest()`, `closeSuggest()` |
| `events.js` | Click, submit, input and keyboard handlers |
| `drag.js` | Pointer interactions on the timeline, hover events of the todo markers |

## Storage and sync

`Store.mode` (`src/storage/store.js`):

| Mode | When | Data |
| --- | --- | --- |
| `none` | No connection on this device | Setup page |
| `demo` | `?demo=1` or "Mit Beispieldaten ausprobieren" | Sample data in memory only |
| `github` | Connected | Encrypted file `CFG.githubPath` in the user's private repo, cached on the device |

**Connection.** The setup page links to GitHub's forms for a new private repository (`GH_NEW_REPO`) and a fine-grained token (`GH_NEW_TOKEN`: name, one year, "Contents: Read and write"; the repository itself is picked by the user), then asks for the token and a passphrase. `Store.connect()` finds the repository via `GitHub.privateRepos()`: exactly one → taken; several → the page shows a select; none → a text field (`owner/name`). It checks that the repo is private, takes its default branch, derives the key and decrypts the existing file, or creates a new one (passphrase entered twice). Stored in IndexedDB under `github`: repo, branch, path, token, salt and the key as a non-extractable `CryptoKey`. The passphrase itself is never stored. The repository is never part of the code: each device stores its own.

**Encryption** (`vault.js`). AES-GCM 256, key from PBKDF2-SHA-256 with 600,000 iterations and a random salt. The file in the repo is an envelope `{app, format: 'aes-gcm-v1', kdf: {salt, iterations}, iv, data}`; a fresh IV for every commit. Without the passphrase the data cannot be read; the backup folder is the safety net.

**Sync cycle.**

1. `save()` → `Store.changed()` caches `S` in IndexedDB (`cache`) at once and schedules `push()` after `CFG.saveDelayMs`.
2. `push()` encrypts and commits with the last known `sha`. On a stale sha (409/422) it runs `pull()`, merges and retries.
3. `sync()` runs every `CFG.syncIntervalSeconds`, on focus, on `online` and when the app becomes visible. It pulls and pushes pending changes. It skips while `busy()` (drawer, drag, inline field, dialog).
4. `pull()`: no local changes → take the remote state; local changes → `mergeStates(base, local, remote)` per entry id. If the same entry changed on both devices, the local version wins and a toast says so. GitHub's commit history keeps every version.
5. `known` remembers recent shas so that a briefly stale read right after a commit is not mistaken for a remote change.
6. When the app goes to the background, pending changes are pushed immediately. Offline, changes stay cached and status shows "Offline, wird nachgereicht".
7. After a remote state is loaded, the undo stack is cleared (`resetUndo()`).
8. **Newer versions.** `push()` writes `{app, version: DATA_VERSION, …S}`; `base` and the cache stay the plain state. `normalize()` throws (`e.newer`) for data with a higher `version` than this app knows; `Store.fail()` then sets `Store.outdated`: no more pulls or pushes, sync status "Neue Version, bitte neu laden" and a banner with "Neu laden". Local changes stay in the cache and go out after the reload. Import refuses such a backup. Lists this version does not know pass through `normalize()`, `mergeStates()` and `serialize()` unchanged. Bump `DATA_VERSION` (`model.js`) for every change an older app would misread; a new optional field or list needs no bump.

**Backups** (`backup.js`). Optional backup folder (Chrome/Edge only): after every sync a plain copy `CFG.backupFileName` plus one daily copy in `CFG.backupFolder/`, older ones than `CFG.backupKeepDays` are deleted. Chromium may ask for permission again after a restart ("Sicherungsordner … erlauben" under "Mehr"). Export and import work in every browser.

Rules: never write data except via `save()`. Never put user data into `localStorage`; only `teamboard.v1.ui` (chosen timeline range) and `teamboard.v1.tour` (tour already offered on this device, per layout) live there.

## Data model

Decrypted content, also the format of backups and exports:

```json
{
  "app": "teamboard", "version": 2, "savedAt": "2026-11-06T18:42:00.000Z",
  "people":   [{ "id": "lena", "name": "Lena Hoffmann", "team": "Plattform", "createdAt": "2026-11-08T10:12:00.000Z" },
               { "id": "p4k2x9a", "name": "Jonas Weber", "team": "Kundenportal", "archived": "2026-11-08" }],
  "contacts": [{ "id": "kmark", "name": "Mark Becker" }],
  "topics":   [{ "id": "a1b2c3d", "personId": "lena", "title": "Payment-API v2", "with": ["mira"],
                 "start": "2026-10-19", "end": "2026-11-13", "status": "aktiv", "note": "" }],
  "absences": [{ "id": "…", "personId": "jonas", "kind": "Urlaub", "start": "2026-11-09", "end": "2026-11-13" }],
  "todos":    [{ "id": "…", "personId": "me", "kind": "team", "title": "Foliendeck für Mark prüfen", "with": ["kmark"],
                 "due": "2026-11-05", "done": false, "note": "" },
               { "id": "…", "personId": "me", "kind": "team", "title": "Zeiterfassung prüfen", "due": "2026-11-30",
                 "done": false, "note": "", "repeat": "m1", "series": "x7f2k1q", "anchor": "2026-11-30" }],
  "talks":    [{ "id": "…", "personId": "lena", "text": "Probezeit-Feedback", "done": true, "doneAt": "2026-11-06" }],
  "assignments": [{ "id": "…", "personId": "lena", "project": "Kranich Versicherung", "start": "2026-03-01", "end": null,
                    "billable": true, "note": "" }],
  "settings": [{ "id": "region", "value": "HE" }, { "id": "phone", "value": "2026-11-08" }]
}
```

Meanings you cannot derive from the names:

- `personId: "me"` is reserved for the user (`ME`). There is no entry in `people` for it.
- `people[].team`: the person's team (free text, suggestions from existing values). Version 1 called it `role`; `normalize()` renames it on every load.
- **People are archived, never deleted.** "Entfernen" sets `people[].archived` (date) via `archivePerson()`: running assignments end that day, planned ones are removed, everything else stays for the history, the yearly review and a later search. `team()` is the current team (use it wherever the team is listed or counted), `isActive(pid)` filters open entries of people who left out of overview lists, counts, "Zu klären" and panels. The person page (`#ma-<id>`) still works and offers "Zurück ins Team". The history keeps them in its person filter.
- `contacts`: people outside the team (boss, colleagues), ids `k` + `uid()`. No timeline row, page, absences or projects. They are never responsible (`personId`), only mentioned in `with`. Removing one sets `archived`, so mentions keep the name. `personOf()` finds team members and contacts; `mentionable()` is what `@` can address (team without archived people, plus active contacts).
- `with` on topics and todos: ids of further involved people (team members, contacts, rarely `me`), information only; responsible stays `personId`. Read it via `withOf(t)` (drops the responsible person) and `withNames(t)`. Shown in todo rows, topic lists, the timeline tooltip and hover card, the panel "Beteiligt an" on the person page, and the filter "Für" in "Meine Planung" (`forMatch()`: my own todos and topics mentioning the person, plus my to-dos about and waits for her). When a todo is dragged to another person, she leaves `with`.
- **Recurring todos:** `repeat` (`w1`, `w2`, `m1`, `m3`, `y1`, see `REPEATS`), `series` (shared by all instances) and `anchor` (first planned date). Planned dates are `anchor` + k × rhythm (`plannedAt()`, months keep the anchor's day, clamped to the month end), moved to the working day before a weekend or holiday (`workdayBefore()`). Only one instance is open: `completeTodo()` creates the next one, the first planned date after the completed due date and after today (`nextDue()`), so late completion builds no backlog. Its id is `<series>-<YYYYMMDD>`, so completing on two offline devices merges into one entry. `reopenTodo()` removes the open follow-up again. Changing the rhythm in the form restarts the series at the current due date; editing only the due date moves this instance, not the rhythm. Deleting the open instance ends the series. A recurring todo needs a due date; quick capture without "bis" starts today. Always complete via `completeTodo()`/`reopenTodo()`, never by setting `done` directly.
- `createdAt` (ISO timestamp) on every entry created since version 2, via `newEntry(o)` (adds `id` and `createdAt`) or `newTodo()`. Older entries have none; it cannot be filled in later. Together with `doneAt`, archived people and `with` ids this is what a later full-text search needs, so keep using `newEntry()` for new lists too.
- `topics[].status`: `geplant` (outlined), `aktiv` (navy), `erledigt` (grey). Stored values are German; keep them. Active and planned bars alternate between three navy tones (`tone-0` to `tone-2`, `toneMap()`): the index of the topic among the person's topics sorted by start, modulo 3. Parallel topics therefore differ, and the tone stays the same while paging. Color never means anything else; status keeps its word or icon.
- `todos[].kind`: `team` = the person's task, `mine` = the user's todo about that person, `waiting` = the user waits for something from the person. If `personId` is `me`, `kind` is always `team`. This rule lives in three places (`parseQuick`, `openTodo`, dragging) and must stay consistent.
- `absences[].kind`: `Urlaub`, `Krank`, `Schulung`, `Sonstiges`. Display via `absLabel()`: `Sonstiges` reads "Abwesend". Optional `note`, never for `Krank`.
- **Sick days are not kept as history.** `expireSick()` turns a `Krank` absence into `Sonstiges` and drops its note `CFG.sickVisibleDays` (7) days after its end. It runs after every load (`Store.resume`, `connect`, `sync`, import, demo) via `applyExpiry()`, without an undo step. The history view and the yearly review never list or count `Krank` or `Sonstiges`. Do not add a sick-day count or list anywhere; the user decided this for legal reasons.
- `doneAt` (`YYYY-MM-DD`) on todos and talks: set when completed, removed when reopened; on topics when the status becomes `erledigt`. Every form shows it for correction („Erledigt am“, „Besprochen am“; for topics only while the status is „Erledigt“). Older entries have none and show under "Ohne Datum" (topics fall back to `end`).
- `assignments`: a person on a project (free text, usually the customer) from `start` to `end` (`null` = open). Several at once are allowed. `billable` per assignment; a new one takes the value of the last assignment with the same project name. Helpers in `model.js`: `asgActive()`, `currentAssignments()`, `projectLabel()` ("Kranich Versicherung +1"), `teamLine()` ("Plattform · Kranich Versicherung").
- `settings`: user settings that travel with the data, `{id, value}`, merged per id like every list. Read with `getSetting(id, default)`/`hasSetting(id)`, write with `setSetting(id, value)` and `save()`. Ids: `region` (state code for holidays, `''` = nationwide only; missing = not chosen yet), `phone` (date a phone first connected, set by `notePhone()`), `onboarded` (date "Erste Schritte" was hidden).
- Dates are `YYYY-MM-DD` without time. `end` is inclusive.
- IDs come from `uid()` (7 chars base36). New people get `p` + `uid()`, contacts `k` + `uid()`, follow-ups of recurring todos `<series>-<YYYYMMDD>`. Merging relies on ids, never reuse them.

A new field needs no migration as long as missing values are handled (`t.prio ?? 'normal'`). Only for renames or changed meaning bump `DATA_VERSION` and migrate in `normalize()`; older apps then stop writing (see "Newer versions" above). `normalize()` keeps exactly the lists `empty()` knows; a new top-level list must be added to `empty()` and `Store.serialize()`.

## Dates

Never do day arithmetic with `Date` objects. The app uses UTC day numbers:

- `dn("2026-11-06")` → day number, `ds(n)` → ISO date.
- `TDN` and `TODAY` are today. `wdOf(n)` returns 0 = Sunday. `mondayOf(n)` the week's Monday.
- **Holidays:** `holidays.js` computes the nine nationwide holidays plus those of the state in the setting `region` (`REGIONS`, `REGIONAL_HOLIDAYS` with the year they were introduced, Buß- und Bettag for Sachsen) per year from fixed dates and Easter (`easterSunday()`, Gregorian computus), so they need no data source and no yearly update. Holidays of single municipalities are left out. `holidaysOf(y, region)` is cached per region and year. The user picks the state in "Erste Schritte" or under "Mehr" → "Feiertage" (`openRegion()`); until then only nationwide holidays count. `holidayOn(n)` returns the name or `null`. `CFG.extraHolidays` adds one-off holidays (`'YYYY-MM-DD'`) or extra days off every year (`'MM-DD'`). Holidays look like weekends in the timeline (header shows the name from 100 px, tooltip otherwise), in the phone strip and in the calendar, `workdays()` leaves them out (absence day counts, yearly review), the overline shows today's holiday, and "Zu klären" flags open todos due on one. Holiday columns in one and two weeks stay full width.
- Display: `dm()` → "6.11.", `longDay()` → "Freitag, 6.11.", `dueLabel()` → "heute", "morgen" or "Fr 6.11.", `isoWeek()`.
- **Date fields in forms:** always `dateIn(name, iso)` (`drawer.js`), never a bare `<input type="date">`: Chrome and Edge show native date inputs in the browser language, e.g. mm/dd/yyyy. `dateIn()` is a text field in TT.MM.JJJJ (`deDate()`) plus a calendar button. On laptop and monitor the button opens the own calendar (`datepicker.js`: German, Monday first, ISO weeks, „Heute“ and „Leeren“, arrows/PageUp/PageDown/Home/End, Esc closes only the calendar, Alt+↓ in the field opens it), because the native popup of Chrome and Edge follows the browser language and cannot be styled. On the phone (`isPhone()` when the form is built) the button holds a hidden native input, whose iOS picker is fine. `parseDeDate()` reads 6.11.2026, 06/11/2026, 6.11. (current year) and ISO; `formValues(form)` converts all `[data-date]` fields to ISO before `onSubmit` and reports invalid ones.

## UI state and routing

`ui` holds what does not belong in the data: `filter`, `tab` (per person), `forPid` (filter "Für" in "Meine Planung"), `off` (week offset), `range` (`week`/`two`/`six`), `more`, `showDone`, `hist` (history filters: `type`, `pid`, `q`, `weeks`), `year` (review year per person). Only `range` is remembered.

Routes: `#uebersicht`, `#ich`, `#ma-<personId>`, `#team` (phone team view; desktop shows the overview), `#verlauf` (history, desktop and phone). Unknown hashes show the overview. On the phone the overview is called "Heute" (`viewToday()`); the history is reached via "Mehr" and the link at the end of "Heute".

## Quick capture and suggestions

`parseQuick(raw, ctx)` returns `{type:'todo', title, personId, kind, due, with, repeat}` or `{type:'absence', personId, absKind, start, end, note}`, plus `unknown` or `ambiguous` (several people match).

- Several `@` are allowed (`parseMentions()`): the first team member or `@ich` is responsible and leaves the title; contacts and every further person go into `with` and stay in the title as plain names. "@ich Foliendeck für @Mark prüfen" is my todo "Foliendeck für Mark prüfen" with Mark involved; "Folien für @Mark" too, because a contact cannot be responsible. An unknown name stays as text and the preview says so; the suggestion list offers "„Name“ als Kontakt anlegen" when nobody matches.
- `@` resolves full names first (longest match, so "@Fabian Müller Review" works), then one word that starts a first or last name; an exact word wins over prefixes. Several matches → `ambiguous`: nothing is created, the preview names the candidates.
- **Due date in the text:** "am", "zum" or "bis" plus a date (`takeDate()`): `12.11`, `12.11.2026`, `heute`, `morgen`, `Fr`, `Freitag` (`parseDateWord()`) or day plus month name, `12. November`, `3. Dez 2027` (`MONTHS`). "heute", "morgen" and "übermorgen" also count alone (`takeLoneDay()`). Other dates need the keyword on purpose: titles contain numbers and weekdays ("Release 4.2", "Termin Freitag absagen"). A keyword followed by no date ("am Ende") stays in the title. Without a year, a date more than 60 days back means next year (`mkDate()`).
- Todo tags `#ich`/`#meins`, `#wartet`. Repeat tags `#wöchentlich`, `#zweiwöchentlich`, `#monatlich`, `#quartalsweise`, `#jährlich` (`REPEAT_TAGS`, matched after `fold()`, so without umlauts too). Absence tags `#urlaub`, `#krank`, `#schulung`, `#abwesend` (`ABS_TAGS`): "bis X" is the end, "ab/vom/am X" or a lone date word the start, default today. Remaining text becomes the note, except for `#krank`.
- `firstName(p)` returns "Fabian M." when two people share a first name; `mentionText(p)` is what the suggestion list inserts (first name, or the full name if shared).
- The suggestion list (`suggest.js`) opens on `@` or `#`, filters while typing, ↑/↓ move, Tab and Enter take the marked entry, Esc closes only the list. It closes by itself when the token is already complete, so Enter then submits. Picking uses `pointerdown` with `preventDefault()` so the field keeps focus. `Store.busy()` is true while it is open.
- Phone sheet: an absence tag switches to the prefilled absence form on submit (`openCapture('absence', '', preset)`).

## Timeline

`layout()` computes columns from `tlAvail()` (content width of `#main` minus card border and label column `LABEL`: 200 px, 168 px on the icon-bar layout). `T.fine` is true for one and two weeks: day headers, a click on a day creates a todo (six weeks: a topic). One week = 7 columns, two weeks = 14: weekdays wide, Saturday and Sunday 48 px (`WEEKEND`) unless today or with open todos due. Below 140 px the header shows "Mo" instead of "Montag"; in two weeks Mondays carry the week number from 110 px. Six weeks = 42 equal columns. Paging: one and two weeks move by one week, six weeks by two. Always position via `colOf()`, `pos()` and `dayAt()`. Always position via `colOf()`, `pos()` and `dayAt()`.

Open todos sit under the topic bars on their due day in every view; overdue ones move to today's column while it is visible. The column width decides the form, not the view: from `CHIP_MIN` (100 px) cards with title, below that one round marker per person and day (`markHTML()`): one todo shows its look (team outlined, mine coral, waiting grey, overdue red with "!"), several show their number in the look of the most urgent one. Hovering or focusing a card or marker shows a hover card with the full title, kind, due date and the start of the note in every view (`#tlPop`, `position:fixed` because the timeline clips). It opens after `HOVER_MS` (150 ms) below a marker and after `HOVER_CHIP_MS` (350 ms) beside a card, so the cards below stay visible and moving across the board stays calm. Cards carry no `title` attribute, which would show a second tooltip. A single-todo marker drags and opens like a card; a click on a marker with several pins the card, its entries open the todo. On a 27" monitor two weeks show cards, on the 13" laptop markers. Topics are greedily placed on lanes.

Pointer interactions (`drag.js`) share one `drag` object with a `type`: `bar` (move, or resize via `.h-l`/`.h-r`), `todo` (drop on a day and person via `elementFromPoint`), `create` (drag on empty area, then `inlineCreate()`). The inline field (`#tlNew`) creates a topic from plain text; an absence tag makes an absence over the dragged range, `#ich`/`#meins`/`#wartet` or a repeat tag a todo due on the last dragged day (`inlineParse()`, which uses `parseQuick()` once a tag is present). The hint below the field (`inlineHint()`) says what Enter will create. It offers `#` suggestions only; their list is `position:fixed` (`.sug-float`) because the timeline clips. After a drag, `suppressUntil` prevents the following click from opening a form; new pointer logic must do the same. On touch `create` does not start, so swiping scrolls. The phone has no timeline.

## Layout and devices

`applyLayout()` is the single source: it sets classes on `<html>`; CSS and `render()` follow them.

| Area | `layoutKey()` | Class | Applies | Test viewports |
| --- | --- | --- | --- | --- |
| Phone | `phone` | `lay-phone` | below 700 px wide, or touch and below 500 px high | 440 × 956, 393 × 852, 956 × 440 |
| Laptop | `rail` | `lay-rail` | 700 to 1439 px | 1280 × 800, 1280 × 700 |
| Monitor | `side` | none | from 1440 px | 1920 × 1080, 2560 × 1440 |

Plus `touch` for a coarse pointer.

- **Monitor:** 264 px sidebar. From 1800 px the right-column panels flow into two columns, from 2200 px into three (`.split>.stack` with CSS `columns`).
- **Laptop:** the sidebar becomes a 76 px icon bar (avatars with counters, absence dot, name as `title`). Sync status as a dot; backups and connection under "Mehr" (`openMore()`).
- **Phone:** own views with the same data, actions and forms. Bottom tab bar: Heute, Team, "+", Ich, Mehr. Forms are bottom sheets (same markup as the drawer); `--kb` and `--vvh` keep them above the keyboard. The page scrolls as a whole. Tap targets at least 44 px, inputs at least 16 px font, safe areas via `env(safe-area-inset-*)`.
- **Resize and rotation:** `applyLayout()` runs at once, `render()` only when width or layout area changes. Height-only changes (Safari's address bar, keyboard) never re-render.

## Design

Values are CSS variables in `styles/tokens.css`; role variables point to base colors. Change values there only.

| Role | Variable | Value |
| --- | --- | --- |
| Page | `--bg-page` | `paper` #f7f7fa |
| Cards | `--surface-card` | `white`, 1px `neutral-200`, radius 28 px, `shadow-sm` |
| Navigation | `--side-bg` | `navy-800` with `paper` text |
| Headings | `--text-strong` | `navy-800` |
| Body text | `--text-body` | `neutral-800` |
| Secondary text | `--text-muted` | `neutral-600` |
| Main action | `--accent` | `coral-500`, hover `coral-600`, pressed `coral-700` |
| Default button | `--primary` | `navy-800` |
| Active topics | `--bar`, `--bar-2`, `--bar-3` | `navy-800`, `navy-600`, `navy-200` (text `navy-800`) |
| Today | `--today`, `--accent-text` | `coral-50`, `coral-700` |
| Status | `--late*`, `--warn*` | `error-*`, `warning-*` |

Rules most often broken:

- **Coral sparingly:** exactly one main action per view (desktop "Thema anlegen", phone "+"), plus active states, focus ring, today and "Mein To-do".
- **Nothing is sharp:** buttons, tags, badges, bars and cards are pills (`999px`); fields 12 px; cards 28 px; toasts 20 px.
- **Fields and outlined elements have a 2 px border**, surfaces 1 px.
- **Shadows are navy-tinted**, never black. No gradients, no colored left edges on cards.
- **Typography:** Nunito Sans only. `h1` 48 px 900, section titles `.h4` 22 px 700, body 16 px, labels and buttons 700 to 800, caps only in `.overline`.
- **Icons:** Lucide 0.544.0, 2 px stroke, `currentColor`. Add new ones as path strings to `ICONS`, never emoji or Unicode symbols.
- **Status always has a word or icon** in addition to color.

To update the font (Python with `fonttools` and `brotli`):

```python
from fontTools import subset; from fontTools.ttLib import TTFont
o=subset.Options(); o.flavor='woff2'; o.layout_features=['*']
f=TTFont('NunitoSans-Variable.ttf'); s=subset.Subsetter(o)
s.populate(unicodes=list(range(0x20,0x7f))+list(range(0xa0,0x180))+[0x2013,0x2014,0x2018,0x2019,0x201a,0x201c,0x201d,0x201e,0x2026,0x20ac,0x2022,0x2212])
s.subset(f); f.flavor='woff2'; f.save('assets/fonts/nunito-sans.woff2')
```

## UI texts (German)

- Address the user with "du", sentence case, short sentences.
- Buttons are verbs: "Thema anlegen", "Eintragen", "Speichern". No "OK".
- Errors state cause and fix, without apologizing: "Bitte gib einen Titel ein."
- Empty states say what will appear and how to add it.
- Typographic quotes „…“ and apostrophe ’ in visible text; straight quotes only in code.
- No dashes as a stylistic device, no emoji, no exclamation marks in messages.
- Every text containing user data goes through `esc()`.

## Recipes

**New entry in any list.** Create it with `newEntry({...})` (or `newTodo()` for todos) so it gets `id` and `createdAt`.

**New field on a topic (e.g. priority).** Add a `field(…)` or `group(…, radios(…))` in `openTopic()` and read it in `onSubmit`. Show it in `barHTML()` (timeline) and the topic list in `personParts()`. Handle missing values with `??`.

**New action.** Render the element with `data-action="name"` and `data-id`, add `case'name':` in `src/ui/events.js`: change `S`, `save()`, `render()`, `toast(text, true)` for undo.

**New panel.** A function returning `<section class="card card-pad">` with `<div class="panel-head"><h2 class="h4">Titel</h2></div>` and `.prow` rows (model: `issuesPanel()`, `absencePanel()`). Desktop: into the `<div class="stack">` of `viewOverview()`/`viewPerson()`. Phone: into the `<div class="m-stack">` of `viewToday()`/`viewPersonPhone()`. Everything must stay reachable on the iPhone.

**New "Zu klären" rule.** Push `{kind:'late'|'warn', act, id, pid, text}` in `issues(pid)`; `act` is an existing action like `edit-topic`. Existing rules: overdue topics, topics overlapping absences, todos due on absence days or holidays, assignments ending within 21 days without a follow-up.

**New setting.** A developer setting goes into `CFG` in `src/config.js` with a comment; read `CFG.name` in code. A user setting that should be the same on every device goes into `S.settings` via `setSetting()` (document the id under "Data model"); a device-only preference into `localStorage` under `KEY`.

**New tour step.** Add `{hash, sel: [selectors], title, text}` to `TOUR.desktop` and/or `TOUR.phone` in `onboarding.js`. The first visible selector is highlighted; give the target a `data-tour="…"` attribute instead of relying on layout classes. The tour runs on `demo()` data, so the target must exist there. The smoke test walks every step on every viewport and checks that card and highlight stay on screen.

**New "Erste Schritte" item.** Add `[done, label, action]` to `firstSteps()`. `done` must be derived from the data (or the device), never stored as a checkbox.

**New keyboard shortcut.** In the keyboard handler inside `if(!typing&&!open&&…)`, and document it in the sidebar footer (`renderSide()`) and in `openMore()`. Taken: N, W, 2, 6, Ctrl+Z, Esc, Enter.

**New quick capture command.** Extend `parseQuick()` and `previewHTML()`; the phone sheet uses `parseQuick()` and `capPreview()` too. A new tag also goes into `TAG_HELP` in `suggest.js`.

**New event type in the history.** Push `{type, day, pid, title, sub, act, id}` in `historyEvents()` and add the type to `HIST_TYPES` and `HIST_ICONS`.

**New type in the phone capture sheet.** Add it to `CAP_TYPES` and a branch in `openCapture()` with `openDrawer({…, top, capture:'<type>'})`. The text field gets `autofocus` so Safari opens the keyboard inside the tap gesture.

**Layout differences.** Decide via `.lay-phone`/`.lay-rail` and `isPhone()`/`layoutKey()`, never via own media queries for phone or laptop. Only wide monitors use `@media (min-width:1800px)` and `2200px`.

## Running and testing

Local: `python -m http.server 8000` in the repo root, then `http://localhost:8000/?demo=1` (sample data) or `/` (real connection). `file://` does not work (service worker, API calls).

Test after every change:

```
pip install playwright && python -m playwright install chromium
python tests/smoke_test.py
```

The test covers demo mode, todo markers, two-week view, calendar, holidays per state, quick capture (incl. suggestions with two equal first names, ambiguity, `#krank`, `#urlaub` across the new year, several `@`, new contact from the suggestion list, `#monatlich`, due dates with "am"/"zum"/month names), sick-day expiry, history view and search, projects panel and "Zu klären", migration `role` → `team`, involved people and the filter "Für", "Erledigt am" on topics, recurring todos, archiving and restoring a person, views, drag-to-create and undo; GitHub sync against a mocked API (setup links, repository detection and choice, tour offer, "Erste Schritte", encryption, wrong passphrase, second device, merge of concurrent edits, offline start and catch-up, the tour from a connected board without commits, unknown lists, data from a newer version); every tour step; and every viewport in `SIZES` with the main flows (touch on iPhone), overflow checks and screenshots in `tests/screenshots/` (ignored by git). `python tests/smoke_test.py iphone` runs only the iPhone viewports. Add a `check(…)` only for things that broke before or are easy to break.

Console helpers: `TB.state()`, `TB.store`, `TB.demo()`. `?nosw=1` disables the service worker.

## Deployment

GitHub Pages serves `main` from the repo root (`https://<owner>.github.io/<repo>/`). A push to `main` is live within a minute. Forks deploy the same way. The service worker is network-first, so an online start always loads the latest version. If you change the list of files, nothing else needs updating; bump `CACHE` in `sw.js` only to drop old cached files.

## Decisions and their reasons

So you do not re-open settled questions without a new reason:

- **GitHub as storage**, not a server or database: free, no own domain, versioned history, works from Safari on the iPhone. OneDrive/SharePoint via Graph API was rejected (needs an app registration in the company tenant); the old local-file mode was removed because iOS Safari cannot write files.
- **Client-side encryption** because the data includes absences such as sick days and one-on-one notes. The data repo is private on top of that.
- **No sick-day history** (7.11.2026): sick days are health data. The board shows who is sick now and turns the entry into "Abwesend" 7 days after its end. Older versions in the GitHub history and daily backups still contain "Krank"; they are encrypted or local.
- **Projects as assignments with periods**, not a field on the person: the user needs to see later who was on which project when. `billable` per assignment because one customer can have billable and internal phases. No project directory; names are free text with suggestions.
- **Suggestion list inserts text**, not a hidden id: the resolution lives in the field value, so it survives `render()` (`keepFields()` keeps only value and caret).
- **Per-entry merge, local wins on true conflicts:** single user, conflicts are rare, GitHub history keeps every version.
- **No build, classic scripts:** the tool is small and maintained occasionally; a toolchain would cost more than it saves.
- **Network-first service worker:** the user always gets the latest version online and can still start offline.
- **One responsible person per entry, others only mentioned** (8.11.2026): responsibility stays clear and `kind` keeps its meaning. Involved team members do not get the bar in their own timeline row; they see it under "Beteiligt an" on their page.
- **Contacts as their own list**, not a flag on `people` (8.11.2026): every team view keeps reading the team, and the boss never lands in counts such as "x von y fakturierbar".
- **Archive instead of delete** (8.11.2026): the user wants past topics and todos of people who left, for the history and a later search.
- **Recurring todos with one open instance** (8.11.2026): the timeline shows no future copies; the rhythm comes from the anchor, so it never drifts, and late completion creates no backlog.
- **Data repository per device, not in the code** (8.11.2026): anyone can use the published app with their own private repository, without a fork. The token decides which repository the app sees.
- **Holidays per state as a synced setting** (8.11.2026): computed like before, no data source; the state belongs to the data, so every device shows the same days off.
- **Tour on sample data** (8.11.2026): a new board is empty, a tour across empty areas explains nothing. The tour switches to `demo()` without syncing and returns with `Store.resume()`, which reloads the cached own data. "Erste Schritte" then guides through the first real entries. No tour library (no dependencies).

## Pitfalls

- **`render()` during input:** only fields in `#main` with `id` or `data-add` survive. Check `Store.busy()` before automatic re-renders.
- **The toast covers the bottom edge** for 6 seconds. In tests, scroll elements to the center.
- **Folder pickers and permission prompts need a user gesture.** Never call them on load.
- **`kind` for `personId: "me"`** must be `team`, otherwise the todo disappears from "Meine Planung".
- **Hash names** only letters, digits and hyphens.
- **Grid and flex children on the phone** need `min-width:0`, otherwise horizontally scrolling content widens the page. `.m-stack` and `.pcard` already set it.
- **Safari zooms into inputs below 16 px.** Keep all inputs at 16 px or more.
- **Nothing only on hover.** Provide a visible form under `@media (hover:none)` or `.lay-phone`.
- **Safari fires `resize` when its address bar moves.** The resize handler re-renders only on a different width or layout area. Keep it that way.
- **iPhone keyboard** opens only if a field gets focus inside the tap gesture. `openDrawer()` focuses `[autofocus]` synchronously.
- **Home screen app on iOS** has its own storage, separate from Safari. Set it up inside the home screen app.
- **Token expiry:** a 401 shows "Der Token ist ungültig oder abgelaufen". Fix: "Mehr" → "Auf diesem Gerät abmelden", connect with a new token.
- **The tour layer (`#tour`) takes every click and key** while it runs and counts as `Store.busy()`. It lives outside `#main`, so `render()` does not remove it; `tourPlace()` repositions on resize and scroll.

## Deliberately not included

Multiple users, own server, notifications, calendar integration. Discuss with the user before adding any of these.

On the phone deliberately not: timeline with dragging, drag-to-create, keyboard shortcuts. No tablet layout; an iPad gets the laptop or monitor layout depending on width. Everything must still be visible and editable on the iPhone.
