# Data model

Read this before you add or change a field, a list or a setting. Overview and ground rules are in `AGENTS.md`.

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
  "settings": [{ "id": "region", "value": "HE" }, { "id": "phone", "value": "2026-11-08" }],
  "acks":     [{ "id": "abs-a1b2c3d", "sig": "2026-11-13", "items": ["…:2026-11-12:2026-11-13"], "at": "2026-11-09" }]
}
```

Meanings you cannot derive from the names:

- `personId: "me"` is reserved for the user (`ME`). There is no entry in `people` for it.
- `people[].team`: the person's team (free text, suggestions from existing values). Version 1 called it `role`; `normalize()` renames it on every load.
- **People are archived, never deleted.** "Entfernen" sets `people[].archived` (date) via `archivePerson()`: running assignments end that day, planned ones are removed, everything else stays for the history, the yearly review and a later search. `team()` is the current team (use it wherever the team is listed or counted), `isActive(pid)` filters open entries of people who left out of overview lists, counts, "Zu klären" and panels. The person page (`#ma-<id>`) still works and offers "Zurück ins Team". The history keeps them in its person filter.
- `contacts`: people outside the team (boss, colleagues), ids `k` + `uid()`. No timeline row, page, absences or projects. They are never responsible (`personId`), only mentioned in `with`. Removing one sets `archived`, so mentions keep the name. `personOf()` finds team members and contacts; `mentionable()` is what `@` can address (team without archived people, plus active contacts).
- `with` on topics and todos: ids of further involved people (team members, contacts, rarely `me`), information only; responsible stays `personId`. Read it via `withOf(t)` (drops the responsible person) and `withNames(t)`. Shown in todo rows, topic lists, the timeline tooltip and hover card, the involved lane of topics in the timeline and the phone team grid (see `timeline.md`), the panel "Beteiligt an" on the person page, and the filter "Für" in "Meine Planung" (`forMatch()`: my own todos and topics mentioning the person, plus my to-dos about and waits for her). When a todo is dragged to another person, she leaves `with`.
- **Recurring todos:** `repeat` (`w1`, `w2`, `m1`, `m3`, `y1`, see `REPEATS`), `series` (shared by all instances) and `anchor` (first planned date). Planned dates are `anchor` + k × rhythm (`plannedAt()`, months keep the anchor's day, clamped to the month end), moved to the working day before a weekend or holiday (`workdayBefore()`). Only one instance is open: `completeTodo()` creates the next one, the first planned date after the completed due date and after today (`nextDue()`), so late completion builds no backlog. Its id is `<series>-<YYYYMMDD>`, so completing on two offline devices merges into one entry. `reopenTodo()` removes the open follow-up again. Changing the rhythm in the form restarts the series at the current due date; editing only the due date moves this instance, not the rhythm. Deleting the open instance ends the series. A recurring todo needs a due date; quick capture without "bis" starts today. Always complete via `completeTodo()`/`reopenTodo()`, never by setting `done` directly.
- `createdAt` (ISO timestamp) on every entry created since version 2, via `newEntry(o)` (adds `id` and `createdAt`) or `newTodo()`. Older entries have none; it cannot be filled in later. Together with `doneAt`, archived people and `with` ids this is what a later full-text search needs, so keep using `newEntry()` for new lists too.
- `topics[].status`: `geplant` (outlined), `aktiv` (navy), `erledigt` (grey). Stored values are German; keep them. Active and planned bars alternate between three navy tones (`tone-0` to `tone-2`, `toneMap()`): the index of the topic among the person's topics sorted by start, modulo 3. Parallel topics therefore differ, and the tone stays the same while paging. Color never means anything else; status keeps its word or icon.
- `todos[].kind`: `team` = the person's task, `mine` = the user's todo about that person, `waiting` = the user waits for something from the person. If `personId` is `me`, `kind` is always `team`. This rule lives in three places (`parseQuick`, `openTodo`, dragging) and must stay consistent.
- `topics[].side`: `true` for a topic that runs on the side („Nebenthema“ in the form); missing = main topic. Side topics never get absence warnings, overdue ones still count as late. See `absRisk()` in `issues.js`.
- `acks`: yellow "Zu klären" issues the user marked as clarified („Als geklärt markieren“). `id` names the issue (`abs-<topic>`, `tabs-<todo>` absence on the due date, `thol-<todo>` holiday, `asg-<assignment>`), `sig` the date it hangs on (topic end, due date, assignment end), `items` the absences behind it (`<id>:<start>:<end>`). The issue stays hidden while `sig` is equal and its current absences are a subset of `items`; a moved date or a new or changed absence brings it back, an absence that is over does not. `ackIssue()` drops entries whose issue is gone. Red issues (late) cannot be acknowledged.
- `absences[].half`: `am` (Vormittag) or `pm` (Nachmittag) on an absence of a single day; missing = whole day. Counts half a workday (`absDays()`), is drawn over half the day column (morning left, afternoon right) and raises no "Zu klären" warning (`absentFull()`, `absRisk()`). Forms show „Tageszeit“ only while Von equals Bis.
- `absences[].kind`: `Urlaub`, `Krank`, `Schulung`, `Sonstiges`. Display via `absLabel()`: `Sonstiges` reads "Abwesend". Optional `note`, never for `Krank`.
- **Sick days are not kept as history.** `expireSick()` turns a `Krank` absence into `Sonstiges` and drops its note `CFG.sickVisibleDays` (7) days after its end. It runs after every load (`Store.resume`, `connect`, `sync`, import, demo) via `applyExpiry()`, without an undo step. The history view and the yearly review never list or count `Krank` or `Sonstiges`. Do not add a sick-day count or list anywhere; the user decided this for legal reasons.
- `doneAt` (`YYYY-MM-DD`) on todos and talks: set when completed, removed when reopened; on topics when the status becomes `erledigt`. Every form shows it for correction („Erledigt am“, „Besprochen am“; for topics only while the status is „Erledigt“). Older entries have none and show under "Ohne Datum" (topics fall back to `end`).
- `assignments`: a person on a project (free text, usually the customer) from `start` to `end` (`null` = open). Several at once are allowed. `billable` per assignment; a new one takes the value of the last assignment with the same project name. Helpers in `model.js`: `asgActive()`, `currentAssignments()`, `projectLabel()` ("Kranich Versicherung +1"), `teamLine()` ("Plattform · Kranich Versicherung").
- `settings`: user settings that travel with the data, `{id, value}`, merged per id like every list. Read with `getSetting(id, default)`/`hasSetting(id)`, write with `setSetting(id, value)` and `save()`. Ids: `region` (state code for holidays, `''` = nationwide only; missing = not chosen yet), `phone` (date a phone first connected, set by `notePhone()`), `onboarded` (date "Erste Schritte" was hidden).
- Dates are `YYYY-MM-DD` without time. `end` is inclusive.
- IDs come from `uid()` (7 chars base36). New people get `p` + `uid()`, contacts `k` + `uid()`, follow-ups of recurring todos `<series>-<YYYYMMDD>`. Merging relies on ids, never reuse them.

A new field needs no migration as long as missing values are handled (`t.prio ?? 'normal'`). Only for renames or changed meaning bump `DATA_VERSION` and migrate in `normalize()`; older apps then stop writing (see "Newer versions" in `storage.md`). `normalize()` keeps exactly the lists `empty()` knows; a new top-level list must be added to `empty()` and `Store.serialize()`.
