"use client"

import { Clapperboard, Download, Pause, Play, RotateCcw, X } from "lucide-react"
import Link from "next/link"
import { parseAsInteger, useQueryState } from "nuqs"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/page-header"
import { Segmented } from "@/components/segmented"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePlan } from "@/features/billing/use-plan"
import { BRAND_DEFAULTS, brandStore } from "@/lib/engine/brand"
import { buildBeats, buildContext } from "@/lib/engine/generators"
import { Player, beatGrid, decodeUpload, renderTrack, type Track } from "@/lib/engine/music"
import { Reel, type Grade, type Motion, type ReelSettings, type RenderBeat } from "@/lib/engine/reel-renderer"
import type { Rhythm } from "@/lib/engine/types"
import { loadImage } from "@/lib/engine/vision"
import { useExternalStore } from "@/lib/hooks/use-external-store"
import { useStudio } from "@/lib/studio/store"

import { MusicPanel, type TrackRef } from "./music-panel"
import { Timeline } from "./timeline"

const DURATIONS = [15, 30, 45, 60, 90]
/** Cut on every bar (slow), half-bar (medium) or beat (fast). */
const EVERY: Record<Rhythm, number> = { slow: 4, medium: 2, fast: 1 }

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

/** Waveform peaks for the slice of the track the reel actually uses. */
function segmentPeaks(buffer: AudioBuffer, from: number, seconds: number, bins = 160): number[] {
  const d = buffer.getChannelData(0)
  const start = Math.floor(from * buffer.sampleRate)
  const step = Math.max(1, Math.floor((seconds * buffer.sampleRate) / bins))
  const out: number[] = []
  let max = 0.0001
  for (let b = 0; b < bins; b++) {
    let peak = 0
    for (let i = 0; i < step; i += 8) {
      const v = Math.abs(d[(start + b * step + i) % d.length] ?? 0)
      if (v > peak) peak = v
    }
    out.push(peak)
    if (peak > max) max = peak
  }
  return out.map((v) => v / max)
}

export function ReelLabPage() {
  const phase = useStudio((s) => s.phase)
  const booted = useStudio((s) => s.booted)

  if (!booted || phase === "restoring" || phase === "analysing") return <ReelSkeleton />
  if (phase !== "ready") {
    return (
      <EmptyState
        icon={<Clapperboard />}
        title="No footage to cut"
        description="Reel Lab builds a beat-cut vertical edit from your selects. Import a gallery to start."
        action={
          <Button asChild>
            <Link href="/studio">Import a gallery</Link>
          </Button>
        }
      />
    )
  }
  return <ReelLab />
}

function ReelLab() {
  const wedding = useStudio((s) => s.wedding)
  const profile = useStudio((s) => s.profile)
  const selects = useStudio((s) => s.selects)
  const { plan } = usePlan()
  const kit = useExternalStore(brandStore, BRAND_DEFAULTS)

  const [secondsParam, setSecondsParam] = useQueryState("seconds", parseAsInteger.withDefault(30))
  const seconds = Math.max(5, Math.min(secondsParam, plan.reelSeconds))

  const [rhythm, setRhythm] = useState<Rhythm>("medium")
  const [settings, setSettings] = useState<ReelSettings>({ motion: "kenburns", grade: "warm", captions: true })
  const [selected, setSelected] = useState<TrackRef | null>(null)
  const [track, setTrack] = useState<Track | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Track[]>([])
  const [bpm, setBpmRaw] = useState(100)
  const [snap, setSnap] = useState(true)
  const [volume, setVolume] = useState(0.8)
  const [trim, setTrim] = useState(0)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [silent, setSilent] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reelRef = useRef<Reel | null>(null)
  const playerRef = useRef<Player | null>(null)
  const lastT = useRef(0)
  const taps = useRef<number[]>([])
  const exportAbort = useRef<AbortController | null>(null)

  const setBpm = useCallback((v: number) => setBpmRaw(Math.round(Math.min(220, Math.max(40, v)))), [])

  /* ---------- the edit ---------- */

  const grid = useMemo(
    () => (track && snap ? beatGrid(bpm, seconds, { every: EVERY[rhythm] }) : null),
    [track, snap, bpm, seconds, rhythm],
  )
  const beats = useMemo(
    () => (profile ? buildBeats(buildContext(wedding, profile, selects), seconds, rhythm, grid) : []),
    [wedding, profile, selects, seconds, rhythm, grid],
  )
  const renderBeats = useMemo<RenderBeat[]>(
    () => beats.map(({ shot, ...b }) => ({ ...b, img: shot.img ?? null, m: shot.m })),
    [beats],
  )
  const peaks = useMemo(() => (track ? segmentPeaks(track.buffer, trim, seconds) : null), [track, trim, seconds])

  /* ---------- engines ---------- */

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reel = new Reel(canvas)
    const player = new Player()
    reelRef.current = reel
    playerRef.current = player
    reel.onTick = (time) => {
      // Picture looped — bring the music back to the top with it.
      if (time < lastT.current - 0.5) player.play(0)
      lastT.current = time
      setT(time)
    }
    return () => {
      reel.destroy()
      player.stop()
      exportAbort.current?.abort()
      reelRef.current = null
      playerRef.current = null
    }
  }, [])

  useEffect(() => {
    reelRef.current?.load(renderBeats, seconds, settings)
  }, [renderBeats, seconds, settings])

  // Logo watermark is a Studio-plan feature.
  const watermark = plan.id !== "starter" ? kit.logo : null
  useEffect(() => {
    let live = true
    if (!watermark) {
      reelRef.current?.setLogo(null)
      return
    }
    loadImage(watermark).then(
      (img) => live && reelRef.current?.setLogo(img),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [watermark])

  useEffect(() => playerRef.current?.setVolume(volume), [volume])
  useEffect(() => {
    if (playerRef.current) playerRef.current.trim = trim
  }, [trim])

  /** Pick a track. Uploads are already decoded; library beds render below. */
  const choose = useCallback(
    (ref: TrackRef | null, upload?: Track) => {
      const player = playerRef.current
      setSelected(ref)
      if (ref?.source === "library") {
        setLoadingId(ref.id)
        return
      }
      const up = ref ? (upload ?? uploads.find((u) => u.id === ref.id) ?? null) : null
      setTrack(up)
      setTrim(0)
      if (up) setBpm(up.bpm)
      player?.load(up?.buffer ?? null)
      if (up && reelRef.current?.playing) player?.play(reelRef.current.t)
    },
    [uploads, setBpm],
  )

  // Library beds are rendered to the reel's length, so re-render on resize.
  const libraryId = selected?.source === "library" ? selected.id : null
  useEffect(() => {
    if (!libraryId) return
    let live = true
    const player = playerRef.current
    renderTrack(libraryId, seconds + 1)
      .then((tr) => {
        if (!live) return
        setTrack(tr)
        setBpm(tr.bpm)
        setTrim(0)
        player?.load(tr.buffer)
        if (reelRef.current?.playing) player?.play(reelRef.current.t)
      })
      .catch((err: unknown) => live && toast.error(err instanceof Error ? err.message : "Couldn't render that track."))
      .finally(() => live && setLoadingId(null))
    return () => {
      live = false
    }
  }, [libraryId, seconds, setBpm])

  /* ---------- transport ---------- */

  const toggle = useCallback(() => {
    const reel = reelRef.current
    const player = playerRef.current
    if (!reel || !player) return
    if (reel.playing) {
      reel.pause()
      player.stop()
      setPlaying(false)
    } else {
      reel.play()
      player.play(reel.t)
      setPlaying(true)
    }
  }, [])

  const seek = (time: number) => {
    reelRef.current?.seek(time)
    lastT.current = time
    if (reelRef.current?.playing) playerRef.current?.play(time)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key !== " " || el.closest("input, textarea, button, [role=slider], [role=radio], [contenteditable]")) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle])

  const onTap = () => {
    const now = performance.now()
    const list = taps.current
    const last = list.at(-1)
    if (last !== undefined && now - last > 2200) list.length = 0
    list.push(now)
    if (list.length > 8) list.shift()
    if (list.length >= 3) {
      const gaps = list.slice(1).map((x, i) => x - list[i]!)
      setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length))
    } else {
      toast(`Keep tapping… ${3 - list.length} more`, { id: "tap", duration: 1200 })
    }
  }

  const onUpload = (file: File) => {
    toast.promise(
      decodeUpload(file).then((tr) => {
        setUploads((u) => [tr, ...u])
        choose({ source: "upload", id: tr.id }, tr)
        return tr
      }),
      {
        loading: `Decoding ${file.name}…`,
        success: (tr) => `${tr.name} · ~${tr.bpm} BPM`,
        error: (err: unknown) => (err instanceof Error ? err.message : "Couldn't read that file."),
      },
    )
  }

  /* ---------- export ---------- */

  async function exportReel() {
    const reel = reelRef.current
    const player = playerRef.current
    if (!reel || !player) return
    if (reel.playing) toggle()
    const withAudio = Boolean(track) && !silent
    const ctrl = new AbortController()
    exportAbort.current = ctrl
    setProgress(0)
    try {
      const blob = await reel.export({
        height: plan.exportHeight,
        audioTrack: withAudio ? player.exportTrack() : null,
        onAudioStart: () => withAudio && player.play(0),
        onProgress: setProgress,
        signal: ctrl.signal,
      })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `${slug([wedding.bride, wedding.groom].filter(Boolean).join("-")) || "wedding"}-reel.webm`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      toast.success("Reel exported", { description: `${seconds}s · ${plan.exportHeight}p WebM` })
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") toast("Export cancelled")
      else toast.error(err instanceof Error ? err.message : "Export failed.")
    } finally {
      player.stop()
      exportAbort.current = null
      setProgress(null)
    }
  }

  const exporting = progress !== null

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke-strong px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">Reel Lab</h1>
          <p className="text-xs text-ink-2">
            {beats.length} cuts · {track ? `${track.name}, ${bpm} BPM` : "no music"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Reel length"
            size="sm"
            value={seconds}
            onChange={(v) => void setSecondsParam(v)}
            options={DURATIONS.map((d) => ({
              value: d,
              label: `${d}s`,
              disabled: d > plan.reelSeconds,
              title: d > plan.reelSeconds ? "Upgrade for longer Reels" : undefined,
            }))}
          />
          <Button onClick={() => void exportReel()} disabled={exporting || !beats.length}>
            <Download />
            Export
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="order-2 min-h-0 overflow-y-auto border-stroke-strong p-4 lg:order-1 lg:border-r">
          <Tabs defaultValue="music">
            <TabsList className="w-full">
              <TabsTrigger value="music">Music</TabsTrigger>
              <TabsTrigger value="style">Style</TabsTrigger>
            </TabsList>
            <TabsContent value="music" className="mt-4">
              <MusicPanel
                selected={selected}
                loadingId={loadingId}
                track={track}
                uploads={uploads}
                bpm={bpm}
                snap={snap}
                volume={volume}
                trim={trim}
                onSelect={choose}
                onUpload={onUpload}
                onBpm={setBpm}
                onTap={onTap}
                onSnap={setSnap}
                onVolume={setVolume}
                onTrim={setTrim}
              />
            </TabsContent>
            <TabsContent value="style" className="mt-4 flex flex-col gap-5">
              <StyleRow label="Pace">
                <Segmented
                  label="Pace"
                  size="sm"
                  value={rhythm}
                  onChange={setRhythm}
                  className="w-full"
                  options={[
                    { value: "slow", label: "Slow" },
                    { value: "medium", label: "Medium" },
                    { value: "fast", label: "Fast" },
                  ]}
                />
              </StyleRow>
              <StyleRow label="Grade">
                <Segmented<Grade>
                  label="Colour grade"
                  size="sm"
                  value={settings.grade}
                  onChange={(grade) => setSettings((s) => ({ ...s, grade }))}
                  className="w-full"
                  options={[
                    { value: "none", label: "None" },
                    { value: "warm", label: "Warm" },
                    { value: "film", label: "Film" },
                    { value: "contrast", label: "Punch" },
                  ]}
                />
              </StyleRow>
              <StyleRow label="Motion">
                <Segmented<Motion>
                  label="Camera motion"
                  size="sm"
                  value={settings.motion}
                  onChange={(motion) => setSettings((s) => ({ ...s, motion }))}
                  className="w-full"
                  options={[
                    { value: "kenburns", label: "Ken Burns" },
                    { value: "drift", label: "Drift" },
                    { value: "static", label: "Still" },
                  ]}
                />
              </StyleRow>
              <div className="flex items-center justify-between">
                <Label htmlFor="captions" className="text-sm text-ink">
                  Burnt-in captions
                </Label>
                <Switch
                  id="captions"
                  checked={settings.captions}
                  onCheckedChange={(captions) => setSettings((s) => ({ ...s, captions }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="silent" className="text-sm text-ink">
                  Export without music
                </Label>
                <Switch id="silent" checked={silent} onCheckedChange={setSilent} />
              </div>
              <p className="rounded-xl bg-layer-1 px-3 py-2.5 text-xs text-ink-2">
                {plan.id === "starter" ? (
                  <>
                    Logo watermarks are on the Studio plan.{" "}
                    <Link href="/studio/plan" className="font-medium text-brand underline-offset-4 hover:underline">
                      Compare plans
                    </Link>
                  </>
                ) : kit.logo ? (
                  "Your logo from the brand kit is watermarked on every frame."
                ) : (
                  <>
                    Add a logo in the{" "}
                    <Link href="/studio/brand" className="font-medium text-brand underline-offset-4 hover:underline">
                      brand kit
                    </Link>{" "}
                    to watermark your Reels.
                  </>
                )}
              </p>
            </TabsContent>
          </Tabs>
        </aside>

        <section
          aria-label="Preview"
          className="order-1 flex min-h-0 flex-col items-center justify-center gap-4 bg-layer-1 p-4 sm:p-6 lg:order-2"
        >
          <div className="relative aspect-[9/16] h-[min(62dvh,640px)] max-w-full overflow-hidden rounded-2xl bg-black shadow-lg ring-1 ring-black/10">
            <canvas
              ref={canvasRef}
              width={540}
              height={960}
              className="size-full cursor-pointer"
              onClick={toggle}
              aria-label="Reel preview. Click or press space to play or pause."
            />
            {exporting && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 p-6 text-center text-white backdrop-blur-sm"
                role="status"
              >
                <p className="tabular text-3xl font-semibold">{Math.round((progress ?? 0) * 100)}%</p>
                <p className="text-sm text-white/80">Recording in real time — keep this tab open.</p>
                <Button size="sm" variant="secondary" onClick={() => exportAbort.current?.abort()}>
                  <X />
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Back to start"
              onClick={() => seek(0)}
              disabled={exporting}
            >
              <RotateCcw />
            </Button>
            <Button
              size="icon-lg"
              variant="default"
              className="size-11 rounded-full"
              aria-label={playing ? "Pause" : "Play"}
              onClick={toggle}
              disabled={exporting}
            >
              {playing ? <Pause /> : <Play className="translate-x-px" />}
            </Button>
            <p className="tabular w-24 text-sm text-ink-2">
              {fmt(t)} / {fmt(seconds)}
            </p>
          </div>
        </section>
      </div>

      <div className="border-t border-stroke-strong px-4 py-4 sm:px-6">
        <Timeline beats={beats} seconds={seconds} t={t} peaks={peaks} grid={grid} onSeek={seek} />
      </div>
    </div>
  )
}

function StyleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-2">{label}</p>
      {children}
    </div>
  )
}

export function ReelSkeleton() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[20rem_1fr]" aria-busy="true" aria-label="Loading Reel Lab">
      <div className="hidden flex-col gap-2 border-r border-stroke-strong p-4 lg:flex">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
      <div className="grid place-items-center bg-layer-1 p-6">
        <Skeleton className="aspect-[9/16] h-[min(62dvh,640px)] rounded-2xl" />
      </div>
    </div>
  )
}
