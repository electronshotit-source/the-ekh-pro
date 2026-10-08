"use client"

import { Menu } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { BrandMark } from "@/components/brand-mark"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useStudio } from "@/lib/studio/store"

import { Composer } from "./composer"
import { SidebarContent } from "./sidebar"

/** Routes where the prompt bar earns its space. */
const COMPOSER_ROUTES = new Set(["/studio", "/studio/selects", "/studio/assets"])

export function StudioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const boot = useStudio((s) => s.boot)
  const [menuOpen, setMenuOpen] = useState(false)

  // Reopen whatever wedding was open last, so a reload doesn't lose work.
  useEffect(() => {
    void boot()
  }, [boot])

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-stroke-strong bg-layer-1 lg:block">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-(--z-nav) flex h-14 items-center justify-between border-b border-stroke-strong bg-surface/90 px-4 backdrop-blur lg:hidden">
          <BrandMark />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-layer-1 p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Studio navigation</SheetDescription>
              <SidebarContent onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        <main id="main" className="flex flex-1 flex-col">
          <div className="flex-1">{children}</div>
          {COMPOSER_ROUTES.has(pathname) && <Composer />}
        </main>
      </div>
    </div>
  )
}
