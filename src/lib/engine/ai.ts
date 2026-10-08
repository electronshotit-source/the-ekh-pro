/**
 * Optional live copywriting via the Claude API.
 *
 * The engine works fully offline; this is an upgrade path. Claude gets the
 * *derived facts* about the gallery (what the pixel analysis found, which
 * frames were selected and why) plus the wedding details — never the images.
 *
 * This runs in the browser with the user's own key, which is why the client
 * sets `dangerouslyAllowBrowser`: fine for a bring-your-own-key tool, wrong
 * for a hosted key. A production deployment should proxy through a server
 * so no key ever reaches a browser.
 */
import Anthropic from "@anthropic-ai/sdk"

import { createExternalStore } from "./external-store"
import type { AssetKind, Profile, Select, Wedding } from "./types"

export type ClaudeModel = "claude-opus-5" | "claude-sonnet-5" | "claude-haiku-4-5"

export const MODELS: Array<{ id: ClaudeModel; label: string; note: string }> = [
  { id: "claude-opus-5", label: "Claude Opus 5", note: "Best writing quality" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "Faster, lower cost" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "Fastest" },
]

export interface AiConfig {
  enabled: boolean
  model: ClaudeModel
  apiKey: string
}

const isModel = (v: unknown): v is ClaudeModel => MODELS.some((m) => m.id === v)

// Same key as the original app, so a saved key carries over.
export const aiStore = createExternalStore<AiConfig>(
  "aso.ai.v1",
  { enabled: false, model: "claude-opus-5", apiKey: "" },
  (raw, d) => {
    if (!raw || typeof raw !== "object") return d
    const r = raw as Partial<AiConfig>
    return {
      enabled: Boolean(r.enabled),
      model: isModel(r.model) ? r.model : d.model,
      apiKey: typeof r.apiKey === "string" ? r.apiKey : "",
    }
  },
)

export const isEnabled = () => {
  const c = aiStore.get()
  return c.enabled && c.apiKey.length > 0
}

const client = (apiKey: string) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

const SYSTEM = `You are the copywriter for a wedding photography studio. You write the studio's social captions, blog posts and pitch copy.

Voice rules:
- Write as the photographer, first person, no corporate register.
- Be specific. Name the fabric, the ritual, the room, the light. Generic wedding copy is the thing the studio is paying to avoid.
- No emoji unless the requested tone is playful. At most one.
- No "in this day and age", no "little did they know", no rhetorical questions as openers.
- Never invent a fact you were not given: no vendor names, no guest counts, no quotes from the couple, no weather. If a detail would strengthen the copy and you do not have it, write around it.
- Match the requested tone exactly. Luxury means restrained, not ornate.

Return ONLY the requested copy. No preamble, no explanation, no markdown fences unless the asset is the blog article (which is Markdown).`

function factSheet(wedding: Wedding, profile: Profile, selects: Select[], asset: string): string {
  return [
    `ASSET REQUESTED: ${asset}`,
    "",
    "WEDDING",
    `  Couple: ${[wedding.bride, wedding.groom].filter(Boolean).join(" & ") || "not given"}`,
    `  Venue: ${wedding.venue || "not given"}`,
    `  City: ${wedding.city || "not given"}`,
    `  Date: ${wedding.date || "not given"}`,
    `  Culture pack: ${wedding.culture}`,
    `  Requested tone: ${wedding.tone}`,
    `  Studio handle: ${wedding.handle || "not given"}`,
    `  Vendors to credit: ${wedding.vendors || "none given"}`,
    "",
    "WHAT THE IMAGE ANALYSIS FOUND (derived from the actual pixels — you may reference this)",
    `  Frames shot: ${profile.total}`,
    `  Frames that passed technical review: ${profile.usable}`,
    `  Rejected as soft or badly exposed: ${profile.rejected}`,
    `  Near-duplicate frames collapsed: ${profile.duplicates}`,
    `  Overall light: ${profile.mood}`,
    `  Palette: ${profile.palette}`,
    `  Colour intensity: ${profile.saturation}`,
    `  Shot mix: ${
      Object.entries(profile.counts)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ") || "unknown"
    }`,
    "",
    "SELECTED FRAMES, IN SEQUENCE",
    ...selects.map((s, i) => `  ${i + 1}. [${s.role}] ${s.note} (score ${s.m.score}/100, ${s.m.type})`),
  ].join("\n")
}

export interface WriteRequest {
  wedding: Wedding
  profile: Profile
  selects: Select[]
  asset: string
  instruction: string
  /** Studio house rules from the brand kit, if any. */
  voice: string | null
  signal?: AbortSignal
}

/**
 * Stream one asset's copy from Claude. `onText` receives the running text.
 * Rejects on refusal or an empty response so the caller keeps the local copy.
 */
export async function write(
  { wedding, profile, selects, asset, instruction, voice, signal }: WriteRequest,
  onText?: (snapshot: string) => void,
): Promise<string> {
  const cfg = aiStore.get()
  if (!cfg.enabled || !cfg.apiKey) throw new Error("Live AI is not enabled.")

  // House rules go in a second system block, after the cached one, so the
  // base prompt stays byte-identical across studios and keeps its cache hit.
  const system: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
    { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
  ]
  if (voice) {
    system.push({
      type: "text",
      text: `STUDIO HOUSE RULES — these override the general guidance above:\n${voice}`,
    })
  }

  const stream = client(cfg.apiKey).beta.messages.stream(
    {
      model: cfg.model,
      max_tokens: 16000,
      system,
      output_config: { effort: "medium" },
      // A declined request is re-run on Anthropic's recommended fallback
      // model inside the same call, instead of failing the asset outright.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [
        {
          role: "user",
          content: `${factSheet(wedding, profile, selects, asset)}\n\nTASK\n${instruction}`,
        },
      ],
    },
    { signal },
  )

  if (onText) stream.on("text", (_delta, snapshot) => onText(snapshot))
  const message = await stream.finalMessage()

  // A refusal is an HTTP 200 with little or no content — check before trusting it.
  if (message.stop_reason === "refusal") {
    throw new Error("The model declined this request. Kept the local copy.")
  }
  const text = message.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim()
  if (!text) throw new Error("Empty response from the model.")
  return text
}

/** Cheap round-trip to validate the key and model. */
export async function ping(): Promise<string> {
  const cfg = aiStore.get()
  const message = await client(cfg.apiKey).messages.create({
    model: cfg.model,
    max_tokens: 32,
    // Thinking is on by default on Opus 5; a one-word reply doesn't need it,
    // and it would otherwise eat the tiny token budget.
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: "Reply with the single word: ready" }],
  })
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("")
  return text.trim() || "ok"
}

/** Turn SDK errors into one line a photographer can act on. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "That API key was rejected."
  if (err instanceof Anthropic.PermissionDeniedError) return "This key can't use that model."
  if (err instanceof Anthropic.NotFoundError) return "That model isn't available to this key."
  if (err instanceof Anthropic.RateLimitError) return "Rate limited — try again in a minute."
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the Claude API."
  if (err instanceof Anthropic.APIError) return err.message
  if (err instanceof Error) return err.message
  return "Something went wrong."
}

/** The instruction per asset type when live AI is on. */
export const INSTRUCTIONS: Record<AssetKind, string> = {
  carousel:
    "Write the Instagram caption for this carousel. Open with a hook that stops the scroll, name the venue and city, reference one specific cultural detail, and close with a booking call to action. 90–140 words.",
  reel: "Write the Instagram Reel caption. Two to four short lines. Hook first. Close with a booking call to action.",
  tiktok:
    "Write the TikTok caption and the on-screen text for the first frame. The on-screen text must work as a hook in under six words. Keep the caption under 20 words.",
  bts: "Write a behind-the-scenes Instagram caption. Be honest about the difficulty — the light, the timing, the number of frames culled. Do not be self-pitying. 110–160 words.",
  testimonial:
    "Write a testimonial draft in the voice of the couple, for the photographer to send them as a starting point. Warm, specific, not gushing. 60–90 words.",
  caption:
    "Write three captions for the same set of images: one under 15 words, one around 40 words, and one around 130 words. Label them Short, Medium and Long.",
  story:
    "Write the copy for an eight-frame Instagram Story sequence. One short line per frame, numbered, with the frame purpose in brackets.",
  pinterest:
    "Write six Pinterest pins. For each: a keyword-led title under 60 characters and a description of 100–160 characters. Pinterest is a search engine — lead with what someone would type.",
  blog: "Write the full blog article in Markdown: H1 title, an opening paragraph, a section on the day, a section of planning notes for couples, and a closing enquiry line. 500–750 words.",
  newsletter:
    "Write the email that tells the studio mailing list this gallery is live. Subject line, preview text, body, and two calls to action (view the gallery, check your date). 180–260 words.",
  shorts:
    "Write the YouTube Shorts title and description. The title must read like a search query someone would actually type. Description: three short paragraphs plus a booking line.",
  linkedin:
    "Write a LinkedIn post aimed at wedding planners and venues, not couples. Lead with one concrete, useful observation about how the day was scheduled. No hashtag spam, no inspirational filler. 130–190 words.",
  vendorsheet:
    "Write the blog credit line and the Instagram caption block crediting each vendor by role. Do not invent handles you were not given.",
  shotlist:
    "Write a client shot list grouped into: before the ceremony, the ceremony itself, portraits, and reception. Use checkbox bullets. Be specific to the culture pack given.",
}
