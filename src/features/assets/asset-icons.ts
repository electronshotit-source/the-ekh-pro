import {
  Briefcase,
  Camera,
  Clapperboard,
  FileText,
  GalleryHorizontal,
  ListChecks,
  type LucideIcon,
  Mail,
  MonitorPlay,
  Music2,
  Pin,
  Quote,
  Smartphone,
  Tags,
  Type,
} from "lucide-react"

import type { Platform } from "@/lib/engine/generators"
import type { AssetKind } from "@/lib/engine/types"

export const ASSET_ICONS: Record<AssetKind, LucideIcon> = {
  carousel: GalleryHorizontal,
  story: Smartphone,
  caption: Type,
  pinterest: Pin,
  bts: Camera,
  reel: Clapperboard,
  tiktok: Music2,
  shorts: MonitorPlay,
  blog: FileText,
  newsletter: Mail,
  linkedin: Briefcase,
  testimonial: Quote,
  vendorsheet: Tags,
  shotlist: ListChecks,
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  linkedin: "LinkedIn",
  email: "Email",
  web: "Website",
  print: "Print",
}
