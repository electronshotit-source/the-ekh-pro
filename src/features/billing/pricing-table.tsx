"use client"

import { Check } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Segmented } from "@/components/segmented"
import { Button } from "@/components/ui/button"
import { ANNUAL_DISCOUNT, PLANS, PLAN_ORDER, type PlanId, monthlyPrice, naira } from "@/lib/engine/billing"
import { cn } from "@/lib/utils"

/**
 * Three tiers with a monthly/annual switch. On the landing page every
 * button leads into the studio; inside the app it switches plan.
 */
export function PricingTable({
  mode,
  current,
  onChoose,
}: {
  mode: "marketing" | "app"
  current?: PlanId
  onChoose?: (id: PlanId) => void
}) {
  const [annual, setAnnual] = useState(false)

  return (
    <div>
      <div className="flex justify-center">
        <Segmented
          label="Billing period"
          value={annual ? "annual" : "monthly"}
          onChange={(v) => setAnnual(v === "annual")}
          options={[
            { value: "monthly", label: "Monthly" },
            {
              value: "annual",
              label: (
                <>
                  Annual <span className="text-success">−{Math.round(ANNUAL_DISCOUNT * 100)}%</span>
                </>
              ),
            },
          ]}
        />
      </div>

      <ul className="mt-8 grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((id, i) => {
          const plan = PLANS[id]
          const price = monthlyPrice(plan, annual)
          const isCurrent = mode === "app" && current === id
          const prev = i > 0 ? PLANS[PLAN_ORDER[i - 1]!] : null
          return (
            <li
              key={id}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-2xl border bg-surface",
                plan.featured ? "border-brand shadow-lg ring-1 ring-brand" : "border-stroke-strong shadow-xs",
              )}
            >
              {plan.featured && (
                <p className="bg-brand py-1.5 text-center text-xs font-medium text-on-accent">Most popular</p>
              )}
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
                  {isCurrent && (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                      Current plan
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-2">{plan.blurb}</p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="tabular text-4xl font-semibold tracking-tight text-ink">{naira(price)}</span>
                  <span className="text-sm text-ink-2">/month</span>
                </p>
                <p className="tabular mt-1 h-4 text-xs text-ink-2">
                  {annual ? `Billed ${naira(price * 12)} yearly` : "Billed monthly · cancel anytime"}
                </p>
                <p className="mt-5 rounded-lg bg-layer-1 px-3 py-2 text-xs text-ink-2">
                  <span className="font-medium text-ink">Recommended for:</span> {plan.forWho}
                </p>

                <p className="mt-5 text-xs font-medium text-ink">
                  {prev ? `Everything in ${prev.name}, plus:` : "Includes:"}
                </p>
                <ul className="mt-2.5 flex flex-1 flex-col gap-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm text-ink-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {mode === "marketing" ? (
                    <Button asChild size="xl" variant={plan.featured ? "default" : "outline"} className="w-full">
                      <Link href="/studio">Start with {plan.name}</Link>
                    </Button>
                  ) : (
                    <Button
                      size="xl"
                      variant={plan.featured && !isCurrent ? "default" : "outline"}
                      className="w-full"
                      disabled={isCurrent}
                      onClick={() => onChoose?.(id)}
                    >
                      {isCurrent ? "Your plan" : `Switch to ${plan.name}`}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
