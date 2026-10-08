"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CULTURES, TONES } from "@/lib/engine/lexicon"
import type { CultureId, ToneId, Wedding } from "@/lib/engine/types"
import { useStudio } from "@/lib/studio/store"

const CULTURE_IDS = Object.keys(CULTURES) as CultureId[]
const TONE_IDS = Object.keys(TONES) as ToneId[]

function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 text-xs font-medium text-ink-2">
        {label}
      </Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-2">
          {hint}
        </p>
      )}
    </div>
  )
}

/** The details every asset is written from. Saves as you type. */
export function WeddingForm() {
  const wedding = useStudio((s) => s.wedding)
  const setWedding = useStudio((s) => s.setWedding)

  const text = (key: keyof Wedding) => ({
    id: `w-${key}`,
    value: wedding[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setWedding({ [key]: e.target.value }),
  })

  return (
    <form className="grid grid-cols-2 gap-x-3 gap-y-4" onSubmit={(e) => e.preventDefault()}>
      <Field id="w-bride" label="Bride">
        <Input {...text("bride")} autoComplete="off" placeholder="Adaeze" />
      </Field>
      <Field id="w-groom" label="Groom">
        <Input {...text("groom")} autoComplete="off" placeholder="Tobenna" />
      </Field>
      <Field id="w-venue" label="Venue" className="col-span-2 sm:col-span-1">
        <Input {...text("venue")} placeholder="Balmoral Convention Centre" />
      </Field>
      <Field id="w-city" label="City" className="col-span-2 sm:col-span-1">
        <Input {...text("city")} placeholder="Lagos" />
      </Field>

      <Field id="w-culture" label="Culture pack">
        <Select value={wedding.culture} onValueChange={(v) => setWedding({ culture: v as CultureId })}>
          <SelectTrigger id="w-culture" className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CULTURE_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {CULTURES[id].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="w-tone" label="Tone">
        <Select value={wedding.tone} onValueChange={(v) => setWedding({ tone: v as ToneId })}>
          <SelectTrigger id="w-tone" className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONE_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {TONES[id].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field id="w-date" label="Date">
        <Input {...text("date")} type="date" />
      </Field>
      <Field id="w-handle" label="Your handle">
        <Input
          {...text("handle")}
          placeholder="@yourstudio"
          autoComplete="off"
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v && !v.startsWith("@")) setWedding({ handle: `@${v}` })
          }}
        />
      </Field>

      <Field
        id="w-vendors"
        label="Vendors"
        hint="Comma-separated “Role: Name”. Used for credits and the tag sheet."
        className="col-span-2"
      >
        <Textarea
          {...text("vendors")}
          rows={2}
          aria-describedby="w-vendors-hint"
          placeholder="Planner: Trina Events, Dress: Yartel Bridal"
        />
      </Field>
    </form>
  )
}
