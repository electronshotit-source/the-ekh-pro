import type { Metadata } from "next"
import { Suspense } from "react"

import { AssetsPage, AssetsSkeleton } from "@/features/assets/assets-page"

export const metadata: Metadata = { title: "Assets" }

export default function Page() {
  return (
    <Suspense fallback={<AssetsSkeleton />}>
      <AssetsPage />
    </Suspense>
  )
}
