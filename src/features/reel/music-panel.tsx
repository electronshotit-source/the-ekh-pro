"use client"

import { Check, Loader2, Music, Upload, Volume2, X } from "lucide-react"
import { useRef, useState } from "react"

import { Segmented } from "@/components/segmented"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { LIBRARY, MOODS, type Mood, type Track } from "@/lib/engine/music"
import { cn } from "@/lib/utils"

export type TrackRef = { source: "library" | "upload"; id: string }

export interface MusicPanelProps {
  selected: TrackRef | null
  loadingId: string | null
  track: Track | null
  uploads: Track[]
  bpm: number
  snap: boolean
  volume: number
  trim: number
  onSelect: (ref: TrackRef | null) => void
  onUpload: (file: File) => void
  onBpm: (bpm: number) => void
  onTap: () => void
  onSnap: (on: boolean) => void
  onVolume: (v: number) => void
  onTrim: (t: number) => void
}

export function MusicPanel(p: MusicPanelProps) {
  const [tab, setTab] = useState<"explore" | "uploads">("explore")
  const [mood, setMood] = useState<Mood | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const library = mood ? LIBRARY.filter((t) => t.mood === mood) : LIBRARY
  const bpmHint = !p.track
    ? null
    : p.track.source === "library"
      ? "Exact tempo — composed at this BPM."
      : (p.track.confidence ?? 0) > 0.45
        ? "Detected from the audio. Tap along to correct it."
        : "Weak pulse — tap the tempo to be sure."

  return (
    <div className="flex flex-col gap-4">
      {p.track ? (
        <div className="rounded-xl border border-brand/30 bg-brand-soft/50 p-3">
          <div className="flex items-start gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-white" aria-hidden>
              <Music className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{p.track.name}</p>
              <p className="tabular text-xs text-ink-2">
                {p.track.source === "library" ? "Library" : "Your upload"} · {p.bpm} BPM
              </p>
            </div>
            <Button size="icon-xs" variant="ghost" aria-label="Remove music" onClick={() => p.onSelect(null)}>
              <X />
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <Volume2 className="size-4 shrink-0 text-ink-2" aria-hidden />
            <Slider
              value={[p.volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={([v]) => p.onVolume(v ?? p.volume)}
              aria-label="Music volume"
            />
          </div>

          {p.track.source === "upload" && p.track.buffer.duration > 6 && (
            <div className="mt-3">
              <Label className="mb-1.5 text-xs text-ink-2">
                Start at <span className="tabular">{p.trim.toFixed(1)}s</span>
              </Label>
              <Slider
                value={[p.trim]}
                min={0}
                max={Math.max(0, p.track.buffer.duration - 5)}
                step={0.1}
                onValueChange={([v]) => p.onTrim(v ?? 0)}
                aria-label="Music start offset"
              />
            </div>
          )}

          <div className="mt-3 flex items-center gap-1.5">
            <Button size="xs" variant="outline" onClick={() => p.onBpm(p.bpm / 2)} aria-label="Halve tempo">
              ÷2
            </Button>
            <Button size="xs" variant="outline" onClick={() => p.onBpm(p.bpm * 2)} aria-label="Double tempo">
              ×2
            </Button>
            <Button size="xs" variant="outline" onClick={p.onTap} className="flex-1">
              Tap tempo
            </Button>
          </div>
          {bpmHint && <p className="mt-1.5 text-[0.7rem] text-ink-2">{bpmHint}</p>}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-brand/15 pt-3">
            <Label htmlFor="snap" className="text-sm text-ink">
              Cut on the beat
            </Label>
            <Switch id="snap" checked={p.snap} onCheckedChange={p.onSnap} />
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-layer-1 px-3 py-2.5 text-sm text-ink-2">
          No music. Pick a bed below and cuts will snap to its beat.
        </p>
      )}

      <Segmented
        label="Music source"
        size="sm"
        value={tab}
        onChange={setTab}
        options={[
          { value: "explore", label: "Library" },
          { value: "uploads", label: `Uploads${p.uploads.length ? ` · ${p.uploads.length}` : ""}` },
        ]}
        className="w-full"
      />

      {tab === "explore" ? (
        <>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by mood">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mood === m}
                onClick={() => setMood(mood === m ? null : m)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs transition-colors",
                  mood === m ? "bg-ink text-white" : "bg-layer-1 text-ink-2 hover:bg-layer-2",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <ul className="flex flex-col gap-1">
            {library.map((t) => {
              const on = p.selected?.source === "library" && p.selected.id === t.id
              const loading = p.loadingId === t.id
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => p.onSelect({ source: "library", id: t.id })}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition-colors",
                      on ? "bg-surface shadow-xs ring-1 ring-brand/40" : "hover:bg-layer-1",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg",
                        on ? "bg-brand text-white" : "bg-layer-1 text-ink-2",
                      )}
                      aria-hidden
                    >
                      {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : on ? (
                        <Check className="size-4" />
                      ) : (
                        <Music className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink">{t.name}</span>
                        <span className="tabular shrink-0 text-[0.7rem] text-ink-3">{t.bpm} BPM</span>
                      </span>
                      <span className="block text-xs text-ink-2">
                        {t.mood} · {t.blurb}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="text-[0.7rem] text-ink-3">
            Library beds are synthesised in your browser — no licence needed, no Content ID claims.
          </p>
        </>
      ) : (
        <>
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload />
            Upload a song
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (f) p.onUpload(f)
            }}
          />
          {p.uploads.length === 0 ? (
            <p className="text-sm text-ink-2">
              MP3, WAV, M4A or OGG up to 40 MB. Decoded on this device — never uploaded. Make sure you’re licensed to
              publish it.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {p.uploads.map((t) => {
                const on = p.selected?.source === "upload" && p.selected.id === t.id
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => p.onSelect({ source: "upload", id: t.id })}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors",
                        on ? "bg-surface shadow-xs ring-1 ring-brand/40" : "hover:bg-layer-1",
                      )}
                    >
                      <Music className="size-4 shrink-0 text-ink-2" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.name}</span>
                      <span className="tabular text-[0.7rem] text-ink-3">~{t.bpm} BPM</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
