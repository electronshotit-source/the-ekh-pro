/**
 * IndexedDB persistence.
 *
 * Two object stores:
 *   weddings  the record: form fields, gallery profile, per-shot metrics,
 *             select order, generated outputs. No blobs, so it stays cheap
 *             to list.
 *   blobs     the image data, keyed `${weddingId}/${shotId}`.
 *
 * Metrics are stored with the record, so reopening a wedding never re-runs
 * analysis — it only re-decodes the images. The database name and stores
 * match the original app, so existing libraries open unchanged.
 */
import type { AssetKind, Block, Metrics, Output, Profile, Role, Wedding } from "./types"

const DB_NAME = "aso"
const DB_VERSION = 1

export interface StoredShot {
  id: string
  name: string
  m: Metrics
  dupeOf: string | null
  burst?: number
}

export interface StoredSelect {
  id: string
  role: Role
  note: string
}

export interface WeddingRecord {
  id: string
  name: string
  wedding: Wedding
  profile: Profile
  shots: StoredShot[]
  selectIds: StoredSelect[]
  outputs: Output[]
  coverId: string | null
  createdAt: number
  updatedAt: number
}

interface BlobRow {
  key: string
  blob: Blob
}

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains("weddings")) db.createObjectStore("weddings", { keyPath: "id" })
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs", { keyPath: "key" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error ?? new Error("IndexedDB unavailable"))
    }
  })
  return dbPromise
}

/** Run one request in its own transaction and resolve once it commits. */
async function run<T>(
  storeName: "weddings" | "blobs",
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(storeName, mode)
    let req: IDBRequest<T>
    try {
      req = fn(t.objectStore(storeName))
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
      return
    }
    t.oncomplete = () => resolve(req.result)
    t.onerror = () => reject(t.error ?? new Error("Transaction failed"))
    t.onabort = () => reject(t.error ?? new Error("Transaction aborted"))
  })
}

export const available = () => typeof indexedDB !== "undefined"

export const newId = () => `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

/* ---------- blobs ---------- */

export const blobKey = (weddingId: string, shotId: string) => `${weddingId}/${shotId}`

export const putBlob = (key: string, blob: Blob) =>
  run("blobs", "readwrite", (s) => s.put({ key, blob } satisfies BlobRow))

export async function getBlob(key: string): Promise<Blob | null> {
  const row = (await run("blobs", "readonly", (s) => s.get(key))) as BlobRow | undefined
  return row?.blob ?? null
}

async function deleteBlobsFor(weddingId: string): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction("blobs", "readwrite")
    const req = t.objectStore("blobs").openCursor()
    req.onsuccess = () => {
      const cur = req.result
      if (!cur) return
      if (String(cur.key).startsWith(`${weddingId}/`)) cur.delete()
      cur.continue()
    }
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error ?? new Error("Couldn't delete images"))
  })
}

/** A dataURL (the demo gallery) or an object URL → a storable Blob. */
export async function toBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  return res.blob()
}

/* ---------- weddings ---------- */

const KINDS = new Set<AssetKind>([
  "carousel",
  "reel",
  "tiktok",
  "bts",
  "testimonial",
  "caption",
  "story",
  "pinterest",
  "blog",
  "newsletter",
  "shorts",
  "linkedin",
  "vendorsheet",
  "shotlist",
])

/**
 * Records written by the original app stored outputs with extra fields
 * (`shot: undefined`) and without `tone`. Normalise on the way in so the
 * rest of the app only ever sees the current shape.
 */
function normaliseOutputs(raw: unknown, tone: Wedding["tone"]): Output[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((o): Output[] => {
    if (!o || typeof o !== "object") return []
    const r = o as Partial<Output>
    if (!r.kind || !KINDS.has(r.kind) || !Array.isArray(r.blocks)) return []
    return [
      {
        id: r.id ?? `${r.kind}-${Math.random().toString(36).slice(2, 8)}`,
        kind: r.kind,
        title: r.title ?? r.kind,
        subtitle: r.subtitle ?? "",
        blocks: r.blocks as Block[],
        createdAt: r.createdAt ?? Date.now(),
        tone: r.tone ?? tone,
        ...(r.printable && { printable: r.printable }),
      },
    ]
  })
}

function normalise(raw: unknown): WeddingRecord | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as WeddingRecord
  if (!r.id || !r.wedding) return null
  return {
    ...r,
    shots: r.shots ?? [],
    selectIds: r.selectIds ?? [],
    outputs: normaliseOutputs(r.outputs, r.wedding.tone),
    createdAt: r.createdAt ?? r.updatedAt ?? Date.now(),
    updatedAt: r.updatedAt ?? Date.now(),
  }
}

/** Records without their blobs, newest first — cheap enough for the Library. */
export async function list(): Promise<WeddingRecord[]> {
  const rows = (await run("weddings", "readonly", (s) => s.getAll())) as unknown[]
  return rows
    .map(normalise)
    .filter((r): r is WeddingRecord => r !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function get(id: string): Promise<WeddingRecord | null> {
  return normalise(await run("weddings", "readonly", (s) => s.get(id)))
}

export async function save(
  record: Omit<WeddingRecord, "createdAt" | "updatedAt"> & {
    createdAt?: number
  },
): Promise<WeddingRecord> {
  const now = Date.now()
  const full: WeddingRecord = { ...record, createdAt: record.createdAt ?? now, updatedAt: now }
  await run("weddings", "readwrite", (s) => s.put(full))
  return full
}

export async function remove(id: string): Promise<void> {
  await deleteBlobsFor(id)
  await run("weddings", "readwrite", (s) => s.delete(id))
}

/** Rough on-disk footprint, for the Library header. */
export async function usage(): Promise<{ used: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null
  const { usage: used = 0, quota = 0 } = await navigator.storage.estimate()
  return { used, quota }
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return "—"
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export const weddingName = (w: Wedding) => [w.bride, w.groom].filter(Boolean).join(" & ") || "Untitled wedding"
