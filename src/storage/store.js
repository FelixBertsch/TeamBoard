/* Storage and sync.
   Modes: 'none' = not set up (setup page), 'demo' = sample data in memory only, 'github' = encrypted file in a private repo.

   How 'github' works:
   - Every change is cached on the device at once (IndexedDB), so the app starts offline and never loses input.
   - CFG.saveDelayMs after the last change, push() commits the encrypted state. `base` is the state last agreed
     with GitHub, `sha` its version. A stale sha means another device committed: pull(), merge per entry, retry.
   - sync() runs every CFG.syncIntervalSeconds, on focus and when the network returns. It pulls remote changes
     and pushes pending local ones. It waits while a form, drag or dialog is open (busy()), except for forms that save
     every change at once (drawer cfg `live`): a change made there must not wait on the device until the form closes.
   - The cache is shared by every window of the browser. A window that writes it while another window's changes are
     still only in the cache (not on GitHub) takes those changes over first (cache()), so reloading one window never
     drops what the other has not committed yet.
   - After each successful sync, Backup.write() mirrors a plain copy into the optional backup folder. */
const TAB = Math.random().toString(36).slice(2); // this window, to tell its cache writes from those of other windows
const Store = {
  mode: 'none',
  status: 'idle', // idle | loading | pending | saving | saved | offline | error | outdated
  outdated: false, // a newer app version wrote the data: stop reading and writing until reload (changes stay cached)
  error: '',
  lastSavedAt: null,
  gh: null,      // { repo, branch, path, token, key, salt }
  sha: null,
  base: null,    // JSON string of the state last agreed with GitHub
  known: [],     // shas this device has seen; protects against briefly stale reads after a commit
  timer: null,
  pushing: false,
  again: false,

  /* ----- called by save() for every change ----- */
  changed() {
    if (this.mode !== 'github') return;
    this.cache();
    this.setStatus('pending');
    this.schedule();
  },
  schedule(ms = CFG.saveDelayMs) { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), ms); },
  get dirty() { return this.mode === 'github' && snapshot() !== this.base; },
  busy() { return sug || drag || (document.body.classList.contains('drawer-open') && !drawerCfg?.live) || $('.tl-new') || $('#dlg.open') || $('#tour'); },

  setStatus(st, err = '') {
    this.status = st; this.error = err;
    const el = $('#syncState'); if (el) el.outerHTML = syncHTML();
  },

  serialize() {
    return JSON.stringify({ app: 'teamboard', version: DATA_VERSION, savedAt: new Date().toISOString(), ...S }, null, 2); // S: lists of empty() plus unknown ones
  },

  /* ----- setup ----- */
  /* First connection on a device. Without `repo` it looks for the private repositories the token can see: exactly one is
     taken, otherwise it returns { needRepo: true, repos } and the setup page asks. Returns { needConfirm: true } if the
     repo has no data file yet and the passphrase still has to be repeated. Throws readable errors. */
  async connect({ token, passphrase, confirm, repo }) {
    repo = (repo || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$|\/$/g, '');
    if (!repo) {
      let repos = [];
      try { repos = await GitHub.privateRepos(token); } catch (e) { if (e.status === 401) throw e; }
      if (repos.length !== 1) return { needRepo: true, repos };
      repo = repos[0];
    }
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Gib das Repository als Besitzer/Name an, zum Beispiel „deinname/teamboard-daten“.');
    const c = { repo, branch: 'main', path: CFG.githubPath, token };
    c.branch = await GitHub.checkRepo(c);
    const file = await GitHub.get(c);
    let data, salt, key;
    if (file) {
      const env = Vault.parse(file.text);
      salt = env.kdf.salt;
      key = await Vault.deriveKey(passphrase, salt, env.kdf.iterations);
      data = normalize(JSON.parse(await Vault.open(env, key)));
    } else {
      if (!confirm) return { needConfirm: true, repo };
      if (confirm !== passphrase) throw new Error('Die beiden Passwörter stimmen nicht überein.');
      salt = Vault.newSalt();
      key = await Vault.deriveKey(passphrase, salt);
      data = empty();
    }
    this.gh = { ...c, key, salt };
    await idbSet('github', this.gh);
    this.mode = 'github';
    this.adopt(data, file ? file.sha : null);
    applyExpiry();
    if (!file) await this.push(true);
    else this.setStatus('saved');
    this.lastSavedAt = new Date();
    Backup.resume();
    notePhone();
    return {};
  },

  /* App start with a stored connection: show the cached state at once, then sync. */
  async resume(gh) {
    this.gh = gh; this.mode = 'github';
    let cache = null;
    try { cache = await idbGet('cache'); } catch { cache = null; }
    if (cache && cache.repo === gh.repo && cache.path === gh.path) {
      S = normalize(cache.state); this.base = cache.base; this.sha = cache.sha; this.known = cache.known || [];
      resetUndo(); applyExpiry();
      this.setStatus(this.dirty ? 'pending' : 'idle');
    } else {
      S = empty(); resetUndo(); this.base = null; this.sha = null;
      this.setStatus('loading');
    }
    render();
    Backup.resume();
    await this.sync(true);
    notePhone();
  },

  async disconnect() {
    clearTimeout(this.timer);
    await idbDel('github'); await idbDel('cache');
    this.gh = null; this.mode = 'none'; this.sha = null; this.base = null; this.known = [];
    S = empty(); resetUndo();
  },

  /* ----- sync ----- */
  adopt(data, sha) {
    S = data; resetUndo();
    this.base = snapshot(); this.sha = sha; this.remember(sha);
    this.cache();
  },
  remember(sha) { if (sha && !this.known.includes(sha)) { this.known.push(sha); if (this.known.length > 50) this.known.shift(); } },
  cache() {
    if (this.mode !== 'github') return;
    idbUpdate('cache', prev => {
      if (prev && prev.tab && prev.tab !== TAB && prev.repo === this.gh.repo && prev.path === this.gh.path && prev.base && JSON.stringify(prev.state) !== prev.base) {
        // another window cached changes it has not committed yet: take them over instead of overwriting them
        if (this.busy()) { this.schedule(3000); return prev; } // a form holds entries of S; push() writes the cache again later
        try {
          const before = snapshot();
          S = mergeStates(JSON.parse(prev.base), S, normalize(prev.state)).data;
          if (snapshot() !== before) { resetUndo(); render(); this.setStatus('pending'); this.schedule(); }
        } catch (e) { console.warn('Cache merge failed', e); return prev; }
      }
      return { repo: this.gh.repo, path: this.gh.path, state: S, base: this.base, sha: this.sha, known: this.known, tab: TAB };
    }).catch(e => console.warn('Cache write failed', e));
  },

  async sync(force = false) {
    if (this.mode !== 'github' || this.pushing || this.outdated) return;
    if (!force && (document.hidden || this.busy())) return;
    if (!navigator.onLine) { this.setStatus('offline'); return; }
    try {
      await this.pull();
      if (applyExpiry() && !this.busy()) render();
      if (this.dirty) await this.push();
      else if (this.status !== 'saved') this.setStatus('saved');
    } catch (e) { this.fail(e); }
  },

  /* Fetches the remote file. Without local changes it replaces the state, otherwise it merges. */
  async pull() {
    const file = await GitHub.get(this.gh);
    if (!file) { this.sha = null; return; } // file missing: next push recreates it
    if (file.sha === this.sha || this.known.includes(file.sha)) return;
    const remote = normalize(JSON.parse(await Vault.open(Vault.parse(file.text), this.gh.key)));
    const remoteStr = JSON.stringify(remote);
    const local = snapshot();
    let next = remoteStr, conflicts = 0;
    if (this.base !== null && local !== this.base) {
      const m = mergeStates(JSON.parse(this.base), S, remote);
      next = JSON.stringify(m.data); conflicts = m.conflicts;
    }
    this.sha = file.sha; this.remember(file.sha); this.base = remoteStr;
    if (next !== local) {
      S = JSON.parse(next); resetUndo();
      if (!this.busy()) render();
      toast(conflicts ? `Neuer Stand geladen. ${conflicts} Einträge wurden auf zwei Geräten geändert, deine Fassung gilt.` : 'Neuer Stand von einem anderen Gerät geladen');
    }
    this.cache();
    Backup.write();
  },

  async push(force = false) {
    if (this.mode !== 'github' || this.outdated) return;
    if (this.pushing) { this.again = true; return; }
    if (!force && this.busy()) { this.schedule(3000); return; }
    if (!navigator.onLine) { this.setStatus('offline'); return; }
    this.pushing = true; this.setStatus('saving');
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const local = snapshot();
        if (local === this.base && this.sha) break;
        // the file carries app and version (normalize() checks it on every device); `base` stays the plain state
        const env = await Vault.seal(JSON.stringify({ app: 'teamboard', version: DATA_VERSION, ...JSON.parse(local) }), this.gh.key, this.gh.salt);
        try {
          const r = await GitHub.put(this.gh, env, this.sha, `Teamboard: ${deviceName()}, ${new Date().toLocaleString('de-DE')}`);
          this.sha = r.sha; this.remember(r.sha); this.base = local; this.lastSavedAt = new Date();
          this.cache();
          Backup.write();
          break;
        } catch (e) {
          if (!e.conflict) throw e;
          await this.pull(); // merges into S, then retry with the new sha (throws if a newer version wrote)
        }
      }
      this.setStatus(this.dirty ? 'pending' : 'saved');
    } catch (e) { this.fail(e); }
    this.pushing = false;
    if (this.again || this.dirty) { this.again = false; if (!['error', 'offline', 'outdated'].includes(this.status)) this.schedule(); }
  },

  fail(e) {
    if (e.newer) { this.outdated = true; this.setStatus('outdated'); if (!this.busy()) render(); return; }
    if (e instanceof TypeError || !navigator.onLine) { this.setStatus('offline'); return; } // fetch network error
    console.error(e);
    this.setStatus('error', e.message || String(e));
  },
};

function deviceName() {
  const ua = navigator.userAgent;
  return /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Browser';
}

window.addEventListener('focus', () => Store.sync());
window.addEventListener('online', () => Store.sync());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (Store.dirty) Store.push(true); } // flush when the app goes to the background
  else Store.sync();
});
setInterval(() => Store.sync(), Math.max(10, CFG.syncIntervalSeconds) * 1000);
