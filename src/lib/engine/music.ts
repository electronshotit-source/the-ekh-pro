/**
 * The score.
 *
 * Two sources:
 *   1. A built-in library. These are NOT licensed recordings — the app
 *      synthesises them with the Web Audio API at the length you need, so
 *      they are yours to use with no clearance and no Content ID risk.
 *   2. Your own uploads. Decoded locally, never sent anywhere.
 *
 * Both paths give an AudioBuffer, from which we derive a BPM estimate, a
 * beat grid and a waveform — so the Reel can cut on the beat instead of on
 * an arbitrary timer. Browser-only.
 */

type Ctx = BaseAudioContext
type Out = AudioNode

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
    webkitOfflineAudioContext?: typeof OfflineAudioContext
  }
}

let ac: AudioContext | null = null
export function audio(): AudioContext {
  if (!ac) {
    const Ctor = window.AudioContext ?? window.webkitAudioContext
    if (!Ctor) throw new Error("This browser has no Web Audio support.")
    ac = new Ctor()
  }
  if (ac.state === "suspended") void ac.resume()
  return ac
}

/* ---------------- synthesis primitives ---------------- */

const SR = 44100

/** Envelope helper: attack/decay in seconds, applied to a gain node. */
function env(g: GainNode, t: number, a: number, d: number, peak = 1) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
}

const noiseCache = new WeakMap<Ctx, AudioBuffer>()
/** One shared second of white noise per context — sources can reuse a buffer. */
function noiseBuffer(ctx: Ctx): AudioBuffer {
  let buf = noiseCache.get(ctx)
  if (!buf) {
    buf = ctx.createBuffer(1, SR, SR)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseCache.set(ctx, buf)
  }
  return buf
}

function filter(ctx: Ctx, type: BiquadFilterType, freq: number, q?: number) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  if (q !== undefined) f.Q.value = q
  return f
}

function kick(ctx: Ctx, out: Out, t: number, { gain = 1, from = 130, to = 45, decay = 0.34 } = {}) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = "sine"
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(to, t + decay * 0.55)
  env(g, t, 0.004, decay, gain)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + decay + 0.05)
}

function noiseHit(ctx: Ctx, out: Out, t: number, f: BiquadFilterNode, a: number, d: number, gain: number) {
  const n = ctx.createBufferSource()
  n.buffer = noiseBuffer(ctx)
  const g = ctx.createGain()
  env(g, t, a, d, gain)
  n.connect(f).connect(g).connect(out)
  n.start(t, Math.random() * 0.5)
  n.stop(t + a + d + 0.05)
}

function snare(ctx: Ctx, out: Out, t: number, { gain = 0.5, decay = 0.16, tone = 1900 } = {}) {
  noiseHit(ctx, out, t, filter(ctx, "bandpass", tone, 0.8), 0.002, decay, gain)
}

function clap(ctx: Ctx, out: Out, t: number, { gain = 0.42 } = {}) {
  // Three quick noise bursts read as hands rather than a snare.
  for (let i = 0; i < 3; i++) {
    snare(ctx, out, t + i * 0.011, { gain: gain * (1 - i * 0.2), decay: 0.1, tone: 1400 })
  }
  snare(ctx, out, t + 0.035, { gain, decay: 0.19, tone: 1200 })
}

function hat(ctx: Ctx, out: Out, t: number, { gain = 0.18, decay = 0.045, open = false } = {}) {
  noiseHit(ctx, out, t, filter(ctx, "highpass", 7800), 0.001, open ? decay * 4 : decay, gain)
}

function shaker(ctx: Ctx, out: Out, t: number, { gain = 0.12 } = {}) {
  noiseHit(ctx, out, t, filter(ctx, "highpass", 5200), 0.006, 0.07, gain)
}

/** Hand drum with a pitch bend — stands in for a talking drum / conga. */
function drum(ctx: Ctx, out: Out, t: number, { gain = 0.4, from = 400, to = 180, decay = 0.22 } = {}) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = "triangle"
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(to, t + decay * 0.7)
  env(g, t, 0.003, decay, gain)
  o.connect(filter(ctx, "lowpass", 2400))
    .connect(g)
    .connect(out)
  o.start(t)
  o.stop(t + decay + 0.05)
}

/** The deep resonant bass hit that defines an amapiano groove. */
function logDrum(ctx: Ctx, out: Out, t: number, { gain = 0.55, freq = 72, decay = 0.42 } = {}) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = "sine"
  o.frequency.setValueAtTime(freq * 2.6, t)
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.09)
  env(g, t, 0.006, decay, gain)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + decay + 0.05)
}

function bass(
  ctx: Ctx,
  out: Out,
  t: number,
  freq: number,
  dur: number,
  { gain = 0.34, type = "sine" as OscillatorType } = {},
) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02)
  g.gain.setValueAtTime(gain, t + dur * 0.75)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(filter(ctx, "lowpass", 420))
    .connect(g)
    .connect(out)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Plucked tone — guitar/kalimba/marimba depending on the harmonic mix. */
function pluck(
  ctx: Ctx,
  out: Out,
  t: number,
  freq: number,
  { gain = 0.2, decay = 0.5, type = "triangle" as OscillatorType, harm = 0.3 } = {},
) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = freq
  env(g, t, 0.006, decay, gain)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + decay + 0.05)
  if (harm > 0) {
    const o2 = ctx.createOscillator()
    const g2 = ctx.createGain()
    o2.type = "sine"
    o2.frequency.value = freq * 2
    env(g2, t, 0.004, decay * 0.6, gain * harm)
    o2.connect(g2).connect(out)
    o2.start(t)
    o2.stop(t + decay + 0.05)
  }
}

/** Sustained chord pad from detuned saws. */
function pad(ctx: Ctx, out: Out, t: number, freqs: number[], dur: number, { gain = 0.1, cutoff = 1400 } = {}) {
  const g = ctx.createGain()
  const lp = filter(ctx, "lowpass", cutoff)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(1.2, dur * 0.3))
  g.gain.setValueAtTime(gain, t + dur * 0.7)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  lp.connect(g).connect(out)
  for (const f of freqs) {
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator()
      o.type = "sawtooth"
      o.frequency.value = f
      o.detune.value = detune
      o.connect(lp)
      o.start(t)
      o.stop(t + dur + 0.1)
    }
  }
}

const strings = (ctx: Ctx, out: Out, t: number, freqs: number[], dur: number, { gain = 0.13 } = {}) =>
  pad(ctx, out, t, freqs, dur, { gain, cutoff: 2600 })

/* ---------------- note helpers ---------------- */

/** MIDI note number → Hz. 60 = middle C. */
const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

const MAJOR_PENT = [0, 2, 4, 7, 9]

type Chord = [number, number, number]
type Progression = [Chord, Chord, Chord, Chord]

/** Four-bar chord progressions as semitone offsets from the root. */
const PROGRESSIONS: Record<"warm" | "emotive" | "uplifting" | "hymn", Progression> = {
  warm: [
    [0, 4, 7],
    [5, 9, 12],
    [7, 11, 14],
    [5, 9, 12],
  ], // I IV V IV
  emotive: [
    [0, 3, 7],
    [8, 12, 15],
    [5, 8, 12],
    [7, 10, 14],
  ], // i VI iv v
  uplifting: [
    [0, 4, 7],
    [9, 12, 16],
    [5, 9, 12],
    [7, 11, 14],
  ], // I vi IV V
  hymn: [
    [0, 4, 7],
    [5, 9, 12],
    [0, 4, 7],
    [7, 11, 14],
  ],
}

const chordAt = (p: Progression, bar: number): Chord => p[bar % 4]!
const voiced = (c: Chord, root: number) => c.map((s) => hz(root + s))

/* ---------------- the library ---------------- */

export type Mood =
  | "Ceremonial"
  | "Afrobeats"
  | "Amapiano"
  | "Highlife"
  | "Percussion"
  | "Cinematic"
  | "Gospel"
  | "Romantic"
  | "High energy"
  | "Ambient"

type Key = "C" | "D" | "E" | "F" | "G" | "A" | "Bb" | "—"

export interface LibraryTrack {
  id: string
  name: string
  mood: Mood
  /** Exact by construction, so the beat grid is exact too. */
  bpm: number
  key: Key
  blurb: string
  build: (ctx: Ctx, out: Out, bars: number, spb: number, root: number) => void
}

export const LIBRARY: LibraryTrack[] = [
  {
    id: "gold-processional",
    name: "Gold Processional",
    mood: "Ceremonial",
    bpm: 72,
    key: "C",
    blurb: "Strings and piano. For the vows and the first look.",
    build: (ctx, out, bars, spb, root) => {
      const prog = PROGRESSIONS.emotive
      for (let b = 0; b < bars; b++) {
        const t = b * spb * 4
        const c = chordAt(prog, b)
        const chord = voiced(c, root)
        strings(ctx, out, t, chord, spb * 4, { gain: 0.14 })
        // piano arpeggio across the bar
        ;[...chord, chord[0]! * 2].forEach((f, i) =>
          pluck(ctx, out, t + i * spb, f, { gain: 0.13, decay: 1.1, type: "sine", harm: 0.25 }),
        )
        if (b % 2 === 0) bass(ctx, out, t, hz(root - 12 + c[0]), spb * 3.6, { gain: 0.22 })
      }
    },
  },
  {
    id: "lagos-gold",
    name: "Lagos Gold",
    mood: "Afrobeats",
    bpm: 102,
    key: "A",
    blurb: "Percussive and warm. The default for a Nigerian reel.",
    build: (ctx, out, bars, spb, root) => {
      const prog = PROGRESSIONS.warm
      for (let b = 0; b < bars; b++) {
        const t = b * spb * 4
        const c = chordAt(prog, b)
        const chord = voiced(c, root)
        pad(ctx, out, t, chord, spb * 4, { gain: 0.07, cutoff: 1100 })
        // afrobeats kick pattern: 1, 2&, 4
        ;[0, 1.5, 3].forEach((p) => kick(ctx, out, t + p * spb, { gain: 0.95 }))
        ;[1, 3].forEach((p) => clap(ctx, out, t + p * spb, { gain: 0.34 }))
        for (let i = 0; i < 8; i++) shaker(ctx, out, t + i * spb * 0.5, { gain: i % 2 ? 0.07 : 0.13 })
        ;[0.75, 2.25, 3.5].forEach((p) => drum(ctx, out, t + p * spb, { gain: 0.3, from: 460, to: 200 }))
        bass(ctx, out, t, hz(root - 24 + c[0]), spb * 1.6, { gain: 0.3 })
        bass(ctx, out, t + spb * 2.5, hz(root - 24 + c[0]), spb * 1.2, { gain: 0.26 })
        chord.forEach((f, i) => pluck(ctx, out, t + (0.5 + i * 0.75) * spb, f * 2, { gain: 0.1, decay: 0.35 }))
      }
    },
  },
  {
    id: "amapiano-dusk",
    name: "Amapiano Dusk",
    mood: "Amapiano",
    bpm: 112,
    key: "F",
    blurb: "Log drums and space. Reception, after dark.",
    build: (ctx, out, bars, spb, root) => {
      const prog = PROGRESSIONS.emotive
      for (let b = 0; b < bars; b++) {
        const t = b * spb * 4
        const chord = voiced(chordAt(prog, b), root)
        pad(ctx, out, t, chord, spb * 4, { gain: 0.075, cutoff: 1500 })
        ;[0, 1, 2, 3].forEach((p) => kick(ctx, out, t + p * spb, { gain: 0.8, decay: 0.28 }))
        // the log-drum signature: off-beat, descending
        ;[1.5, 1.75, 2.5, 3.25].forEach((p, i) => logDrum(ctx, out, t + p * spb, { gain: 0.5, freq: 72 - i * 5 }))
        for (let i = 0; i < 8; i++) hat(ctx, out, t + (i + 0.5) * spb * 0.5, { gain: 0.11, open: i % 4 === 3 })
        ;[1, 3].forEach((p) => clap(ctx, out, t + p * spb, { gain: 0.26 }))
        chord.forEach((f, i) => pluck(ctx, out, t + (2 + i * 0.5) * spb, f, { gain: 0.09, decay: 0.7, type: "sine" }))
      }
    },
  },
  {
    id: "highlife-morning",
    name: "Highlife Morning",
    mood: "Highlife",
    bpm: 96,
    key: "G",
    blurb: "Guitar figures and light percussion. Preparation, daylight.",
    build: (ctx, out, bars, spb, root) => {
      const prog = PROGRESSIONS.uplifting
      for (let b = 0; b < bars; b++) {
        const t = b * spb * 4
        const c = chordAt(prog, b)
        pad(ctx, out, t, voiced(c, root), spb * 4, { gain: 0.055, cutoff: 1300 })
        // interlocking guitar: eighths across a pentatonic
        for (let i = 0; i < 8; i++) {
          const deg = MAJOR_PENT[(b * 3 + i * 2) % MAJOR_PENT.length]!
          pluck(ctx, out, t + i * spb * 0.5, hz(root + 12 + deg + c[0]), {
            gain: i % 2 ? 0.08 : 0.13,
            decay: 0.4,
            type: "triangle",
            harm: 0.4,
          })
        }
        ;[0, 2].forEach((p) => kick(ctx, out, t + p * spb, { gain: 0.7 }))
        ;[1, 3].forEach((p) => snare(ctx, out, t + p * spb, { gain: 0.26, tone: 2200 }))
        for (let i = 0; i < 8; i++) shaker(ctx, out, t + i * spb * 0.5, { gain: 0.1 })
        bass(ctx, out, t, hz(root - 24 + c[0]), spb * 2, { gain: 0.26 })
        bass(ctx, out, t + spb * 2, hz(root - 24 + c[2] - 12), spb * 1.8, { gain: 0.22 })
      }
    },
  },
  {
    id: "owambe-drums",
    name: "Owambe Drums",
    mood: "Percussion",
    bpm: 118,
    key: "—",
    blurb: "Drums only. Sits under dialogue and vows without fighting them.",
    build: (ctx, out, bars, spb) => {
      for (let b = 0; b < bars; b++) {
        const t = b * spb * 4
        ;[0, 1.5, 2.5].forEach((p) => kick(ctx, out, t + p * spb, { gain: 0.85 }))
        ;[1, 3].forEach((p) => clap(ctx, out, t + p * spb, { gain: 0.4 }))
        // talking-drum style call and response
        const call = b % 2 === 0 ? [0.5, 0.75, 1.25] : [2.25, 2.75, 3.25, 3.5]
        call.forEach((p, i) =>
          drum(ctx, out, t + p * spb, { gain: 0.42, from: 520 - i * 60, to: 190 - i * 15, decay: 0.2 }),
        )
        for (let i = 0; i < 16; i++) shaker(ctx, out, t + i * spb * 0.25, { gain: i % 4 === 0 ? 0.14 : 0.07 })
        if (b % 4 === 3) {
          for (let i = 0; i < 6; i++) {
            drum(ctx, out, t + spb * 3 + i * spb * 0.16, { gain: 0.36, from: 600 - i * 55, to: 200, decay: 0.15 })
          }
        }
      }
    },
  },
  {
    id: "cathedral-light",
    name: "Cathedral Light",
    mood: "Cinematic",
    bpm: 60,
    key: "D",
    blurb: "Slow strings, no drums. For the quiet cut.",
    build: (ctx, out, bars, spb, root) => {
      const prog = PROGRESSIONS.hymn
      for (let b = 0; b < bars; b++) {
        const t = b * spb * 4
        const c = chordAt(prog, b)
        const chord = voiced(c, root)
        strings(ctx, out, t, chord, spb * 4.4, { gain: 0.16 })
        strings(
          ctx,
          out,
          t,
          chord.map((f) => f / 2),
          spb * 4.4,
          { gain: 0.09 },
        )
        if (b % 2 === 0) {
          pluck(ctx, out, t + spb * 2, hz(root + 12 + c[2]), { gain: 0.11, decay: 2.2, type: "sine", harm: 0.2 })
        }
      }
    },
  },
  {
    id: "gospel-hands",
    name: "Gospel Hands",
    mood: "Gospel",
    bpm: 88,
    key: "Bb",
    blurb: "Organ, claps and a choir feel. Church ceremonies.",
    build: (ctx, out, bars, spb, root) => {
      const prog = PROGRESSIONS.hymn
      for (let b = 0; b < bars; b++) {
        const t = b * spb * 4
        const c = chordAt(prog, b)
        const chord = voiced(c, root)
        pad(ctx, out, t, chord, spb * 4, { gain: 0.11, cutoff: 2000 })
        pad(
          ctx,
          out,
          t,
          chord.map((f) => f * 2),
          spb * 4,
          { gain: 0.05, cutoff: 3000 },
        )
        ;[0, 2].forEach((p) => kick(ctx, out, t + p * spb, { gain: 0.75 }))
        ;[1, 3].forEach((p) => clap(ctx, out, t + p * spb, { gain: 0.44 }))
        ;[1.5, 3.5].forEach((p) => clap(ctx, out, t + p * spb, { gain: 0.18 }))
        bass(ctx, out, t, hz(root - 24 + c[0]), spb * 3.6, { gain: 0.28 })
      }
    },
  },
  {
    id: "first-dance",
    name: "First Dance",
    mood: "Romantic",
    bpm: 76,
    key: "E",
    blurb: "Piano and soft pad. Slow, unhurried, no percussion until late.",
    build: (ctx, out, bars, spb, root) => {
      const prog = PROGRESSIONS.warm
      for (let b = 0; b < bars; b++) {
        const t = b * spb * 4
        const c = chordAt(prog, b)
        const chord = voiced(c, root)
        pad(ctx, out, t, chord, spb * 4, { gain: 0.08, cutoff: 1200 })
        ;[0, 1.5, 2, 3.5].forEach((p, i) =>
          pluck(ctx, out, t + p * spb, chord[i % chord.length]!, { gain: 0.14, decay: 1.4, type: "sine", harm: 0.3 }),
        )
        bass(ctx, out, t, hz(root - 24 + c[0]), spb * 3.6, { gain: 0.2 })
        if (b >= 4) [1, 3].forEach((p) => snare(ctx, out, t + p * spb, { gain: 0.1, tone: 2600, decay: 0.1 }))
      }
    },
  },
  {
    id: "reception-rush",
    name: "Reception Rush",
    mood: "High energy",
    bpm: 128,
    key: "A",
    blurb: "Four on the floor. The dance-floor section, cut fast.",
    build: (ctx, out, bars, spb, root) => {
      const prog = PROGRESSIONS.uplifting
      for (let b = 0; b < bars; b++) {
        const t = b * spb * 4
        const c = chordAt(prog, b)
        const chord = voiced(c, root)
        pad(ctx, out, t, chord, spb * 4, { gain: 0.08, cutoff: 1800 })
        for (let p = 0; p < 4; p++) kick(ctx, out, t + p * spb, { gain: 1, decay: 0.24 })
        ;[1, 3].forEach((p) => clap(ctx, out, t + p * spb, { gain: 0.42 }))
        for (let i = 0; i < 8; i++) hat(ctx, out, t + (i + 0.5) * spb * 0.5, { gain: 0.14, open: i === 7 })
        for (let i = 0; i < 4; i++) {
          bass(ctx, out, t + i * spb, hz(root - 24 + c[0]), spb * 0.8, { gain: 0.3, type: "triangle" })
        }
        chord.forEach((f, i) =>
          pluck(ctx, out, t + i * 0.5 * spb, f * 2, { gain: 0.1, decay: 0.3, type: "square", harm: 0 }),
        )
      }
    },
  },
  {
    id: "still-room",
    name: "Still Room",
    mood: "Ambient",
    bpm: 84,
    key: "C",
    blurb: "Barely there. Use when the captions are doing the work.",
    build: (ctx, out, bars, spb, root) => {
      for (let b = 0; b < bars; b++) {
        const t = b * spb * 4
        const chord = [0, 7, 12, 16].map((s) => hz(root + s + (b % 2 ? -2 : 0)))
        pad(ctx, out, t, chord, spb * 4.6, { gain: 0.1, cutoff: 900 })
        if (b % 2 === 0) {
          pluck(ctx, out, t + spb * 1.5, hz(root + 24), { gain: 0.06, decay: 2.4, type: "sine", harm: 0.1 })
        }
      }
    },
  },
]

export const MOODS: Mood[] = [...new Set(LIBRARY.map((t) => t.mood))]

const ROOTS: Record<Key, number> = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 57, Bb: 58, "—": 60 }

export interface Track {
  id: string
  name: string
  buffer: AudioBuffer
  bpm: number
  source: "library" | "upload"
  /** 0..1 pulse strength — uploads only; library tempos are exact. */
  confidence?: number
}

/**
 * Render a library track to an AudioBuffer of exactly `seconds`, with a
 * short fade-in and a fade-out over the last 1.5s.
 */
export async function renderTrack(id: string, seconds: number): Promise<Track> {
  const track = LIBRARY.find((t) => t.id === id)
  if (!track) throw new Error(`Unknown track: ${id}`)

  const Offline = window.OfflineAudioContext ?? window.webkitOfflineAudioContext
  if (!Offline) throw new Error("This browser can't render audio offline.")
  const ctx = new Offline(2, Math.ceil(SR * seconds), SR)

  const master = ctx.createGain()
  master.gain.value = 0.9
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 4
  comp.attack.value = 0.004
  master.connect(comp).connect(ctx.destination)

  const spb = 60 / track.bpm // seconds per beat
  const bars = Math.ceil(seconds / (spb * 4)) + 1 // one spare bar, trimmed by length
  track.build(ctx, master, bars, spb, ROOTS[track.key])

  // Fades, applied on the master so every layer is covered.
  master.gain.setValueAtTime(0.0001, 0)
  master.gain.exponentialRampToValueAtTime(0.9, 0.35)
  master.gain.setValueAtTime(0.9, Math.max(0.4, seconds - 1.5))
  master.gain.exponentialRampToValueAtTime(0.0001, seconds)

  const buffer = await ctx.startRendering()
  normalise(buffer)
  return { id, name: track.name, buffer, bpm: track.bpm, source: "library" }
}

/**
 * Even out perceived loudness across the library and guarantee no clipping.
 *
 * Scale toward a target RMS, but never past a peak ceiling — so a dense
 * afrobeats bed and a sparse ambient pad sit at a similar level when you
 * switch between them, while dynamics *within* each track are untouched.
 */
const TARGET_RMS = 0.12
const PEAK_CEILING = 0.89

export function normalise(buffer: AudioBuffer): AudioBuffer {
  let peak = 0
  let sumSq = 0
  let n = 0
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch)
    for (let i = 0; i < d.length; i++) {
      const s = d[i]!
      const v = Math.abs(s)
      if (v > peak) peak = v
      sumSq += s * s
      n++
    }
  }
  if (!n || peak === 0) return buffer

  const rms = Math.sqrt(sumSq / n)
  const gain = Math.min(rms > 0 ? TARGET_RMS / rms : 1, PEAK_CEILING / peak)
  if (Math.abs(gain - 1) < 0.01) return buffer

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch)
    for (let i = 0; i < d.length; i++) d[i] = d[i]! * gain
  }
  return buffer
}

/* ---------------- uploads ---------------- */

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024

export async function decodeUpload(file: File): Promise<Track> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That file is over 40 MB — trim it first.")
  const bytes = await file.arrayBuffer()
  let buffer: AudioBuffer
  try {
    buffer = await audio().decodeAudioData(bytes)
  } catch {
    throw new Error("Couldn't decode that file. Try an MP3, WAV, M4A or OGG.")
  }
  return {
    id: `up_${Date.now().toString(36)}`,
    name: file.name.replace(/\.[^.]+$/, ""),
    buffer,
    bpm: detectBPM(buffer),
    confidence: pulseConfidence(buffer),
    source: "upload",
  }
}

/**
 * BPM estimate from an onset envelope: autocorrelate over 60–180 BPM,
 * refine with parabolic interpolation, then fold into 70–160. Good enough
 * to snap cuts to; not a mastering-grade analysis.
 */
const ENV_HZ = 100 // onset envelope sample rate

function onsetEnvelope(buffer: AudioBuffer): Float32Array | null {
  const raw = buffer.getChannelData(0)
  const win = Math.floor(buffer.sampleRate / ENV_HZ)
  const frames = Math.floor(raw.length / win)
  if (frames < 200) return null

  const energy = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let sum = 0
    for (let i = 0; i < win; i++) {
      const s = raw[f * win + i]!
      sum += s * s
    }
    energy[f] = Math.sqrt(sum / win)
  }

  // Positive change in energy = an onset. Mean-remove so the autocorrelation
  // measures periodicity rather than overall level.
  const onset = new Float32Array(frames)
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, energy[f]! - energy[f - 1]!)
  let mean = 0
  for (let f = 0; f < frames; f++) mean += onset[f]!
  mean /= frames
  for (let f = 0; f < frames; f++) onset[f] = onset[f]! - mean
  return onset
}

function autocorrelate(onset: Float32Array, lag: number): number {
  const L = Math.round(lag)
  const frames = onset.length
  if (L < 2 || L >= frames) return 0
  let sum = 0
  for (let f = 0; f + L < frames; f++) sum += onset[f]! * onset[f + L]!
  return sum / (frames - L)
}

export function detectBPM(buffer: AudioBuffer): number {
  const onset = onsetEnvelope(buffer)
  if (!onset) return 100
  const ac = (lag: number) => autocorrelate(onset, lag)
  const toBpm = (lag: number) => (60 * ENV_HZ) / lag
  const toLag = (bpm: number) => (60 * ENV_HZ) / bpm

  const minLag = Math.round(toLag(180))
  const maxLag = Math.round(toLag(60))

  let bestLag = minLag
  let best = Number.NEGATIVE_INFINITY
  for (let lag = minLag; lag <= maxLag; lag++) {
    const score = ac(lag)
    if (score > best) {
      best = score
      bestLag = lag
    }
  }

  // Parabolic interpolation for sub-bin precision.
  const y0 = ac(bestLag - 1)
  const y1 = ac(bestLag)
  const y2 = ac(bestLag + 1)
  const denom = y0 - 2 * y1 + y2
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0
  const refined = bestLag + (Math.abs(shift) < 1 ? shift : 0)

  let bpm = toBpm(refined)
  while (bpm < 70) bpm *= 2
  while (bpm > 160) bpm /= 2
  return Math.round(bpm)
}

/**
 * How much periodic structure the envelope actually has, 0..1. Near zero
 * means pads and sustains with no clear pulse — any BPM we report for it is
 * a guess, and the UI should say so.
 */
export function pulseConfidence(buffer: AudioBuffer): number {
  const onset = onsetEnvelope(buffer)
  if (!onset) return 0
  let energy = 0
  for (let f = 0; f < onset.length; f++) energy += onset[f]! * onset[f]!
  if (energy <= 0) return 0

  const zero = energy / onset.length
  let peak = 0
  for (let lag = Math.round((ENV_HZ * 60) / 190); lag <= Math.round(ENV_HZ); lag++) {
    peak = Math.max(peak, autocorrelate(onset, lag))
  }
  return Math.max(0, Math.min(1, peak / zero))
}

/** Peak envelope for drawing a waveform, `bins` values in 0..1. */
export function waveform(buffer: AudioBuffer, bins = 240): number[] {
  const d = buffer.getChannelData(0)
  const step = Math.floor(d.length / bins) || 1
  const out: number[] = []
  let max = 0.0001
  for (let b = 0; b < bins; b++) {
    let peak = 0
    const start = b * step
    for (let i = 0; i < step; i += 4) {
      const v = Math.abs(d[start + i] ?? 0)
      if (v > peak) peak = v
    }
    out.push(peak)
    if (peak > max) max = peak
  }
  return out.map((v) => v / max)
}

/**
 * Beat times in seconds across `duration`, given a BPM and an offset.
 * `every` = 1 for beats, 2 for half-bars, 4 for bars.
 */
export function beatGrid(bpm: number, duration: number, { offset = 0, every = 1 } = {}): number[] {
  const spb = (60 / bpm) * every
  const times: number[] = []
  for (let t = offset; t < duration - 0.05; t += spb) times.push(+t.toFixed(3))
  return times
}

/* ---------------- playback ---------------- */

/** Plays a buffer in sync with the reel's clock. One voice at a time. */
export class Player {
  private buffer: AudioBuffer | null = null
  private node: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private dest: MediaStreamAudioDestinationNode | null = null
  volume = 0.8
  /** Start offset into the track, seconds. */
  trim = 0

  load(buffer: AudioBuffer | null) {
    this.stop()
    this.buffer = buffer
  }

  private ensure(): { ctx: AudioContext; gain: GainNode; dest: MediaStreamAudioDestinationNode } {
    const ctx = audio()
    if (!this.gain || !this.dest) {
      this.gain = ctx.createGain()
      this.gain.connect(ctx.destination)
      this.dest = ctx.createMediaStreamDestination()
      this.gain.connect(this.dest)
    }
    this.gain.gain.value = this.volume
    return { ctx, gain: this.gain, dest: this.dest }
  }

  /** Start playback `from` seconds into the reel timeline. */
  play(from = 0) {
    if (!this.buffer) return
    const { ctx, gain } = this.ensure()
    this.stop()
    const node = ctx.createBufferSource()
    node.buffer = this.buffer
    node.loop = true
    node.loopStart = this.trim
    node.loopEnd = this.buffer.duration
    node.connect(gain)
    node.start(0, Math.min(this.buffer.duration - 0.01, this.trim + from))
    this.node = node
  }

  stop() {
    if (!this.node) return
    try {
      this.node.stop()
    } catch {
      // already stopped
    }
    this.node.disconnect()
    this.node = null
  }

  setVolume(v: number) {
    this.volume = v
    if (this.gain) this.gain.gain.value = v
  }

  /** The audio track to mux into a canvas recording. */
  exportTrack(): MediaStreamTrack | null {
    return this.ensure().dest.stream.getAudioTracks()[0] ?? null
  }
}
