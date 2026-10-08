"use client"

import { ArrowRight, Images, Minus, Plus } from "lucide-react"
import Link from "next/link"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useMemo } from "react"

import { EmptyState, PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ScoredShot } from "@/lib/engine/types"
import { useStudio } from "@/lib/studio/store"

import { ShotCard } from "./shot-card"

const VIEWS = ["selects", "all", "rejected", "duplicates"] as const
type View = (typeof VIEWS)[number]

function reasonFor(shot: ScoredShot, names: Map<string, string>): string | null {
  if (shot.dupeOf) return `Near-duplicate of ${names.get(shot.dupeOf) ?? "a stronger frame"}`
  if (!shot.m.usable)
    return shot.m.sharp <= 0.2 ? "Soft — focus missed or motion blur" : "Exposure too far off to rescue"
  return null
}

export function SelectsPage() {
  const phase = useStudio((s) => s.phase)
  const booted = useStudio((s) => s.booted)

  if (!booted || phase === "restoring" || phase === "analysing") return <GridSkeleton />
  if (phase !== "ready") {
    return (
      <EmptyState
        icon={<Images />}
        title="No gallery yet"
        description="Import a wedding and the strongest frames will show up here, in story order."
        action={
          <Button asChild>
            <Link href="/studio">Import a gallery</Link>
          </Button>
        }
      />
    )
  }
  return <Selects />
}

function Selects() {
  const shots = useStudio((s) => s.shots)
  const selects = useStudio((s) => s.selects)
  const pinned = useStudio((s) => s.pinned)
  const excluded = useStudio((s) => s.excluded)
  const selectCount = useStudio((s) => s.selectCount)
  const { togglePin, toggleExclude, setSelectCount } = useStudio.getState()
  const [view, setView] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("selects"))

  const names = useMemo(() => new Map(shots.map((s) => [s.id, s.name])), [shots])
  const groups = useMemo(
    () => ({
      all: [...shots].sort((a, b) => b.m.score - a.m.score),
      rejected: shots.filter((s) => !s.m.usable && !s.dupeOf),
      duplicates: shots.filter((s) => s.dupeOf),
    }),
    [shots],
  )

  const tabs: Array<[View, string, number]> = [
    ["selects", "Selects", selects.length],
    ["all", "All frames", shots.length],
    ["rejected", "Rejected", groups.rejected.length],
    ["duplicates", "Duplicates", groups.duplicates.length],
  ]

  const list: ScoredShot[] = view === "selects" ? selects : groups[view]
  const pinnedSet = new Set(pinned)
  const excludedSet = new Set(excluded)

  return (
    <>
      <PageHeader
        eyebrow="Selects"
        title="The story, in order"
        description="Sequenced hero → detail → room → party → closer. Pin a frame to force it in; exclude one to keep it out."
        actions={
          <>
            <div
              className="flex items-center gap-1 rounded-lg border border-stroke-strong p-0.5"
              role="group"
              aria-label="Number of selects"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Fewer selects"
                disabled={selectCount <= 3}
                onClick={() => setSelectCount(selectCount - 1)}
              >
                <Minus />
              </Button>
              <span className="tabular w-16 text-center text-sm text-ink" aria-live="polite">
                {selectCount} picks
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="More selects"
                disabled={selectCount >= 20}
                onClick={() => setSelectCount(selectCount + 1)}
              >
                <Plus />
              </Button>
            </div>
            <Button asChild>
              <Link href="/studio/assets">
                Generate assets
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="px-4 py-5 sm:px-8">
        <Tabs value={view} onValueChange={(v) => void setView(v as View)}>
          <TabsList>
            {tabs.map(([id, label, n]) => (
              <TabsTrigger key={id} value={id}>
                {label}
                <span className="tabular ml-1 text-ink-3">{n}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {(pinned.length > 0 || excluded.length > 0) && (
          <p className="mt-3 text-sm text-ink-2">
            {pinned.length > 0 && `${pinned.length} pinned`}
            {pinned.length > 0 && excluded.length > 0 && " · "}
            {excluded.length > 0 && `${excluded.length} excluded`}
          </p>
        )}

        {list.length === 0 ? (
          <EmptyState
            title={view === "selects" ? "Nothing made the cut" : `No ${view} frames`}
            description={
              view === "selects"
                ? "Every frame was soft, badly exposed or excluded. Allow some frames back from All frames."
                : view === "rejected"
                  ? "Every frame passed the technical check."
                  : "No near-identical bursts in this gallery."
            }
          />
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {list.map((shot, i) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                index={view === "selects" ? i : undefined}
                pinned={pinnedSet.has(shot.id)}
                excluded={excludedSet.has(shot.id)}
                reason={view === "selects" ? null : reasonFor(shot, names)}
                onPin={() => togglePin(shot.id)}
                onExclude={() => toggleExclude(shot.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

export function GridSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-3 h-8 w-56" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
        ))}
      </div>
    </div>
  )
}
