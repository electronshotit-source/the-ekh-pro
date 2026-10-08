/**
 * Subscription tiers and quota gating.
 *
 * This is the entitlement layer only: it decides what the UI allows. It
 * deliberately does not take payment — wire plan changes to Paystack or
 * Flutterwave server-side and flip the plan from a verified webhook. A
 * client-side plan flag is trivially editable; never trust it for money.
 */
import { createExternalStore } from "./external-store"

export type PlanId = "starter" | "studio" | "atelier"

export interface Plan {
  id: PlanId
  name: string
  /** Monthly price in naira. */
  price: number
  featured?: boolean
  blurb: string
  /** Who should pick this plan — answers "which one is me?" first. */
  forWho: string
  assetsPerMonth: number
  weddingsPerMonth: number
  reelSeconds: number
  exportHeight: number
  /** Feature lines new at this tier (the previous tier's are implied). */
  features: string[]
}

/** Annual billing discount, as offered on the original landing page. */
export const ANNUAL_DISCOUNT = 0.2

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 5000,
    blurb: "Everything you need to post every wedding you shoot.",
    forWho: "Solo photographers shooting a couple of weddings a month",
    assetsPerMonth: 40,
    weddingsPerMonth: 4,
    reelSeconds: 30,
    exportHeight: 1280,
    features: [
      "40 generated assets a month",
      "4 weddings a month",
      "All 14 asset types",
      "Automatic scoring & selects",
      "Reel Lab up to 30 seconds",
      "720p video export",
    ],
  },
  studio: {
    id: "studio",
    name: "Studio",
    price: 12000,
    featured: true,
    blurb: "For a working studio with a full season booked.",
    forWho: "Studios publishing several weddings a week",
    assetsPerMonth: 200,
    weddingsPerMonth: 20,
    reelSeconds: 60,
    exportHeight: 1920,
    features: [
      "200 generated assets a month",
      "20 weddings a month",
      "Reel Lab up to 60 seconds",
      "1080p video export",
      "Logo watermark on Reels",
      "Saved brand voice",
    ],
  },
  atelier: {
    id: "atelier",
    name: "Atelier",
    price: 20000,
    blurb: "For teams with second shooters, editors and a content lead.",
    forWho: "Teams with an editor or content person",
    assetsPerMonth: Number.POSITIVE_INFINITY,
    weddingsPerMonth: Number.POSITIVE_INFINITY,
    reelSeconds: 90,
    exportHeight: 1920,
    features: [
      "Unlimited assets & weddings",
      "Reel Lab up to 90 seconds",
      "Priority generation",
      "Bring your own Claude API key",
      "5 team seats",
    ],
  },
}

export const PLAN_ORDER: PlanId[] = ["starter", "studio", "atelier"]

export interface Usage {
  plan: PlanId
  month: string
  assets: number
  weddings: number
}

const monthKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS

// Same key as the original app, so plans and usage carry over.
export const billingStore = createExternalStore<Usage>(
  "aso.billing.v1",
  // `month` stays empty until hydrated in the browser — reading the clock at
  // import time would trip Next's prerender checks.
  { plan: "starter", month: "", assets: 0, weddings: 0 },
  (raw, defaults) => {
    if (!raw || typeof raw !== "object") return { ...defaults, month: monthKey() }
    const r = raw as Partial<Usage>
    const plan = isPlanId(r.plan) ? r.plan : "starter"
    // A new month resets usage but keeps the plan.
    if (r.month !== monthKey()) return { plan, month: monthKey(), assets: 0, weddings: 0 }
    return {
      plan,
      month: r.month,
      assets: Number(r.assets) || 0,
      weddings: Number(r.weddings) || 0,
    }
  },
)

export const current = (): Plan => PLANS[billingStore.get().plan]
export const usage = (): Usage => billingStore.get()

export const setPlan = (plan: PlanId) => billingStore.set({ plan })

/** Can we generate `n` more assets this month? */
export const canGenerate = (n = 1) => billingStore.get().assets + n <= current().assetsPerMonth

export const remainingAssets = () => current().assetsPerMonth - billingStore.get().assets

export const recordAssets = (n = 1) => billingStore.set((u) => ({ ...u, assets: u.assets + n }))
export const recordWedding = () => billingStore.set((u) => ({ ...u, weddings: u.weddings + 1 }))

export const maxReelSeconds = () => current().reelSeconds
export const exportHeight = () => current().exportHeight

export const monthlyPrice = (plan: Plan, annual: boolean) =>
  annual ? Math.round(plan.price * (1 - ANNUAL_DISCOUNT)) : plan.price

export const naira = (n: number) => (Number.isFinite(n) ? `₦${n.toLocaleString("en-NG")}` : "Unlimited")
