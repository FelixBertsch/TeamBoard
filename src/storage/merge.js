/* Three-way merge per entry. base = last state both devices agreed on, local = this device, remote = GitHub.
   Entries are matched by id in every list. Changes to different entries are combined; if the same entry
   changed on both sides, the local version wins and is counted in `conflicts` (GitHub history keeps the other). */
function mergeStates(base, local, remote) {
  const out = empty();
  let conflicts = 0;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // known lists plus lists only a newer app version knows (passed through by normalize())
  const keys = new Set([...Object.keys(out), ...[local, remote, base].flatMap(o => Object.keys(o || {}).filter(k => Array.isArray(o[k])))]);
  for (const key of keys) {
    const B = new Map((base[key] || []).map(x => [x.id, x]));
    const R = new Map((remote[key] || []).map(x => [x.id, x]));
    const L = new Map((local[key] || []).map(x => [x.id, x]));
    const pick = id => {
      const b = B.get(id), l = L.get(id), r = R.get(id);
      if (l && r) {
        if (same(l, r) || (b && same(r, b))) return l;
        if (b && same(l, b)) return r;
        conflicts++;
        return l;
      }
      if (l) return b && same(l, b) ? null : l; // deleted remotely: keep only if edited locally
      if (r) return b && same(r, b) ? null : r; // deleted locally: keep only if edited remotely
      return null;
    };
    // Local order first, then entries that only exist remotely.
    const ids = [...L.keys(), ...[...R.keys()].filter(id => !L.has(id))];
    out[key] = ids.map(pick).filter(Boolean);
  }
  return { data: out, conflicts };
}
