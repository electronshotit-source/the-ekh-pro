/**
 * Pixel-level image analysis, entirely in the browser.
 *
 * For each photo:
 *   sharpness    Laplacian variance on a downsampled luma plane
 *   exposure     histogram balance + clipping penalty
 *   contrast     luma standard deviation
 *   colour       Hasler–Süsstrunk colourfulness
 *   subject      skin-tone ratio (works across all skin tones) — or real
 *                faces where the browser exposes FaceDetector
 *   composition  gradient energy near rule-of-thirds intersections
 *   warmth       R-vs-B bias
 *   hash         64-bit dHash for near-duplicate clustering
 *
 * Typed-array reads in the kernels below are bounds-checked by their loops;
 * the `!` assertions record that rather than paying for `?? 0` per pixel.
 */
import type { Metrics, ShotType } from "./types"

const WORK = 256 // analysis resolution (long edge)

let workCtx: CanvasRenderingContext2D | null = null

/** Created on first use so importing this module never touches the DOM. */
function getWorkContext(): CanvasRenderingContext2D {
  if (workCtx) return workCtx
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas 2D is unavailable in this browser.")
  workCtx = ctx
  return ctx
}

interface Sample {
  data: Uint8ClampedArray
  w: number
  h: number
}

function sample(img: HTMLImageElement): Sample {
  const ctx = getWorkContext()
  const ratio = img.naturalWidth / img.naturalHeight
  const w = ratio >= 1 ? WORK : Math.round(WORK * ratio)
  const h = ratio >= 1 ? Math.round(WORK / ratio) : WORK
  ctx.canvas.width = w
  ctx.canvas.height = h
  ctx.drawImage(img, 0, 0, w, h)
  return { data: ctx.getImageData(0, 0, w, h).data, w, h }
}

const lumaOf = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Laplacian variance — the standard "is this in focus" measure. */
function sharpness(luma: Float32Array, w: number, h: number): number {
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap = 4 * luma[i]! - luma[i - 1]! - luma[i + 1]! - luma[i - w]! - luma[i + w]!
      sum += lap
      sumSq += lap * lap
      n++
    }
  }
  const mean = sum / n
  const variance = sumSq / n - mean * mean
  // ~0 for a soft frame, 1500+ for a crisp one. Compress to 0..1.
  return Math.min(1, Math.sqrt(variance) / 26)
}

/** Reward a full tonal range; punish blown highlights and crushed blacks. */
function exposure(luma: Float32Array): { score: number; mean: number } {
  const hist = new Uint32Array(64)
  for (let i = 0; i < luma.length; i++) hist[(luma[i]! >> 2) & 63]!++
  const total = luma.length
  const clipLow = hist[0]! / total
  const clipHigh = hist[63]! / total
  let occupied = 0
  for (let i = 0; i < 64; i++) if (hist[i]! / total > 0.0015) occupied++
  const spread = occupied / 64
  let lumaSum = 0
  for (let i = 0; i < total; i++) lumaSum += luma[i]!
  const mean = lumaSum / total / 255
  // Ideal mean luma sits around 0.45 for editorial wedding work.
  const midtone = 1 - Math.min(1, Math.abs(mean - 0.45) / 0.45)
  const clipPenalty = Math.min(1, (Math.max(0, clipLow - 0.02) + Math.max(0, clipHigh - 0.02)) * 6)
  return { score: Math.max(0, spread * 0.45 + midtone * 0.55 - clipPenalty), mean }
}

function contrast(luma: Float32Array): number {
  const n = luma.length
  let sum = 0
  for (let i = 0; i < n; i++) sum += luma[i]!
  const mean = sum / n
  let sq = 0
  for (let i = 0; i < n; i++) {
    const d = luma[i]! - mean
    sq += d * d
  }
  return Math.min(1, Math.sqrt(sq / n) / 68)
}

/** Hasler–Süsstrunk colourfulness. */
function colourfulness(data: Uint8ClampedArray): number {
  let rgSum = 0
  let rgSq = 0
  let ybSum = 0
  let ybSq = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const rg = r - g
    const yb = 0.5 * (r + g) - b
    rgSum += rg
    rgSq += rg * rg
    ybSum += yb
    ybSq += yb * yb
    n++
  }
  const rgMean = rgSum / n
  const ybMean = ybSum / n
  const rgStd = Math.sqrt(Math.max(0, rgSq / n - rgMean * rgMean))
  const ybStd = Math.sqrt(Math.max(0, ybSq / n - ybMean * ybMean))
  const std = Math.hypot(rgStd, ybStd)
  const mean = Math.hypot(rgMean, ybMean)
  return Math.min(1, (std + 0.3 * mean) / 110)
}

/**
 * Skin-tone ratio in YCbCr — a fast stand-in for face detection that works
 * across the full range of skin tones. Also reports where those pixels sit.
 */
function subject(data: Uint8ClampedArray, w: number, h: number) {
  let hits = 0
  let cx = 0
  let cy = 0
  let total = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
      const yv = lumaOf(r, g, b)
      if (cb >= 77 && cb <= 135 && cr >= 130 && cr <= 180 && yv > 24) {
        hits++
        cx += x
        cy += y
      }
      total++
    }
  }
  return {
    ratio: hits / total,
    cx: hits ? cx / hits / w : 0.5,
    cy: hits ? cy / hits / h : 0.5,
  }
}

/** How much gradient energy falls near the rule-of-thirds intersections. */
function composition(luma: Float32Array, w: number, h: number): number {
  const points: Array<[number, number]> = [
    [1 / 3, 1 / 3],
    [2 / 3, 1 / 3],
    [1 / 3, 2 / 3],
    [2 / 3, 2 / 3],
  ]
  let near = 0
  let all = 0
  const radius = Math.min(w, h) * 0.18
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x
      const gx = luma[i + 1]! - luma[i - 1]!
      const gy = luma[i + w]! - luma[i - w]!
      const e = Math.abs(gx) + Math.abs(gy)
      all += e
      for (const [px, py] of points) {
        if (Math.hypot(x - px * w, y - py * h) < radius) {
          near += e
          break
        }
      }
    }
  }
  if (!all) return 0.5
  // Four circles cover roughly 25–30% of the frame; above that is "well placed".
  return Math.min(1, near / all / 0.34)
}

/** 64-bit difference hash as a hex string. */
function dHash(luma: Float32Array, w: number, h: number): string {
  const gw = 9
  const gh = 8
  const small = new Float32Array(gw * gh)
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const sx = Math.floor((x / gw) * w)
      const sy = Math.floor((y / gh) * h)
      small[y * gw + x] = luma[sy * w + sx]!
    }
  }
  let bits = ""
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw - 1; x++) bits += small[y * gw + x]! < small[y * gw + x + 1]! ? "1" : "0"
  let hex = ""
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

export function hamming(a: string, b: string): number {
  let d = 0
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a.charAt(i), 16) ^ parseInt(b.charAt(i), 16)
    while (x) {
      d += x & 1
      x >>= 1
    }
  }
  return d
}

interface ClassifyInput {
  subjectRatio: number
  subjectSize: number
  colour: number
  brightness: number
  aspect: number
  sharp: number
}

/** Bucket a frame into the shot types a wedding edit is built from. */
function classify(m: ClassifyInput): ShotType {
  const { subjectRatio, subjectSize, colour, brightness, aspect, sharp } = m
  if (subjectRatio > 0.11 && subjectSize > 0.22) return "portrait"
  if (subjectRatio > 0.045 && colour > 0.5 && brightness < 0.42) return "party"
  if (subjectRatio > 0.045) return aspect > 1.25 ? "wide" : "portrait"
  if (sharp > 0.55 && colour > 0.42) return "detail"
  if (aspect > 1.3) return "wide"
  return "detail"
}

/** Analyse one loaded image. Returns plain data — no DOM references held. */
export function analyze(img: HTMLImageElement): Metrics {
  const { data, w, h } = sample(img)
  const luma = new Float32Array(w * h)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    luma[p] = lumaOf(data[i]!, data[i + 1]!, data[i + 2]!)
  }

  const sharp = sharpness(luma, w, h)
  const exp = exposure(luma)
  const con = contrast(luma)
  const col = colourfulness(data)
  const subj = subject(data, w, h)
  const comp = composition(luma, w, h)

  let rSum = 0
  let bSum = 0
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i]!
    bSum += data[i + 2]!
  }
  const warmth = Math.max(0, Math.min(1, 0.5 + ((rSum - bSum) / (rSum + bSum + 1)) * 1.6))

  // Spread of skin pixels ≈ how large the subject is in frame.
  const subjectSize = Math.min(1, Math.sqrt(subj.ratio) * 2.2)
  const aspect = img.naturalWidth / img.naturalHeight

  const type = classify({
    subjectRatio: subj.ratio,
    subjectSize,
    colour: col,
    brightness: exp.mean,
    aspect,
    sharp,
  })

  // Technical quality gates everything — a beautiful moment that's out of
  // focus still can't lead a carousel — then human presence and composition
  // order the technically fine frames.
  const humanBonus = Math.min(1, subj.ratio * 6)
  const score =
    Math.round(1000 * (sharp * 0.3 + exp.score * 0.18 + con * 0.08 + col * 0.12 + humanBonus * 0.2 + comp * 0.12)) / 10

  return {
    sharp,
    exposure: exp.score,
    brightness: exp.mean,
    contrast: con,
    colour: col,
    subjectRatio: subj.ratio,
    subjectSize,
    subjectX: subj.cx,
    subjectY: subj.cy,
    composition: comp,
    warmth,
    aspect,
    width: img.naturalWidth,
    height: img.naturalHeight,
    hash: dHash(luma, w, h),
    type,
    score,
    // Hard vetoes: nothing badly soft or badly exposed reaches a select.
    usable: sharp > 0.2 && exp.score > 0.22,
  }
}

/* ---------------- face detection ---------------- */

interface DetectedFace {
  boundingBox: DOMRectReadOnly
}
interface FaceDetectorLike {
  detect(image: ImageBitmapSource): Promise<DetectedFace[]>
}
type FaceDetectorCtor = new (opts: { fastMode: boolean; maxDetectedFaces: number }) => FaceDetectorLike

export interface FaceBox {
  x: number
  y: number
  w: number
  h: number
}

let detector: FaceDetectorLike | null = null
let detectorChecked = false

export function faceDetectionAvailable(): boolean {
  if (detectorChecked) return detector !== null
  detectorChecked = true
  if (typeof window === "undefined") return false
  const Ctor = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector
  if (!Ctor) return false
  try {
    detector = new Ctor({ fastMode: true, maxDetectedFaces: 12 })
  } catch {
    detector = null
  }
  return detector !== null
}

/** Faces in normalised 0..1 coordinates, or null where unsupported. */
export async function detectFaces(img: HTMLImageElement): Promise<FaceBox[] | null> {
  if (!faceDetectionAvailable() || !detector) return null
  try {
    const faces = await detector.detect(img)
    return faces.map((f) => ({
      x: f.boundingBox.x / img.naturalWidth,
      y: f.boundingBox.y / img.naturalHeight,
      w: f.boundingBox.width / img.naturalWidth,
      h: f.boundingBox.height / img.naturalHeight,
    }))
  } catch {
    return null // detector can throw on odd image sizes; fall back quietly
  }
}

/**
 * Fold real face geometry into a metrics object: re-derive subject size and
 * position, re-classify, re-score. Returns a new object.
 */
export function applyFaces(m: Metrics, faces: FaceBox[] | null): Metrics {
  if (!faces) return { ...m, faceSource: "skin-tone" }

  const next: Metrics = { ...m, faceSource: "detector", faces: faces.length }
  next.faceArea = faces.reduce((a, f) => a + f.w * f.h, 0)

  if (faces.length) {
    // Weight the centroid by face area so the Reel frames the closest subject.
    let wx = 0
    let wy = 0
    let total = 0
    for (const f of faces) {
      const area = f.w * f.h
      wx += (f.x + f.w / 2) * area
      wy += (f.y + f.h / 2) * area
      total += area
    }
    next.subjectX = wx / total
    // Bias upward: framing on the eyeline reads better than on the box centre.
    next.subjectY = Math.max(0.12, wy / total - 0.04)
    next.subjectSize = Math.min(1, Math.sqrt(next.faceArea) * 3.2)
  } else {
    next.subjectSize = 0
  }

  const largest = faces.length ? Math.max(...faces.map((f) => f.w * f.h)) : 0
  if (faces.length >= 4) next.type = "party"
  else if (largest > 0.045) next.type = "portrait"
  else if (faces.length >= 1) next.type = m.aspect > 1.25 ? "wide" : "portrait"
  else if (m.sharp > 0.55 && m.colour > 0.42) next.type = "detail"
  else next.type = m.aspect > 1.3 ? "wide" : "detail"

  // A confirmed face is worth more than a skin-coloured region; a frame with
  // no face at all shouldn't carry a human bonus.
  const humanBonus = faces.length ? Math.min(1, 0.55 + Math.sqrt(largest) * 2.2) : 0
  next.score =
    Math.round(
      1000 *
        (m.sharp * 0.3 +
          m.exposure * 0.18 +
          m.contrast * 0.08 +
          m.colour * 0.12 +
          humanBonus * 0.2 +
          m.composition * 0.12),
    ) / 10

  return next
}

/** Load a URL into an <img> we can analyse and draw from. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not decode image"))
    img.src = src
  })
}
