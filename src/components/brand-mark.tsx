import Link from "next/link"

import { cn } from "@/lib/utils"

/** The wordmark. `href` makes it a home link. */
export function BrandMark({ className, href = "/" }: { className?: string; href?: string | null }) {
  const mark = (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-lg bg-ink font-serif text-[1.05rem] text-white italic"
      >
        e
      </span>
      <span className="text-[0.95rem] font-semibold tracking-tight">
        the <span className="font-serif text-[1.1rem] font-normal italic">EKH</span> pro
      </span>
    </span>
  )
  if (!href) return mark
  return (
    <Link href={href} className="rounded-md" aria-label="the EKH pro — home">
      {mark}
    </Link>
  )
}
