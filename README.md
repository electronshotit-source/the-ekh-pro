# the EKH pro

The social media engine for wedding photographers. Upload a wedding gallery; the app scores every frame, picks
and sequences the strongest, and writes the campaign — Instagram carousel, Reel, TikTok, Story sequence, captions,
Pinterest pins, behind-the-scenes post, client testimonial, blog article, newsletter, YouTube Shorts, LinkedIn post,
vendor tag sheet and client shot list.

Plain-English requests work from the prompt bar (⌘K):

- “Give me a luxury Nigerian wedding Instagram carousel.”
- “Turn this wedding into a 30-second Reel.”
- “Draft the blog article and 6 Pinterest pins.”

Everything runs in the browser. Photos are analysed and stored on the device (IndexedDB) and never uploaded.
Optional live rewriting uses Claude with the user's own Anthropic API key; Claude receives the wedding details and
the analysis results, never the images.

## Stack

Next.js 16 (App Router, Turbopack, Cache Components) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
shadcn/ui on Radix · Motion · Zustand · nuqs · Vitest.

## Structure

```
src/
  app/              routes — "/" (landing) and /studio/* (the app)
  features/         one folder per product area: gallery, selects, assets, reel,
                    library, brand, billing, ai, shell, landing
  lib/engine/       framework-free domain logic: vision scoring, curation,
                    generators, music synthesis, reel renderer, persistence
  lib/studio/       the client store for the open wedding
  components/       shared UI; components/ui holds the shadcn primitives
```

Dependencies point one way: `app → features → lib`.

## Develop

```bash
npm install
npm run dev
npm run check   # typecheck + lint + unit tests
```

## Deploy

Vercel runs it natively (`next build`). For a static host such as GitHub Pages:

```bash
STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/repo-name npm run build   # writes out/
```

## Billing

Plans (₦5,000 / ₦12,000 / ₦20,000 a month) gate usage in the client only — no payment is taken. Wire plan changes to
Paystack or Flutterwave server-side and set the plan from a verified webhook before charging anyone.
