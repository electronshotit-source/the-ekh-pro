/**
 * Shared domain types for the engine. Everything that crosses a module
 * boundary is defined here once and derived elsewhere.
 */

export type ShotType = "portrait" | "detail" | "wide" | "party"
export type Role = "hero" | "detail" | "wide" | "portrait" | "party" | "closer"

export type CultureId = "yoruba" | "igbo" | "hausa" | "nigerian" | "ghanaian" | "global"
export type ToneId = "luxury" | "warm" | "playful" | "cinematic"

/** Pixel-level analysis of one frame (vision.ts). */
export interface Metrics {
  sharp: number
  exposure: number
  brightness: number
  contrast: number
  colour: number
  subjectRatio: number
  subjectSize: number
  subjectX: number
  subjectY: number
  composition: number
  warmth: number
  aspect: number
  width: number
  height: number
  hash: string
  type: ShotType
  score: number
  usable: boolean
  faceSource?: "detector" | "skin-tone"
  faces?: number
  faceArea?: number
}

/** A photo as uploaded, before analysis. */
export interface RawShot {
  id: string
  name: string
  url: string
  blob?: Blob
  img?: HTMLImageElement
}

/** A photo after analysis and de-duplication. */
export interface ScoredShot extends RawShot {
  m: Metrics
  dupeOf: string | null
  burst?: number
}

/** A shot placed in the narrative sequence. */
export interface Select extends ScoredShot {
  role: Role
  note: string
}

export type Mood = "moody" | "airy" | "balanced"
export type Palette = "warm" | "cool" | "neutral"
export type Saturation = "rich" | "muted" | "natural"

/** Gallery-level summary the copywriter writes from. */
export interface Profile {
  total: number
  usable: number
  rejected: number
  duplicates: number
  counts: Partial<Record<ShotType, number>>
  avgScore: number
  topScore: number
  mood: Mood
  palette: Palette
  saturation: Saturation
  peopleHeavy: boolean
}

/** The wedding details form. */
export interface Wedding {
  bride: string
  groom: string
  venue: string
  city: string
  culture: CultureId
  tone: ToneId
  handle: string
  date: string
  vendors: string
}

export type AssetKind =
  | "carousel"
  | "reel"
  | "tiktok"
  | "bts"
  | "testimonial"
  | "caption"
  | "story"
  | "pinterest"
  | "blog"
  | "newsletter"
  | "shorts"
  | "linkedin"
  | "vendorsheet"
  | "shotlist"

export interface Slide {
  shotId: string | null
  n?: number
  caption: string
}

export interface BeatSpec {
  shotId: string
  role: Role
  start: number
  dur: number
  text: string
  onBeat: boolean
}

/** A beat with its shot resolved, for the canvas renderer. */
export interface Beat extends BeatSpec {
  shot: Select
}

export interface Pin {
  shotId: string | null
  title: string
  desc: string
  board: string
}

export type Block =
  | { t: "note"; text: string }
  | { t: "copy"; text: string; label?: string }
  | { t: "tags"; tags: string[] }
  | { t: "slides"; slides: Slide[] }
  | { t: "beats"; beats: BeatSpec[] }
  | { t: "pins"; pins: Pin[] }

/** One generated asset. Plain JSON — safe to persist as-is. */
export interface Output {
  id: string
  kind: AssetKind
  title: string
  subtitle: string
  blocks: Block[]
  createdAt: number
  tone: ToneId
  printable?: { title: string; body: string }
}

export type Rhythm = "slow" | "medium" | "fast"
