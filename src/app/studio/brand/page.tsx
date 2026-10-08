import type { Metadata } from "next"

import { BrandPage } from "@/features/brand/brand-page"

export const metadata: Metadata = { title: "Brand kit" }

export default function Page() {
  return <BrandPage />
}
