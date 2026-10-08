"use client"

import { ImagePlus, RotateCcw, Trash2 } from "lucide-react"
import { useRef } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Segmented } from "@/components/segmented"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import * as brand from "@/lib/engine/brand"
import { useExternalStore } from "@/lib/hooks/use-external-store"
import { cn } from "@/lib/utils"

const MAX_LOGO_BYTES = 1024 * 1024
const SAMPLE = "An absolutely stunning day — truly magical light and a perfect, gorgeous couple."

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-stroke-strong py-8 first:pt-0 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-2">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 text-xs font-medium text-ink-2">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-lg border border-stroke-strong bg-surface p-1"
        />
        <Input
          aria-label={`${label} hex value`}
          value={value}
          onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)}
          className="font-mono uppercase"
        />
      </div>
    </div>
  )
}

export function BrandPage() {
  const kit = useExternalStore(brand.brandStore, brand.BRAND_DEFAULTS)
  const fileInput = useRef<HTMLInputElement>(null)
  const set = brand.set

  const onLogo = (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("That isn't an image file.")
    if (file.size > MAX_LOGO_BYTES) return toast.error("Keep logos under 1 MB — a PNG or SVG export is ideal.")
    const reader = new FileReader()
    reader.onload = () => {
      set({ logo: String(reader.result) })
      toast.success("Logo saved")
    }
    reader.onerror = () => toast.error("Couldn't read that file.")
    reader.readAsDataURL(file)
  }

  const preview = brand.applyVoice(SAMPLE, kit)
  const sig = brand.signature("@yourstudio", kit)
  const pos = {
    tl: "top-3 left-3",
    tr: "top-3 right-3",
    bl: "bottom-12 left-3",
    br: "bottom-12 right-3",
  }[kit.logoPosition]

  return (
    <>
      <PageHeader
        eyebrow="Brand kit"
        title="Make every asset yours"
        description="Applied to every caption, article and Reel. Saved in this browser."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              brand.reset()
              toast("Brand kit reset")
            }}
          >
            <RotateCcw />
            Reset
          </Button>
        }
      />

      <div className="grid gap-10 px-4 py-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <Section
            title="Identity"
            description="Your name and logo. The logo is watermarked on Reels on the Studio plan and up."
          >
            <div>
              <Label htmlFor="studio-name" className="mb-1.5 text-xs font-medium text-ink-2">
                Studio name
              </Label>
              <Input
                id="studio-name"
                value={kit.studioName}
                placeholder="Golden Hour Studio"
                onChange={(e) => set({ studioName: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid size-16 place-items-center overflow-hidden rounded-xl border border-stroke-strong bg-layer-1">
                {kit.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local data URL
                  <img src={kit.logo} alt="Your logo" className="max-h-full max-w-full object-contain p-1.5" />
                ) : (
                  <ImagePlus className="size-5 text-ink-3" aria-hidden />
                )}
              </div>
              <Button variant="outline" onClick={() => fileInput.current?.click()}>
                {kit.logo ? "Replace logo" : "Upload logo"}
              </Button>
              {kit.logo && (
                <Button variant="ghost" onClick={() => set({ logo: null })}>
                  <Trash2 />
                  Remove
                </Button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/svg+xml,image/webp,image/jpeg"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (f) onLogo(f)
                }}
              />
            </div>
            <div className="grid gap-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink-2">Logo position</p>
                <Segmented
                  label="Logo position"
                  size="sm"
                  value={kit.logoPosition}
                  onChange={(logoPosition) => set({ logoPosition })}
                  className="w-full"
                  options={[
                    { value: "tl", label: "Top left" },
                    { value: "tr", label: "Top right" },
                    { value: "bl", label: "Bottom left" },
                    { value: "br", label: "Bottom right" },
                  ]}
                />
              </div>
              <div>
                <p className="mb-3 text-xs font-medium text-ink-2">
                  Opacity <span className="tabular">{Math.round(kit.logoOpacity * 100)}%</span>
                </p>
                <Slider
                  value={[kit.logoOpacity]}
                  min={0.2}
                  max={1}
                  step={0.05}
                  onValueChange={([v]) => set({ logoOpacity: v ?? kit.logoOpacity })}
                  aria-label="Logo opacity"
                />
              </div>
            </div>
          </Section>

          <Section
            title="Colour"
            description="Used for Reel captions, the progress bar and — if you choose — the colour grade."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField id="accent" label="Accent" value={kit.accent} onChange={(accent) => set({ accent })} />
              <ColorField id="ink" label="Caption text" value={kit.ink} onChange={(ink) => set({ ink })} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl bg-layer-1 px-4 py-3">
              <div>
                <Label htmlFor="grade-brand" className="text-sm text-ink">
                  Tint the Reel grade with my accent
                </Label>
                <p className="text-xs text-ink-2">Instead of the stock warm amber.</p>
              </div>
              <Switch
                id="grade-brand"
                checked={kit.gradeFromBrand}
                onCheckedChange={(gradeFromBrand) => set({ gradeFromBrand })}
              />
            </div>
          </Section>

          <Section
            title="Voice"
            description="House rules for every caption. Claude follows them too when live writing is on."
          >
            <div>
              <Label htmlFor="voice" className="mb-1.5 text-xs font-medium text-ink-2">
                House rules
              </Label>
              <Textarea
                id="voice"
                rows={3}
                value={kit.voice}
                placeholder="Short sentences. Never say ‘dream wedding’. Always mention the venue."
                onChange={(e) => set({ voice: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="banned" className="mb-1.5 text-xs font-medium text-ink-2">
                Words to avoid
              </Label>
              <Input
                id="banned"
                value={kit.banned}
                placeholder="stunning, magical, truly"
                aria-describedby="banned-hint"
                onChange={(e) => set({ banned: e.target.value })}
              />
              <p id="banned-hint" className="mt-1 text-xs text-ink-2">
                Comma-separated. Swapped for a plainer word, or removed.
              </p>
            </div>
            <div>
              <Label htmlFor="signature" className="mb-1.5 text-xs font-medium text-ink-2">
                Signature
              </Label>
              <Input
                id="signature"
                value={kit.signature}
                placeholder="— Golden Hour Studio · Lagos & Abuja"
                onChange={(e) => set({ signature: e.target.value })}
              />
            </div>
            <div className="rounded-xl border border-stroke-strong p-4">
              <p className="text-xs font-medium text-ink-2">Preview</p>
              <p className="mt-2 text-sm text-ink-3 line-through decoration-ink-3/50">{SAMPLE}</p>
              <p className="mt-1 text-sm text-ink">{preview}</p>
              {sig && <p className="mt-2 text-sm text-ink-2">{sig}</p>}
            </div>
          </Section>
        </div>

        <aside aria-label="Reel frame preview" className="xl:sticky xl:top-8 xl:self-start">
          <p className="mb-2 text-xs font-medium text-ink-2">On a Reel frame</p>
          <div className="relative mx-auto aspect-[9/16] w-56 overflow-hidden rounded-2xl bg-gradient-to-b from-[#3b2f2a] via-[#7a5a44] to-[#20160f] shadow-lg">
            {kit.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- local data URL
              <img
                src={kit.logo}
                alt=""
                className={cn("absolute w-1/5 object-contain", pos)}
                style={{ opacity: kit.logoOpacity }}
              />
            )}
            <p
              className="absolute inset-x-4 bottom-20 text-center font-serif text-lg leading-tight"
              style={{ color: kit.ink }}
            >
              They said yes.
            </p>
            <div className="absolute inset-x-3 bottom-4 h-0.5 rounded-full bg-white/20">
              <div className="h-full w-2/5 rounded-full" style={{ background: kit.accent }} />
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
