# Running and testing

Details on the smoke test. The short version is in `AGENTS.md`.

Local: `python -m http.server 8000` in the repo root, then `http://localhost:8000/?demo=1` (sample data) or `/` (real connection). `file://` does not work (service worker, API calls).

Test after every change:

```
pip install playwright && python -m playwright install chromium
python tests/smoke_test.py
```

The test covers demo mode, todo markers, two-week view, calendar, holidays per state, quick capture (incl. suggestions with two equal first names, ambiguity, `#krank`, `#urlaub` across the new year, several `@`, new contact from the suggestion list, `#monatlich`, due dates with "am"/"zum"/month names), sick-day expiry, history view and search, projects panel and "Zu klären", migration `role` → `team`, involved people (incl. the involved lane in the timeline) and the filter "Für", "Erledigt am" on topics, recurring todos, archiving and restoring a person, views, drag-to-create and undo; GitHub sync against a mocked API (setup links, repository detection and choice, tour offer, "Erste Schritte", encryption, wrong passphrase, second device, merge of concurrent edits, offline start and catch-up, the tour from a connected board without commits, unknown lists, data from a newer version); every tour step; and every viewport in `SIZES` with the main flows (touch on iPhone), overflow checks and screenshots in `tests/screenshots/` (ignored by git). `python tests/smoke_test.py iphone` runs only the iPhone viewports. Add a `check(…)` only for things that broke before or are easy to break.

Console helpers: `TB.state()`, `TB.store`, `TB.demo()`. `?nosw=1` disables the service worker.

Things that make tests flaky:

- **The toast covers the bottom edge** for 6 seconds. Scroll elements to the center before clicking.
- **A focused quick field shows its preview** (`.qprev`). Clicking elsewhere blurs it, the preview collapses and everything below moves up between mousedown and mouseup, so the click misses. Blur the field first (`document.activeElement.blur()`).
