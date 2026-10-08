import type { Metadata } from "next"
import { Suspense } from "react"

import { ReelLabPage, ReelSkeleton } from "@/features/reel/reel-lab"

export const metadata: Metadata = { title: "Reel Lab" }

export default function Page() {
  return (
    <Suspense fallback={<ReelSkeleton />}>
      <ReelLabPage />
    </Suspense>
  )
}
