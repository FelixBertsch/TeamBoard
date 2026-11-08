/* Backups.
   - Backup folder (desktop Chrome/Edge only, optional): after every sync a plain, unencrypted copy goes to
     <folder>/CFG.backupFileName, plus one daily copy in <folder>/CFG.backupFolder/. This is the safety net
     if the passphrase is ever lost. Chromium may ask for permission again after a browser restart.
   - Export/import: download the current state as JSON or replace it with a JSON backup (any browser). */
const FS_OK = typeof window.showDirectoryPicker === 'function';

const Backup = {
  dir: null,
  needsPermission: false,
  writing: false,

  async resume() {
    if (!FS_OK) return;
    let h = null;
    try { h = await idbGet('backupDir'); } catch { h = null; }
    if (!h) return;
    this.dir = h;
    try { this.needsPermission = (await h.queryPermission({ mode: 'readwrite' })) !== 'granted'; } catch { this.needsPermission = true; }
    if (!this.needsPermission) this.write();
  },

  /* Must run inside a click (browser rule for folder pickers and permission prompts). */
  async choose() {
    try {
      const dir = await window.showDirectoryPicker({ id: 'teamboard-backup', mode: 'readwrite' });
      await idbSet('backupDir', dir);
      this.dir = dir; this.needsPermission = false;
      await this.write();
      toast(`Sicherungsordner: ${dir.name}`);
    } catch (e) { if (e.name !== 'AbortError') toast(`Ordner lässt sich nicht verbinden: ${e.message}`); }
  },
  async allow() {
    try { this.needsPermission = (await this.dir.requestPermission({ mode: 'readwrite' })) !== 'granted'; }
    catch { this.needsPermission = true; }
    if (!this.needsPermission) { await this.write(); toast('Sicherungsordner wieder verbunden'); }
  },

  async write() {
    if (!this.dir || this.needsPermission || this.writing || Store.mode !== 'github') return;
    this.writing = true;
    try {
      const text = Store.serialize();
      await this.writeFile(this.dir, CFG.backupFileName, text);
      const d = await this.dir.getDirectoryHandle(CFG.backupFolder, { create: true });
      const daily = `teamboard-${TODAY}.json`;
      let exists = true;
      try { await d.getFileHandle(daily); } catch { exists = false; }
      if (!exists) {
        await this.writeFile(d, daily, text);
        if (CFG.backupKeepDays > 0) {
          const limit = ds(TDN - CFG.backupKeepDays);
          for await (const [n] of d.entries()) { const m = n.match(/^teamboard-(\d{4}-\d{2}-\d{2})\.json$/); if (m && m[1] < limit) await d.removeEntry(n); }
        }
      }
    } catch (e) {
      console.warn('Backup failed', e);
      if (e.name === 'NotAllowedError') this.needsPermission = true;
    }
    this.writing = false;
  },
  async writeFile(dir, name, text) {
    const h = await dir.getFileHandle(name, { create: true });
    const w = await h.createWritable(); await w.write(text); await w.close();
  },
};

function exportData() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([Store.serialize()], { type: 'application/json' }));
  a.download = `teamboard-sicherung-${TODAY}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function importFile(file) {
  let data;
  try { data = normalize(JSON.parse(await file.text())); }
  catch (e) { toast(e.newer ? 'Die Sicherung stammt von einer neueren Version des Teamboards. Lade die Seite neu und spiel sie dann ein.' : 'Die Datei ist keine Teamboard-Sicherung'); return; }
  showDialog({ title: 'Sicherung einspielen',
    text: `„${esc(file.name)}“ enthält ${data.people.length} Personen, ${data.topics.length} Themen und ${data.todos.length} Aufgaben. Sie ersetzt alle aktuellen Daten. Strg+Z holt den alten Stand zurück.`,
    actions: [{ label: 'Abbrechen', kind: 'ghost' }, { label: 'Einspielen', kind: 'primary', run: () => { S = data; expireSick(); save(); render(); toast('Sicherung eingespielt', true); } }] });
}
document.addEventListener('change', e => { if (e.target.id === 'importFile' && e.target.files[0]) { importFile(e.target.files[0]); e.target.value = ''; } });
