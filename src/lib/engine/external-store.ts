/**
 * A tiny localStorage-backed store that React reads via useSyncExternalStore.
 *
 * Engine code (generators, the reel renderer) needs these values
 * synchronously and outside React; components need to re-render when they
 * change. One module-level source of truth serves both — mirroring it into
 * a second client store would let the two drift.
 */
export interface ExternalStore<T> {
  get(): T
  set(patch: Partial<T> | ((prev: T) => T)): T
  subscribe(listener: () => void): () => void
}

const hasStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined"

export function createExternalStore<T extends object>(
  key: string,
  defaults: T,
  /** Normalise whatever was persisted (old shapes, partial data) into T. */
  hydrate: (raw: unknown, defaults: T) => T = (raw, d) =>
    raw && typeof raw === "object" ? { ...d, ...(raw as Partial<T>) } : d,
): ExternalStore<T> {
  let state: T = defaults
  let loaded = false
  const listeners = new Set<() => void>()

  const load = () => {
    if (loaded || !hasStorage()) return
    loaded = true
    try {
      const raw = localStorage.getItem(key)
      state = hydrate(raw ? (JSON.parse(raw) as unknown) : null, defaults)
    } catch {
      state = defaults
    }
  }

  return {
    get() {
      load()
      return state
    },
    set(patch) {
      load()
      state = typeof patch === "function" ? patch(state) : { ...state, ...patch }
      if (hasStorage()) {
        try {
          localStorage.setItem(key, JSON.stringify(state))
        } catch {
          // Quota or private mode — keep the in-memory value; nothing to recover.
        }
      }
      listeners.forEach((l) => l())
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
