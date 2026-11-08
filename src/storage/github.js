/* Minimal client for one file via the GitHub contents API.
   c = { repo: 'owner/name', branch, path, token }. Every successful put() is a commit. */
const GitHub = {
  API: 'https://api.github.com',

  headers(c, extra = {}) {
    return { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...extra };
  },
  fileUrl(c) {
    return `${this.API}/repos/${c.repo}/contents/${c.path.split('/').map(encodeURIComponent).join('/')}`;
  },

  /* Checks that the repository exists, is private and returns its default branch. */
  async checkRepo(c) {
    const r = await fetch(`${this.API}/repos/${c.repo}`, { headers: this.headers(c), cache: 'no-store' });
    if (!r.ok) throw await this.error(r);
    const j = await r.json();
    if (!j.private) throw new Error(`${c.repo} ist öffentlich. Bitte nutze ein privates Repository für die Daten.`);
    return j.default_branch || 'main';
  },

  /* Private repositories the token can see ("owner/name"). A fine-grained token limited to one repository returns just that one. */
  async privateRepos(token) {
    const r = await fetch(`${this.API}/user/repos?visibility=private&per_page=100&sort=updated`, { headers: this.headers({ token }), cache: 'no-store' });
    if (!r.ok) throw await this.error(r);
    return (await r.json()).filter(x => x.private).map(x => x.full_name);
  },

  /* Returns { sha, text } or null if the file does not exist yet. */
  async get(c) {
    const r = await fetch(`${this.fileUrl(c)}?ref=${encodeURIComponent(c.branch)}`, { headers: this.headers(c), cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw await this.error(r);
    const j = await r.json();
    return { sha: j.sha, text: this.decode(j.content) };
  },

  /* Creates or updates the file. sha = version we are based on (null for a new file).
     A stale sha means another device committed in between: throws { conflict: true }. */
  async put(c, text, sha, message) {
    const body = { message, content: this.encode(text), branch: c.branch };
    if (sha) body.sha = sha;
    const r = await fetch(this.fileUrl(c), { method: 'PUT', headers: this.headers(c, { 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) { const e = new Error('conflict'); e.conflict = true; throw e; }
    if (!r.ok) throw await this.error(r);
    return { sha: (await r.json()).content.sha };
  },

  encode(text) { return Vault.b64(new TextEncoder().encode(text)); },
  decode(b64) { return new TextDecoder().decode(Vault.unb64(b64)); },

  async error(r) {
    const msg = {
      401: 'Der Token ist ungültig oder abgelaufen. Leg unter github.com einen neuen an und verbinde dich neu.',
      403: 'GitHub verweigert den Zugriff. Prüf, ob der Token „Contents: Read and write“ für das Daten-Repository hat.',
      404: 'Repository nicht gefunden, oder der Token hat keinen Zugriff darauf.',
    }[r.status] || `GitHub antwortet mit Fehler ${r.status}.`;
    const e = new Error(msg);
    e.status = r.status;
    return e;
  },
};
