"use client"

import { ArrowUp, Sparkles } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useId, useRef, useState } from "react"

import { Kbd } from "@/components/ui/kbd"
import { useRunCommand } from "@/features/assets/use-run-command"
import { spring } from "@/lib/motion"
import { useStudio } from "@/lib/studio/store"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  "A luxury Nigerian wedding Instagram carousel",
  "Turn this wedding into a 30-second Reel",
  "The blog article and 6 Pinterest pins",
  "Everything — the full campaign",
]

/**
 * The floating prompt bar. Plain English in, assets out. ⌘K / Ctrl+K
 * focuses it from anywhere in the studio.
 */
export function Composer() {
  const ready = useStudio((s) => s.phase === "ready")
  const run = useRunCommand()
  const [value, setValue] = useState("")
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const submit = (text: string) => {
    if (!text.trim() || !ready) return
    if (run(text)) {
      setValue("")
      inputRef.current?.blur()
    }
  }

  const showSuggestions = focused && ready && !value

  return (
    <div className="pointer-events-none sticky bottom-0 z-(--z-composer) px-4 pt-6 pb-4 sm:pb-6">
      <div className="pointer-events-auto mx-auto w-full max-w-2xl">
        <AnimatePresence>
          {showSuggestions && (
            <motion.ul
              id={listId}
              aria-label="Suggestions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={spring}
              className="mb-2 flex flex-wrap gap-1.5"
            >
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    // Keep focus in the input so the list doesn't collapse mid-click.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => submit(s)}
                    className="rounded-full border border-stroke-strong bg-surface/95 px-3 py-1.5 text-xs text-ink-2 shadow-xs backdrop-blur transition-colors hover:border-brand/40 hover:text-ink"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(value)
          }}
          className={cn(
            "flex items-center gap-2 rounded-2xl border bg-surface/95 p-1.5 pl-4 shadow-lg backdrop-blur transition-[border-color,box-shadow]",
            focused ? "border-brand/50 ring-4 ring-brand/10" : "border-stroke-strong",
          )}
        >
          <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
          <label htmlFor="composer" className="sr-only">
            Ask for assets
          </label>
          <input
            id="composer"
            ref={inputRef}
            value={value}
            disabled={!ready}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") inputRef.current?.blur()
            }}
            autoComplete="off"
            aria-describedby={showSuggestions ? listId : undefined}
            placeholder={
              ready
                ? "Ask for anything — “a cinematic Yoruba carousel and a 45s Reel”"
                : "Import a gallery to start asking"
            }
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none disabled:cursor-not-allowed"
          />
          <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
          <motion.button
            type="submit"
            aria-label="Generate"
            disabled={!ready || !value.trim()}
            whileTap={{ scale: 0.92 }}
            transition={spring}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-on-accent transition-colors hover:bg-brand-hover disabled:bg-layer-2 disabled:text-ink-3"
          >
            <ArrowUp className="size-4" aria-hidden />
          </motion.button>
        </form>
      </div>
    </div>
  )
}
