"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ASSET_LABELS } from "@/lib/engine/generators"
import { describe, parse } from "@/lib/engine/prompt"
import { useStudio } from "@/lib/studio/store"

/**
 * Turn a plain-English request into generated assets, then take the user to
 * them. Returns true when something was generated.
 */
export function useRunCommand() {
  const router = useRouter()
  const generate = useStudio((s) => s.generate)

  return (text: string): boolean => {
    const plan = parse(text)
    if (!plan.assets.length) {
      toast("Name an asset and I'll make it", {
        description: "Try “a luxury carousel”, “a 30-second Reel” or “the blog post and 6 pins”.",
      })
      return false
    }
    try {
      const made = generate(plan.assets, {
        ...(plan.tone && { tone: plan.tone }),
        ...(plan.culture && { culture: plan.culture }),
        ...(plan.seconds && { seconds: plan.seconds }),
        ...(plan.count && { count: plan.count }),
      })
      toast.success(describe(plan, ASSET_LABELS) ?? "Generated", {
        description: plan.guessed ? "You didn't name an asset, so I started with a carousel." : undefined,
      })
      if (plan.assets.length === 1 && plan.assets[0] === "reel") {
        router.push(`/studio/reel${plan.seconds ? `?seconds=${plan.seconds}` : ""}`)
      } else {
        router.push(`/studio/assets?focus=${made[0]?.id ?? ""}`)
      }
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate that.")
      return false
    }
  }
}
