/* Tiny IndexedDB key-value store (database "teamboard", store "kv").
   Keys: "github" (connection + derived key), "cache" (last state for offline start), "backupDir" (folder handle). */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('teamboard', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
async function idbSet(k, v) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
/* Reads and replaces one key in a single transaction, so no other window writes in between. fn(old) returns the new value
   (returning old unchanged writes nothing). fn runs synchronously inside the transaction. */
async function idbUpdate(k, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction('kv', 'readwrite'), st = t.objectStore('kv'), q = st.get(k);
    q.onsuccess = () => { const v = fn(q.result); if (v !== q.result) st.put(v, k); };
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
async function idbDel(k) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
