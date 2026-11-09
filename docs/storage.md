# Storage, sync and deployment

Read this before you touch `src/storage/` or anything that writes data.

## Modes


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
3. `sync()` runs every `CFG.syncIntervalSeconds`, on focus, on `online` and when the app becomes visible. It pulls and pushes pending changes. It skips while `busy()` (drawer, drag, inline field, dialog). Drawers that save every change at once and hold no entry they edit later (`live: true` in `openDrawer()`: contacts list, "Mehr", "Feiertage") do not count as busy. Before 9.11.2026 the contacts list kept a new contact on the device until the form closed; reloaded in that state next to a second window, the contact was lost. A new form that saves while staying open (returns `KEEP_OPEN`) needs `live: true`, unless it keeps references to entries of `S`.
4. `pull()`: no local changes → take the remote state; local changes → `mergeStates(base, local, remote)` per entry id. If the same entry changed on both devices, the local version wins and a toast says so. GitHub's commit history keeps every version.
5. `known` remembers recent shas so that a briefly stale read right after a commit is not mistaken for a remote change.
6. **Several windows** of one browser share the IndexedDB `cache`. Every write goes through `idbUpdate()` in one transaction and carries the window id (`TAB`). If the cache holds changes of another window that are not on GitHub yet (`state` differs from `base`), `cache()` merges them into `S` first (`mergeStates(prev.base, S, prev.state)`, local wins) and commits them; while this window is busy it leaves the cache alone. Without this, a second window overwrote the cache and a reload of the first one dropped its uncommitted changes.
7. When the app goes to the background, pending changes are pushed immediately. Offline, changes stay cached and status shows "Offline, wird nachgereicht".
8. After a remote state is loaded, the undo stack is cleared (`resetUndo()`).
9. **Newer versions.** `push()` writes `{app, version: DATA_VERSION, …S}`; `base` and the cache stay the plain state. `normalize()` throws (`e.newer`) for data with a higher `version` than this app knows; `Store.fail()` then sets `Store.outdated`: no more pulls or pushes, sync status "Neue Version, bitte neu laden" and a banner with "Neu laden". Local changes stay in the cache and go out after the reload. Import refuses such a backup. Lists this version does not know pass through `normalize()`, `mergeStates()` and `serialize()` unchanged. Bump `DATA_VERSION` (`model.js`) for every change an older app would misread; a new optional field or list needs no bump.

**Backups** (`backup.js`). Optional backup folder (Chrome/Edge only): after every sync a plain copy `CFG.backupFileName` plus one daily copy in `CFG.backupFolder/`, older ones than `CFG.backupKeepDays` are deleted. Chromium may ask for permission again after a restart ("Sicherungsordner … erlauben" under "Mehr"). Export and import work in every browser.

Rules: never write data except via `save()`. Never put user data into `localStorage`; only `teamboard.v1.ui` (chosen timeline range) and `teamboard.v1.tour` (tour already offered on this device, per layout) live there.


## Deployment


GitHub Pages serves `main` from the repo root (`https://<owner>.github.io/<repo>/`). A push to `main` is live within a minute. Forks deploy the same way. The service worker is network-first, so an online start always loads the latest version. If you change the list of files, nothing else needs updating; bump `CACHE` in `sw.js` only to drop old cached files.

**Token expiry:** a 401 shows „Der Token ist ungültig oder abgelaufen“. Fix: "Mehr" → "Auf diesem Gerät abmelden", connect with a new token.
