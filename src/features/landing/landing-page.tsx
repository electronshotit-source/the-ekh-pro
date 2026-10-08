import {
  ArrowRight,
  Clapperboard,
  Lock,
  MessageSquareText,
  Palette,
  ScanFace,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react"
import Link from "next/link"

import { BrandMark } from "@/components/brand-mark"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { ASSET_ICONS, PLATFORM_LABELS } from "@/features/assets/asset-icons"
import { PricingTable } from "@/features/billing/pricing-table"
import { ASSETS, ASSET_GROUPS, type AssetGroup } from "@/lib/engine/generators"
import { ALL_ASSETS } from "@/lib/engine/prompt"

import { ProductWindow } from "./product-window"

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#assets", label: "What you get" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
]

const STATS = [
  { value: "14", label: "asset types from one gallery" },
  { value: "10", label: "licence-free music beds" },
  { value: "0", label: "photos uploaded to a server" },
  { value: "₦5,000", label: "a month to start" },
]

const STEPS = [
  {
    icon: Upload,
    title: "Drop in the whole gallery",
    body: "Every frame you delivered. Nothing to tag, nothing to sort. Analysis runs in your browser.",
  },
  {
    icon: ScanFace,
    title: "The engine picks your selects",
    body: "Each frame is scored for focus, exposure, faces and composition. Soft frames and burst duplicates are set aside, and the strongest are sequenced into a story.",
  },
  {
    icon: MessageSquareText,
    title: "Ask for what you need",
    body: "“Turn this wedding into a 30-second Reel.” “The blog post and six pins.” Plain English in, ready-to-post assets out.",
  },
]

const FEATURES = [
  {
    icon: Clapperboard,
    title: "A Reel editor that cuts on the beat",
    body: "Pick a bed from the library — Afrobeats, amapiano, highlife, gospel, strings — or upload your own song. Cuts snap to the music, captions burn in, and the Reel exports at up to 1080p.",
  },
  {
    icon: Palette,
    title: "Your voice, not a template's",
    body: "Set house rules, words you never use and a signature once. Every caption follows them, and your logo watermarks every Reel.",
  },
  {
    icon: Sparkles,
    title: "Copy that knows the culture",
    body: "Culture packs for Yoruba, Igbo, Hausa, Ghanaian and destination weddings. The copy names the gele, the Igba Nkwu, the spraying — not “the special day”.",
  },
  {
    icon: Lock,
    title: "Your clients' photos stay yours",
    body: "Images are analysed and stored on your own device. Turn on Claude for live rewrites and it sees the wedding details — never the pictures.",
  },
]

const FAQ = [
  {
    q: "Do my photos get uploaded anywhere?",
    a: "No. Scoring, face detection, sequencing and Reel rendering all happen in your browser, and weddings are saved in your browser's own storage. Nothing is sent to a server.",
  },
  {
    q: "How does it choose the strongest images?",
    a: "Every frame is measured for sharpness, exposure, contrast, colour, composition and how prominent the people are. Near-identical bursts are collapsed to the best frame. You can pin a frame to force it in or exclude one to keep it out.",
  },
  {
    q: "Can I use my own music?",
    a: "Yes. Upload an MP3, WAV, M4A or OGG and the tempo is detected so cuts land on the beat. The built-in library is synthesised in your browser, so it carries no licence fees or Content ID claims.",
  },
  {
    q: "What does Claude add?",
    a: "Assets are written instantly without it. If you add your own Anthropic API key, any asset can be rewritten live by Claude in your house voice.",
  },
  {
    q: "Can I change plans later?",
    a: "Any time. Usage resets on the first of each month, and annual billing saves 20%.",
  },
]

const GROUP_ORDER: AssetGroup[] = ["social", "video", "longform", "client"]

export function LandingPage() {
  return (
    <div className="bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-modal) focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-md"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-(--z-nav) border-b border-stroke-strong/70 bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <BrandMark />
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex gap-1">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="rounded-lg px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-layer-1 hover:text-ink"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <Button asChild variant="dark">
            <Link href="/studio">Open the studio</Link>
          </Button>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-[32rem] bg-[radial-gradient(60%_60%_at_50%_0%,var(--accent-1-bg),transparent)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:pt-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-stroke-strong bg-surface px-3 py-1 text-xs text-ink-2 shadow-xs">
                <span className="size-1.5 animate-pulse-soft rounded-full bg-brand" aria-hidden />
                The social media engine for wedding photographers
              </p>
              <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
                One wedding in. <br className="hidden sm:block" />A whole{" "}
                <span className="font-serif font-normal text-brand italic">campaign</span> out.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-pretty text-ink-2">
                Upload the gallery. The EKH pro picks your strongest frames and writes the carousel, the Reel, the
                TikTok, the blog post, the pins and the newsletter — in your voice, in minutes.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="xl">
                  <Link href="/studio">
                    <Wand2 />
                    Try it with a sample wedding
                  </Link>
                </Button>
                <Button asChild size="xl" variant="outline">
                  <a href="#pricing">See pricing</a>
                </Button>
              </div>
              <p className="mt-4 text-sm text-ink-2">No sign-up to try. Your photos never leave your device.</p>
            </div>
            <ProductWindow />
          </div>
        </section>

        {/* Stats */}
        <section aria-label="At a glance" className="border-y border-stroke-strong bg-layer-1">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <dd className="tabular text-3xl font-semibold tracking-tight text-ink">{s.value}</dd>
                <dt className="mt-1 text-sm text-ink-2">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <SectionIntro
            eyebrow="How it works"
            title={
              <>
                From delivery to <span className="font-serif font-normal italic">posted</span>, before the couple stops
                sharing it.
              </>
            }
            body="The hours between delivering a gallery and posting about it are where most studios lose momentum. This is the part we do for you."
          />
          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-stroke-strong p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="tabular font-serif text-3xl text-ink-3 italic">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-base font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Asset catalog */}
        <section id="assets" className="scroll-mt-20 border-y border-stroke-strong bg-layer-1">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <SectionIntro
              eyebrow="What you get"
              title={
                <>
                  Fourteen assets. <span className="font-serif font-normal italic">One</span> upload.
                </>
              }
              body="Each one is shaped for where it lives — a TikTok is cut differently from a Reel, a pin is written for search, a LinkedIn post is aimed at planners who refer."
            />
            <div className="mt-14 grid gap-8 md:grid-cols-2">
              {GROUP_ORDER.map((g) => (
                <div key={g}>
                  <h3 className="text-xs font-medium tracking-wide text-ink-3 uppercase">{ASSET_GROUPS[g].label}</h3>
                  <ul className="mt-3 flex flex-col gap-2">
                    {ALL_ASSETS.filter((k) => ASSETS[k].group === g).map((k) => {
                      const Icon = ASSET_ICONS[k]
                      return (
                        <li
                          key={k}
                          className="flex items-start gap-3 rounded-xl border border-stroke-strong bg-surface p-3.5 shadow-xs"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-ink">{ASSETS[k].label}</p>
                              <span className="flex gap-1">
                                {ASSETS[k].platforms.map((p) => (
                                  <span key={p} className="rounded bg-layer-1 px-1.5 py-0.5 text-[0.65rem] text-ink-2">
                                    {PLATFORM_LABELS[p]}
                                  </span>
                                ))}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm text-ink-2">{ASSETS[k].blurb}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionIntro
            eyebrow="Why studios switch"
            title={
              <>
                Less time posting. More time <span className="font-serif font-normal italic">shooting</span>.
              </>
            }
          />
          <ul className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-white">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-y border-stroke-strong bg-layer-1">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <SectionIntro
              eyebrow="Pricing"
              title={
                <>
                  Priced in <span className="font-serif font-normal italic">naira</span>, for the season you&apos;ve
                  booked.
                </>
              }
              body="Every plan includes all fourteen asset types and the full music library."
              center
            />
            <div className="mt-12">
              <PricingTable mode="marketing" />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-24 sm:px-6">
          <SectionIntro eyebrow="FAQ" title="Questions photographers ask" center />
          <Accordion type="single" collapsible className="mt-10">
            {FAQ.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-base">{f.q}</AccordionTrigger>
                <AccordionContent className="text-ink-2">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Closing CTA */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink px-6 py-16 text-center sm:px-12">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
              Your last wedding deserves more than <span className="font-serif font-normal italic">one</span> post.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">
              Try the whole workflow on a sample wedding. No account, no upload, two minutes.
            </p>
            <Button asChild size="xl" className="mt-8">
              <Link href="/studio">
                Open the studio
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-stroke-strong">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <BrandMark />
          <p>Built for wedding photographers in Lagos, Abuja, Accra and everywhere they travel.</p>
        </div>
      </footer>
    </div>
  )
}

function SectionIntro({
  eyebrow,
  title,
  body,
  center,
}: {
  eyebrow: string
  title: React.ReactNode
  body?: string
  center?: boolean
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-sm font-medium text-brand">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-lg text-pretty text-ink-2">{body}</p>}
    </div>
  )
}
