"use client"

import { Ban, Pin, PinOff, Undo2 } from "lucide-react"
import { motion } from "motion/react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { spring } from "@/lib/motion"
import type { ScoredShot, Select } from "@/lib/engine/types"
import { cn } from "@/lib/utils"

export const scoreTone = (score: number) =>
  score >= 70
    ? "bg-success-soft text-success"
    : score >= 50
      ? "bg-brand-soft text-brand"
      : "bg-warning-soft text-warning"

const pct = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 100)

function Breakdown({ shot }: { shot: ScoredShot }) {
  const m = shot.m
  const rows: Array<[string, number]> = [
    ["Sharpness", m.sharp],
    ["Exposure", m.exposure],
    ["Contrast", m.contrast],
    ["Colour", m.colour],
    ["Composition", m.composition],
    ["People", Math.min(1, m.subjectRatio * 6)],
  ]
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-ink">Score {m.score}</p>
        <p className="text-xs text-ink-2 capitalize">{m.type}</p>
      </div>
      <dl className="mt-3 flex flex-col gap-2">
        {rows.map(([label, v]) => (
          <div key={label} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2 text-xs">
            <dt className="text-ink-2">{label}</dt>
            <div className="h-1.5 overflow-hidden rounded-full bg-layer-2" aria-hidden>
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct(v)}%` }} />
            </div>
            <dd className="tabular text-right text-ink">{pct(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-stroke-strong pt-2.5 text-xs text-ink-2">
        {m.faceSource === "detector"
          ? `${m.faces ?? 0} face${m.faces === 1 ? "" : "s"} found by the browser's face detector.`
          : "Subject found by skin-tone analysis."}
      </p>
    </div>
  )
}

export interface ShotCardProps {
  shot: ScoredShot | Select
  index?: number
  pinned: boolean
  excluded: boolean
  reason?: string | null
  onPin: () => void
  onExclude: () => void
}

/** One frame: image, score with breakdown, and pin/exclude controls. */
export function ShotCard({ shot, index, pinned, excluded, reason, onPin, onExclude }: ShotCardProps) {
  const isSelect = "role" in shot
  return (
    <motion.li
      layout
      transition={spring}
      className={cn(
        "group relative overflow-hidden rounded-xl bg-layer-1 ring-1 ring-stroke-strong",
        pinned && "ring-2 ring-brand",
      )}
    >
      <div className="relative aspect-[4/5]">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob URLs */}
        <img
          src={shot.url}
          alt={isSelect ? `${shot.role}: ${shot.name}` : shot.name}
          loading="lazy"
          className={cn(
            "size-full object-cover transition-[filter,opacity] duration-200",
            excluded && "opacity-40 grayscale",
          )}
        />

        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          {index !== undefined ? (
            <span className="tabular grid h-6 min-w-6 place-items-center rounded-md bg-black/70 px-1.5 text-xs font-medium text-white backdrop-blur">
              {index + 1}
            </span>
          ) : (
            <span />
          )}
          <Popover>
            <PopoverTrigger
              aria-label={`Score ${shot.m.score}. Show breakdown`}
              className={cn(
                "tabular rounded-md px-1.5 py-0.5 text-xs font-semibold shadow-xs ring-1 ring-black/20 transition-transform hover:scale-105",
                scoreTone(shot.m.score),
              )}
            >
              {shot.m.score}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <Breakdown shot={shot} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onPin}
                aria-pressed={pinned}
                aria-label={pinned ? "Unpin from selects" : "Pin to selects"}
                className={cn(
                  "grid size-8 place-items-center rounded-lg shadow-sm backdrop-blur transition-colors",
                  pinned ? "bg-brand text-on-accent" : "bg-surface/90 text-ink hover:bg-surface",
                )}
              >
                {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{pinned ? "Unpin" : "Always include"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onExclude}
                aria-pressed={excluded}
                aria-label={excluded ? "Allow this frame again" : "Exclude this frame"}
                className="grid size-8 place-items-center rounded-lg bg-surface/90 text-ink shadow-sm backdrop-blur transition-colors hover:bg-surface"
              >
                {excluded ? <Undo2 className="size-4" /> : <Ban className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{excluded ? "Allow again" : "Never use"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {(isSelect || reason) && (
        <div className="bg-surface px-3 py-2.5">
          {isSelect ? (
            <>
              <p className="text-xs font-medium text-ink capitalize">{shot.role}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">{shot.note}</p>
            </>
          ) : (
            <p className="text-xs text-ink-2">{reason}</p>
          )}
        </div>
      )}
    </motion.li>
  )
}
