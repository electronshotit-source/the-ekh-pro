"use client"

import { motion } from "motion/react"
import { useId, useRef } from "react"

import { spring } from "@/lib/motion"
import { cn } from "@/lib/utils"

export interface SegmentedOption<T extends string | number> {
  value: T
  label: React.ReactNode
  disabled?: boolean
  title?: string
}

/**
 * Single-choice segmented control (radio semantics, arrow-key navigation)
 * with a sliding indicator.
 */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  size = "default",
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<SegmentedOption<T>>
  label: string
  size?: "sm" | "default"
  className?: string
}) {
  const id = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const move = (from: number, dir: 1 | -1) => {
    for (let step = 1; step <= options.length; step++) {
      const i = (from + dir * step + options.length) % options.length
      const opt = options[i]
      if (opt && !opt.disabled) {
        onChange(opt.value)
        refs.current[i]?.focus()
        return
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-lg bg-layer-1 p-0.5 ring-1 ring-stroke-strong", className)}
    >
      {options.map((opt, i) => {
        const on = opt.value === value
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={opt.disabled}
            title={opt.title}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault()
                move(i, 1)
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault()
                move(i, -1)
              }
            }}
            className={cn(
              "relative flex-1 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              on ? "text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                className="absolute inset-0 rounded-md bg-surface shadow-xs ring-1 ring-stroke-strong"
                aria-hidden
              />
            )}
            <span className="relative inline-flex items-center justify-center gap-1">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
