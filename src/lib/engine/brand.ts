/**
 * Studio identity applied across every asset: logo (dataURL), palette,
 * voice rules, banned words and a signature block. The reel renderer reads
 * the logo and palette; the copy engine reads the voice rules and signature.
 */
import { createExternalStore } from "./external-store"

export type LogoPosition = "tl" | "tr" | "bl" | "br"

export interface BrandKit {
  studioName: string
  logo: string | null
  logoPosition: LogoPosition
  logoOpacity: number
  accent: string
  ink: string
  shadow: string
  /** Tint the Reel grade with the accent colour instead of stock amber. */
  gradeFromBrand: boolean
  voice: string
  /** Comma-separated words to avoid. */
  banned: string
  /** Appended to long-form captions. */
  signature: string
}

export const BRAND_DEFAULTS: BrandKit = {
  studioName: "",
  logo: null,
  logoPosition: "br",
  logoOpacity: 0.85,
  accent: "#D9B77E",
  ink: "#FDF9F2",
  shadow: "#1A1410",
  gradeFromBrand: false,
  voice: "",
  banned: "",
  signature: "",
}

// Same key as the original app, so existing brand kits carry over.
export const brandStore = createExternalStore<BrandKit>("aso.brand.v1", BRAND_DEFAULTS)

export const get = () => brandStore.get()
export const set = (patch: Partial<BrandKit>) => brandStore.set(patch)
export const reset = () => brandStore.set(() => ({ ...BRAND_DEFAULTS }))

/** Hex → {r,g,b}, for canvas tinting. */
export function rgb(hex: string): { r: number; g: number; b: number } {
  const h = (hex || "#000").replace("#", "")
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const parseBanned = (banned: string) =>
  banned
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

/**
 * Voice rules for the copy engine and the Claude system prompt.
 * Null when nothing is set, so prompts aren't padded with empty rules.
 */
export function voiceRules(kit: BrandKit = get()): string | null {
  const bits: string[] = []
  if (kit.studioName) bits.push(`The studio is called ${kit.studioName}.`)
  if (kit.voice) bits.push(kit.voice.trim())
  const banned = parseBanned(kit.banned)
  if (banned.length) bits.push(`Never use these words: ${banned.join(", ")}.`)
  return bits.length ? bits.join(" ") : null
}

/**
 * Swaps are single words that slot into the same grammatical position as
 * the word they replace — "obsessed" → "taken" keeps a following "with"
 * valid. An empty string deletes the word; cleanup repairs what's left.
 */
const SWAPS: Record<string, string> = {
  stunning: "striking",
  gorgeous: "beautiful",
  amazing: "remarkable",
  breathtaking: "arresting",
  magical: "rare",
  perfect: "exact",
  epic: "considerable",
  vibes: "feeling",
  obsessed: "taken",
  literally: "",
  absolutely: "",
  truly: "",
  very: "",
  really: "",
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const matchCase = (sample: string, word: string) =>
  /^[A-Z]/.test(sample) ? word.charAt(0).toUpperCase() + word.slice(1) : word

/** Strip banned words from copy, repairing articles and spacing. */
export function applyVoice(text: string, kit: BrandKit = get()): string {
  const banned = parseBanned(kit.banned)
  if (!banned.length) return text
  let out = text

  for (const word of banned) {
    const swap = SWAPS[word] ?? ""
    const w = escapeRe(word)

    // Pass 1: the word with an indefinite article in front of it. Swapping
    // can invalidate the article ("an amazing" → "a remarkable"), so rewrite
    // both together. Scoped to words we touched — a global a/an sweep would
    // "correct" legitimate cases like "an hour".
    out = out.replace(new RegExp(`\\b(an?)(\\s+)${w}\\b`, "gi"), (_m, art: string, gap: string) => {
      if (!swap) return art // deletion: keep the article
      const article = /^[aeiou]/i.test(swap) ? "an" : "a"
      return matchCase(art, article) + gap + matchCase(word.charAt(0), swap)
    })

    // Pass 2: every remaining occurrence.
    out = out.replace(new RegExp(`\\b${w}\\b`, "gi"), (m) => (swap ? matchCase(m, swap) : ""))
  }

  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/^[ \t]+/gm, "")
}

/** The signature line appended to long-form assets. */
export function signature(handle: string, kit: BrandKit = get()): string | null {
  if (kit.signature) return kit.signature.trim()
  if (kit.studioName && handle) return `— ${kit.studioName} · ${handle}`
  return null
}

/** Draw the watermark onto a canvas context sized W×H. */
export function drawWatermark(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  logoImg: HTMLImageElement | null,
  kit: BrandKit = get(),
): void {
  if (!logoImg) return
  const pad = W * 0.05
  const w = W * 0.2
  const h = w * (logoImg.naturalHeight / logoImg.naturalWidth || 1)
  const positions: Record<LogoPosition, [number, number]> = {
    tl: [pad, pad],
    tr: [W - w - pad, pad],
    bl: [pad, H - h - pad - H * 0.06],
    br: [W - w - pad, H - h - pad - H * 0.06],
  }
  const [x, y] = positions[kit.logoPosition]

  g.save()
  g.globalAlpha = kit.logoOpacity
  g.shadowColor = "rgba(0,0,0,0.45)"
  g.shadowBlur = W * 0.02
  g.drawImage(logoImg, x, y, w, h)
  g.restore()
}
