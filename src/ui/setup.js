/* Setup page (mode 'none'), demo mode and the sync status shown in the sidebar and in "Mehr".
   The setup page walks a new user through GitHub: create a private repository, create a fine-grained token (both via
   prefilled GitHub URLs), then connect. The repository is detected from the token; it is stored per device, not in the code. */
let setupError = '', setupConfirm = false, setupBusy = false, setupRepos = null; // setupRepos: null, or the candidates when the repository has to be chosen

const GH_NEW_REPO = 'https://github.com/new?name=teamboard-daten&visibility=private&description=' + encodeURIComponent('Verschlüsselte Daten des Teamboards');
const GH_NEW_TOKEN = 'https://github.com/settings/personal-access-tokens/new?name=Teamboard&expires_in=366&contents=write&description='
  + encodeURIComponent('Lesen und Schreiben der verschlüsselten Teamboard-Daten');

function viewSetup() {
  const v = setupConfirm, link = (href, label) => `<a class="btn secondary sm" href="${href}" target="_blank" rel="noopener">${label}</a>`;
  const repoField = setupRepos === null ? '' : setupRepos.length > 1
    ? field('Daten-Repository', `<select name="repo" required>${setupRepos.map(r => `<option>${esc(r)}</option>`).join('')}</select>`)
      + '<p class="hint">Der Token sieht mehrere private Repositories. Wähle das für die Teamboard-Daten.</p>'
    : field('Daten-Repository', '<input name="repo" required autocomplete="off" spellcheck="false" placeholder="deinname/teamboard-daten">')
      + '<p class="hint">Der Token sieht kein privates Repository. Prüf, ob du in Schritt 2 unter „Repository access“ dein Repository ausgewählt hast, oder gib es hier als Besitzer/Name an.</p>';
  return `<div class="setup"><section class="card"><img class="setup-logo" src="assets/brand/logo-light.svg" alt="Teamboard" width="185" height="28"><p class="overline">Teamboard</p><h1>Einrichten</h1>
    <p class="lead">Das Teamboard speichert deine Daten verschlüsselt in einem privaten GitHub-Repository, das nur dir gehört. Du brauchst ein kostenloses GitHub-Konto und etwa fünf Minuten.</p>
    <ol class="steps">
      <li><h2>Privates Repository anlegen</h2><p>Der Link öffnet GitHub mit einem vorbereiteten Repository. Der Name ist frei wählbar, die Sichtbarkeit bleibt „Private“. Dann „Create repository“, mehr nicht.</p>
        ${link(GH_NEW_REPO, 'Repository auf GitHub anlegen')}</li>
      <li><h2>Zugangsschlüssel erzeugen</h2><p>Der Link öffnet ein vorausgefülltes Token-Formular: ein Jahr gültig, Berechtigung „Contents: Read and write“. Wähle unter „Repository access“ die Option „Only select repositories“ und dein neues Repository, dann „Generate token“.
        Kopier den Token sofort, GitHub zeigt ihn nur einmal. Leg ihn in deinem Passwortmanager ab, du brauchst ihn auf jedem Gerät.</p>
        ${link(GH_NEW_TOKEN, 'Token auf GitHub erzeugen')}</li>
      <li><h2>Verbinden</h2>
    <form id="setupForm" autocomplete="off">
      ${field('Zugangsschlüssel (Token)', `<input name="token" type="password" required autocomplete="off" spellcheck="false" placeholder="github_pat_…">`)}
      ${repoField}
      ${field('Passwort für die Verschlüsselung', `<input name="passphrase" type="password" required minlength="8" autocomplete="current-password">`)}
      <p class="hint">Damit verschlüsselt das Teamboard deine Daten auf dem Gerät, bevor sie zu GitHub gehen. Niemand kann es zurücksetzen, auch GitHub nicht. Ohne Passwort sind die Daten verloren.</p>
      ${v ? `<p class="hint strong">Im Repository liegen noch keine Daten. Wiederhol das Passwort, damit sich kein Tippfehler einschleicht.</p>
        ${field('Passwort wiederholen', `<input name="confirm" type="password" required autocomplete="new-password" autofocus>`)}` : ''}
      <div class="actions"><button class="btn accent" type="submit"${setupBusy ? ' disabled' : ''}>${setupBusy ? 'Verbinde …' : v ? 'Daten anlegen' : 'Verbinden'}</button>
        <button class="btn ghost" type="button" data-action="start-demo">Mit Beispieldaten ausprobieren</button></div>
    </form>
    ${setupError ? `<div class="err" role="alert">${esc(setupError)}</div>` : ''}</li></ol>
    <p class="setup-note">Auf jedem weiteren Gerät brauchst du nur Schritt 3, mit demselben Token und Passwort. Auf dem iPhone öffnest du diese Seite in Safari, wählst „Teilen“ und „Zum Home-Bildschirm“ und richtest das Teamboard dann in der App auf dem Home-Bildschirm ein.</p></section></div>`;
}

async function submitSetup(form) {
  const v = Object.fromEntries(new FormData(form));
  setupBusy = true; setupError = ''; render(); restoreSetup(v);
  try {
    const r = await Store.connect({ token: v.token.trim(), passphrase: v.passphrase, confirm: v.confirm, repo: v.repo });
    setupBusy = false;
    if (r.needRepo) { setupRepos = r.repos; render(); restoreSetup(v); $('#setupForm [name=repo]')?.focus(); return; }
    if (r.needConfirm) { setupConfirm = true; setupRepos = setupRepos && [r.repo]; render(); restoreSetup({ ...v, repo: r.repo }); return; }
    setupConfirm = false; setupRepos = null; location.hash = 'uebersicht'; render(); toast('Verbunden, Daten werden synchronisiert');
    offerTour();
  } catch (e) {
    setupBusy = false; setupError = e.message || String(e); render(); restoreSetup(v);
  }
}
/* render() rebuilds the form; keep what was typed. */
function restoreSetup(v) {
  const f = $('#setupForm'); if (!f) return;
  for (const k of ['token', 'passphrase', 'repo']) if (f[k] && v[k]) f[k].value = v[k];
  if (!setupBusy) (f.confirm || f.passphrase).focus();
}

function startDemo() { Store.mode = 'demo'; S = demo(); expireSick(); resetUndo(); render(); }
function leaveDemo() { Store.mode = 'none'; S = empty(); resetUndo(); location.hash = ''; render(); }
function confirmDisconnect() {
  showDialog({ title: 'Auf diesem Gerät abmelden',
    text: 'Token, Schlüssel und zwischengespeicherte Daten werden von diesem Gerät entfernt. Die Daten im Repository bleiben erhalten.',
    actions: [{ label: 'Abbrechen', kind: 'ghost' }, { label: 'Abmelden', kind: 'primary', run: async () => {
      if (Store.dirty) await Store.push(true);
      await Store.disconnect(); closeDrawer(false); render(); toast('Abgemeldet'); } }] });
}

function syncHTML() {
  const st = Store.status;
  if (Store.mode === 'demo') return `<div id="syncState"><div class="sync" title="Beispielmodus, nichts wird gespeichert"><span class="sdot pending"></span>Beispielmodus</div><span class="sync-file">Änderungen werden nicht gespeichert.</span></div>`;
  const time = Store.lastSavedAt ? stamp(Store.lastSavedAt) : '';
  const label = { saved: `Synchronisiert ${time}`, pending: 'Änderungen offen', saving: 'Synchronisiert …', loading: 'Lädt …',
    offline: 'Offline, wird nachgereicht', error: 'Synchronisieren fehlgeschlagen', idle: 'Verbunden', outdated: 'Neue Version, bitte neu laden' }[st] || '';
  const sub = st === 'error' ? Store.error : st === 'outdated' ? 'Änderungen bleiben auf dem Gerät' : Store.gh?.repo || '';
  return `<div id="syncState"><div class="sync" title="${esc(label)}"><span class="sdot ${st === 'outdated' ? 'error' : st}"></span>${esc(label)}</div><span class="sync-file" title="${esc(sub)}">${esc(sub)}</span></div>`;
}
const stamp = d => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/* Actions offered in the sidebar footer and in "Mehr", depending on mode. Each: [action, icon, label]. */
function storageActions() {
  const region = ['region', 'calendar', hasSetting('region') ? `Feiertage: ${regionName(getSetting('region', ''))}` : 'Feiertage wählen'];
  if (Store.mode === 'demo') return [region, ['tour', 'compass', 'Rundgang'], ['leave-demo', 'folder', 'Teamboard einrichten']];
  const a = [['export', 'download', 'Sicherung herunterladen'], ['import', 'upload', 'Sicherung einspielen']];
  if (FS_OK) a.push(Backup.dir && Backup.needsPermission ? ['backup-allow', 'folder', `Sicherungsordner ${Backup.dir.name} erlauben`]
    : ['backup-folder', 'folder', Backup.dir ? `Sicherungsordner: ${Backup.dir.name}` : 'Sicherungsordner wählen']);
  a.push(region, ['tour', 'compass', 'Rundgang']);
  a.push(['disconnect', 'logOut', 'Auf diesem Gerät abmelden']);
  return a;
}
