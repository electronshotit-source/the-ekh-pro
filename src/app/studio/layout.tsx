import type { Metadata } from "next"

import { StudioShell } from "@/features/shell/studio-shell"

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · the EKH pro" },
  robots: { index: false },
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <StudioShell>{children}</StudioShell>
}
