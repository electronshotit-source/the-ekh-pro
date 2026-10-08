"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"

import { usePlan } from "./use-plan"

/** Sidebar footer: plan name, assets used, and a way up. */
export function UsageMeter({ className }: { className?: string }) {
  const { plan, usage, unlimited, pct } = usePlan()
  const near = pct >= 0.8

  return (
    <div className={cn("rounded-xl border border-stroke-strong bg-surface p-3 shadow-xs", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink">{plan.name} plan</p>
        <Link href="/studio/plan" className="text-xs font-medium text-brand underline-offset-4 hover:underline">
          {plan.id === "atelier" ? "Manage" : "Upgrade"}
        </Link>
      </div>
      <p className="tabular mt-1 text-xs text-ink-2">
        {unlimited
          ? `${usage.assets} assets this month · unlimited`
          : `${usage.assets} of ${plan.assetsPerMonth} assets this month`}
      </p>
      {!unlimited && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-layer-2"
          role="progressbar"
          aria-label="Assets used this month"
          aria-valuemin={0}
          aria-valuemax={plan.assetsPerMonth}
          aria-valuenow={usage.assets}
        >
          <div
            className={cn(
              "h-full origin-left rounded-full transition-transform duration-300",
              near ? "bg-warning" : "bg-brand",
            )}
            style={{ transform: `scaleX(${pct})` }}
          />
        </div>
      )}
    </div>
  )
}
