"use client"

import { PLANS, billingStore, type Usage } from "@/lib/engine/billing"
import { useExternalStore } from "@/lib/hooks/use-external-store"

const SERVER: Usage = { plan: "starter", month: "", assets: 0, weddings: 0 }

/** The current plan and this month's usage, live. */
export function usePlan() {
  const usage = useExternalStore(billingStore, SERVER)
  const plan = PLANS[usage.plan]
  const limit = plan.assetsPerMonth
  const unlimited = !Number.isFinite(limit)
  return {
    usage,
    plan,
    unlimited,
    remaining: unlimited ? Number.POSITIVE_INFINITY : Math.max(0, limit - usage.assets),
    pct: unlimited ? 0 : Math.min(1, usage.assets / limit),
  }
}
