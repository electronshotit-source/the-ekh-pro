"use client"

import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { ClaudeSettings } from "@/features/ai/claude-settings"
import { PLANS, naira, setPlan } from "@/lib/engine/billing"

import { PricingTable } from "./pricing-table"
import { usePlan } from "./use-plan"

export function PlanPage() {
  const { plan, usage, unlimited } = usePlan()

  const stats = [
    { label: "Assets this month", value: unlimited ? `${usage.assets}` : `${usage.assets} / ${plan.assetsPerMonth}` },
    {
      label: "Weddings this month",
      value: Number.isFinite(plan.weddingsPerMonth)
        ? `${usage.weddings} / ${plan.weddingsPerMonth}`
        : `${usage.weddings}`,
    },
    { label: "Longest Reel", value: `${plan.reelSeconds}s` },
    { label: "Export quality", value: `${plan.exportHeight}p` },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Plan & settings"
        title={`${plan.name} · ${naira(plan.price)}/month`}
        description="Usage resets on the first of every month."
      />
      <div className="flex flex-col gap-12 px-4 py-8 sm:px-8">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-stroke-strong p-4">
              <dt className="text-xs text-ink-2">{s.label}</dt>
              <dd className="tabular mt-1 text-xl font-semibold text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="plans-h">
          <h2 id="plans-h" className="text-sm font-semibold text-ink">
            Plans
          </h2>
          <p className="mt-1 mb-6 text-sm text-ink-2">
            Payments aren’t connected in this preview, so switching takes effect immediately and nothing is charged.
          </p>
          <PricingTable
            mode="app"
            current={plan.id}
            onChoose={(id) => {
              setPlan(id)
              toast.success(`You're on ${PLANS[id].name}`)
            }}
          />
        </section>

        <section aria-labelledby="claude-h" className="max-w-3xl">
          <h2 id="claude-h" className="text-sm font-semibold text-ink">
            Live writing with Claude
          </h2>
          <p className="mt-1 mb-5 text-sm text-ink-2">
            Optional. Assets are written instantly on your device; Claude can rewrite any of them in your house voice.
          </p>
          <ClaudeSettings />
        </section>
      </div>
    </>
  )
}
