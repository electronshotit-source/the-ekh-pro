import type { Metadata } from "next"

import { PlanPage } from "@/features/billing/plan-page"

export const metadata: Metadata = { title: "Plan & settings" }

export default function Page() {
  return <PlanPage />
}
