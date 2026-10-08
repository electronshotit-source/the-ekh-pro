/* ============================================================
   prompt.js — plain-English command parsing.

   "Give me a luxury Nigerian wedding Instagram carousel."
      → { assets:['carousel'], tone:'luxury', culture:'nigerian' }
   "Turn this wedding into a 30-second Reel."
      → { assets:['reel'], seconds:30 }
   "Draft the blog article and 6 Pinterest pins."
      → { assets:['blog','pinterest'], count:6 }
   ============================================================ */

import type { AssetKind, CultureId, ToneId } from "./types"

const ASSET_PATTERNS: Array<[AssetKind, RegExp]> = [
  ["carousel", /carousel|swipe post|slide ?deck|ig post|instagram post|photo dump/i],
  ["reel", /\breels?\b|instagram video|ig video/i],
  ["shorts", /you ?tube|\byt\b/i],
  ["tiktok", /tik ?tok/i],
  ["bts", /behind[- ]the[- ]scenes|\bbts\b|behind the camera/i],
  ["testimonial", /testimonial|review|client quote|what they said/i],
  ["caption", /caption|copy for|write me copy|words for/i],
  ["story", /\bstories\b|story sequence|\bstory\b|instagram stories/i],
  ["pinterest", /pinterest|\bpins?\b/i],
  ["blog", /blog|article|write.?up|long ?form|seo post/i],
  ["newsletter", /news ?letter|\bemail\b|mailing list|email blast|edm/i],
  ["linkedin", /linked ?in|b2b|vendor post|industry post/i],
  ["vendorsheet", /vendor (?:tag|sheet|credit|list)|tag sheet|credits?\b|supplier tags?/i],
  ["shotlist", /shot ?list|checklist|planning call|client list/i],
]

const TONE_PATTERNS: Array<[ToneId, RegExp]> = [
  ["luxury", /luxur|high[- ]end|editorial|elevated|premium|refined|upscale/i],
  ["warm", /warm|documentary|candid|intimate|honest|personal|storytell/i],
  ["playful", /playful|fun|loud|cheeky|chaotic|energetic|hype|viral/i],
  ["cinematic", /cinematic|moody|dark|dramatic|film ?look|atmospheric/i],
]

const CULTURE_PATTERNS: Array<[CultureId, RegExp]> = [
  ["yoruba", /yoruba|owambe|aso.?oke|alaga|gele/i],
  ["igbo", /igbo|igba ?nkwu|isiagu|umunna/i],
  ["hausa", /hausa|fulani|fatiha|kamu|northern/i],
  ["ghanaian", /ghana|kente|accra/i],
  ["nigerian", /nigerian?|naija|lagos|abuja|9ja|port ?harcourt/i],
  ["global", /destination|european|italian|international|abroad/i],
]

const EVERYTHING = /\ball\b|everything|full campaign|whole (?:lot|thing|set)|entire campaign|complete (?:set|package)/i
export const ALL_ASSETS: AssetKind[] = [
  "carousel",
  "reel",
  "tiktok",
  "bts",
  "testimonial",
  "caption",
  "story",
  "pinterest",
  "blog",
  "newsletter",
  "shorts",
  "linkedin",
  "vendorsheet",
  "shotlist",
]

/**
 * Parse a natural-language request into a generation plan.
 * Returns null for `tone`/`culture` when the user did not specify one,
 * so the caller can fall back to the wedding's saved settings.
 */
export interface Plan {
  assets: AssetKind[]
  tone: ToneId | null
  culture: CultureId | null
  seconds: number | null
  count: number | null
  raw: string
  /** True when no asset was named and we defaulted to a carousel. */
  guessed: boolean
}

export function parse(text: string): Plan {
  const q = (text || "").trim()
  const plan: Plan = { assets: [], tone: null, culture: null, seconds: null, count: null, raw: q, guessed: false }
  if (!q) return plan

  if (EVERYTHING.test(q)) {
    plan.assets = [...ALL_ASSETS]
  } else {
    for (const [kind, re] of ASSET_PATTERNS) if (re.test(q)) plan.assets.push(kind)
  }

  // "shorts" on its own means TikTok-style vertical video to most people;
  // only "YouTube Shorts" is the separate, slower-paced asset. Resolved here
  // rather than in the table because every pattern is tested, not just the
  // first match — a bare /shorts/ in the TikTok row would double-fire.
  if (/\bshorts?\b/i.test(q) && !plan.assets.includes("shorts") && !plan.assets.includes("tiktok")) {
    plan.assets.push("tiktok")
  }

  for (const [tone, re] of TONE_PATTERNS)
    if (re.test(q)) {
      plan.tone = tone
      break
    }
  for (const [culture, re] of CULTURE_PATTERNS)
    if (re.test(q)) {
      plan.culture = culture
      break
    }

  // "30-second", "30 sec", "30s", "a minute"
  const secs = q.match(/(\d{1,3})\s*[- ]?\s*(?:second|sec|s)\b/i)
  if (secs?.[1]) plan.seconds = Math.min(90, Math.max(5, parseInt(secs[1], 10)))
  else if (/\ba? ?minute\b/i.test(q)) plan.seconds = 60

  // "6 pins", "10 slides"
  const count = q.match(/(\d{1,2})\s*(?:pins?|slides?|frames?|images?|photos?)/i)
  if (count?.[1]) plan.count = Math.min(20, Math.max(1, parseInt(count[1], 10)))

  // Bare "make me something" — give them the workhorse.
  if (!plan.assets.length && /\b(make|give|create|generate|build|draft|write|turn)\b/i.test(q)) {
    plan.assets = ["carousel"]
    plan.guessed = true
  }
  return plan
}

/** A human-readable summary of what we understood, for the toast. */
export function describe(plan: Plan, labels: Record<AssetKind, string>): string | null {
  if (!plan.assets.length) return null
  const names = plan.assets.map((a) => labels[a])
  const list = names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names.join(" and ")
  const bits: string[] = []
  if (plan.tone) bits.push(plan.tone)
  if (plan.culture) bits.push(plan.culture)
  if (plan.seconds) bits.push(`${plan.seconds}s`)
  return `Generated ${list}${bits.length ? ` · ${bits.join(" · ")}` : ""}`
}
