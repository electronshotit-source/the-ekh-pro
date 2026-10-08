/**
 * Turns a scored pile of frames into an edit:
 *   1. collapse near-duplicates (a burst of six contributes one frame)
 *   2. enforce variety (a carousel isn't ten portraits in a row)
 *   3. sequence along a narrative arc — the order a wedding story is told
 *      in is not the order of the score column
 * The photographer can pin or exclude frames; the arc respects both.
 */
import { hamming } from "./vision"
import type { Metrics, Profile, RawShot, Role, ScoredShot, Select, ShotType } from "./types"

const DUPE_THRESHOLD = 11 // hamming distance below this ⇒ same moment

/** Mark near-identical frames; keep the best of each cluster. */
export function dedupe(shots: Array<RawShot & { m: Metrics }>): ScoredShot[] {
  const result: ScoredShot[] = shots.map((s) => ({ ...s, dupeOf: null, burst: 1 }))
  const kept: ScoredShot[] = []
  const byScore = [...result].sort((a, b) => b.m.score - a.m.score)
  for (const shot of byScore) {
    const twin = kept.find((k) => hamming(k.m.hash, shot.m.hash) < DUPE_THRESHOLD)
    if (twin) {
      shot.dupeOf = twin.id
      twin.burst = (twin.burst ?? 1) + 1
    } else {
      kept.push(shot)
    }
  }
  return result
}

interface ArcBeat {
  role: Role
  want: ShotType[]
  note: string
}

/** The narrative spine of a wedding edit, in order. */
const ARC: ArcBeat[] = [
  { role: "hero", want: ["portrait"], note: "Open on the couple — the strongest frame you have." },
  { role: "detail", want: ["detail"], note: "Slow down: rings, lace, gele, stationery." },
  { role: "wide", want: ["wide"], note: "Establish the room. Give the scale." },
  { role: "portrait", want: ["portrait"], note: "Back to faces. Hold the emotion." },
  { role: "detail", want: ["detail"], note: "Texture beat — fabric, florals, the table." },
  { role: "party", want: ["party", "wide"], note: "Energy. Dancing, spraying, the noise." },
  { role: "portrait", want: ["portrait"], note: "A quieter portrait for contrast." },
  { role: "wide", want: ["wide", "detail"], note: "Pull back — venue, sky, the room emptying." },
  { role: "party", want: ["party", "portrait"], note: "Peak joy. The frame people screenshot." },
  { role: "closer", want: ["portrait", "wide"], note: "Close on them. Leave the viewer with the couple." },
]

export interface SequenceOptions {
  /** Frames the photographer insists on. They always make the edit. */
  pinned?: ReadonlySet<string>
  /** Frames the photographer has ruled out. */
  excluded?: ReadonlySet<string>
}

/**
 * Build a narrative-ordered sequence of `count` shots. Falls back to score
 * order when a shot type is unavailable.
 */
export function sequence(
  shots: ScoredShot[],
  count = 10,
  { pinned = new Set(), excluded = new Set() }: SequenceOptions = {},
): Select[] {
  const isPinned = (s: ScoredShot) => pinned.has(s.id)
  const pool = shots
    .filter((s) => !excluded.has(s.id) && (isPinned(s) || (!s.dupeOf && s.m.usable)))
    // Pinned frames first, then by score — so every pick prefers them.
    .sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || b.m.score - a.m.score)

  if (!pool.length) return []
  const target = Math.min(pool.length, Math.max(count, pinned.size))
  const used = new Set<string>()
  const out: Select[] = []

  const take = (types: ShotType[]): ScoredShot | undefined => {
    for (const t of types) {
      const hit = pool.find((s) => !used.has(s.id) && s.m.type === t)
      if (hit) return hit
    }
    return pool.find((s) => !used.has(s.id))
  }

  for (let i = 0; i < target; i++) {
    const beat = ARC[i % ARC.length]!
    // A pinned frame whose type never comes up in the arc would otherwise be
    // dropped; once the slots left only just cover the pins, place them.
    const waiting = pool.filter((s) => isPinned(s) && !used.has(s.id))
    // The opening frame is the strongest one with a person in it.
    const shot =
      waiting.length >= target - i
        ? waiting[0]
        : i === 0
          ? (pool.find((s) => s.m.type === "portrait") ?? pool[0])
          : take(beat.want)
    if (!shot) break
    used.add(shot.id)
    out.push({ ...shot, role: beat.role, note: beat.note })
  }
  return out
}

/** Everything the copywriter needs to know about the gallery, derived. */
export function profile(shots: ScoredShot[]): Profile {
  const live = shots.filter((s) => s.m.usable && !s.dupeOf)
  const avg = (k: "warmth" | "brightness" | "colour") =>
    live.length ? live.reduce((a, s) => a + s.m[k], 0) / live.length : 0
  const counts: Partial<Record<ShotType, number>> = {}
  for (const s of live) counts[s.m.type] = (counts[s.m.type] ?? 0) + 1

  const warmth = avg("warmth")
  const brightness = avg("brightness")
  const colour = avg("colour")

  return {
    total: shots.length,
    usable: live.length,
    rejected: shots.filter((s) => !s.m.usable).length,
    duplicates: shots.filter((s) => s.dupeOf).length,
    counts,
    avgScore: live.length ? +(live.reduce((a, s) => a + s.m.score, 0) / live.length).toFixed(1) : 0,
    topScore: live.length ? Math.max(...live.map((s) => s.m.score)) : 0,
    // These drive word choice: a bright, saturated, warm gallery gets
    // different adjectives from a dark, moody one.
    mood: brightness < 0.36 ? "moody" : brightness > 0.58 ? "airy" : "balanced",
    palette: warmth > 0.56 ? "warm" : warmth < 0.44 ? "cool" : "neutral",
    saturation: colour > 0.55 ? "rich" : colour < 0.32 ? "muted" : "natural",
    peopleHeavy: (counts.portrait ?? 0) + (counts.party ?? 0) > live.length * 0.5,
  }
}
