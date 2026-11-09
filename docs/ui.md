# UI files, state and routing

Function index of `src/ui/`, UI state and routes. Use it to find things; the code is the source of truth.

## UI files

| File | Contents |
| --- | --- |
| `layout.js` | `MQ_PHONE`, `isPhone()`, `isLand()`, `layoutKey()`, `applyLayout()` |
| `icons.js` | `ICONS` (Lucide paths) and `ic(name, size, stroke)` |
| `feedback.js` | `toast(text, withUndo)`, `showDialog()`, `closeDialog()` |
| `sidebar.js` | `renderSide()`: sidebar, icon bar or phone tab bar. `KEYS`/`keysHTML()` (shortcut list for the sidebar footer and "Mehr"), `MORE_SUB()` |
| `timeline.js` | `tlAvail()`, `layout()`, `pos()`, `dayAt()`, headers, bars (`toneMap()`), lanes (`placeLanes()`), involved lane (`involvedTopics()`, `wbarHTML()`), todo cards and markers, `timeline()`, `tlSection()`, hover card of markers (`showPop()`, `hidePop()`) |
| `views-desktop.js` | `quickBlock()`, `todoRow()`, overview (`viewOverview()`, `todoGroups()`, `todoListHTML()`, panels incl. `projectsPanel()`), person page (`personParts()`, `assignmentsPanel()`, `involvedPanel()`, `viewPerson()`), filter "Für" of "Meine Planung" (`forPeople()`, `forList()`) |
| `views-phone.js` | "Heute" (`viewToday()` with folding cards `foldCard()`, `todoListPhone()`, `redKeys()`), team grid (`viewTeam()`, `gridRows()`, `gridBar()`, `dayList()`, `teamLand()`, `restoreGridScroll()`, `colStart()`/`colEnd()`/`colDay()`), `viewPersonPhone()`, `awayChips()` |
| `views-history.js` | `viewHistory()` (`#verlauf`, desktop and phone), `historyEvents()`, `historyLink()`, `reviewPanel()` (yearly review on person pages) |
| `render.js` | `render()` incl. setup page and demo banner |
| `datepicker.js` | Own calendar for date fields on laptop and monitor: `openDp()`, `closeDp()`, `dpKey()` (called first in the keyboard handler); range picking for linked start and end fields (`docs/dates.md`) |
| `drawer.js` | `dateIn()`, `withField()`/`parseWith()` ("Beteiligt"), `openDrawer()` and the forms `openTopic()`, `openAbsence()`, `openAssignment()`, `openTalk()`, `openTodo()`, `openPerson()` (with `archivePerson()`), `openContacts()`, `openContact()`, `openMore()`. An `onSubmit` that opens another form itself returns `KEEP_OPEN`. |
| `capture.js` | Phone "+" sheet: `openCapture()`, `dueChoices()`, `capPreview()` |
| `setup.js` | Setup page (three steps with prefilled GitHub links, repository detection), demo mode, disconnect, `syncHTML(full)` (compact in the sidebar, with repository in "Mehr"), `storageActions()` (entries of "Mehr") |
| `onboarding.js` | "Erste Schritte" card (`firstStepsPanel()`), holiday form `openRegion()`, `notePhone()`, `phoneHint()`, the tour (`TOUR`, `offerTour()`, `startTour()`, `endTour()`, `tourStep()`, `tourPlace()`) |
| `suggest.js` | Suggestion list for `@` (team and contacts, or "als Kontakt anlegen" for an unknown name) and `#` (tags) in `#quick`, `#capText` and `#withIn`: `updateSuggest()`, `suggestKey()`, `pickSuggest()`, `closeSuggest()` |
| `events.js` | Click, submit, input and keyboard handlers |
| `drag.js` | Pointer interactions on the timeline, hover events of the todo markers |


## UI state and routing


`ui` holds what does not belong in the data: `filter`, `tab` (per person), `forPid` (filter "Für" in "Meine Planung"), `off` (week offset), `range` (`week`/`two`/`six`), `more`, `showDone`, `hist` (history filters: `type`, `pid`, `q`, `weeks`), `year` (review year per person), on the phone `fold` (open cards of "Heute"), `redSeen` (red issues present when "Zu klären" was folded), `grp` (open todo groups), `toff` and `tday` (week and day of the upright team grid), `lgX` (scroll position of the sideways grid). `range`, `fold` and `redSeen` are remembered per device (`saveUi()`, `teamboard.v1.ui`).

Routes: `#uebersicht`, `#ich`, `#ma-<personId>`, `#team` (phone team view; desktop shows the overview), `#verlauf` (history, desktop and phone). Unknown hashes show the overview. On the phone the overview is called "Heute" (`viewToday()`); the history is reached via "Mehr" and the link at the end of "Heute".

Phone "Heute": the todo list shows overdue and today, "Rest der Woche", "Nächste Woche" and "Später" are folded groups. Todos, "Zu klären", absences and talking points are folding cards (`foldCard()`): the head is one button with title, summary and chevron, an action of the panel ("Eintragen", "n geklärte anzeigen") sits beside it while open. The bodies come from the same functions as the desktop panels (`absenceRows()`, `talkRows()`, `issuesBody()`/`issuesToggle()`). "Zu klären" opens by itself when a red issue appears that was not there when it was folded (`redKeys()` against `ui.redSeen`): red issues must not be hidden. "Projekte heute" is desktop only.


## Updating the font

To update the font (Python with `fonttools` and `brotli`):

```python
from fontTools import subset; from fontTools.ttLib import TTFont
o=subset.Options(); o.flavor='woff2'; o.layout_features=['*']
f=TTFont('NunitoSans-Variable.ttf'); s=subset.Subsetter(o)
s.populate(unicodes=list(range(0x20,0x7f))+list(range(0xa0,0x180))+[0x2013,0x2014,0x2018,0x2019,0x201a,0x201c,0x201d,0x201e,0x2026,0x20ac,0x2022,0x2212])
s.subset(f); f.flavor='woff2'; f.save('assets/fonts/nunito-sans.woff2')
```
