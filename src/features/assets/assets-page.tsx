"use client"

import { Plus, Sparkles, Wand2 } from "lucide-react"
import Link from "next/link"
import { parseAsString, useQueryState } from "nuqs"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { EmptyState, PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePlan } from "@/features/billing/use-plan"
import { ALL_ASSETS } from "@/lib/engine/prompt"
import { ASSETS, ASSET_GROUPS, type AssetGroup } from "@/lib/engine/generators"
import type { AssetKind } from "@/lib/engine/types"
import { useStudio } from "@/lib/studio/store"
import { cn } from "@/lib/utils"

import { ASSET_ICONS, PLATFORM_LABELS } from "./asset-icons"
import { OutputCard } from "./output-card"

const GROUP_ORDER: AssetGroup[] = ["social", "video", "longform", "client"]

export function AssetsPage() {
  const phase = useStudio((s) => s.phase)
  const booted = useStudio((s) => s.booted)

  if (!booted || phase === "restoring" || phase === "analysing") return <AssetsSkeleton />
  if (phase !== "ready") {
    return (
      <EmptyState
        icon={<Sparkles />}
        title="Nothing to write from yet"
        description="Assets are written from your selects and wedding details. Import a gallery first."
        action={
          <Button asChild>
            <Link href="/studio">Import a gallery</Link>
          </Button>
        }
      />
    )
  }
  return <Assets />
}

function Assets() {
  const outputs = useStudio((s) => s.outputs)
  const generate = useStudio((s) => s.generate)
  const { remaining, unlimited } = usePlan()
  const [focus, setFocus] = useQueryState("focus", parseAsString)
  const [filter, setFilter] = useState<AssetKind | "all">("all")

  // Bring a freshly generated asset into view, then drop the param.
  useEffect(() => {
    if (!focus) return
    // Wait a beat: the router's own scroll-to-top on navigation runs after
    // this effect and would otherwise win.
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    const scroll = setTimeout(() => {
      document
        .getElementById(`output-${focus}`)
        ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    }, 120)
    const clear = setTimeout(() => void setFocus(null), 2400)
    return () => {
      clearTimeout(scroll)
      clearTimeout(clear)
    }
  }, [focus, setFocus])

  const run = (kinds: AssetKind[]) => {
    try {
      const made = generate(kinds)
      void setFocus(made[0]?.id ?? null)
      if (kinds.length > 1) toast.success(`${made.length} assets generated`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate that.")
    }
  }

  const kindsPresent = [...new Set(outputs.map((o) => o.kind))]
  const shown = filter === "all" ? outputs : outputs.filter((o) => o.kind === filter)

  return (
    <>
      <PageHeader
        eyebrow="Assets"
        title="Write the campaign"
        description="Every asset is written from this wedding's details and the frames that made your selects."
        actions={
          <Button onClick={() => run(ALL_ASSETS)} disabled={!unlimited && remaining < ALL_ASSETS.length}>
            <Wand2 />
            Generate all {ALL_ASSETS.length}
          </Button>
        }
      />

      <div className="grid gap-8 px-4 py-6 sm:px-8 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside
          aria-label="Asset catalog"
          className="xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:self-start xl:overflow-y-auto xl:pr-1"
        >
          <p className="tabular mb-4 text-xs text-ink-2">
            {unlimited
              ? "Unlimited assets on your plan"
              : `${remaining} asset${remaining === 1 ? "" : "s"} left this month`}
          </p>
          <div className="flex flex-col gap-6">
            {GROUP_ORDER.map((g) => (
              <section key={g} aria-labelledby={`grp-${g}`}>
                <h2 id={`grp-${g}`} className="mb-2 text-[0.7rem] font-medium tracking-wide text-ink-3 uppercase">
                  {ASSET_GROUPS[g].label}
                </h2>
                <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
                  {ALL_ASSETS.filter((k) => ASSETS[k].group === g).map((k) => {
                    const def = ASSETS[k]
                    const Icon = ASSET_ICONS[k]
                    return (
                      <li key={k}>
                        <button
                          type="button"
                          onClick={() => run([k])}
                          disabled={!unlimited && remaining < 1}
                          className="group flex w-full items-start gap-3 rounded-xl border border-stroke-strong bg-surface p-3 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-brand/40 hover:shadow-sm disabled:pointer-events-none disabled:opacity-50"
                        >
                          <span
                            className="grid size-8 shrink-0 place-items-center rounded-lg bg-layer-1 text-ink-2 transition-colors group-hover:bg-brand-soft group-hover:text-brand"
                            aria-hidden
                          >
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-ink">{def.label}</span>
                              <Plus
                                className="size-4 text-ink-3 transition-colors group-hover:text-brand"
                                aria-hidden
                              />
                            </span>
                            <span className="mt-0.5 block text-xs text-ink-2">{def.blurb}</span>
                            <span className="mt-1.5 flex flex-wrap gap-1">
                              {def.platforms.map((p) => (
                                <span key={p} className="rounded bg-layer-1 px-1.5 py-0.5 text-[0.65rem] text-ink-2">
                                  {PLATFORM_LABELS[p]}
                                </span>
                              ))}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </aside>

        <section aria-labelledby="generated-h" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="generated-h" className="text-sm font-semibold text-ink">
              Generated <span className="tabular font-normal text-ink-3">{outputs.length}</span>
            </h2>
            {kindsPresent.length > 1 && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="Filter generated assets">
                {(["all", ...kindsPresent] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={filter === k}
                    onClick={() => setFilter(k)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs transition-colors",
                      filter === k ? "bg-ink text-surface" : "bg-layer-1 text-ink-2 hover:bg-layer-2",
                    )}
                  >
                    {k === "all" ? "All" : ASSETS[k].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stroke-strong">
              <EmptyState
                icon={<Sparkles />}
                title="Pick an asset to generate"
                description="Choose one from the catalog, or type what you want in the bar below — “a luxury Igbo carousel and a 30-second Reel”."
                className="py-16"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {shown.map((o) => (
                <OutputCard key={o.id} output={o} focused={o.id === focus} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

export function AssetsSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-3 h-8 w-64" />
      <div className="mt-8 grid gap-8 xl:grid-cols-[22rem_1fr]">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  )
}
