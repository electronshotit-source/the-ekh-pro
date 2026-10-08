"use client"

/**
 * The open wedding: gallery, analysis, selects and generated outputs.
 *
 * One client store shared by every studio route, so moving between Gallery,
 * Selects, Assets and Reel Lab never re-runs analysis. Persistence is
 * write-through to IndexedDB (debounced); images are stored once, on import.
 */
import { create } from "zustand"

import * as billing from "@/lib/engine/billing"
import * as curator from "@/lib/engine/curator"
import * as db from "@/lib/engine/wedding-db"
import { demoGallery, demoWedding } from "@/lib/engine/demo"
import { generate, type GenerateOptions } from "@/lib/engine/generators"
import { analyze, applyFaces, detectFaces, loadImage } from "@/lib/engine/vision"
import type { AssetKind, Metrics, Output, Profile, RawShot, ScoredShot, Select, Wedding } from "@/lib/engine/types"

export type Phase = "empty" | "restoring" | "analysing" | "ready"

export interface Progress {
  done: number
  total: number
  current: string | null
}

export const EMPTY_WEDDING: Wedding = {
  bride: "",
  groom: "",
  venue: "",
  city: "Lagos",
  culture: "nigerian",
  tone: "luxury",
  handle: "",
  date: "",
  vendors: "",
}

export const DEFAULT_SELECT_COUNT = 10
export const MAX_IMPORT = 400
const LAST_KEY = "ekh.last.v1"

interface StudioState {
  weddingId: string | null
  wedding: Wedding
  shots: ScoredShot[]
  selects: Select[]
  profile: Profile | null
  outputs: Output[]
  pinned: string[]
  excluded: string[]
  selectCount: number
  phase: Phase
  progress: Progress
  error: string | null
  /** True once the last-opened wedding has been restored (or there was none). */
  booted: boolean
}

interface StudioActions {
  boot(): Promise<void>
  setWedding(patch: Partial<Wedding>): void
  importFiles(files: File[]): Promise<void>
  importDemo(): Promise<void>
  togglePin(id: string): void
  toggleExclude(id: string): void
  setSelectCount(n: number): void
  generate(
    kinds: AssetKind[],
    opts?: GenerateOptions & { tone?: Wedding["tone"]; culture?: Wedding["culture"] },
  ): Output[]
  updateOutput(id: string, fn: (o: Output) => Output): void
  removeOutput(id: string): void
  open(id: string): Promise<void>
  close(): void
}

export type Studio = StudioState & StudioActions

const INITIAL: StudioState = {
  weddingId: null,
  wedding: EMPTY_WEDDING,
  shots: [],
  selects: [],
  profile: null,
  outputs: [],
  pinned: [],
  excluded: [],
  selectCount: DEFAULT_SELECT_COUNT,
  phase: "empty",
  progress: { done: 0, total: 0, current: null },
  error: null,
  booted: false,
}

/* ---------- helpers ---------- */

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0))

const remember = (id: string | null) => {
  try {
    if (id) localStorage.setItem(LAST_KEY, id)
    else localStorage.removeItem(LAST_KEY)
  } catch {
    // Private mode — restoring on reload is a nicety, not a requirement.
  }
}

const recall = (): string | null => {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

const shotId = (i: number) => `s${i.toString(36)}_${Math.random().toString(36).slice(2, 6)}`

function revokeAll(shots: RawShot[]) {
  for (const s of shots) if (s.url.startsWith("blob:")) URL.revokeObjectURL(s.url)
}

/** Decode, score and face-check one frame. */
async function measure(img: HTMLImageElement): Promise<Metrics> {
  const m = analyze(img)
  return applyFaces(m, await detectFaces(img))
}

function curate(shots: ScoredShot[], count: number, pinned: string[], excluded: string[]) {
  return curator.sequence(shots, count, {
    pinned: new Set(pinned),
    excluded: new Set(excluded),
  })
}

/* ---------- persistence ---------- */

let saveTimer: ReturnType<typeof setTimeout> | null = null

function toRecord(s: StudioState): Omit<db.WeddingRecord, "createdAt" | "updatedAt"> | null {
  if (!s.weddingId || !s.profile) return null
  return {
    id: s.weddingId,
    name: db.weddingName(s.wedding),
    wedding: s.wedding,
    profile: s.profile,
    shots: s.shots.map(({ id, name, m, dupeOf, burst }) => ({
      id,
      name,
      m,
      dupeOf,
      ...(burst !== undefined && { burst }),
    })),
    selectIds: s.selects.map(({ id, role, note }) => ({ id, role, note })),
    outputs: s.outputs,
    coverId: s.selects[0]?.id ?? s.shots[0]?.id ?? null,
  }
}

/* ---------- store ---------- */

export const useStudio = create<Studio>()((set, get) => {
  const createdAt = new Map<string, number>()

  const persist = () => {
    if (!db.available()) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const record = toRecord(get())
      if (!record) return
      db.save({ ...record, createdAt: createdAt.get(record.id) }).catch(() => {
        // Storage full or unavailable — the session still works in memory.
      })
    }, 500)
  }

  /** Shared tail of every import: dedupe, sequence, profile, store. */
  async function ingest(raw: Array<RawShot & { m: Metrics }>, wedding: Wedding, blobs: Map<string, Blob>) {
    const shots = curator.dedupe(raw)
    const { selectCount } = get()
    const selects = curate(shots, selectCount, [], [])
    const profile = curator.profile(shots)
    const weddingId = db.newId()
    createdAt.set(weddingId, Date.now())

    set({
      weddingId,
      wedding,
      shots,
      selects,
      profile,
      outputs: [],
      pinned: [],
      excluded: [],
      phase: "ready",
      progress: { done: raw.length, total: raw.length, current: null },
      error: null,
    })
    billing.recordWedding()
    remember(weddingId)

    if (!db.available()) return
    try {
      await Promise.all([...blobs].map(([id, blob]) => db.putBlob(db.blobKey(weddingId, id), blob)))
      persist()
    } catch {
      set({ error: "Couldn't save this wedding to the browser — it'll be gone on reload." })
    }
  }

  return {
    ...INITIAL,

    async boot() {
      if (get().booted) return
      set({ booted: true })
      const id = recall()
      if (!id || !db.available()) return
      await get().open(id)
    },

    setWedding(patch) {
      set((s) => ({ wedding: { ...s.wedding, ...patch } }))
      persist()
    },

    async importFiles(files) {
      const images = files.filter((f) => f.type.startsWith("image/")).slice(0, MAX_IMPORT)
      if (!images.length) {
        set({ error: "None of those files were images. Try JPEG, PNG, WebP or HEIC exports." })
        return
      }
      revokeAll(get().shots)
      set({
        ...INITIAL,
        booted: true,
        wedding: get().wedding,
        phase: "analysing",
        progress: { done: 0, total: images.length, current: null },
      })

      const raw: Array<RawShot & { m: Metrics }> = []
      const blobs = new Map<string, Blob>()
      let failed = 0
      for (const [i, file] of images.entries()) {
        set({ progress: { done: i, total: images.length, current: file.name } })
        const url = URL.createObjectURL(file)
        try {
          const img = await loadImage(url)
          const id = shotId(i)
          raw.push({ id, name: file.name, url, img, blob: file, m: await measure(img) })
          blobs.set(id, file)
        } catch {
          URL.revokeObjectURL(url)
          failed++
        }
        await yieldToUi()
      }

      if (!raw.length) {
        set({ phase: "empty", error: "Couldn't decode any of those images." })
        return
      }
      await ingest(raw, get().wedding, blobs)
      if (failed) set({ error: `${failed} file${failed === 1 ? "" : "s"} couldn't be decoded and were skipped.` })
    },

    async importDemo() {
      revokeAll(get().shots)
      set({ ...INITIAL, booted: true, phase: "analysing", progress: { done: 0, total: 22, current: null } })
      await yieldToUi()
      const frames = demoGallery()
      set({ progress: { done: 0, total: frames.length, current: null } })

      const raw: Array<RawShot & { m: Metrics }> = []
      const blobs = new Map<string, Blob>()
      for (const [i, f] of frames.entries()) {
        set({ progress: { done: i, total: frames.length, current: f.name } })
        const blob = await db.toBlob(f.url)
        const url = URL.createObjectURL(blob)
        const img = await loadImage(url)
        const id = shotId(i)
        raw.push({ id, name: f.name, url, img, m: await measure(img) })
        blobs.set(id, blob)
        await yieldToUi()
      }
      await ingest(raw, demoWedding(), blobs)
    },

    togglePin(id) {
      const s = get()
      const pinned = s.pinned.includes(id) ? s.pinned.filter((x) => x !== id) : [...s.pinned, id]
      const excluded = s.excluded.filter((x) => x !== id)
      set({ pinned, excluded, selects: curate(s.shots, s.selectCount, pinned, excluded) })
      persist()
    },

    toggleExclude(id) {
      const s = get()
      const excluded = s.excluded.includes(id) ? s.excluded.filter((x) => x !== id) : [...s.excluded, id]
      const pinned = s.pinned.filter((x) => x !== id)
      set({ pinned, excluded, selects: curate(s.shots, s.selectCount, pinned, excluded) })
      persist()
    },

    setSelectCount(n) {
      const s = get()
      const selectCount = Math.max(3, Math.min(20, Math.round(n)))
      set({ selectCount, selects: curate(s.shots, selectCount, s.pinned, s.excluded) })
      persist()
    },

    generate(kinds, opts = {}) {
      const s = get()
      if (!s.profile || !s.selects.length) throw new Error("Import a gallery first.")
      if (!billing.canGenerate(kinds.length)) {
        const left = Math.max(0, billing.remainingAssets())
        throw new Error(
          left
            ? `Only ${left} asset${left === 1 ? "" : "s"} left on your plan this month.`
            : "You've used this month's assets. Upgrade your plan to keep generating.",
        )
      }
      const { tone, culture, ...rest } = opts
      const wedding: Wedding = {
        ...s.wedding,
        ...(tone && { tone }),
        ...(culture && { culture }),
      }
      const seconds = rest.seconds ? Math.min(rest.seconds, billing.maxReelSeconds()) : undefined
      const made = kinds.map((k, i) =>
        generate(k, wedding, s.profile!, s.selects, {
          ...rest,
          ...(seconds && { seconds }),
          variant: (rest.variant ?? 0) + i,
        }),
      )
      billing.recordAssets(made.length)
      set({ outputs: [...made, ...s.outputs] })
      persist()
      return made
    },

    updateOutput(id, fn) {
      set((s) => ({ outputs: s.outputs.map((o) => (o.id === id ? fn(o) : o)) }))
      persist()
    },

    removeOutput(id) {
      set((s) => ({ outputs: s.outputs.filter((o) => o.id !== id) }))
      persist()
    },

    async open(id) {
      revokeAll(get().shots)
      set({ ...INITIAL, booted: true, phase: "restoring" })
      try {
        const record = await db.get(id)
        if (!record) throw new Error("missing")
        createdAt.set(record.id, record.createdAt)

        const shots: ScoredShot[] = []
        for (const stored of record.shots) {
          const blob = await db.getBlob(db.blobKey(record.id, stored.id))
          if (!blob) continue
          const url = URL.createObjectURL(blob)
          const img = await loadImage(url).catch(() => undefined)
          shots.push({ ...stored, url, ...(img && { img }) })
        }
        const byId = new Map(shots.map((s) => [s.id, s]))
        const selects: Select[] = record.selectIds.flatMap((sel) => {
          const shot = byId.get(sel.id)
          return shot ? [{ ...shot, role: sel.role, note: sel.note }] : []
        })

        set({
          weddingId: record.id,
          wedding: record.wedding,
          profile: record.profile,
          shots,
          selects: selects.length ? selects : curate(shots, DEFAULT_SELECT_COUNT, [], []),
          selectCount: selects.length || DEFAULT_SELECT_COUNT,
          outputs: record.outputs,
          phase: shots.length ? "ready" : "empty",
          error: shots.length ? null : "That wedding's images are missing from this browser.",
        })
        remember(record.id)
      } catch {
        remember(null)
        set({ phase: "empty" })
      }
    },

    close() {
      revokeAll(get().shots)
      remember(null)
      set({ ...INITIAL, booted: true })
    },
  }
})

/** Look up shots by id for slide/beat/pin rendering. */
export function useShotMap(): Map<string, ScoredShot> {
  const shots = useStudio((s) => s.shots)
  return shotMapFor(shots)
}

const mapCache = new WeakMap<ScoredShot[], Map<string, ScoredShot>>()
function shotMapFor(shots: ScoredShot[]) {
  let m = mapCache.get(shots)
  if (!m) {
    m = new Map(shots.map((s) => [s.id, s]))
    mapCache.set(shots, m)
  }
  return m
}
