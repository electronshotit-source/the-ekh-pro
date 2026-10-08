"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { BrandMark } from "@/components/brand-mark"
import { UsageMeter } from "@/features/billing/usage-meter"
import { useStudio } from "@/lib/studio/store"
import { cn } from "@/lib/utils"

import { NAV, isActive } from "./nav"
import { WeddingSwitcher } from "./wedding-switcher"

/** Grouped app navigation. Rendered in the desktop rail and the mobile sheet. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const hasGallery = useStudio((s) => s.phase === "ready")
  const selects = useStudio((s) => s.selects.length)
  const outputs = useStudio((s) => s.outputs.length)
  const counts = { selects, outputs }

  return (
    <div className="flex h-full flex-col gap-5 p-3">
      <div className="px-1.5 pt-1.5">
        <BrandMark />
      </div>
      <WeddingSwitcher />

      <nav aria-label="Studio" className="flex flex-1 flex-col gap-5">
        {NAV.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pb-1.5 text-[0.7rem] font-medium tracking-wide text-ink-3 uppercase">{group.label}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href)
                const dim = item.needsGallery && !hasGallery
                const count = item.badge ? counts[item.badge] : 0
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                        active
                          ? "bg-layer-2 font-medium text-ink ring-1 ring-stroke-strong"
                          : "text-ink-2 hover:bg-layer-2 hover:text-ink",
                        dim && !active && "text-ink-3",
                      )}
                    >
                      <item.icon
                        className={cn("size-4 shrink-0", active ? "text-brand" : "text-current")}
                        aria-hidden
                      />
                      <span className="flex-1">{item.label}</span>
                      {count > 0 && (
                        <span className="tabular rounded-md bg-layer-2 px-1.5 text-xs text-ink-2 group-aria-[current=page]:bg-brand-soft group-aria-[current=page]:text-brand">
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <UsageMeter />
    </div>
  )
}
