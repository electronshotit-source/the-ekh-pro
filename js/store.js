/* ============================================================
   store.js — IndexedDB persistence.

   Two object stores:
     weddings  the record: form fields, gallery profile, per-shot metrics,
               select order, generated outputs. No blobs, so it stays cheap
               to list.
     blobs     the actual image data, keyed `${weddingId}/${shotId}`.

   Metrics are stored alongside the blobs, so reopening a wedding does not
   re-run the analysis pass — it only re-decodes the images the Reel needs.
   ============================================================ */

const DB_NAME = 'aso';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('weddings')) {
        db.createObjectStore('weddings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
  });
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    let result;
    try { result = fn(store); } catch (err) { reject(err); return; }
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  }));
}

export const available = () => typeof indexedDB !== 'undefined';

export const newId = () =>
  `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/* ---------- blobs ---------- */

export const putBlob = (key, blob) => tx('blobs', 'readwrite', s => s.put({ key, blob }));
export const getBlob = (key) => tx('blobs', 'readonly', s => s.get(key)).then(r => r?.blob || null);

async function deleteBlobsFor(weddingId) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction('blobs', 'readwrite');
    const store = t.objectStore('blobs');
    const req = store.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return;
      if (String(cur.key).startsWith(`${weddingId}/`)) cur.delete();
      cur.continue();
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** A dataURL (the demo gallery) or an object URL → a storable Blob. */
export async function toBlob(url) {
  const res = await fetch(url);
  return res.blob();
}

/* ---------- weddings ---------- */

/** Records without their blobs, newest first — cheap enough for the Library. */
export async function list() {
  const rows = await tx('weddings', 'readonly', s => s.getAll());
  return (rows || []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export const get = (id) => tx('weddings', 'readonly', s => s.get(id));

export async function save(record) {
  record.updatedAt = Date.now();
  record.createdAt ||= record.updatedAt;
  await tx('weddings', 'readwrite', s => s.put(record));
  return record;
}

export async function remove(id) {
  await deleteBlobsFor(id);
  await tx('weddings', 'readwrite', s => s.delete(id));
}

/** Rough on-disk footprint, for the Library header. */
export async function usage() {
  if (!navigator.storage?.estimate) return null;
  const { usage: used, quota } = await navigator.storage.estimate();
  return { used, quota };
}

export const formatBytes = (n) => {
  if (n == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

/* ---------- shaping ---------- */

/**
 * Build a persistable record from live app state.
 * Strips `img` elements and object URLs — those are rebuilt on load.
 */
export function toRecord({ id, wedding, profile, shots, selects, outputs, name }) {
  return {
    id,
    name: name || [wedding.bride, wedding.groom].filter(Boolean).join(' & ') || 'Untitled wedding',
    wedding,
    profile,
    shots: shots.map(s => ({ id: s.id, name: s.name, m: s.m, dupeOf: s.dupeOf, burst: s.burst })),
    selectIds: selects.map(s => ({ id: s.id, role: s.role, note: s.note })),
    outputs: outputs.map(stripOutput),
    coverId: selects[0]?.id ?? shots[0]?.id ?? null,
    updatedAt: Date.now(),
  };
}

/** Outputs reference shot objects; store only the shot id and rehydrate later. */
function stripOutput(o) {
  return {
    ...o,
    blocks: o.blocks.map(b => {
      if (b.t === 'slides') return { ...b, slides: b.slides.map(s => ({ ...s, shot: undefined, shotId: s.shot?.id ?? null })) };
      if (b.t === 'beats') return { ...b, beats: b.beats.map(x => ({ ...x, shot: undefined, shotId: x.shot?.id ?? null })) };
      if (b.t === 'pins') return { ...b, pins: b.pins.map(p => ({ ...p, shot: undefined, shotId: p.shot?.id ?? null })) };
      return b;
    }),
  };
}

/** Re-attach live shot objects to a loaded record's outputs. */
export function rehydrateOutputs(outputs, byId) {
  return (outputs || []).map(o => ({
    ...o,
    blocks: o.blocks.map(b => {
      if (b.t === 'slides') return { ...b, slides: b.slides.map(s => ({ ...s, shot: byId[s.shotId] || null })) };
      if (b.t === 'beats') return { ...b, beats: b.beats.map(x => ({ ...x, shot: byId[x.shotId] || null })) };
      if (b.t === 'pins') return { ...b, pins: b.pins.map(p => ({ ...p, shot: byId[p.shotId] || null })) };
      return b;
    }),
  }));
}
