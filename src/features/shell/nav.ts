import { BookImage, Clapperboard, CreditCard, Images, type LucideIcon, Palette, Sparkles, Upload } from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Which count to show as a badge, if any. */
  badge?: "selects" | "outputs"
  /** Needs an imported gallery to be useful. */
  needsGallery?: boolean
}

export const NAV: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Wedding",
    items: [
      { href: "/studio", label: "Gallery", icon: Upload },
      { href: "/studio/selects", label: "Selects", icon: Images, badge: "selects", needsGallery: true },
      { href: "/studio/assets", label: "Assets", icon: Sparkles, badge: "outputs", needsGallery: true },
      { href: "/studio/reel", label: "Reel Lab", icon: Clapperboard, needsGallery: true },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/studio/library", label: "Library", icon: BookImage },
      { href: "/studio/brand", label: "Brand kit", icon: Palette },
      { href: "/studio/plan", label: "Plan & settings", icon: CreditCard },
    ],
  },
]

export const isActive = (pathname: string, href: string) =>
  href === "/studio" ? pathname === "/studio" : pathname.startsWith(href)
