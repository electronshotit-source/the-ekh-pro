import { describe, expect, it } from "vitest"

import { BRAND_DEFAULTS, applyVoice } from "./brand"
import { profile, sequence } from "./curator"
import { buildBeats, buildContext, generate } from "./generators"
import { beatGrid } from "./music"
import { ALL_ASSETS, parse } from "./prompt"
import type { Metrics, ScoredShot, ShotType, Wedding } from "./types"

/* ---------- fixtures ---------- */

function metrics(type: ShotType, score: number, overrides: Partial<Metrics> = {}): Metrics {
  return {
    sharp: 0.7,
    exposure: 0.7,
    brightness: 0.5,
    contrast: 0.6,
    colour: 0.5,
    subjectRatio: 0.1,
    subjectSize: 0.3,
    subjectX: 0.5,
    subjectY: 0.4,
    composition: 0.6,
    warmth: 0.6,
    aspect: 0.8,
    width: 1200,
    height: 1500,
    hash: "0",
    type,
    score,
    usable: true,
    ...overrides,
  }
}

const TYPES: ShotType[] = ["portrait", "detail", "wide", "party"]
const shots: ScoredShot[] = Array.from({ length: 16 }, (_, i) => ({
  id: `s${i}`,
  name: `DSC_${i}.jpg`,
  url: `blob:${i}`,
  m: metrics(TYPES[i % 4]!, 90 - i),
  dupeOf: null,
}))

const wedding: Wedding = {
  bride: "Adaeze",
  groom: "Tobenna",
  venue: "Balmoral Convention Centre",
  city: "Lagos",
  culture: "igbo",
  tone: "luxury",
  handle: "@goldenhourstudio",
  date: "2026-10-03",
  vendors: "Planner: Trina Events, Dress: Yartel Bridal",
}

/* ---------- prompt parsing ---------- */

describe("parse", () => {
  it("reads the carousel example", () => {
    const p = parse("Give me a luxury Nigerian wedding Instagram carousel.")
    expect(p.assets).toEqual(["carousel"])
    expect(p.tone).toBe("luxury")
    expect(p.culture).toBe("nigerian")
  })

  it("reads the Reel example with its length", () => {
    const p = parse("Turn this wedding into a 30-second Reel.")
    expect(p.assets).toEqual(["reel"])
    expect(p.seconds).toBe(30)
  })

  it("reads several assets and a count", () => {
    const p = parse("Draft the blog article and 6 Pinterest pins")
    expect(p.assets).toEqual(expect.arrayContaining(["blog", "pinterest"]))
    expect(p.count).toBe(6)
  })

  it("treats bare 'shorts' as TikTok but 'YouTube Shorts' as Shorts", () => {
    expect(parse("make some shorts").assets).toEqual(["tiktok"])
    expect(parse("YouTube Shorts please").assets).toEqual(["shorts"])
  })

  it("expands 'everything' to every asset", () => {
    expect(parse("everything").assets).toHaveLength(ALL_ASSETS.length)
  })

  it("defaults a bare request to a carousel and says so", () => {
    const p = parse("make me something")
    expect(p.assets).toEqual(["carousel"])
    expect(p.guessed).toBe(true)
  })
})

/* ---------- brand voice ---------- */

describe("applyVoice", () => {
  const kit = { ...BRAND_DEFAULTS, banned: "amazing, truly, stunning" }

  it("swaps words and repairs the article", () => {
    expect(applyVoice("What an amazing day.", kit)).toBe("What a remarkable day.")
  })

  it("deletes filler words and tidies spacing", () => {
    expect(applyVoice("It was truly, stunning.", kit)).toBe("It was, striking.")
  })

  it("leaves unrelated articles alone", () => {
    expect(applyVoice("We waited an hour.", kit)).toBe("We waited an hour.")
  })

  it("is a no-op without banned words", () => {
    expect(applyVoice("An amazing day.", BRAND_DEFAULTS)).toBe("An amazing day.")
  })
})

/* ---------- curation ---------- */

describe("sequence", () => {
  it("opens on the strongest portrait and never repeats a frame", () => {
    const out = sequence(shots, 10)
    expect(out[0]?.m.type).toBe("portrait")
    expect(new Set(out.map((s) => s.id)).size).toBe(out.length)
    expect(out).toHaveLength(10)
  })

  it("always includes pinned frames and never excluded ones", () => {
    const out = sequence(shots, 5, { pinned: new Set(["s15"]), excluded: new Set(["s0"]) })
    const ids = out.map((s) => s.id)
    expect(ids).toContain("s15")
    expect(ids).not.toContain("s0")
  })

  it("skips unusable frames and duplicates", () => {
    const pool = [
      ...shots.slice(0, 4),
      { ...shots[4]!, id: "soft", m: metrics("portrait", 99, { usable: false }) },
      { ...shots[5]!, id: "dupe", dupeOf: "s0" },
    ]
    const ids = sequence(pool, 10).map((s) => s.id)
    expect(ids).not.toContain("soft")
    expect(ids).not.toContain("dupe")
  })
})

/* ---------- beats ---------- */

describe("buildBeats", () => {
  const selects = sequence(shots, 10)
  const ctx = buildContext(wedding, profile(shots), selects)

  it("fills the requested length exactly without music", () => {
    const beats = buildBeats(ctx, 30, "medium")
    const end = beats.at(-1)!
    expect(beats[0]?.start).toBe(0)
    expect(end.start + end.dur).toBeCloseTo(30, 1)
  })

  it("lands every cut on the beat grid, in order", () => {
    const grid = beatGrid(102, 30, { every: 2 })
    const beats = buildBeats(ctx, 30, "medium", grid)
    for (const [i, b] of beats.entries()) {
      expect(b.onBeat).toBe(true)
      if (i > 0) expect(b.start).toBeGreaterThan(beats[i - 1]!.start)
      expect(grid.some((g) => Math.abs(g - b.start) < 0.01) || b.start > grid.at(-1)!).toBe(true)
    }
  })
})

/* ---------- generation ---------- */

describe("generate", () => {
  const selects = sequence(shots, 10)
  const prof = profile(shots)
  const ids = new Set(shots.map((s) => s.id))

  it.each(ALL_ASSETS)("produces a %s that only references real frames", (kind) => {
    const out = generate(kind, wedding, prof, selects, { seconds: 30 })
    expect(out.kind).toBe(kind)
    expect(out.blocks.length).toBeGreaterThan(0)
    for (const b of out.blocks) {
      const refs =
        b.t === "slides"
          ? b.slides.map((s) => s.shotId)
          : b.t === "pins"
            ? b.pins.map((p) => p.shotId)
            : b.t === "beats"
              ? b.beats.map((x) => x.shotId)
              : []
      for (const r of refs) if (r) expect(ids.has(r)).toBe(true)
      if (b.t === "copy") expect(b.text).not.toMatch(/\{\w+\}/) // no unfilled template slots
    }
  })

  it("refuses to run without selects", () => {
    expect(() => generate("carousel", wedding, prof, [])).toThrow()
  })
})
