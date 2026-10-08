"use client"

import { ImagePlus } from "lucide-react"
import { useRef, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Drag-and-drop or click-to-browse image picker. The whole surface is one
 * button, so it works from the keyboard and announces itself properly.
 */
export function Dropzone({
  onFiles,
  compact = false,
  className,
}: {
  onFiles: (files: File[]) => void
  compact?: boolean
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const files = [...e.dataTransfer.files]
        if (files.length) onFiles(files)
      }}
      className={className}
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          "group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed text-center transition-colors",
          compact ? "gap-2 px-6 py-6" : "gap-3 px-6 py-16 sm:py-20",
          over
            ? "border-brand bg-brand-soft"
            : "border-stroke-strong bg-layer-1 hover:border-brand/40 hover:bg-brand-soft/40",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid place-items-center rounded-2xl bg-surface text-brand shadow-sm ring-1 ring-stroke-strong transition-transform duration-200 group-hover:-translate-y-0.5",
            compact ? "size-10" : "size-14",
          )}
        >
          <ImagePlus className={compact ? "size-4" : "size-6"} />
        </span>
        <span className={cn("font-medium text-ink", compact ? "text-sm" : "text-base")}>
          {over ? "Drop to import" : compact ? "Import a different gallery" : "Drop your wedding gallery here"}
        </span>
        {!compact && (
          <span className="text-sm text-ink-2">
            or <span className="font-medium text-brand underline underline-offset-4">browse your files</span> — JPEG,
            PNG or WebP exports
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ""
          if (files.length) onFiles(files)
        }}
      />
    </div>
  )
}
