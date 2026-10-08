"use client"

import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import * as db from "@/lib/engine/wedding-db"
import { useStudio } from "@/lib/studio/store"

/** Top-of-sidebar switcher: the open wedding, recent ones, and "New wedding". */
export function WeddingSwitcher() {
  const router = useRouter()
  const weddingId = useStudio((s) => s.weddingId)
  const wedding = useStudio((s) => s.wedding)
  const phase = useStudio((s) => s.phase)
  const open = useStudio((s) => s.open)
  const close = useStudio((s) => s.close)
  const [recent, setRecent] = useState<db.WeddingRecord[] | null>(null)

  const name = weddingId ? db.weddingName(wedding) : "No wedding open"
  const sub = weddingId
    ? [wedding.venue, wedding.city].filter(Boolean).join(", ") || "Details not set"
    : phase === "analysing"
      ? "Analysing…"
      : "Import a gallery to start"

  return (
    <DropdownMenu
      onOpenChange={(o) => {
        if (o && db.available())
          db.list().then(
            (r) => setRecent(r.slice(0, 6)),
            () => setRecent([]),
          )
      }}
    >
      <DropdownMenuTrigger className="group flex w-full items-center gap-3 rounded-xl border border-stroke-strong bg-surface p-2.5 text-left shadow-xs transition-colors hover:bg-layer-1 aria-expanded:bg-layer-1">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft font-serif text-base text-brand italic"
        >
          {(wedding.bride || "W").charAt(0)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{name}</span>
          <span className="block truncate text-xs text-ink-2">{sub}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-64">
        <DropdownMenuLabel className="text-xs text-ink-2">Recent weddings</DropdownMenuLabel>
        {recent === null ? (
          <p className="px-2 py-1.5 text-sm text-ink-2">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-ink-2">Nothing saved yet.</p>
        ) : (
          recent.map((r) => (
            <DropdownMenuItem
              key={r.id}
              onSelect={() => {
                if (r.id !== weddingId) void open(r.id)
                router.push("/studio/selects")
              }}
            >
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              {r.id === weddingId && <Check className="text-brand" aria-label="Open" />}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            close()
            router.push("/studio")
          }}
        >
          <Plus />
          New wedding
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
