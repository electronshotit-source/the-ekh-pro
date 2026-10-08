"use client"

import { Clapperboard, Copy, MoreHorizontal, Printer, RefreshCw, Sparkles, Square, Trash2 } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAiConfig, useRewrite } from "@/features/ai/use-ai"
import { copyText } from "@/lib/clipboard"
import { TONES } from "@/lib/engine/lexicon"
import type { Block, Output } from "@/lib/engine/types"
import { rise } from "@/lib/motion"
import { printText } from "@/lib/print"
import { useShotMap, useStudio } from "@/lib/studio/store"
import { cn } from "@/lib/utils"

import { ASSET_ICONS } from "./asset-icons"
import { BeatsBlock, CarouselFrame, CopyBlock, NoteBlock, PinsBlock, SlidesBlock, TagsBlock } from "./blocks"

/** Everything in an output as one paste-ready string. */
function flatten(o: Output): string {
  return o.blocks
    .flatMap((b): string[] => {
      if (b.t === "copy") return [b.label ? `— ${b.label} —\n${b.text}` : b.text]
      if (b.t === "tags") return [b.tags.join(" ")]
      if (b.t === "pins") return b.pins.map((p) => `${p.title}\n${p.desc}`)
      return []
    })
    .join("\n\n")
}

const time = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

export function OutputCard({ output, focused }: { output: Output; focused?: boolean }) {
  const shots = useShotMap()
  const handle = useStudio((s) => s.wedding.handle)
  const { generate, removeOutput, updateOutput } = useStudio.getState()
  const aiCfg = useAiConfig()
  const { rewrite, streaming, streamText, target, cancel } = useRewrite(output)
  const Icon = ASSET_ICONS[output.kind]

  const regenerate = () => {
    try {
      generate([output.kind], { tone: output.tone, variant: useStudio.getState().outputs.length + 1 })
      removeOutput(output.id)
      toast.success("New variation ready")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't regenerate.")
    }
  }

  const editBlock = (index: number) => (text: string) =>
    updateOutput(output.id, (o) => ({
      ...o,
      blocks: o.blocks.map((b, i): Block => (i === index && b.t === "copy" ? { ...b, text } : b)),
    }))

  return (
    <motion.article
      id={`output-${output.id}`}
      variants={rise}
      initial="hidden"
      animate="show"
      className={cn(
        "scroll-mt-6 rounded-2xl border bg-surface shadow-xs transition-shadow",
        focused ? "border-brand/50 shadow-md ring-4 ring-brand/10" : "border-stroke-strong",
      )}
      aria-labelledby={`output-${output.id}-title`}
    >
      <header className="flex items-start gap-3 border-b border-stroke-strong px-4 py-3.5 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`output-${output.id}-title`} className="truncate text-sm font-semibold text-ink">
            {output.title}
          </h3>
          <p className="truncate text-xs text-ink-2">
            {output.subtitle} · {TONES[output.tone].label} · <span className="tabular">{time(output.createdAt)}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {aiCfg.ready &&
            target >= 0 &&
            (streaming ? (
              <Button size="sm" variant="outline" onClick={cancel}>
                <Square />
                Stop
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void rewrite()}>
                <Sparkles />
                <span className="hidden sm:inline">Rewrite with Claude</span>
                <span className="sm:hidden">Claude</span>
              </Button>
            ))}
          <Button size="sm" variant="ghost" onClick={() => void copyText(flatten(output), "Asset copied")}>
            <Copy />
            <span className="hidden sm:inline">Copy</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={regenerate}>
                <RefreshCw />
                New variation
              </DropdownMenuItem>
              {output.printable && (
                <DropdownMenuItem onSelect={() => printText(output.printable!.title, output.printable!.body)}>
                  <Printer />
                  Print
                </DropdownMenuItem>
              )}
              {output.blocks.some((b) => b.t === "beats") && (
                <DropdownMenuItem asChild>
                  <Link href="/studio/reel">
                    <Clapperboard />
                    Open in Reel Lab
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => removeOutput(output.id)}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        {output.blocks.map((b, i) => {
          switch (b.t) {
            case "note":
              return <NoteBlock key={i} text={b.text} />
            case "copy":
              return (
                <CopyBlock
                  key={`${i}-${b.text.length}`}
                  label={b.label}
                  text={streaming && i === target ? (streamText ?? "") : b.text}
                  streaming={streaming && i === target}
                  onEdit={editBlock(i)}
                />
              )
            case "tags":
              return <TagsBlock key={i} tags={b.tags} />
            case "slides":
              return output.kind === "carousel" ? (
                <CarouselFrame key={i} slides={b.slides} shots={shots} handle={handle} />
              ) : (
                <SlidesBlock key={i} slides={b.slides} shots={shots} tall={output.kind === "story"} />
              )
            case "pins":
              return <PinsBlock key={i} pins={b.pins} shots={shots} />
            case "beats":
              return <BeatsBlock key={i} beats={b.beats} shots={shots} />
          }
        })}
        {aiCfg.ready && (
          <p className="text-[0.7rem] text-ink-3">Claude can make mistakes — read it through before you post.</p>
        )}
      </div>
    </motion.article>
  )
}
