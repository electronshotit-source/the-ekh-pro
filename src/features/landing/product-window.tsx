"use client"

import { Clapperboard, Images, Pause, Sparkles } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"

import { Segmented } from "@/components/segmented"
import { tween } from "@/lib/motion"
import { cn } from "@/lib/utils"

type Tab = "selects" | "assets" | "reel"

/* Illustrative frames — gradients in the palette of a real reception, not photographs. */
const FRAMES = [
  { bg: "from-[#f0d9b8] to-[#8b5e3c]", score: 91, role: "Hero" },
  { bg: "from-[#f3e6cf] to-[#c9a227]", score: 84, role: "Detail" },
  { bg: "from-[#dfe6ef] to-[#3c4a5e]", score: 79, role: "Wide" },
  { bg: "from-[#e8c9a0] to-[#6b4226]", score: 88, role: "Portrait" },
  { bg: "from-[#2a1f1a] to-[#c9a227]", score: 76, role: "Party" },
  { bg: "from-[#f7f0e2] to-[#8a7c4f]", score: 72, role: "Detail" },
  { bg: "from-[#241a20] to-[#d4832f]", score: 81, role: "Party" },
  { bg: "from-[#f5e0c0] to-[#a0704a]", score: 86, role: "Closer" },
]
const REJECTS = [
  { bg: "from-[#c9d6e0] to-[#2e3a4a]", why: "Soft" },
  { bg: "from-[#1c1a24] to-[#b4552d]", why: "Duplicate" },
]

function Selects() {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-[1fr_9rem]">
      <ul className="grid grid-cols-4 gap-2">
        {FRAMES.map((f, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...tween, delay: i * 0.04 }}
            className={cn(
              "relative aspect-[4/5] rounded-lg bg-gradient-to-br",
              f.bg,
              i === 0 && "ring-2 ring-brand ring-offset-2",
            )}
          >
            <span className="tabular absolute top-1.5 left-1.5 grid size-4 place-items-center rounded bg-black/55 text-[0.55rem] text-white">
              {i + 1}
            </span>
            <span className="tabular absolute top-1.5 right-1.5 rounded bg-success-soft px-1 text-[0.55rem] font-semibold text-success">
              {f.score}
            </span>
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1 text-[0.55rem] font-medium text-white">
              {f.role}
            </span>
          </motion.li>
        ))}
      </ul>
      <div className="hidden flex-col gap-2 sm:flex">
        <p className="text-[0.65rem] font-medium tracking-wide text-ink-3 uppercase">Left out</p>
        {REJECTS.map((r) => (
          <div
            key={r.why}
            className={cn("relative aspect-[4/3] rounded-lg bg-gradient-to-br opacity-50 grayscale", r.bg)}
          >
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1 text-[0.55rem] font-medium text-white">
              {r.why}
            </span>
          </div>
        ))}
        <p className="mt-auto text-[0.65rem] text-ink-2">
          <span className="tabular font-semibold text-ink">312</span> frames →{" "}
          <span className="tabular font-semibold text-ink">10</span> selects
        </p>
      </div>
    </div>
  )
}

function Assets() {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-[10rem_1fr]">
      <ul className="hidden flex-col gap-1.5 sm:flex">
        {["Instagram carousel", "Instagram Reel", "Blog article", "Pinterest pins", "Email newsletter"].map((a, i) => (
          <li
            key={a}
            className={cn(
              "rounded-lg px-2.5 py-2 text-[0.7rem]",
              i === 0 ? "bg-brand-soft font-medium text-brand" : "bg-layer-1 text-ink-2",
            )}
          >
            {a}
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-stroke-strong">
        <div className="flex items-center justify-between border-b border-stroke-strong px-3 py-2">
          <p className="text-[0.7rem] font-semibold text-ink">Instagram carousel · 10 slides</p>
          <span className="rounded bg-layer-1 px-1.5 py-0.5 text-[0.6rem] text-ink-2">Luxury editorial</span>
        </div>
        <div className="flex gap-1.5 px-3 pt-3">
          {FRAMES.slice(0, 5).map((f, i) => (
            <div key={i} className={cn("aspect-[4/5] flex-1 rounded-md bg-gradient-to-br", f.bg)} />
          ))}
        </div>
        <p className="px-3 pt-3 pb-1 text-[0.72rem] leading-relaxed text-ink">
          Some galleries you edit. This one you just get out of the way of.
        </p>
        <p className="px-3 pb-3 text-[0.72rem] leading-relaxed text-ink-2">
          Igba Nkwu in Lagos, and the isiagu alone deserved its own post. Low, deliberate light, gold and amber running
          through it…
        </p>
        <div className="flex flex-wrap gap-1 border-t border-stroke-strong px-3 py-2">
          {["#igbawedding", "#igbanwu", "#lagosweddings", "#nigerianwedding"].map((t) => (
            <span key={t} className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[0.6rem] text-brand">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ReelTab() {
  const cuts = [1.6, 1, 0.9, 1, 0.75, 0.75, 1, 1.5]
  return (
    <div className="grid items-center gap-4 p-4 sm:grid-cols-[8.5rem_1fr]">
      <div className="relative mx-auto aspect-[9/16] w-32 overflow-hidden rounded-xl bg-gradient-to-b from-[#7a5a44] to-[#20160f] shadow-md">
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-[#f0d9b8]/50 to-transparent"
          animate={{ scale: [1.02, 1.12] }}
          transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
        />
        <p className="absolute inset-x-2 bottom-8 text-center font-serif text-sm text-white">They said yes.</p>
        <div className="absolute inset-x-2 bottom-3 h-0.5 rounded-full bg-white/25">
          <motion.div
            className="h-full origin-left rounded-full bg-brand"
            animate={{ scaleX: [0, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[0.7rem] text-ink-2">
          <span className="grid size-6 place-items-center rounded-full bg-ink text-surface">
            <Pause className="size-3" />
          </span>
          Lagos Gold · 102 BPM · cuts on the beat
        </div>
        <div className="flex h-9 gap-0.5 overflow-hidden rounded-md">
          {cuts.map((w, i) => (
            <div key={i} className={cn("bg-gradient-to-br", FRAMES[i]!.bg)} style={{ flex: w }} />
          ))}
        </div>
        <div className="relative flex h-7 items-center gap-px overflow-hidden rounded-md bg-layer-1 px-px">
          {Array.from({ length: 64 }, (_, i) => (
            <span
              key={i}
              className="flex-1 rounded-full bg-brand/45"
              style={{ height: `${20 + Math.abs(Math.sin(i * 1.7)) * 70}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/** The hero's product window: three tabs, three moments of the workflow. */
export function ProductWindow() {
  const [tab, setTab] = useState<Tab>("selects")

  return (
    <div className="rounded-2xl border border-stroke-strong bg-surface shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke-strong px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-layer-2" />
          <span className="size-2.5 rounded-full bg-layer-2" />
          <span className="size-2.5 rounded-full bg-layer-2" />
        </div>
        <Segmented
          label="Product preview"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            {
              value: "selects",
              label: (
                <>
                  <Images className="size-3.5" /> Selects
                </>
              ),
            },
            {
              value: "assets",
              label: (
                <>
                  <Sparkles className="size-3.5" /> Assets
                </>
              ),
            },
            {
              value: "reel",
              label: (
                <>
                  <Clapperboard className="size-3.5" /> Reel Lab
                </>
              ),
            },
          ]}
        />
        <span className="hidden text-xs text-ink-3 sm:block">Adaeze & Tobenna</span>
      </div>
      <div className="min-h-72">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={tween}
          >
            {tab === "selects" ? <Selects /> : tab === "assets" ? <Assets /> : <ReelTab />}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 border-t border-stroke-strong px-4 py-3">
        <Sparkles className="size-3.5 text-brand" aria-hidden />
        <p className="truncate text-xs text-ink-2">“Give me a luxury Nigerian wedding Instagram carousel.”</p>
      </div>
    </div>
  )
}
