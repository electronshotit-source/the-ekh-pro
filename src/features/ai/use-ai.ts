"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import * as ai from "@/lib/engine/ai"
import * as brand from "@/lib/engine/brand"
import { ASSET_LABELS } from "@/lib/engine/generators"
import type { Output } from "@/lib/engine/types"
import { useExternalStore } from "@/lib/hooks/use-external-store"
import { useStudio } from "@/lib/studio/store"

const SERVER: ai.AiConfig = { enabled: false, model: "claude-opus-5", apiKey: "" }

export function useAiConfig() {
  const cfg = useExternalStore(ai.aiStore, SERVER)
  return { ...cfg, ready: cfg.enabled && cfg.apiKey.length > 0 }
}

/**
 * Rewrite an output's main copy block with Claude, streaming into local
 * state and committing to the store only when the response completes — so
 * a refusal or network error leaves the original copy untouched.
 */
export function useRewrite(output: Output) {
  const [streamText, setStreamText] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const updateOutput = useStudio((s) => s.updateOutput)

  useEffect(() => () => abort.current?.abort(), [])

  const target = output.blocks.findIndex((b) => b.t === "copy")

  async function rewrite() {
    const { wedding, profile, selects } = useStudio.getState()
    if (!profile || target < 0) return
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setStreamText("")
    try {
      const text = await ai.write(
        {
          wedding: { ...wedding, tone: output.tone },
          profile,
          selects,
          asset: ASSET_LABELS[output.kind],
          instruction: ai.INSTRUCTIONS[output.kind],
          voice: brand.voiceRules(),
          signal: ctrl.signal,
        },
        (snapshot) => setStreamText(snapshot),
      )
      updateOutput(output.id, (o) => ({
        ...o,
        blocks: o.blocks.map((b, i) =>
          i === target && b.t === "copy"
            ? { ...b, text: brand.applyVoice(text), label: `${b.label ?? "Copy"} · Claude` }
            : b,
        ),
      }))
      toast.success("Rewritten with Claude")
    } catch (err) {
      if (!ctrl.signal.aborted) toast.error(ai.describeError(err))
    } finally {
      if (abort.current === ctrl) abort.current = null
      setStreamText(null)
    }
  }

  return { rewrite, streaming: streamText !== null, streamText, target, cancel: () => abort.current?.abort() }
}
