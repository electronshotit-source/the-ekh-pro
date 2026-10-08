"use client"

import { Check, Copy, Info, Pencil } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { copyText } from "@/lib/clipboard"
import type { BeatSpec, Pin, ScoredShot, Slide } from "@/lib/engine/types"
import { cn } from "@/lib/utils"

type ShotMap = Map<string, ScoredShot>

/* eslint-disable @next/next/no-img-element -- every image here is a local blob URL */

function Thumb({ shot, className, alt }: { shot: ScoredShot | undefined; className?: string; alt: string }) {
  if (!shot) return <div className={cn("bg-layer-2", className)} aria-hidden />
  return <img src={shot.url} alt={alt} loading="lazy" className={cn("object-cover", className)} />
}

export function NoteBlock({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-layer-1 px-3.5 py-3 text-sm text-ink-2">
      <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <p>{text}</p>
    </div>
  )
}

export function CopyBlock({
  label,
  text,
  streaming,
  onEdit,
}: {
  label?: string
  text: string
  streaming?: boolean
  onEdit?: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const long = text.length > 900

  return (
    <div className="overflow-hidden rounded-xl border border-stroke-strong">
      <div className="flex items-center justify-between gap-2 border-b border-stroke-strong bg-layer-1 py-1.5 pr-1.5 pl-3.5">
        <p className="text-xs font-medium text-ink-2">{label ?? "Copy"}</p>
        <div className="flex gap-1">
          {onEdit &&
            (editing ? (
              <Button
                size="xs"
                onClick={() => {
                  onEdit(draft)
                  setEditing(false)
                }}
              >
                <Check />
                Save
              </Button>
            ) : (
              <Button
                size="xs"
                variant="ghost"
                disabled={streaming}
                onClick={() => {
                  setDraft(text)
                  setEditing(true)
                }}
              >
                <Pencil />
                Edit
              </Button>
            ))}
          <Button size="xs" variant="ghost" disabled={streaming} onClick={() => void copyText(text)}>
            <Copy />
            Copy
          </Button>
        </div>
      </div>
      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`Edit ${label ?? "copy"}`}
          className="min-h-48 rounded-none border-0 bg-surface font-mono text-[0.8rem] leading-relaxed focus-visible:ring-0"
          autoFocus
        />
      ) : (
        <pre
          className={cn(
            "px-3.5 py-3 font-sans text-sm leading-relaxed whitespace-pre-wrap text-ink",
            long && "max-h-96 overflow-y-auto",
          )}
          aria-busy={streaming}
        >
          {text}
          {streaming && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse-soft bg-brand align-text-bottom" />
          )}
        </pre>
      )}
    </div>
  )
}

export function TagsBlock({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
          {t}
        </span>
      ))}
      <Button size="xs" variant="ghost" onClick={() => void copyText(tags.join(" "), "Hashtags copied")}>
        <Copy />
        Copy all
      </Button>
    </div>
  )
}

/** Instagram-style frame with swipeable slides — what followers will see. */
export function CarouselFrame({ slides, shots, handle }: { slides: Slide[]; shots: ShotMap; handle: string }) {
  const [active, setActive] = useState(0)
  return (
    <figure className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-stroke-strong bg-surface shadow-sm">
      <figcaption className="flex items-center gap-2 px-3 py-2.5">
        <span className="size-7 rounded-full bg-gradient-to-br from-brand to-brand-soft" aria-hidden />
        <span className="text-sm font-medium text-ink">{handle.replace(/^@/, "") || "yourstudio"}</span>
      </figcaption>
      <div
        className="flex aspect-[4/5] snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget
          setActive(Math.round(el.scrollLeft / el.clientWidth))
        }}
        tabIndex={0}
        aria-label={`Carousel preview, ${slides.length} slides`}
      >
        {slides.map((s, i) => (
          <Thumb
            key={i}
            shot={s.shotId ? shots.get(s.shotId) : undefined}
            alt={s.caption}
            className="aspect-[4/5] w-full shrink-0 snap-center"
          />
        ))}
      </div>
      <div className="flex justify-center gap-1 py-2.5" aria-hidden>
        {slides.map((_, i) => (
          <span
            key={i}
            className={cn("size-1.5 rounded-full transition-colors", i === active ? "bg-brand" : "bg-layer-2")}
          />
        ))}
      </div>
      <p className="border-t border-stroke-strong px-3 py-2 text-xs text-ink-2">{slides[active]?.caption}</p>
    </figure>
  )
}

export function SlidesBlock({ slides, shots, tall }: { slides: Slide[]; shots: ShotMap; tall?: boolean }) {
  return (
    <ol className="flex snap-x gap-2.5 overflow-x-auto pb-1">
      {slides.map((s, i) => (
        <li key={i} className={cn("shrink-0 snap-start", tall ? "w-28" : "w-36")}>
          <div className="relative">
            <Thumb
              shot={s.shotId ? shots.get(s.shotId) : undefined}
              alt={s.caption}
              className={cn("w-full rounded-lg", tall ? "aspect-[9/16]" : "aspect-[4/5]")}
            />
            {s.n !== undefined && (
              <span className="tabular absolute top-1.5 left-1.5 grid size-5 place-items-center rounded bg-black/70 text-[0.65rem] font-medium text-white">
                {s.n}
              </span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-3 text-xs text-ink-2">{s.caption}</p>
        </li>
      ))}
    </ol>
  )
}

export function PinsBlock({ pins, shots }: { pins: Pin[]; shots: ShotMap }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {pins.map((p, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-stroke-strong">
          <Thumb shot={p.shotId ? shots.get(p.shotId) : undefined} alt={p.title} className="aspect-[2/3] w-full" />
          <div className="p-2.5">
            <p className="line-clamp-2 text-xs font-semibold text-ink">{p.title}</p>
            <p className="mt-1 line-clamp-3 text-xs text-ink-2">{p.desc}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="truncate text-[0.7rem] text-ink-3">{p.board}</span>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Copy pin ${i + 1}`}
                onClick={() => void copyText(`${p.title}\n\n${p.desc}`, "Pin copied")}
              >
                <Copy />
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`

/** The cut list as a proportional strip — a timeline in miniature. */
export function BeatsBlock({ beats, shots }: { beats: BeatSpec[]; shots: ShotMap }) {
  const total = beats.reduce((a, b) => Math.max(a, b.start + b.dur), 0) || 1
  return (
    <div>
      <div
        className="flex h-20 gap-0.5 overflow-hidden rounded-xl"
        role="img"
        aria-label={`${beats.length} cuts over ${Math.round(total)} seconds`}
      >
        {beats.map((b, i) => (
          <div key={i} className="relative min-w-0" style={{ flexGrow: b.dur, flexBasis: 0 }}>
            <Thumb shot={shots.get(b.shotId)} alt="" className="size-full" />
          </div>
        ))}
      </div>
      <div className="tabular mt-1.5 flex justify-between text-[0.7rem] text-ink-3">
        <span>0:00</span>
        <span>{beats.length} cuts</span>
        <span>{fmt(total)}</span>
      </div>
      <ol className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
        {beats.slice(0, 8).map((b, i) => (
          <li key={i} className="flex gap-2 text-ink-2">
            <span className="tabular w-9 shrink-0 text-ink-3">{b.start.toFixed(1)}s</span>
            <span className="truncate">{b.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
