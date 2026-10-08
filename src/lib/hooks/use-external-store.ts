"use client"

import { useSyncExternalStore } from "react"

import type { ExternalStore } from "@/lib/engine/external-store"

/**
 * Subscribe a component to an engine store (brand kit, plan, Claude
 * settings). The server snapshot is the store's defaults, so the first
 * client render matches the HTML and saved values arrive right after.
 */
export function useExternalStore<T extends object>(store: ExternalStore<T>, serverSnapshot: T): T {
  return useSyncExternalStore(store.subscribe, store.get, () => serverSnapshot)
}
