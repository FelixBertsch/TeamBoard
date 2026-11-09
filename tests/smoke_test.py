"""
End-to-end test for the Teamboard (Python 3 + Playwright with Chromium).
  pip install playwright && python -m playwright install chromium
  python tests/smoke_test.py            everything
  python tests/smoke_test.py iphone     only viewports whose name contains "iphone"
Checks: demo mode, quick capture, views, todo markers with hover card, two-week view, calendar, holidays per state, drag-to-create, undo; GitHub sync against a mocked API
(setup with repository detection, encryption, second device, merge of concurrent edits, offline start from cache, tour from a connected board);
then per viewport (27", 13", iPhone portrait and landscape): no JS errors, no horizontal overflow,
the main flows (touch on iPhone, incl. the team grid and moving a topic by hold and drag) and screenshots in tests/screenshots/.
"""
import base64, functools, hashlib, http.server, json, pathlib, sys, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
fails = []
def check(cond, msg):
    print(("OK   " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)

# ---------- Viewports ----------
SIZES = [  # name, width, height, touch
    ("27-2560x1440", 2560, 1440, False), ("27-1920x1080", 1920, 1080, False),
    ("13-1280x800", 1280, 800, False), ("13-1280x700", 1280, 700, False),
    ("iphone-440x956", 440, 956, True), ("iphone-393x852", 393, 852, True), ("iphone-landscape-956x440", 956, 440, True),
]
ONLY = sys.argv[1] if len(sys.argv) > 1 else ""
SHOTS = ROOT / "tests" / "screenshots"

def overflow(pg):
    """Horizontal overflow of the page or #main in pixels."""
    return pg.evaluate("""()=>{const d=document.documentElement,m=document.querySelector('#main');
      return Math.max(d.scrollWidth-innerWidth,m?m.scrollWidth-m.clientWidth:0)}""")

def go(pg, hsh):
    pg.evaluate(f"location.hash='{hsh}'"); pg.wait_for_timeout(120)

def shot(pg, name, tag):
    SHOTS.mkdir(parents=True, exist_ok=True)
    pg.screenshot(path=str(SHOTS / f"{name}-{tag}.png"))

def state(pg, js):
    return pg.evaluate("()=>{const S=TB.state();return " + js + "}")

def desktop_flows(pg, name):
    c = lambda cond, msg: check(cond, f"[{name}] {msg}")
    pg.goto(BASE + "?demo=1&nosw=1"); pg.wait_for_timeout(300)
    for hsh, tag in [("uebersicht", "uebersicht"), ("ma-lena", "person"), ("ich", "meine-planung")]:
        go(pg, hsh)
        c(overflow(pg) <= 0, f"no horizontal overflow ({tag})")
        c(pg.evaluate("(()=>{const t=document.querySelector('.tl');return t.scrollWidth<=t.clientWidth})()"), f"week fits the timeline without scrolling ({tag})")
        shot(pg, name, tag)
    go(pg, "verlauf")
    c(overflow(pg) <= 0 and pg.locator(".hrow").count() > 0, "history view without overflow")
    shot(pg, name, "verlauf")
    go(pg, "uebersicht")
    c(pg.locator(".grp.late").count() == 1 and "überfällig" in pg.inner_text(".lead"), "today and overdue visible")
    c(pg.locator(".abs").count() > 0 and pg.locator("text=Mira, Urlaub").count() > 0, "absence visible")
    c(pg.locator("#side .brand img:visible").count() == 1, "logo shown once")
    pg.click('#side a[href="#ma-lena"]'); pg.wait_for_timeout(120)
    c(pg.inner_text("h1") == "Lena Hoffmann", "open person via navigation")
    # create, edit, complete, undo a todo
    pg.keyboard.press("n"); pg.keyboard.type("Desk Aufgabe bis morgen"); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    tid = state(pg, "(S.todos.find(t=>t.title==='Desk Aufgabe')||{}).id")
    c(bool(tid) and state(pg, f"S.todos.find(t=>t.id==='{tid}').personId==='lena'"), "create todo with N (person preselected)")
    pg.keyboard.press("Escape")
    pg.click(f'.todo-title[data-id="{tid}"]'); pg.wait_for_timeout(100)
    pg.fill('#dform [name=title]', "Desk Aufgabe geändert"); pg.click('#dform button[type=submit]'); pg.wait_for_timeout(100)
    c(state(pg, f"S.todos.find(t=>t.id==='{tid}').title")=="Desk Aufgabe geändert", "edit todo in drawer")
    # date fields show TT.MM.JJJJ whatever the browser language (native date inputs showed mm/dd/yyyy)
    pg.click(f'.todo-title[data-id="{tid}"]'); pg.wait_for_timeout(100)
    due = state(pg, f"S.todos.find(t=>t.id==='{tid}').due")
    c(pg.input_value('#dform [name=due]') == f"{due[8:10]}.{due[5:7]}.{due[0:4]}", "date field shows TT.MM.JJJJ")
    pg.fill('#dform [name=due]', "31.02.2026"); pg.click('#dform button[type=submit]'); pg.wait_for_timeout(100)
    c("TT.MM.JJJJ" in pg.inner_text('#drawer .d-err'), "invalid date is rejected")
    pg.fill('#dform [name=due]', "1.12.2026"); pg.click('#dform button[type=submit]'); pg.wait_for_timeout(100)
    c(state(pg, f"S.todos.find(t=>t.id==='{tid}').due") == "2026-12-01", "typed German date is stored as ISO")
    pg.click(f'.check[data-id="{tid}"]'); pg.wait_for_timeout(100)
    c(state(pg, f"(t=>t.done&&!!t.doneAt)(S.todos.find(t=>t.id==='{tid}'))"), "complete todo stores the date")
    pg.click('#toast [data-action=undo]'); pg.wait_for_timeout(100)
    c(state(pg, f"(t=>!t.done&&!t.doneAt)(S.todos.find(t=>t.id==='{tid}'))"), "undo completion")
    # project assignment from the person page
    pg.click('.card [data-action=new-assignment][data-person=lena]'); pg.wait_for_timeout(100)
    pg.fill('#dform [name=project]', "Desk Kunde"); pg.click('#dform button[type=submit]'); pg.wait_for_timeout(100)
    c(state(pg, "S.assignments.some(a=>a.project==='Desk Kunde'&&a.personId==='lena'&&a.billable&&a.end===null)"), "assign a project")
    c("Kranich Versicherung +1" in pg.text_content(".page-head .overline") and pg.locator(".prow:has-text('Desk Kunde')").count() == 1, "current projects in header and panel")
    # absence and talking point
    n = state(pg, "S.absences.length")
    pg.click('.page-head [data-action=new-absence]'); pg.wait_for_timeout(100); pg.click('#dform button[type=submit]'); pg.wait_for_timeout(100)
    c(state(pg, "S.absences.length") == n + 1, "add absence")
    pg.fill(".inline-add", "Desk Punkt"); pg.press(".inline-add", "Enter"); pg.wait_for_timeout(100)
    c(state(pg, "S.talks.some(t=>t.text==='Desk Punkt'&&t.personId==='lena')"), "add talking point")
    pg.click('.todo-title >> nth=0'); pg.wait_for_timeout(150); shot(pg, name, "seitenpanel"); pg.keyboard.press("Escape")
    # input survives resize
    pg.click("#quick"); pg.keyboard.type("Halb getippt")
    vp = pg.viewport_size; pg.set_viewport_size({"width": 1366 if vp["width"] != 1366 else 1600, "height": vp["height"]}); pg.wait_for_timeout(400)
    c(pg.input_value("#quick") == "Halb getippt" and pg.evaluate("document.activeElement.id") == "quick", "input survives resize")
    pg.set_viewport_size(vp); pg.wait_for_timeout(300)
    # board below the timeline: equal columns by width, tasks first; cards keep their place while content changes
    pg.goto(BASE + "?demo=1&nosw=1#uebersicht"); pg.wait_for_timeout(300)
    cols = lambda: pg.evaluate("[...document.querySelectorAll('#main [data-board=overview] .bcol')].map(c=>[...c.children].map(x=>x.dataset.card).join())")
    before = cols(); want = 4 if vp["width"] >= 2500 else 3 if vp["width"] >= 1900 else 2
    c(len(before) == want and before[0].startswith("todos") and overflow(pg) <= 0, f"board with {want} columns, tasks first")
    pg.evaluate("TB.state().todos.filter(t=>!t.done).slice(0,6).forEach(t=>completeTodo(t));save();render()")
    if pg.locator("[data-action=abs-more]").count(): pg.click("[data-action=abs-more]")
    pg.wait_for_timeout(100)
    c(cols() == before, "cards stay in place when lists shrink or grow")
    pg.reload(); pg.wait_for_timeout(300)

def phone_flows(pg, name, w, h):
    c = lambda cond, msg: check(cond, f"[{name}] {msg}")
    tap = lambda sel: (pg.locator(sel).first.tap(), pg.wait_for_timeout(150))
    pg.goto(BASE + "?demo=1&nosw=1"); pg.wait_for_timeout(300)
    c(pg.evaluate("document.documentElement.classList.contains('lay-phone')"), "phone layout active")
    for hsh, tag in [("uebersicht", "heute"), ("team", "team"), ("ma-lena", "person"), ("ich", "meine-planung"), ("verlauf", "verlauf")]:
        go(pg, hsh)
        c(overflow(pg) <= 0, f"no horizontal overflow ({tag})")
        shot(pg, name, tag)
    go(pg, "uebersicht")
    c(pg.inner_text("h1") == "Heute" and pg.locator(".grp.late").count() == 1, "today and overdue visible")
    c(pg.locator(".away").count() > 0, "absent people visible")
    small = pg.evaluate("""()=>[...document.querySelectorAll('.lay-phone .check,.tab-i,.tab-plus,.away:not(.badge),.fold-t,.grp-f')].filter(e=>{const r=e.getBoundingClientRect();
      const s=getComputedStyle(e,'::before');const ext=s.content!=='none'?20:0;return r.width>0&&(Math.min(r.width,r.height)+ext)<44}).length""")
    c(small == 0, "tap targets at least 44 px")
    tap('.tab-i[href="#team"]'); tap('#main a[href="#ma-lena"]')
    c(pg.inner_text("h1") == "Lena Hoffmann", "open person via Team")
    # create todo with + and chips
    tap(".tab-plus")
    c(pg.evaluate("document.activeElement.id") == "capText", "+ focuses the text field at once")
    pg.keyboard.type("Telefon Aufgabe")
    tomorrow = pg.evaluate("(()=>{const d=new Date();d.setDate(d.getDate()+1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()")
    tap('#dform input[name=pid][value=jonas] + span'); tap(f'#dform input[name=due][value="{tomorrow}"] + span')
    shot(pg, name, "erfassen")
    tap('#dform button[type=submit]')
    tid = state(pg, "(S.todos.find(t=>t.title==='Telefon Aufgabe')||{}).id")
    c(bool(tid) and state(pg, f"(t=>t.personId==='jonas'&&t.due==='{tomorrow}')(S.todos.find(t=>t.id==='{tid}'))"), "create todo with person and due chips")
    tap('.tab-plus'); pg.keyboard.type("@Aylin Parser bis morgen"); pg.keyboard.press("Enter"); pg.wait_for_timeout(150)
    c(state(pg, f"S.todos.some(t=>t.title==='Parser'&&t.personId==='aylin'&&t.due==='{tomorrow}')"), "quick capture with @name and bis in the sheet")
    # suggestion list by tap, then "#krank" switches to the prefilled absence form
    tap('.tab-plus'); pg.keyboard.type("@Ay")
    pg.locator('#sugList li').first.tap(); pg.wait_for_timeout(100)
    c(pg.input_value("#capText") == "@Aylin ", "tap on a suggestion inserts the name")
    pg.keyboard.type("#krank"); tap('#dform button[type=submit]')
    c(pg.locator('#dform input[name=kind][value=Krank]').is_checked() and pg.locator('#dform input[name=pid]:checked').input_value() == "aylin"
      and pg.locator('.seg-b[data-v=absence][aria-selected=true]').count() == 1, "#krank switches the sheet to Abwesend, prefilled")
    tap('#dform button[type=submit]')
    c(state(pg, f"S.absences.some(a=>a.personId==='aylin'&&a.kind==='Krank'&&a.start===a.end)"), "sick day via the sheet")
    go(pg, "team"); tap('#main a[href="#ma-jonas"]')
    tap(f'.todo-title[data-id="{tid}"]')
    pg.locator('#dform [name=title]').fill("Telefon Aufgabe geändert"); tap('#dform button[type=submit]')
    c(state(pg, f"S.todos.find(t=>t.id==='{tid}').title") == "Telefon Aufgabe geändert", "edit todo in sheet")
    tap(f'.check[data-id="{tid}"]')
    c(state(pg, f"S.todos.find(t=>t.id==='{tid}').done"), "complete todo")
    tap('#toast [data-action=undo]')
    c(not state(pg, f"S.todos.find(t=>t.id==='{tid}').done"), "undo completion")
    # one capture sheet: switching the type keeps title, tab position, sheet height and the typed text
    tap(".tab-plus"); pg.keyboard.type("Halb notiert")
    geo = lambda: pg.evaluate("[document.querySelector('#drawer h3').textContent,Math.round(document.querySelector('.cap-seg').getBoundingClientRect().top),Math.round(document.querySelector('#drawer').getBoundingClientRect().height)]")
    g0 = geo(); gs = []
    for v in ["absence", "topic", "talk", "todo"]: tap(f'.seg-b[data-v={v}]'); gs.append(geo())
    c(all(g == g0 for g in gs) and g0[0] == "Neu erfassen", f"switching the type keeps title, tabs and height {g0} {gs}")
    c(pg.input_value("#capText") == "Halb notiert", "typed text survives switching the type")
    tap('#drawer [data-action=close-drawer]')
    # absence and talking point via +
    n = state(pg, "S.absences.length")
    tap(".tab-plus"); tap('.seg-b[data-v=absence]')
    c(pg.locator('#dform input[name=pid][value=jonas]').is_checked() and pg.locator('#dform select').count() == 0, "absence in the sheet: person as chips, preselected")
    tap('#dform input[name=end] + span >> nth=2')
    end = pg.locator('#dform input[name=end]').nth(2).get_attribute("value")
    tap('#dform button[type=submit]')
    c(state(pg, "S.absences.length") == n + 1 and state(pg, "S.absences.at(-1).personId") == "jonas" and state(pg, "S.absences.at(-1).end") == end, "add absence via + with date chips")
    tap(".tab-plus"); tap('.seg-b[data-v=talk]'); pg.keyboard.type("Telefon Punkt"); tap('#dform button[type=submit]')
    c(state(pg, "S.talks.some(t=>t.text==='Telefon Punkt'&&t.personId==='jonas')"), "add talking point via +")
    pg.locator(".inline-add").tap(); pg.keyboard.type("Punkt im Feld"); pg.keyboard.press("Enter"); pg.wait_for_timeout(150)
    c(state(pg, "S.talks.some(t=>t.text==='Punkt im Feld'&&t.personId==='jonas')"), "add talking point on person page")
    tap('.tab-i[data-action=more-menu]'); shot(pg, name, "mehr"); tap('#drawer [data-action=contacts]')
    c(pg.locator("#drawer .prow:has-text('Mark Becker')").count() == 1, "contacts under Mehr")
    tap('#drawer [data-action=close-drawer]')
    go(pg, "ich"); pg.select_option("#forPerson", "kmark"); pg.wait_for_timeout(150)
    c(pg.locator(".todo:has-text('Foliendeck')").count() == 1 and overflow(pg) <= 0, "Für filter on the phone without overflow")
    shot(pg, name, "fuer-filter"); pg.select_option("#forPerson", ""); pg.wait_for_timeout(100); go(pg, "ma-jonas")
    # rotation keeps input: field on the page and open sheet
    pg.locator(".inline-add").tap(); pg.keyboard.type("Halb getippt")
    pg.set_viewport_size({"width": h, "height": w}); pg.wait_for_timeout(400)
    c(pg.input_value(".inline-add") == "Halb getippt" and overflow(pg) <= 0, "rotation keeps page input")
    pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(400)
    tap(".tab-plus"); pg.keyboard.type("Im Blatt")
    pg.set_viewport_size({"width": h, "height": w}); pg.wait_for_timeout(400)
    c(pg.evaluate("document.body.classList.contains('drawer-open')") and pg.input_value("#capText") == "Im Blatt", "rotation keeps the open sheet")
    pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(300)
    today_folds(pg, name); team_grid(pg, name, w, h)

def touch_drag(pg, x, y, dx, hold=600):
    """Touch at (x, y), hold `hold` ms, then move by dx in steps and lift (CDP touch events, like a finger)."""
    cdp = pg.context.new_cdp_session(pg)
    ev = lambda t, px=0, py=0: cdp.send("Input.dispatchTouchEvent", {"type": t, "touchPoints": [] if t == "touchEnd" else [{"x": px, "y": py}]})
    ev("touchStart", x, y); pg.wait_for_timeout(hold)
    for i in range(1, 7): ev("touchMove", x + dx * i / 6, y + (2 if hold < 100 else 0)); pg.wait_for_timeout(25)
    ev("touchEnd"); pg.wait_for_timeout(250); cdp.detach()

def today_folds(pg, name):
    """Phone "Heute": cards fold with a summary, the state survives a reload, a new red issue opens "Zu klären" again."""
    c = lambda cond, msg: check(cond, f"[{name}] {msg}")
    tap = lambda sel: (pg.locator(sel).first.tap(), pg.wait_for_timeout(150))
    go(pg, "uebersicht")
    c(pg.locator("text=Projekte heute").count() == 0, "Heute without the projects panel")
    c(pg.locator(".fold.open .grp.late").count() == 1 and pg.locator(".grp-f[data-v=week]").count() == 1 and pg.locator(".todo:has-text('Partner-Sandbox')").count() == 0,
      "todos: overdue and today open, the rest of the week folded")
    tap(".grp-f[data-v=week]")
    c(pg.locator(".todo:has-text('Partner-Sandbox')").count() == 1, "a folded todo group opens")
    c(pg.locator(".fold:not(.open) .fold-t[data-v=abs]").count() == 1 and "abwesend" in pg.inner_text(".fold-t[data-v=abs] .fold-s"), "Abwesenheiten folded with a summary")
    tap(".fold-t[data-v=abs]")
    c(pg.locator(".fold.open .prow[data-action=edit-absence]").count() > 0 and pg.locator(".fold-h [data-action=new-absence]").count() == 1, "a card opens with its rows and action")
    tap(".fold-t[data-v=issues]")
    c(pg.locator(".fold.open .fold-t[data-v=issues]").count() == 0, "Zu klären folds")
    pg.reload(); pg.wait_for_timeout(400); go(pg, "uebersicht")
    c(pg.locator(".fold.open .fold-t[data-v=abs]").count() == 1 and pg.locator(".fold.open .fold-t[data-v=issues]").count() == 0, "folding survives a reload")
    pg.evaluate("S=TB.state();S.topics.push(newEntry({personId:'aylin',title:'Altlast',start:ds(TDN-9),end:ds(TDN-2),status:'aktiv',note:''}));save();render()")
    c(pg.locator(".fold.open .fold-t[data-v=issues]").count() == 1 and "dringend" in pg.inner_text(".fold-t[data-v=issues] .fold-s"), "a new red issue opens Zu klären")
    pg.evaluate("localStorage.removeItem('teamboard.v1.ui')"); pg.reload(); pg.wait_for_timeout(400)

def team_grid(pg, name, w, h):
    """Phone team grid: upright one week with day list, sideways two weeks in a scroller; hold and drag moves a topic."""
    c = lambda cond, msg: check(cond, f"[{name}] {msg}")
    tap = lambda sel: (pg.locator(sel).first.tap(), pg.wait_for_timeout(150))
    go(pg, "team"); pg.evaluate("document.querySelectorAll('.banner').forEach(e=>e.remove())")
    rows = pg.locator(".wg-r:not(.wg-h)").count()
    c(rows == 1 + state(pg, "S.people.filter(p=>!p.archived).length"), "team grid: one row per person and me")
    dw = pg.evaluate("document.querySelector('.wg-c').getBoundingClientRect().width")
    topic = "Redesign Kundenportal"; span = lambda: state(pg, f"(t=>t.start+' '+t.end)(S.topics.find(t=>t.title==='{topic}'))")
    if w < h:
        c(pg.locator(".wg-d").count() == 5 and dw > 50, f"upright: five workdays, {dw:.0f} px per day")
        tap(".wg-d >> nth=2")
        c(pg.inner_text(".dday h2").startswith("Mittwoch"), "tap on a day shows it below")
        c("off" in pg.locator(".dd").last.get_attribute("class") and pg.locator(".dd.off").count() >= 1, "absent people at the end of the day list")
        kw = pg.inner_text(".wk-l b"); tap(".wk-nav [data-v='1']")
        c(pg.inner_text(".wk-l b") != kw and pg.locator(".wk-nav [data-v='0']").count() == 1, "next week")
        tap(".wk-nav [data-v='0']")
        c(pg.inner_text(".wk-l b") == kw, "back to this week")
    else:
        c(pg.locator(".wg-land").count() == 1 and not pg.locator(".tab-plus").is_visible(), "sideways: scroller, tab bar hidden")
        cw = pg.evaluate("document.querySelector('.wg-land').clientWidth")
        c(abs(dw * 10 + 46 - cw) < 4, f"sideways: ten workdays visible ({dw:.0f} px per day)")
        x0 = pg.evaluate("document.querySelector('.wg-land').scrollLeft")
        c(abs(x0 - dw * 10) < 4, "sideways: starts at the current week")
        pg.evaluate("document.querySelector('.wg-land').scrollLeft=333"); pg.wait_for_timeout(80); pg.evaluate("render()")
        c(pg.evaluate("document.querySelector('.wg-land').scrollLeft") == 333, "render() keeps the scroll position")
        pg.evaluate(f"document.querySelector('.wg-land').scrollLeft={x0}"); pg.wait_for_timeout(80)
    before = span(); bar = pg.locator(".wg-b[data-move]", has_text=topic).first
    bb = bar.bounding_box(); x = max(bb["x"], 80) + 16; y = bb["y"] + bb["height"] / 2
    touch_drag(pg, x, y, -dw * 1.5, hold=60)
    c(span() == before and pg.evaluate("!document.body.classList.contains('drawer-open')"), "a swipe over a bar does not move it")
    if w > h: pg.wait_for_timeout(600); pg.evaluate(f"document.querySelector('.wg-land').scrollLeft={x0}"); pg.wait_for_timeout(150)
    bb = bar.bounding_box(); x = max(bb["x"], 80) + 16; y = bb["y"] + bb["height"] / 2
    touch_drag(pg, x, y, dw * 1.2)
    c(span() != before and span().split()[0] > before.split()[0] and pg.evaluate("!document.body.classList.contains('drawer-open')") and "Rückgängig" in pg.inner_text("#toast"),
      f"hold and drag moves a topic by a workday ({before} to {span()})")
    c(all(pg.evaluate(f"[0,6].includes(wdOf(dn('{d}')))") is False for d in span().split()), "the moved topic does not land on a weekend")
    tap("#toast [data-action=undo]")
    c(span() == before, "undo the move")
    shot(pg, name, "team-grid")
    pg.locator(".wg-b[data-move]", has_text=topic).first.tap(); pg.wait_for_timeout(200)
    c(pg.evaluate("document.body.classList.contains('drawer-open')"), "a tap on a bar opens the topic")
    tap("#drawer [data-action=close-drawer]")

def tour_flow(pg, name, touch):
    """Runs the tour on sample data: every highlight and card inside the viewport, screenshots of some steps."""
    c = lambda cond, msg: check(cond, f"[{name}] {msg}")
    pg.goto(BASE + "?demo=1&nosw=1"); pg.wait_for_timeout(300)
    pg.locator(".banner [data-action=tour]").click(); pg.wait_for_timeout(400)
    n = pg.evaluate("tour.steps.length"); bad = []
    for i in range(n):
        box = pg.evaluate("""()=>{const r=document.querySelector('#tour .tour-card').getBoundingClientRect(),h=document.querySelector('#tour .tour-hole').getBoundingClientRect(),
          st=tour.steps[tour.i];return{ok:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hole:!st.sel||h.width>0,over:st.sel&&h.width>0&&r.left<h.right&&r.right>h.left&&r.top<h.bottom&&r.bottom>h.top&&h.height+r.height+48<=innerHeight}}""")
        if not (box["ok"] and box["hole"] and not box["over"]): bad.append(f"{i+1}:{box}")
        if i in (1, 3, 6, 8): shot(pg, name, f"rundgang-{i+1}")
        pg.locator("#tour [data-tour=next]").click(); pg.wait_for_timeout(450)
    c(not bad, "tour: every card on screen, highlight found, card beside it " + " ".join(bad))
    c(pg.locator("#tour").count() == 0 and pg.evaluate("TB.store.mode") == "demo" and overflow(pg) <= 0, "tour ends in demo mode")

def responsive(b):
    for name, w, h, touch in SIZES:
        if ONLY and ONLY not in name: continue
        ctx = b.new_context(viewport={"width": w, "height": h}, locale="de-DE", has_touch=touch, is_mobile=touch)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        try:
            phone_flows(pg, name, w, h) if touch else desktop_flows(pg, name)
            tour_flow(pg, name, touch)
        except Exception as e:
            check(False, f"[{name}] flow aborted: {str(e).splitlines()[0]}")
        check(not errs, f"[{name}] no JavaScript errors " + "; ".join(errs))
        ctx.close()


# ---------- GitHub sync against a mocked contents API ----------
class FakeGitHub:
    """Holds one file like the GitHub contents API: sha + base64 content. Stale sha on PUT -> 409."""
    REPO = "/repos/beispiel/teamboard-daten"
    def __init__(self, repos=("beispiel/teamboard-daten",)): self.file = None; self.commits = 0; self.down = False; self.repos = list(repos)
    def text(self): return base64.b64decode(self.file["content"]).decode() if self.file else ""
    def handle(self, route):
        req, cors = route.request, {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"}
        path = req.url.split("api.github.com", 1)[1].split("?")[0]
        reply = lambda status, body=None: route.fulfill(status=status, headers={**cors, "Content-Type": "application/json"}, body=json.dumps(body or {}))
        if self.down: return route.abort("internetdisconnected")
        if req.method == "OPTIONS": return route.fulfill(status=204, headers=cors)
        if path == "/user/repos": return route.fulfill(status=200, headers={**cors, "Content-Type": "application/json"}, body=json.dumps([{"full_name": r, "private": True} for r in self.repos]))
        if path == self.REPO: return reply(200, {"private": True, "default_branch": "main"})
        if path.startswith("/repos/") and "/contents/" not in path: return reply(404, {"message": "Not Found"})
        if req.method == "GET": return reply(200, self.file) if self.file else reply(404, {"message": "Not Found"})
        body = json.loads(req.post_data)
        if (self.file["sha"] if self.file else None) != body.get("sha"): return reply(409, {"message": "conflict"})
        self.commits += 1
        self.file = {"sha": hashlib.sha1(f"{self.commits}{body['content']}".encode()).hexdigest(), "content": body["content"]}
        return reply(200, {"content": {"sha": self.file["sha"]}})

def device(b, gh, **kw):
    ctx = b.new_context(locale="de-DE", **kw); ctx.route("https://api.github.com/**", gh.handle)
    pg = ctx.new_page(); pg.errs = []; pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    pg.goto(BASE + "?nosw=1"); pg.wait_for_timeout(300)
    return ctx, pg

def connect(pg, passphrase, confirm=None):
    pg.fill("#setupForm [name=token]", "github_pat_test"); pg.fill("#setupForm [name=passphrase]", passphrase)
    pg.click("#setupForm button[type=submit]"); pg.wait_for_timeout(1500)
    if confirm is not None:
        pg.fill("#setupForm [name=confirm]", confirm); pg.click("#setupForm button[type=submit]"); pg.wait_for_timeout(1500)
    if pg.locator("#dlg.open").count():  # the tour offer after the first connection
        pg.click("#dlg [data-dlg='0']"); pg.wait_for_timeout(100)

def add_todo(pg, title):
    pg.evaluate(f"S=TB.state();S.todos.push({{id:'{title.replace(' ','')}',personId:'me',kind:'team',title:'{title}',due:null,done:false,note:''}});save();render()")

def wait_synced(pg):
    pg.wait_for_function("TB.store.status==='saved'&&!TB.store.dirty", timeout=8000)

def sync_flows(b):
    gh = FakeGitHub()
    a_ctx, a = device(b, gh, viewport={"width": 1536, "height": 1000})
    check(a.locator("#setupForm").count() == 1, "setup page without connection")
    check(a.locator("a[href^='https://github.com/new?name=']").count() == 1 and a.locator("a[href*='personal-access-tokens/new?'][href*='contents=write']").count() == 1, "setup links to prefilled GitHub forms")
    a.fill("#setupForm [name=token]", "github_pat_test"); a.fill("#setupForm [name=passphrase]", "geheim-passwort"); a.click("#setupForm button[type=submit]"); a.wait_for_timeout(1500)
    a.fill("#setupForm [name=confirm]", "geheim-passwort"); a.click("#setupForm button[type=submit]"); a.wait_for_timeout(1500)
    check(a.locator("#dlg.open").count() == 1 and "Rundgang" in a.inner_text("#dlg"), "first connection offers the tour")
    a.click("#dlg [data-dlg='0']"); a.wait_for_timeout(100)
    check(a.evaluate("TB.store.mode") == "github" and gh.file is not None and a.evaluate("TB.store.gh.repo") == "beispiel/teamboard-daten", "first device detects the repository and creates the encrypted file")
    check(a.locator(".first-steps").count() == 1 and "0 von" in a.inner_text(".first-steps"), "empty board shows Erste Schritte")
    add_todo(a, "Synced task"); wait_synced(a)
    check("1 von" in a.inner_text(".first-steps .fs-n"), "Erste Schritte ticks off the first todo")
    env = json.loads(gh.text())
    check(env.get("format") == "aes-gcm-v1" and "Synced task" not in gh.text(), "commit is encrypted, no plain text on GitHub")

    c_ctx, c = device(b, gh, viewport={"width": 1280, "height": 800})
    connect(c, "falsches-passwort")
    check("Passwort passt nicht" in c.inner_text("#main"), "wrong passphrase is rejected"); c_ctx.close()
    # a token that sees several private repositories: the setup page asks which one
    gh.repos = ["beispiel/anderes", "beispiel/teamboard-daten"]
    c_ctx, c = device(b, gh, viewport={"width": 1280, "height": 800})
    connect(c, "geheim-passwort")
    check(c.locator("#setupForm select[name=repo] option").count() == 2 and c.evaluate("TB.store.mode") == "none", "several repositories: choose one")
    c.select_option("#setupForm [name=repo]", "beispiel/teamboard-daten"); c.click("#setupForm button[type=submit]"); c.wait_for_timeout(1500)
    if c.locator("#dlg.open").count(): c.click("#dlg [data-dlg='0']")
    check(c.evaluate("TB.store.mode==='github'&&TB.state().todos.some(t=>t.title==='Synced task')"), "chosen repository connects"); c_ctx.close()
    gh.repos = ["beispiel/teamboard-daten"]

    p_ctx, p = device(b, gh, viewport={"width": 440, "height": 956}, has_touch=True, is_mobile=True)
    connect(p, "geheim-passwort")
    check(p.evaluate("TB.state().todos.some(t=>t.title==='Synced task')"), "second device loads and decrypts the data")

    # concurrent edits on both devices: phone commits first, laptop then hits a stale sha and merges
    add_todo(p, "From phone"); p.evaluate("S=TB.state();S.assignments.push({id:'asp',personId:'me',project:'Phone Kunde',start:TODAY,end:null,billable:true,note:''});save()"); wait_synced(p)
    add_todo(a, "From laptop"); a.evaluate("S=TB.state();S.assignments.push({id:'asl',personId:'me',project:'Laptop Kunde',start:TODAY,end:null,billable:false,note:''});save()"); wait_synced(a)
    both = "['From phone','From laptop'].every(x=>TB.state().todos.some(t=>t.title===x))&&['asp','asl'].every(x=>TB.state().assignments.some(a=>a.id===x))"
    a_has = a.evaluate(both)
    p.evaluate("TB.store.sync(true)"); p.wait_for_timeout(500)
    p_has = p.evaluate(both)
    check(a_has and p_has, "concurrent edits on two devices are merged (todos and projects)")

    # offline start from the local cache
    gh.down = True; a.reload(); a.wait_for_timeout(800)
    check(a.evaluate("TB.store.mode==='github'&&TB.state().todos.some(t=>t.title==='From laptop')"), "offline start shows the cached state")
    add_todo(a, "Offline task"); a.wait_for_timeout(2000)
    check(a.evaluate("TB.store.status") == "offline", "offline changes wait")
    gh.down = False; a.evaluate("window.dispatchEvent(new Event('online'))"); wait_synced(a)
    check("Offline task" not in gh.text() and gh.commits >= 4, "offline changes are committed when back online")
    # the tour from a connected board runs on sample data, writes nothing and returns to the own data
    a.reload(); a.wait_for_timeout(800); n = gh.commits
    a.click("#side [data-action=more-menu]"); a.click("#drawer [data-action=tour]"); a.wait_for_timeout(300)
    check(a.locator("#tour").count() == 1 and a.evaluate("TB.store.mode") == "demo" and a.evaluate("TB.state().people.length") == 5, "tour switches to sample data")
    a.evaluate("S=TB.state();S.todos.push({id:'tourx',personId:'me',kind:'team',title:'Im Rundgang',due:null,done:false,note:''});save()"); a.wait_for_timeout(2000)
    a.keyboard.press("Escape"); a.wait_for_timeout(800)
    check(a.locator("#tour").count() == 0 and a.evaluate("TB.store.mode") == "github" and a.evaluate("TB.state().todos.some(t=>t.title==='Offline task')")
          and not a.evaluate("TB.state().todos.some(t=>t.title==='Im Rundgang')") and gh.commits == n, "tour ends on the own data without commits")
    # a list this version does not know survives a merge; data from a newer version stops this window from writing
    seal = "async v=>{const s=TB.store;const env=await Vault.seal(JSON.stringify({...TB.state(),version:v,future:[{id:'f1',x:1}]}),s.gh.key,s.gh.salt);const r=await GitHub.put(s.gh,env,s.sha,'test');s.sha=r.sha}"
    p.evaluate("TB.store.sync(true)"); p.wait_for_timeout(500)
    p.evaluate(f"({seal})(2)"); add_todo(a, "Merge with future"); a.evaluate("TB.store.sync(true)"); wait_synced(a)
    p.evaluate("TB.store.sync(true)"); p.wait_for_timeout(500)
    check(p.evaluate("(S=>S.future&&S.future[0].id==='f1'&&S.todos.some(t=>t.title==='Merge with future'))(TB.state())"), "unknown lists survive merge and sync")
    p.evaluate(f"({seal})(99)"); n = gh.commits
    add_todo(a, "After newer version"); a.evaluate("TB.store.sync(true)"); a.wait_for_timeout(1500)
    check(a.evaluate("TB.store.outdated") and gh.commits == n and a.locator(".banner [data-action=reload]").count() == 1, "data from a newer version: no commit, reload banner")
    check(a.evaluate("TB.state().todos.some(t=>t.title==='After newer version')"), "local changes stay on the device")
    check(not (a.errs or p.errs), "no JavaScript errors during sync " + "; ".join(a.errs + p.errs))
    a_ctx.close(); p_ctx.close()

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1536, "height": 1000}, locale="de-DE")
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE + "?demo=1&nosw=1"); pg.wait_for_timeout(300)
    check(pg.locator(".tl-row").count() == 6, "demo mode shows 6 rows")
    pg.keyboard.press("n"); pg.keyboard.type("@Lena Testaufgabe bis Fr #ich"); pg.keyboard.press("Enter")
    check(pg.evaluate("TB.state().todos.some(t=>t.title==='Testaufgabe'&&t.kind==='mine'&&t.personId==='lena')"), "quick capture with @name, bis and #ich")
    # suggestion list: two people with the same first name
    pg.evaluate("S=TB.state();S.people.push({id:'fab1',name:'Fabian Müller',team:''},{id:'fab2',name:'Fabian Schmidt',team:''});render()")
    pg.click("#quick"); pg.keyboard.type("@Fab")
    check(pg.locator("#sugList li").count() == 2, "@ suggests every matching person")
    pg.keyboard.press("ArrowDown"); pg.keyboard.press("Tab")
    check(pg.input_value("#quick") == "@Fabian Schmidt ", "arrow and Tab pick the second Fabian")
    pg.keyboard.type("Review"); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check(pg.evaluate("TB.state().todos.some(t=>t.title==='Review'&&t.personId==='fab2')"), "todo lands with the picked person")
    pg.click("#quick"); pg.keyboard.type("@Fabian Doppelt"); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check(not pg.evaluate("TB.state().todos.some(t=>t.title==='Doppelt')") and "Mehrere passen" in pg.inner_text("#qprev"), "ambiguous name creates nothing")
    pg.fill("#quick", ""); pg.keyboard.type("@Lena #kr"); pg.keyboard.press("Tab")
    check(pg.input_value("#quick") == "@Lena #krank ", "# suggests tags")
    pg.keyboard.type("bis morgen Arzttermin"); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check(pg.evaluate("(a=>a&&a.kind==='Krank'&&a.end>a.start&&!a.note)(TB.state().absences.find(a=>a.personId==='lena'&&a.kind==='Krank'))"), "#krank creates a sick day without details")
    r = pg.evaluate("parseQuick('@Jonas #urlaub ab 22.12. bis 2.1. Vertretung Tobias',{personId:'me',kind:'team'})")
    check(r["type"] == "absence" and r["start"][5:] == "12-22" and r["end"][5:] == "01-02" and r["end"] > r["start"] and r["note"] == "Vertretung Tobias", "#urlaub with ab and bis across the new year")
    r = pg.evaluate("parseQuick('@Jonas #urlaub #vormittags am 23.12.',{personId:'me',kind:'team'})")
    check(r["type"] == "absence" and r["half"] == "am" and r["start"] == r["end"] and not r.get("err"), "#vormittags makes a half day")
    r = pg.evaluate("parseQuick('@Jonas #urlaub #nachmittags ab 22.12. bis 23.12.',{personId:'me',kind:'team'})")
    check(bool(r.get("err")) and "einzelnen Tag" in r["err"], "a half day needs a single day")
    r = pg.evaluate("parseQuick('Termin #vormittags',{personId:'me',kind:'team'})")
    check(bool(r.get("err")) and "#urlaub" in r["err"], "#vormittags without an absence tag creates nothing")
    r = pg.evaluate("(a=>[absDays(a),daysText(absDays(a)),daysText(2.5)])({start:'2026-12-23',end:'2026-12-23',half:'am'})")
    check(r == [0.5, "ein halber Arbeitstag", "2,5 Arbeitstage"], "a half day counts half a workday")
    pg.evaluate("S=TB.state();S.absences.push({id:'old8',personId:'mira',kind:'Krank',start:ds(TDN-9),end:ds(TDN-8),note:'x'},{id:'old6',personId:'mira',kind:'Krank',start:ds(TDN-6),end:ds(TDN-6)});expireSick()")
    check(pg.evaluate("(S=>S.absences.find(a=>a.id==='old8').kind==='Sonstiges'&&!S.absences.find(a=>a.id==='old8').note&&S.absences.find(a=>a.id==='old6').kind==='Krank')(TB.state())"), "sick days turn into Abwesend after 7 days")
    pg.evaluate("location.hash='verlauf'"); pg.wait_for_timeout(150)
    check(pg.locator(".hrow").count() > 0 and "Krank" not in pg.inner_text(".hist") and "Abwesend" not in pg.inner_text(".hist"), "history without sick days")
    pg.fill("#histSearch", "Styleguide"); pg.wait_for_timeout(150)
    check(pg.locator(".hrow").count() == 1 and pg.evaluate("document.activeElement.id") == "histSearch", "history search keeps the field")
    pg.evaluate("location.hash='uebersicht'"); pg.wait_for_timeout(150)
    check(pg.locator(".pj").count() > 0 and "Ohne Projekt" in pg.inner_text("main"), "projects panel on the overview")
    check(any("Stadtwerke Elmstadt" in t for t in pg.locator(".prow.issue").all_inner_texts()), "ending project shows under Zu klären")
    # absences put only main topics at risk, and only near the end or when they cover more than half of the workdays; one entry per topic
    r = pg.evaluate("""()=>{const S=TB.state();let m=mondayOf(TDN)+70;while([...Array(28).keys()].some(i=>holidayOn(m+i)))m+=7;
      const t={id:'rk1',personId:'aylin',title:'Risikothema',start:ds(m),end:ds(m+18),status:'geplant',note:''};S.topics.push(t);
      const ab=(id,a,b)=>({id,personId:'aylin',kind:'Urlaub',start:ds(m+a),end:ds(m+b)}),set=(...l)=>{S.absences=S.absences.filter(a=>!a.id.startsWith('rk'));S.absences.push(...l)};
      const out={};set(ab('rka',2,2),ab('rkb',8,8));out.mid=absRisk(t);
      set(ab('rka',2,2),ab('rkb',8,8),ab('rkc',17,17));out.end=absRisk(t)?.text;render();
      out.rows=[...document.querySelectorAll('.prow.issue')].filter(e=>e.textContent.includes('Risikothema')).map(e=>e.textContent);
      t.side=true;out.side=absRisk(t);delete t.side;
      set(ab('rka',0,9));out.share=absRisk(t)?.text;
      S.topics=S.topics.filter(x=>x!==t);set();render();return out}""")
    check(r["mid"] is None, "single days off in the middle of a topic are no risk")
    check(r["end"] and "kurz vor dem Ende im Urlaub" in r["end"] and "bis" not in r["end"] and len(r["rows"]) == 1, "a day off near the end shows once under Zu klären")
    check(r["side"] is None, "side topics get no absence warning")
    check(r["share"] and "an 8 von 15 Arbeitstagen" in r["share"], "absences over half of the workdays put the topic at risk")
    # absences on the overview: the next block per person, pieces merged across weekends, "Mehr anzeigen" lists all
    r = pg.evaluate("""()=>{const S=TB.state();let m=mondayOf(TDN)+70;while([...Array(28).keys()].some(i=>holidayOn(m+i)))m+=7;
      const ab=(id,a,b,kind='Urlaub')=>({id,personId:'aylin',kind,start:ds(m+a),end:ds(m+b)});
      const keep=S.absences;S.absences=keep.filter(a=>a.personId!=='aylin').concat(ab('ra1',3,4),ab('ra2',7,9),ab('ra3',14,14),ab('ra4',15,15,'Schulung'));
      const bl=absBlocks(S.absences.filter(a=>a.personId==='aylin').sort((a,b)=>a.start.localeCompare(b.start)));render();
      const rows=()=>[...document.querySelectorAll('.prow')].filter(e=>e.dataset.action==='edit-absence'&&e.textContent.includes('Aylin,')).map(e=>e.textContent);
      const out={blocks:bl.map(b=>[b.start===ds(m+3),b.end,b.ids.length]),first:ds(m+9),few:rows()};
      document.querySelector('[data-action=abs-more]').click();out.all=rows();S.absences=keep;ui.absAll=false;render();return out}""")
    check(r["blocks"][0][0] and r["blocks"][0][1] == r["first"] and r["blocks"][0][2] == 2 and len(r["blocks"]) == 3, "pieces of leave across a weekend form one block, other kinds stay apart")
    check(len(r["few"]) == 1 and "2 Einträge" in r["few"][0], "the overview shows only the next absence block per person")
    check(len(r["all"]) == 3, "Mehr anzeigen lists every block")
    r = pg.evaluate("""()=>{const S=TB.state();let m=mondayOf(TDN)+70;while([...Array(28).keys()].some(i=>holidayOn(m+i)))m+=7;
      const t={id:'rk3',personId:'aylin',title:'Halbtagsthema',start:ds(m),end:ds(m+18),status:'geplant',note:''};S.topics.push(t);
      S.absences.push({id:'rkh',personId:'aylin',kind:'Urlaub',start:ds(m+18),end:ds(m+18),half:'pm'});const out=absRisk(t);
      S.topics=S.topics.filter(x=>x!==t);S.absences=S.absences.filter(a=>a.id!=='rkh');render();return out}""")
    check(r is None, "a half day near the end raises no warning")
    # acknowledging a yellow issue hides it until its date or its absences change; red ones have no check button
    row = pg.locator(".prow.issue", has_text="Stadtwerke Elmstadt")
    row.locator("[data-action=ack-issue]").click(); pg.wait_for_timeout(150)
    check(pg.locator(".prow.issue:not(.acked)", has_text="Stadtwerke Elmstadt").count() == 0 and "1 geklärte anzeigen" in pg.inner_text("[data-tour=issues]"), "a clarified issue leaves the list")
    pg.click("[data-action=show-acked]"); pg.wait_for_timeout(100)
    pg.locator(".prow.issue.acked", has_text="Stadtwerke Elmstadt").locator("[data-action=unack-issue]").click(); pg.wait_for_timeout(150)
    check(pg.locator(".prow.issue:not(.acked)", has_text="Stadtwerke Elmstadt").count() == 1, "Wieder anzeigen brings it back")
    pg.evaluate("ui.showAcked=false;render()")
    r = pg.evaluate("""()=>{const S=TB.state();S.topics.forEach(t=>{if(topicLate(t))t.status='erledigt'});
      for(const i of issues())if(i.ack)ackIssue(i.ack);render();const shown=()=>!!document.querySelector('[data-tour=issues]');
      const out={left:issues().length,kept:shown()&&document.querySelector('[data-tour=issues]').textContent.includes('Alles geklärt')};
      ui.keepIss={};render();out.gone=!shown();S.acks=[];render();out.back=shown();return out}""")
    check(r["left"] == 0 and r["kept"] and r["gone"] and r["back"], "Zu klären stays with Alles geklärt until reload, then hides until something is open")
    r = pg.evaluate("""()=>{const S=TB.state();let m=mondayOf(TDN)+70;while([...Array(28).keys()].some(i=>holidayOn(m+i)))m+=7;
      const t={id:'rk2',personId:'aylin',title:'Quittierthema',start:ds(m),end:ds(m+18),status:'geplant',note:''};S.topics.push(t);
      S.absences.push({id:'rkd',personId:'aylin',kind:'Urlaub',start:ds(m+17),end:ds(m+17)});
      const out={ok:ackIssue('abs-rk2'),hidden:topicWarn(t)===null&&!issues().some(i=>i.id==='rk2')};
      S.absences.push({id:'rke',personId:'aylin',kind:'Urlaub',start:ds(m+16),end:ds(m+16)});out.back=!!topicWarn(t);
      S.absences=S.absences.filter(a=>a.id!=='rke');t.end=ds(m+17);out.moved=!!topicWarn(t);
      out.late=allIssues().filter(i=>i.kind==='late').every(i=>!i.ack);
      S.topics=S.topics.filter(x=>x!==t);S.absences=S.absences.filter(a=>a.id!=='rkd');S.acks=[];render();return out}""")
    check(r["ok"] and r["hidden"], "a clarified topic warning hides the flag too")
    check(r["back"] and r["moved"], "a new absence or a moved end brings the warning back")
    check(r["late"], "red issues cannot be acknowledged")
    pg.keyboard.press("Escape"); pg.keyboard.press("6"); pg.wait_for_timeout(100)
    check(pg.locator(".hc.wk").count() == 6, "six-week view")
    pg.evaluate("document.querySelector('.tl-track[data-person=aylin]').scrollIntoView({block:'center'})")  # keep clear of the toast
    tr = pg.locator(".tl-track[data-person=aylin]").bounding_box()
    y = tr["y"] + tr["height"] - 12
    pg.mouse.move(tr["x"] + tr["width"] * .62, y); pg.mouse.down(); pg.mouse.move(tr["x"] + tr["width"] * .8, y, steps=6); pg.mouse.up(); pg.wait_for_timeout(100)
    pg.keyboard.type("Aufgezogenes Thema"); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check(pg.evaluate("TB.state().topics.some(t=>t.title==='Aufgezogenes Thema')"), "drag to create a topic")
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(100)
    check(not pg.evaluate("TB.state().topics.some(t=>t.title==='Aufgezogenes Thema')"), "Ctrl+Z")
    # tags in the drag-to-create field: absence over the dragged range, todo due on its last day
    def drag_range():
        pg.mouse.move(tr["x"] + tr["width"] * .62, y); pg.mouse.down(); pg.mouse.move(tr["x"] + tr["width"] * .8, y, steps=6); pg.mouse.up(); pg.wait_for_timeout(100)
    sick = "TB.state().absences.filter(a=>a.personId==='aylin'&&a.kind==='Krank'&&a.end>a.start&&!a.note).length"
    n = pg.evaluate(sick)
    drag_range(); pg.keyboard.type("#kr"); pg.wait_for_timeout(80)
    check(pg.locator("#sugList li").count() == 1, "drag-to-create suggests tags")
    pg.keyboard.press("Enter"); pg.keyboard.type("Grippe"); pg.wait_for_timeout(80)
    check("krank" in pg.inner_text(".tl-new small"), "drag-to-create hint names the absence")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check(pg.evaluate(sick) == n + 1, "drag-to-create with #krank adds a sick range without text")
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(100)
    drag_range(); pg.keyboard.type("#wartet Angebot"); pg.wait_for_timeout(80)
    check("Wartet auf Aylin" in pg.inner_text(".tl-new small"), "drag-to-create hint names the todo")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check(pg.evaluate("TB.state().todos.some(t=>t.title==='Angebot'&&t.kind==='waiting'&&t.personId==='aylin'&&!!t.due)"), "drag-to-create with #wartet adds a todo")
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(100)
    # todos in narrow columns: markers with a hover card; two weeks: cards with titles; parallel topics in different navy tones
    pg.evaluate("""S=TB.state();S.todos.push({id:'mk1',personId:'aylin',kind:'team',title:'Marker eins',due:ds(TDN+9),done:false,note:'Notiz zum Marker'},
      {id:'mk2',personId:'aylin',kind:'mine',title:'Marker zwei',due:ds(TDN+9),done:false,note:''});
      S.topics.push({id:'par1',personId:'mira',title:'Parallel A',start:ds(TDN),end:ds(TDN+20),status:'aktiv',note:''},{id:'par2',personId:'mira',title:'Parallel B',start:ds(TDN+1),end:ds(TDN+20),status:'aktiv',note:''});render()""")
    check(pg.locator(".tl .tchip").count() == 0 and pg.locator(".tmark").count() > 0, "six weeks shows todo markers instead of cards")
    mk = pg.locator(".tmark.multi[data-person=aylin]").first
    check(mk.inner_text() == "2", "marker counts the todos of a day")
    mk.scroll_into_view_if_needed(); mk.hover(); pg.wait_for_timeout(400)
    check(pg.locator("#tlPop").count() == 1 and "Marker eins" in pg.inner_text("#tlPop") and "Notiz zum Marker" in pg.inner_text("#tlPop"), "hover on a marker shows the details")
    pg.mouse.move(5, 5); pg.wait_for_timeout(400)
    check(pg.locator("#tlPop").count() == 0, "hover card closes when the mouse leaves")
    mk.click(); pg.wait_for_timeout(100); pg.mouse.move(5, 5); pg.wait_for_timeout(400)
    check(pg.locator("#tlPop").count() == 1, "click pins the card of several todos")
    pg.click("#tlPop .tp-i >> nth=0"); pg.wait_for_timeout(150)
    check(pg.locator("#dform [name=title]").input_value() in ("Marker eins", "Marker zwei") and pg.locator("#tlPop").count() == 0, "entry in the card opens the todo")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    check(pg.evaluate("document.activeElement.closest('#drawer')") is None, "closing the form leaves no focus in it")
    tones = pg.evaluate("[...document.querySelectorAll('.bar')].filter(b=>/Parallel/.test(b.textContent)).map(b=>b.className.match(/tone-\\d/)[0])")
    check(len(tones) == 2 and tones[0] != tones[1], "parallel topics get different tones")
    pg.keyboard.press("2"); pg.wait_for_timeout(100)
    check(pg.locator(".hc.dl").count() == 14 and "KW" in pg.inner_text(".tl-top h2") and pg.locator(".tchip,.tmark").count() > 0, "two-week view with todos")
    pg.click(".pager [data-action=tl-next]"); pg.wait_for_timeout(100)
    check(pg.evaluate("ui.off") == 1, "two weeks pages by one week")
    pg.click(".pager [data-action=tl-today]"); pg.keyboard.press("w"); pg.wait_for_timeout(100)
    chip = pg.locator(".tl .tchip").first
    chip.scroll_into_view_if_needed(); chip.hover(); pg.wait_for_timeout(600)
    title = state(pg, f"S.todos.find(t=>t.id==='{chip.get_attribute('data-todo')}').title")
    check(pg.locator("#tlPop").count() == 1 and title in pg.inner_text("#tlPop"), "hover on a todo card in the week view shows the details")
    pg.mouse.move(5, 5); pg.wait_for_timeout(400)
    # own calendar for date fields (Chrome/Edge show the native picker in the browser language)
    pg.evaluate("openTodo('mk1')"); pg.wait_for_timeout(150)
    pg.click("#dform [name=due] ~ .date-pick"); pg.wait_for_timeout(100)
    check(pg.locator("#dp").count() == 1 and "KW" in pg.inner_text("#dp") and "Mo" in pg.inner_text("#dp thead"), "calendar opens in German with week numbers")
    pg.keyboard.press("ArrowRight"); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    want = pg.evaluate("deDate(ds(TDN+10))")
    check(pg.locator("#dp").count() == 0 and pg.input_value("#dform [name=due]") == want, "arrow and Enter pick the next day")
    pg.click("#dform [name=due] ~ .date-pick"); pg.wait_for_timeout(100); pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    check(pg.locator("#dp").count() == 0 and pg.evaluate("document.body.classList.contains('drawer-open')"), "Esc closes the calendar, not the form")
    pg.click("#dform [name=due] ~ .date-pick"); pg.click("#dp [data-dp-set=today]"); pg.wait_for_timeout(100)
    check(pg.input_value("#dform [name=due]") == pg.evaluate("deDate(TODAY)"), "Heute in the calendar")
    pg.click("#dform [name=due] ~ .date-pick"); pg.click("#dp [data-dp-nav='1']"); pg.click("#dp .dp-d:not(.out) >> nth=0"); pg.wait_for_timeout(100)
    check(pg.input_value("#dform [name=due]").startswith("01."), "next month and click on a day")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    # date range: the calendar of a start field picks start and end in one go, the end field stays on its own
    pg.evaluate("openAbsence(null,{personId:'me'})"); pg.wait_for_timeout(150)
    d1, d2 = pg.evaluate("[TDN+2,TDN+6]")
    iso = lambda n: pg.evaluate(f"deDate(ds({n}))")
    pg.click("#dform [name=start] ~ .date-pick"); pg.wait_for_timeout(100)
    pg.click(f"#dp [data-dp='{d1}']"); pg.wait_for_timeout(100)
    check(pg.locator("#dp").count() == 1 and pg.input_value("#dform [name=start]") == iso(d1) and "Ende" in pg.inner_text("#dp .dp-info"), "range: first click sets the start, the calendar stays open")
    pg.hover(f"#dp [data-dp='{d2}']"); pg.wait_for_timeout(50)
    check(pg.locator("#dp td.in").count() == 5 and "5 Tage" in pg.inner_text("#dp .dp-info"), "range: hover previews the band with the day count")
    pg.click(f"#dp [data-dp='{d2}']"); pg.wait_for_timeout(100)
    check(pg.locator("#dp").count() == 0 and pg.input_value("#dform [name=end]") == iso(d2), "range: second click sets the end and closes")
    pg.click("#dform [name=start] ~ .date-pick"); pg.wait_for_timeout(100); pg.click(f"#dp [data-dp='{d2+1}']"); pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    check(pg.locator("#dp").count() == 0 and pg.input_value("#dform [name=start]") == iso(d2+1) and pg.input_value("#dform [name=end]") == iso(d2+1), "range: Esc keeps the start, an end before it follows")
    pg.click("#dform [name=end] ~ .date-pick"); pg.wait_for_timeout(100); pg.click(f"#dp [data-dp='{d2+3}']"); pg.wait_for_timeout(100)
    check(pg.locator("#dp").count() == 0 and pg.input_value("#dform [name=start]") == iso(d2+1) and pg.input_value("#dform [name=end]") == iso(d2+3), "range: the end field picks only the end")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    # half days: „Tageszeit“ only for a single day, saved as half, drawn over half the day column
    pg.evaluate("openAbsence(null,{personId:'lena'})"); pg.wait_for_timeout(150)
    check(pg.is_visible("#dform .half-g"), "Tageszeit shows for a single day")
    pg.fill("#dform [name=end]", pg.evaluate("deDate(ds(TDN+3))")); pg.dispatch_event("#dform [name=end]", "change"); pg.wait_for_timeout(50)
    check(not pg.is_visible("#dform .half-g"), "Tageszeit hides for several days")
    pg.fill("#dform [name=end]", pg.evaluate("deDate(TODAY)")); pg.dispatch_event("#dform [name=end]", "change"); pg.wait_for_timeout(50)
    pg.click("#dform label:has(input[name=half][value=am])"); pg.click("#dform button[type=submit]"); pg.wait_for_timeout(150)
    check(pg.evaluate("TB.state().absences.some(a=>a.personId==='lena'&&a.start===TODAY&&a.end===TODAY&&a.half==='am')"), "a half day is saved with half")
    check(pg.locator(".abs.half").count() >= 1, "the timeline draws the half day")
    r = pg.evaluate("""()=>{const S=TB.state(),m=mondayOf(TDN),keep=S.absences,rg=ui.range,off=ui.off;
      S.absences=keep.concat({id:'lb1',personId:'me',kind:'Urlaub',start:ds(m),end:ds(m+1)},{id:'lb2',personId:'me',kind:'Urlaub',start:ds(m+2),end:ds(m+2),half:'am'},{id:'lb3',personId:'me',kind:'Schulung',start:ds(m+3),end:ds(m+3)});
      ui.range='week';ui.off=0;render();const labels=()=>[...document.querySelectorAll('.tl-track[data-person=me] .abs-label')];
      const out={week:labels().map(l=>l.textContent),tip:labels()[0]?.title||''};ui.range='six';render();
      const rs=labels().map(l=>l.getBoundingClientRect());out.overlap=rs.some((a,i)=>rs.some((b,j)=>j>i&&a.right>b.left+0.5&&b.right>a.left+0.5&&a.bottom>b.top&&b.bottom>a.top));
      S.absences=keep;ui.range=rg;ui.off=off;render();return out}""")
    check(r["week"] == ["Urlaub", "Schulung"] and "2 Einträge" in r["tip"], "touching entries of one kind share one label in the timeline")
    check(not r["overlap"], "absence labels never overlap, also in six weeks")
    pg.evaluate("(S=>{S.absences=S.absences.filter(a=>!(a.personId==='lena'&&a.half));render()})(TB.state())")
    # holidays per state: computed per year, shown in the timeline, left out of workday counts, flagged under "Zu klären"
    check(pg.evaluate("[2024,2025,2026,2027,2038].map(y=>ds(easterSunday(y))).join()") == "2024-03-31,2025-04-20,2026-04-05,2027-03-28,2038-04-25", "Easter dates")
    counts = pg.evaluate("['','HE','BY','BE','SN','TH','HH'].map(r=>Object.keys(holidaysOf(2027,r)).length).join()")
    check(counts == "9,10,12,10,11,11,10", f"holiday count per state in 2027 ({counts})")
    check(pg.evaluate("[holidaysOf(2026,'SN')[dn('2026-11-18')],holidaysOf(2027,'SN')[dn('2027-11-17')],holidaysOf(2029,'SN')[dn('2029-11-21')],Object.keys(holidaysOf(2017,'HH')).length].join()") == "Buß- und Bettag,Buß- und Bettag,Buß- und Bettag,9", "Buß- und Bettag and Reformationstag since 2018")
    pg.click("#side [data-action=more-menu]"); pg.click("#drawer [data-action=region]"); pg.select_option("#dform [name=region]", "HE"); pg.click("#dform button[type=submit]"); pg.wait_for_timeout(100)
    pg.click("#side [data-action=more-menu]"); hessen = "Feiertage: Hessen" in pg.inner_text("#drawer"); pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    check(pg.evaluate("getSetting('region')") == "HE" and pg.evaluate("holidayOn(dn('2027-05-27'))") == "Fronleichnam" and hessen, "choose the state for holidays")
    check(pg.evaluate("workdays('2027-03-22','2027-04-02')") == 8, "workdays leave out Karfreitag and Ostermontag")
    pg.evaluate("ui.range='week';ui.off=(mondayOf(dn('2026-12-21'))-mondayOf(TDN))/7;render()"); pg.wait_for_timeout(100)
    check(pg.locator(".hc.hol").count() == 2 and "1. Weihnachtstag" in pg.inner_text(".tl-head"), "holidays in the timeline header")
    pg.evaluate("S=TB.state();S.todos.push({id:'hol1',personId:'lena',kind:'team',title:'Feiertagsaufgabe',due:'2027-12-24',done:false,note:''});S.todos.find(t=>t.id==='hol1').due='2027-12-25';ui.off=0;render()")
    check(any("Feiertagsaufgabe" in t and "Feiertag" in t for t in pg.locator(".prow.issue").all_inner_texts()), "todo due on a holiday shows under Zu klären")
    # due date in the text: "am", "zum", "bis", month names, "morgen" alone; other dates only after a keyword
    q = lambda s: pg.evaluate(f"(r=>[r.title||r.note,r.due||r.start||''].join('|'))(parseQuick({s!r},{{personId:'me',kind:'team'}}))")
    d = lambda js: pg.evaluate(js)
    check(q("@ich Vorbereitung Beförderungsgespräch am 12.11") == "Vorbereitung Beförderungsgespräch|" + d("mkDate(12,11,0)"), "am 12.11 sets the due date")
    check(q("Bericht zum 3. Dezember 2027") == "Bericht|2027-12-03" and q("Plan am 12. Nov") == "Plan|" + d("mkDate(12,11,0)"), "zum and month names")
    check(q("Bericht morgen abgeben") == "Bericht abgeben|" + d("ds(TDN+1)"), "morgen without keyword")
    check(q("Review Release 4.2") == "Review Release 4.2|" and q("Termin Freitag absagen") == "Termin Freitag absagen|" and q("Treffen am Ende") == "Treffen am Ende|", "numbers and weekdays without keyword stay in the title")
    check(q("@Lena #schulung am 20.11.") == "|" + d("mkDate(20,11,0)"), "am sets the start of an absence")
    check(pg.evaluate("(()=>{try{normalize({version:99,people:[]});return false}catch(e){return !!e.newer}})()") and pg.evaluate("Array.isArray(normalize({version:2,future:[{id:1}]}).future)"), "newer data is refused, unknown lists pass through")
    # data version 2: "role" becomes "team"; new entries carry createdAt
    check(pg.evaluate("(d=>d.people[0].team==='Backend'&&!('role' in d.people[0])&&Array.isArray(d.contacts))(normalize({people:[{id:'x',name:'X',role:'Backend'}]}))"), "migration renames role to team")
    check(pg.evaluate("JSON.parse(TB.store.serialize()).version") == 2, "data version 2")
    # involved people and contacts: first team member is responsible, contacts and further people are only mentioned
    pg.evaluate("location.hash='uebersicht'"); pg.wait_for_timeout(100)
    rows = pg.locator(".tl-row").count()
    pg.click("#quick"); pg.keyboard.type("@ich Foliendeck für @Mark prüfen"); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check(pg.evaluate("(t=>t&&t.personId==='me'&&t.kind==='team'&&t.with.join()==='kmark'&&!!t.createdAt)(TB.state().todos.find(t=>t.title==='Foliendeck für Mark prüfen'&&t.createdAt))"), "@ich … @Mark: my todo with Mark involved, createdAt set")
    r = pg.evaluate("parseQuick('@Lena Review mit @Jonas',{personId:'me',kind:'team'})")
    check(r["personId"] == "lena" and r["with"] == ["jonas"] and r["title"] == "Review mit Jonas", "second @ is involved, not responsible")
    pg.click("#quick"); pg.keyboard.type("Zahlen für @Zora")
    check("als Kontakt anlegen" in pg.inner_text("#sugList"), "unknown @name offers a new contact")
    pg.keyboard.press("Enter"); pg.keyboard.type("prüfen"); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check(pg.evaluate("(k=>k&&TB.state().todos.some(t=>t.title==='Zahlen für Zora prüfen'&&t.with.includes(k.id)))(TB.state().contacts.find(k=>k.name==='Zora'))"), "contact created from the suggestion list and mentioned")
    check(pg.locator(".tl-row").count() == rows and pg.locator("#side .nav:has-text('Zora')").count() == 0, "contacts get no row and no sidebar entry")
    pg.evaluate("location.hash='ich'"); pg.wait_for_timeout(150)
    pg.select_option("#forPerson", "kmark"); pg.wait_for_timeout(100)
    check(pg.locator(".todo:has-text('Foliendeck für Mark prüfen')").count() == 2 and pg.locator(".tabs").count() == 0, "Meine Planung filters by a mentioned person")
    pg.select_option("#forPerson", "kthomas"); pg.wait_for_timeout(100); pg.evaluate("ui.showDone=true;render()")
    check(pg.locator(".todo.done:has-text('Agenda Jour fixe')").count() == 1, "done items for a contact")
    pg.select_option("#forPerson", ""); pg.wait_for_timeout(100)
    pg.evaluate("location.hash='ma-mira'"); pg.wait_for_timeout(150)
    check(pg.locator(".card:has(h2:has-text('Beteiligt an')) .prow:has-text('Payment-API v2')").count() == 1, "person page lists topics she is involved in")
    pg.evaluate("ui.off=0;render()"); pg.wait_for_timeout(100); nt = state(pg, "S.todos.length")
    check(pg.locator(".tl-track[data-person=mira] .wbar:has-text('Lena: Payment-API v2')").count() == 1 and pg.locator(".tl-track[data-person=mira] .bar:has-text('Payment-API v2')").count() == 0, "involved topic shows as a lane in her timeline row")
    pg.evaluate("document.activeElement.blur();document.querySelector('.tl-track[data-person=mira] .wbar').scrollIntoView({block:'center'})"); pg.click(".tl-track[data-person=mira] .wbar"); pg.wait_for_timeout(150)
    check(pg.input_value("#withIn").strip() == "@Mira" and state(pg, "S.todos.length") == nt, "a click on the lane opens the topic and creates nothing")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    tid = pg.evaluate("TB.state().topics.find(t=>t.title==='Payment-API v2').id")
    pg.evaluate(f"openTopic('{tid}')"); pg.wait_for_timeout(150)
    check(pg.input_value("#withIn").strip() == "@Mira", "form shows involved people")
    pg.click("#withIn"); pg.keyboard.press("End"); pg.keyboard.type("@Th"); pg.keyboard.press("Enter")
    pg.check("#dform input[name=status][value=erledigt]", force=True)
    check(pg.locator(".topic-done").is_visible(), "Erledigt am appears for a finished topic")
    pg.fill("#dform [name=doneAt]", "5.11.2026"); pg.click("#dform button[type=submit]"); pg.wait_for_timeout(100)
    check(pg.evaluate(f"(t=>t.with.join()==='mira,kthomas'&&t.doneAt==='2026-11-05')(TB.state().topics.find(t=>t.id==='{tid}'))"), "involved people and completion date of a topic are saved")
    pg.evaluate(f"openTopic('{tid}')"); pg.wait_for_timeout(100); pg.fill("#withIn", "@Niemand"); pg.click("#dform button[type=submit]"); pg.wait_for_timeout(100)
    check("weder im Team" in pg.inner_text("#drawer .d-err"), "unknown name in the form is rejected"); pg.keyboard.press("Escape")
    # recurring todos: completing creates the next instance on a working day, reopening removes it again
    check(pg.evaluate("(()=>[plannedAt('2026-01-31','m1',1),plannedAt('2026-11-30','m3',1),ds(workdayBefore(dn('2026-12-26')))].join())()") == "2026-02-28,2027-02-28,2026-12-24", "repeat dates: month ends and holidays")
    pg.evaluate("location.hash='ich'"); pg.wait_for_timeout(150)
    rid = pg.evaluate("TB.state().todos.find(t=>t.series==='demorep'&&!t.done).id")
    check(pg.locator(f'.todo:has(.check[data-id="{rid}"]) .badge.rep').count() == 1, "recurring todo shows its rhythm")
    pg.click(f'.check[data-id="{rid}"]'); pg.wait_for_timeout(100)
    nxt = pg.evaluate("TB.state().todos.filter(t=>t.series==='demorep'&&!t.done).map(t=>t.due)"); TODAY_ISO = ""
    ok = len(nxt) == 1 and pg.evaluate(f"(n=>n>TDN&&wdOf(n)>0&&wdOf(n)<6&&!holidayOn(n))(dn('{nxt[0] if nxt else TODAY_ISO}'))") if nxt else False
    check(ok and "Nächste fällig" in pg.inner_text("#toast"), "completing a recurring todo creates the next one on a working day")
    pg.evaluate(f"(t=>{{reopenTodo(t);save();render()}})(TB.state().todos.find(t=>t.id==='{rid}'))")
    check(pg.evaluate("TB.state().todos.filter(t=>t.series==='demorep').length") == 1, "reopening removes the follow-up")
    pg.click("#quick"); pg.keyboard.type("Zeiterfassung prüfen #mon"); pg.keyboard.press("Tab"); pg.keyboard.type("bis Fr"); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check(pg.evaluate("(t=>t&&t.repeat==='m1'&&t.anchor===t.due&&!!t.series)(TB.state().todos.find(t=>t.title==='Zeiterfassung prüfen'))"), "#monatlich creates a recurring todo")
    # removing a person archives her: entries stay, she leaves the team views
    n = pg.evaluate("TB.state().topics.filter(t=>t.personId==='tobias').length")
    pg.evaluate("location.hash='ma-tobias'"); pg.wait_for_timeout(150)
    pg.click(".page-head [data-action=edit-person]"); pg.wait_for_timeout(100)
    check("bleiben im Verlauf" in pg.inner_text("#drawer"), "form explains what removing keeps")
    pg.click("#drawer [data-action=delete]"); pg.wait_for_timeout(150)
    check(pg.evaluate(f"(S=>S.people.find(p=>p.id==='tobias').archived===TODAY&&S.topics.filter(t=>t.personId==='tobias').length==={n})(TB.state())"), "removed person keeps her topics")
    check(pg.locator(".tl-row").count() == rows - 1 and pg.locator('#side a[href="#ma-tobias"]').count() == 0, "removed person leaves timeline and sidebar")
    check(pg.evaluate("TB.state().assignments.filter(a=>a.personId==='tobias').every(a=>a.end&&a.end<=TODAY)"), "running projects end on the day she leaves")
    pg.evaluate("location.hash='verlauf'"); pg.wait_for_timeout(150)
    check(pg.locator("#histPerson option:has-text('ausgeschieden')").count() == 1, "history still offers the removed person")
    pg.evaluate("location.hash='ma-tobias'"); pg.wait_for_timeout(150)
    pg.click("[data-action=restore-person]"); pg.wait_for_timeout(150)
    check(pg.locator('#side a[href="#ma-tobias"]').count() == 1, "removed person can come back")
    check(not errors, "no JavaScript errors " + "; ".join(errors))

    if not ONLY: sync_flows(b)
    responsive(b)
    b.close()
srv.shutdown()
print(f"\n{len(fails)} failed" if fails else "\nall passed")
sys.exit(1 if fails else 0)
