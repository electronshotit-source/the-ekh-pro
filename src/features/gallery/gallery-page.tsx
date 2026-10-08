"use client"

import { ArrowRight, Check, Images, Lock, ShieldCheck, Sparkles, Wand2 } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useEffect } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { weddingName } from "@/lib/engine/wedding-db"
import { rise, stagger } from "@/lib/motion"
import { MAX_IMPORT, useStudio } from "@/lib/studio/store"

import { Dropzone } from "./dropzone"
import { WeddingForm } from "./wedding-form"

export function GalleryPage() {
  const phase = useStudio((s) => s.phase)
  const booted = useStudio((s) => s.booted)
  const error = useStudio((s) => s.error)

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  if (!booted || phase === "restoring") return <GallerySkeleton />
  if (phase === "analysing") return <Analysing />
  if (phase === "ready") return <Overview />
  return <Import />
}

function Import() {
  const importFiles = useStudio((s) => s.importFiles)
  const importDemo = useStudio((s) => s.importDemo)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-16">
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.p variants={rise} className="text-xs font-medium text-brand">
          New wedding
        </motion.p>
        <motion.h1 variants={rise} className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Start with the <span className="font-serif font-normal italic">whole</span> gallery.
        </motion.h1>
        <motion.p variants={rise} className="mt-3 max-w-xl text-ink-2">
          Drop in every frame you delivered. The EKH pro scores each one, throws out the soft and the duplicated, and
          sequences the strongest into a story.
        </motion.p>

        <motion.div variants={rise} className="mt-8">
          <Dropzone onFiles={(f) => void importFiles(f)} />
        </motion.div>

        <motion.div variants={rise} className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">No gallery to hand?</p>
          <Button variant="outline" onClick={() => void importDemo()}>
            <Wand2 />
            Try a sample wedding
          </Button>
        </motion.div>

        <motion.ul
          variants={rise}
          className="mt-10 grid gap-4 border-t border-stroke-strong pt-8 text-sm sm:grid-cols-3"
        >
          <li className="flex gap-3">
            <Images className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            <span className="text-ink-2">
              Up to <span className="tabular font-medium text-ink">{MAX_IMPORT}</span> images per wedding. Web-size
              exports are plenty.
            </span>
          </li>
          <li className="flex gap-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            <span className="text-ink-2">Analysed in your browser. Your photos are never uploaded anywhere.</span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            <span className="text-ink-2">Only import work you shot and have the couple’s permission to publish.</span>
          </li>
        </motion.ul>
      </motion.div>
    </div>
  )
}

const CHECKS = ["Sharpness and focus", "Exposure and clipping", "Faces and subject", "Near-duplicates"]

function Analysing() {
  const { done, total, current } = useStudio((s) => s.progress)
  const pct = total ? done / total : 0

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-20 sm:px-8" role="status" aria-live="polite">
      <div className="relative mx-auto mb-8 grid size-20 place-items-center overflow-hidden rounded-3xl bg-brand-soft text-brand">
        <Sparkles className="size-7" aria-hidden />
        <span
          aria-hidden
          className="absolute inset-x-0 h-1/2 animate-scan bg-gradient-to-b from-transparent via-brand/15 to-transparent"
        />
      </div>
      <h1 className="text-center text-xl font-semibold tracking-tight text-ink">Reading every frame</h1>
      <p className="tabular mt-1.5 text-center text-sm text-ink-2">
        {done} of {total} analysed
        {current && <span className="block truncate text-ink-3">{current}</span>}
      </p>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-layer-2">
        <div
          className="h-full origin-left rounded-full bg-brand transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${pct})` }}
        />
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-2">
        {CHECKS.map((c, i) => {
          const on = pct > (i + 1) / (CHECKS.length + 1)
          return (
            <li
              key={c}
              className="flex items-center gap-2 rounded-xl border border-stroke-strong px-3 py-2.5 text-sm text-ink-2"
            >
              <span
                className={`grid size-4 place-items-center rounded-full transition-colors ${on ? "bg-success text-surface" : "bg-layer-2"}`}
              >
                {on && <Check className="size-3" aria-hidden />}
              </span>
              {c}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Overview() {
  const wedding = useStudio((s) => s.wedding)
  const profile = useStudio((s) => s.profile)
  const selects = useStudio((s) => s.selects)
  const importFiles = useStudio((s) => s.importFiles)

  if (!profile) return null
  const stats = [
    { label: "Frames", value: profile.total },
    { label: "Usable", value: profile.usable },
    { label: "Rejected", value: profile.rejected },
    { label: "Duplicates", value: profile.duplicates },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Gallery"
        title={weddingName(wedding)}
        description="Check the details — every caption, article and pin is written from them."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/studio/selects">Review selects</Link>
            </Button>
            <Button asChild>
              <Link href="/studio/assets">
                Generate assets
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <section aria-labelledby="details-h" className="rounded-2xl border border-stroke-strong p-5">
          <h2 id="details-h" className="mb-4 text-sm font-semibold text-ink">
            Wedding details
          </h2>
          <WeddingForm />
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="analysis-h" className="rounded-2xl border border-stroke-strong p-5">
            <h2 id="analysis-h" className="text-sm font-semibold text-ink">
              What the analysis found
            </h2>
            <dl className="mt-4 grid grid-cols-4 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl bg-layer-1 px-2 py-2.5 text-center">
                  <dd className="tabular text-lg font-semibold text-ink">{s.value}</dd>
                  <dt className="text-[0.7rem] text-ink-2">{s.label}</dt>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[profile.mood, profile.palette, profile.saturation].map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand capitalize"
                >
                  {t}
                </span>
              ))}
              <span className="tabular rounded-full bg-layer-1 px-2.5 py-1 text-xs text-ink-2">
                Top score {profile.topScore}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-1.5">
              {selects.slice(0, 4).map((s) => (
                // eslint-disable-next-line @next/next/no-img-element -- local blob URLs
                <img
                  key={s.id}
                  src={s.url}
                  alt={`${s.role} — ${s.name}`}
                  className="aspect-[4/5] w-full rounded-lg object-cover"
                />
              ))}
            </div>
            <Link
              href="/studio/selects"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              See all {selects.length} selects <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>

          <Dropzone compact onFiles={(f) => void importFiles(f)} />
        </div>
      </div>
    </>
  )
}

function GallerySkeleton() {
  return (
    <div className="px-4 py-6 sm:px-8" aria-busy="true" aria-label="Loading wedding">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-3 h-8 w-64" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}
