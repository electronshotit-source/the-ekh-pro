"use client"

import { useRef } from "react"

import type { Beat } from "@/lib/engine/types"
import { cn } from "@/lib/utils"

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`

/**
 * Stacked timeline: clips, caption beats and the music waveform with beat
 * markers. The whole area scrubs — pointer or arrow keys.
 */
export function Timeline({
  beats,
  seconds,
  t,
  peaks,
  grid,
  onSeek,
}: {
  beats: Beat[]
  seconds: number
  t: number
  peaks: number[] | null
  grid: number[] | null
  onSeek: (t: number) => void
}) {
  const area = useRef<HTMLDivElement>(null)
  const pct = (x: number) => `${(x / seconds) * 100}%`

  const seekFromPointer = (clientX: number) => {
    const el = area.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * seconds)
  }

  const ticks = Array.from({ length: Math.floor(seconds / 5) + 1 }, (_, i) => i * 5)

  return (
    <div className="select-none">
      <div className="tabular relative mb-1 h-4 text-[0.65rem] text-ink-3" aria-hidden>
        {ticks.map((s) => (
          <span key={s} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: pct(s) }}>
            {fmt(s)}
          </span>
        ))}
      </div>

      <div
        ref={area}
        role="slider"
        tabIndex={0}
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={seconds}
        aria-valuenow={Math.round(t * 10) / 10}
        aria-valuetext={`${fmt(t)} of ${fmt(seconds)}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          seekFromPointer(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e.clientX)
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 5 : 1
          if (e.key === "ArrowRight") onSeek(Math.min(seconds, t + step))
          else if (e.key === "ArrowLeft") onSeek(Math.max(0, t - step))
          else if (e.key === "Home") onSeek(0)
          else return
          e.preventDefault()
        }}
        className="relative flex cursor-ew-resize flex-col gap-1.5 rounded-xl"
      >
        {/* clips */}
        <div className="relative h-14 overflow-hidden rounded-lg bg-layer-2">
          {beats.map((b, i) => (
            <div
              key={i}
              className="absolute inset-y-0 overflow-hidden border-r-2 border-surface"
              style={{ left: pct(b.start), width: pct(b.dur) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob URLs */}
              <img src={b.shot.url} alt="" className="size-full object-cover" draggable={false} />
            </div>
          ))}
        </div>

        {/* caption beats */}
        <div className="relative h-6">
          {beats.map((b, i) => (
            <div
              key={i}
              className={cn(
                "absolute inset-y-0 truncate rounded-md border-r-2 border-surface px-1.5 text-[0.65rem] leading-6",
                b.onBeat ? "bg-brand-soft text-brand" : "bg-layer-1 text-ink-2",
              )}
              style={{ left: pct(b.start), width: pct(b.dur) }}
              title={b.text}
            >
              {b.text}
            </div>
          ))}
        </div>

        {/* waveform + beat markers */}
        <div className="relative h-10 overflow-hidden rounded-lg bg-layer-1">
          {peaks ? (
            <div className="absolute inset-0 flex items-center gap-px px-px" aria-hidden>
              {peaks.map((v, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-full bg-brand/45"
                  style={{ height: `${Math.max(6, v * 92)}%` }}
                />
              ))}
            </div>
          ) : (
            <p className="absolute inset-0 grid place-items-center text-[0.7rem] text-ink-3">No music</p>
          )}
          {grid?.map((g, i) => (
            <span key={i} aria-hidden className="absolute inset-y-0 w-px bg-brand/50" style={{ left: pct(g) }} />
          ))}
        </div>

        {/* playhead */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink"
          style={{ left: pct(t) }}
        >
          <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-ink" />
        </div>
      </div>
    </div>
  )
}
