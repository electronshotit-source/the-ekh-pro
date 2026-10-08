import type { Metadata } from "next"
import { Suspense } from "react"

import { GridSkeleton, SelectsPage } from "@/features/selects/selects-page"

export const metadata: Metadata = { title: "Selects" }

export default function Page() {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <SelectsPage />
    </Suspense>
  )
}
