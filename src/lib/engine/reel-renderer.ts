/**
 * Vertical video engine on a canvas.
 *
 * Plays a beat-cut edit in real time (Ken Burns motion, cross-dissolves,
 * burnt-in caption beats, colour grade) and records the same timeline to a
 * .webm via MediaRecorder. Browser-only; construct it inside an effect.
 */
import * as brand from "./brand"
import type { Metrics, Role } from "./types"

export type Grade = "none" | "warm" | "film" | "contrast"
export type Motion = "kenburns" | "drift" | "static"

const GRADES: Record<Grade, { warm: number; lift: number }> = {
  none: { warm: 0, lift: 0 },
  warm: { warm: 0.1, lift: 0.02 },
  film: { warm: 0.04, lift: 0.06 },
  contrast: { warm: 0, lift: -0.03 },
}

export interface ReelSettings {
  motion: Motion
  grade: Grade
  captions: boolean
}

/** A beat with its decoded image, ready to draw. */
export interface RenderBeat {
  shotId: string
  role: Role
  start: number
  dur: number
  text: string
  img: HTMLImageElement | null
  m: Metrics | null
}

export interface ExportOptions {
  height?: number
  fps?: number
  onProgress?: (p: number) => void
  audioTrack?: MediaStreamTrack | null
  onAudioStart?: () => void
  signal?: AbortSignal
}

const context2d = (c: HTMLCanvasElement) => {
  const g = c.getContext("2d")
  if (!g) throw new Error("Canvas 2D is not available in this browser.")
  return g
}

export class Reel {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  beats: RenderBeat[] = []
  duration = 30
  settings: ReelSettings = { motion: "kenburns", grade: "warm", captions: true }
  t = 0
  playing = false
  onTick: ((t: number, duration: number) => void) | null = null
  private raf: number | null = null
  private last = 0
  private logo: HTMLImageElement | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = context2d(canvas)
  }

  /** Give the renderer a decoded logo image, or null to clear it. */
  setLogo(img: HTMLImageElement | null) {
    this.logo = img
    this.draw(this.t)
  }

  load(beats: RenderBeat[], duration: number, settings: Partial<ReelSettings> = {}) {
    this.beats = beats
    this.duration = duration
    this.settings = { ...this.settings, ...settings }
    this.t = Math.min(this.t, Math.max(0, duration - 0.01))
    this.draw(this.t)
  }

  configure(settings: Partial<ReelSettings>) {
    this.settings = { ...this.settings, ...settings }
    this.draw(this.t)
  }

  seek(t: number) {
    this.t = Math.max(0, Math.min(this.duration - 0.01, t))
    this.draw(this.t)
    this.onTick?.(this.t, this.duration)
  }

  play() {
    if (this.playing || !this.beats.length) return
    this.playing = true
    this.last = performance.now()
    const loop = (now: number) => {
      if (!this.playing) return
      this.t += (now - this.last) / 1000
      this.last = now
      if (this.t >= this.duration) this.t = 0 // loop, like the platforms do
      this.draw(this.t)
      this.onTick?.(this.t, this.duration)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  pause() {
    this.playing = false
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.raf = null
  }

  toggle() {
    if (this.playing) this.pause()
    else this.play()
  }

  destroy() {
    this.pause()
    this.onTick = null
  }

  /** Which beat is on screen at time t, plus its local progress 0..1. */
  beatAt(t: number): { beat: RenderBeat; index: number; p: number } | null {
    for (let i = 0; i < this.beats.length; i++) {
      const b = this.beats[i]!
      if (t >= b.start && t < b.start + b.dur) return { beat: b, index: i, p: (t - b.start) / b.dur }
    }
    const last = this.beats.at(-1)
    return last ? { beat: last, index: this.beats.length - 1, p: 1 } : null
  }

  /** Cover-fit draw with Ken Burns push, biased toward the detected subject. */
  private drawShot(beat: RenderBeat, p: number, W: number, H: number, alpha: number) {
    const { img, m } = beat
    if (!img || !img.naturalWidth) return
    const g = this.ctx
    const motion = this.settings.motion
    const zoomFrom = motion === "static" ? 1.04 : 1.02
    const zoomTo = motion === "kenburns" ? 1.18 : motion === "drift" ? 1.07 : 1.04
    const zoom = zoomFrom + (zoomTo - zoomFrom) * p

    // Frame the detected subject rather than the geometric centre.
    const fx = m ? Math.min(0.75, Math.max(0.25, m.subjectX)) : 0.5
    const fy = m ? Math.min(0.7, Math.max(0.28, m.subjectY)) : 0.45
    const drift = motion === "static" ? 0 : (p - 0.5) * 0.06

    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom
    const dw = img.naturalWidth * scale
    const dh = img.naturalHeight * scale
    const dx = (W - dw) * fx + drift * W * 0.5
    const dy = (H - dh) * fy

    g.save()
    g.globalAlpha = alpha
    g.drawImage(img, dx, dy, dw, dh)
    g.restore()
  }

  private applyGrade(W: number, H: number) {
    const g = this.ctx
    const grade = GRADES[this.settings.grade]
    const b = brand.get()
    if (grade.warm) {
      // When the studio has opted in, tint with their accent colour rather
      // than the stock amber, so the grade carries the brand.
      const tint = b.gradeFromBrand ? brand.rgb(b.accent) : { r: 214, g: 160, b: 70 }
      g.save()
      g.globalCompositeOperation = "overlay"
      g.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${grade.warm})`
      g.fillRect(0, 0, W, H)
      g.restore()
    }
    if (grade.lift) {
      g.save()
      g.globalCompositeOperation = grade.lift > 0 ? "lighter" : "multiply"
      g.fillStyle = `rgba(255,246,232,${Math.abs(grade.lift)})`
      g.fillRect(0, 0, W, H)
      g.restore()
    }
    // Vignette — sells the "graded" look more than any curve at this scale.
    const grd = g.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72)
    grd.addColorStop(0, "rgba(0,0,0,0)")
    grd.addColorStop(1, "rgba(0,0,0,0.34)")
    g.fillStyle = grd
    g.fillRect(0, 0, W, H)
  }

  private drawCaption(text: string, p: number, W: number, H: number) {
    if (!this.settings.captions || !text) return
    // Fade in over the first 12% of the beat, out over the last 18%.
    const a = Math.min(1, p / 0.12) * Math.min(1, (1 - p) / 0.18)
    if (a <= 0.01) return

    const g = this.ctx
    const size = Math.round(W * 0.072)
    g.save()
    g.globalAlpha = a
    g.font = `400 ${size}px "Instrument Serif", Georgia, "Times New Roman", serif`
    g.textAlign = "center"
    g.textBaseline = "middle"

    // Wrap to at most three lines.
    const maxW = W * 0.82
    const lines: string[] = []
    let line = ""
    for (const w of text.split(" ")) {
      const test = line ? `${line} ${w}` : w
      if (g.measureText(test).width > maxW && line) {
        lines.push(line)
        line = w
      } else line = test
    }
    if (line) lines.push(line)
    const shown = lines.slice(0, 3)

    const lineH = size * 1.26
    const blockH = shown.length * lineH
    const baseY = H * 0.8 - blockH / 2

    // Scrim so text stays legible over any frame.
    g.fillStyle = `rgba(8,6,5,${0.42 * a})`
    g.fillRect(0, baseY - lineH * 0.7, W, blockH + lineH * 1.2)

    g.shadowColor = "rgba(0,0,0,0.6)"
    g.shadowBlur = size * 0.3
    g.fillStyle = brand.get().ink || "#fdf9f2"
    shown.forEach((l, i) => g.fillText(l, W / 2, baseY + lineH * (i + 0.5)))
    g.restore()
  }

  private drawProgress(t: number, W: number, H: number) {
    const g = this.ctx
    const pct = Math.min(1, t / this.duration)
    g.fillStyle = "rgba(255,255,255,0.18)"
    g.fillRect(W * 0.06, H * 0.955, W * 0.88, 3)
    g.fillStyle = brand.get().accent || "#d9b77e"
    g.fillRect(W * 0.06, H * 0.955, W * 0.88 * pct, 3)
  }

  draw(t: number) {
    const g = this.ctx
    const W = this.canvas.width
    const H = this.canvas.height
    g.fillStyle = "#000"
    g.fillRect(0, 0, W, H)

    const cur = this.beatAt(t)
    if (!cur) {
      g.fillStyle = "#6b6b6b"
      g.font = `${Math.round(W * 0.045)}px Georgia, serif`
      g.textAlign = "center"
      g.fillText("No selects yet", W / 2, H / 2)
      return
    }

    const FADE = 0.28 // seconds of cross-dissolve
    const localT = t - cur.beat.start
    const prev = cur.index > 0 ? this.beats[cur.index - 1] : undefined

    if (prev && localT < FADE) {
      this.drawShot(prev, 1, W, H, 1)
      this.drawShot(cur.beat, cur.p, W, H, localT / FADE)
    } else {
      this.drawShot(cur.beat, cur.p, W, H, 1)
    }

    this.applyGrade(W, H)
    this.drawCaption(cur.beat.text, cur.p, W, H)
    brand.drawWatermark(g, W, H, this.logo)
    this.drawProgress(t, W, H)
  }

  /**
   * Record the timeline to a .webm Blob by driving `draw()` in real time
   * against a captured canvas stream.
   */
  async export({
    height = 1920,
    fps = 30,
    onProgress,
    audioTrack = null,
    onAudioStart,
    signal,
  }: ExportOptions = {}): Promise<Blob> {
    if (!this.beats.length) throw new Error("Nothing to export — build the reel first.")
    if (typeof MediaRecorder === "undefined") throw new Error("This browser cannot record canvas video.")

    this.pause()

    const out = document.createElement("canvas")
    out.height = height
    out.width = Math.round((height * 9) / 16)
    const prevCanvas = this.canvas
    const prevCtx = this.ctx
    this.canvas = out
    this.ctx = context2d(out)

    try {
      const stream = out.captureStream(fps)
      // Mux the score in as a second track on the same stream, so the
      // recorder writes one file with picture and sound already in sync.
      if (audioTrack) stream.addTrack(audioTrack)

      const codecs = audioTrack
        ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
        : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      const mime = codecs.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm"
      const rec = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 8_000_000,
        ...(audioTrack && { audioBitsPerSecond: 128_000 }),
      })

      const chunks: Blob[] = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      const finished = new Promise<Blob>((res) => {
        rec.onstop = () => res(new Blob(chunks, { type: mime }))
      })

      rec.start(200)
      onAudioStart?.() // start the score on the same tick as the recorder
      const started = performance.now()

      // MediaRecorder timestamps in wall-clock time, so the export is
      // inherently real-time. Drive it from a fixed-step interval rather than
      // rAF: rAF is throttled hard when the tab loses focus, which would
      // overshoot the duration check and record a longer clip than asked for.
      let aborted = false
      await new Promise<void>((resolve) => {
        const stop = () => {
          clearInterval(timer)
          clearTimeout(guard)
          signal?.removeEventListener("abort", onAbort)
          resolve()
        }
        const onAbort = () => {
          aborted = true
          stop()
        }
        const timer = setInterval(() => {
          const elapsed = (performance.now() - started) / 1000
          if (elapsed >= this.duration) return stop()
          this.draw(elapsed)
          onProgress?.(elapsed / this.duration)
        }, 1000 / fps)
        // Belt and braces: never run more than a second past the target.
        const guard = setTimeout(stop, (this.duration + 1) * 1000)
        signal?.addEventListener("abort", onAbort)
      })
      this.draw(this.duration - 0.01)
      rec.stop()
      const blob = await finished
      if (aborted) throw new DOMException("Export cancelled", "AbortError")
      return blob
    } finally {
      this.canvas = prevCanvas
      this.ctx = prevCtx
      this.draw(this.t)
    }
  }
}
