# the EKH pro — Social Media Engine for Wedding Photographers

Upload a wedding. The app scores every frame, picks the strongest images,
sequences them into a story, and generates a full social campaign from them.

```bash
python3 serve.py
# → http://localhost:5173
```

No build step, no dependencies, no npm. Vanilla ES modules and Canvas.

You land on the marketing page; **Open the studio** switches to the app, and
**Back to site** in the sidebar returns. Inside the studio, **Load demo wedding**
runs the whole pipeline without uploading anything.

## The landing page

Everything demonstrated on it is driven by the real modules, not mocked up:

- The **hero animation** is a canvas loop of the selection engine — frames
  appearing, a scan sweeping each one, scores landing, winners pulling forward.
- The **asset explorer** calls `engine.js` live. Clicking a tab generates that
  asset in your browser from the demo gallery; the sidebar thumbnails are the
  frames `curator.js` actually selected.
- The **scoring panel** runs `vision.js` over generated frames and shows the
  real bars and verdicts.
- The **track list** is `music.js`'s actual library, and **pricing** comes from
  `billing.js`.

So the landing page cannot drift from the product — if a generator changes, the
page changes with it.

> **Animations are time-based, not frame-based.** `requestAnimationFrame` is
> throttled hard in background tabs and some embedded browsers (it runs at 1 fps
> in the harness this was tested in). A frame-counted typing effect silently
> stalls part-written, so the typing and counters derive their progress from
> elapsed wall-clock time and always land on the finished state.

---

## What it produces

Fourteen asset types from one gallery:

| Asset | What you get |
|---|---|
| Instagram carousel | Up to 10 sequenced slides, caption, hashtag row |
| Instagram Reel | Beat-cut vertical edit + script — playable and exportable |
| TikTok | A different, faster edit: hook-first, built to loop |
| YouTube Shorts | Slower 55s cut written for search rather than the feed |
| Behind-the-scenes | The honest post, using your real cull statistics |
| Client testimonial | A draft to send the couple, plus a publish-ready version |
| Caption | Short, medium and long, in one voice |
| Story sequence | Eight frames across a 24-hour arc |
| Pinterest pins | Six keyword-led pins with titles and descriptions |
| Blog article | ~450–550 words of Markdown plus an SEO metadata block |
| Email newsletter | Gallery-is-live email, two CTAs, four subject lines to A/B |
| LinkedIn post | Vendor-facing, aimed at the planners who make referrals |
| Vendor tag sheet | Every supplier handle, formatted per platform |
| Client shot list | Printable checklist for the planning call |

Ask for them in plain English in the command bar:

- *"Give me a luxury Nigerian wedding Instagram carousel."*
- *"Turn this wedding into a 30-second Reel."*
- *"Draft the blog article and 6 Pinterest pins."*
- *"Write the email newsletter and a LinkedIn post."*
- *"Generate everything."*

The parser reads the asset type, tone, culture pack, duration and counts out of
the sentence and applies them. "YouTube Shorts" resolves to the Shorts asset;
a bare "shorts" resolves to TikTok, which is what people usually mean.

---

## How the image selection actually works

`js/vision.js` analyses every frame in a canvas at 256px and computes:

| Signal | Method |
|---|---|
| Sharpness | Laplacian variance on the luma plane |
| Exposure | 64-bin histogram: tonal spread, midtone placement, clipping penalty |
| Contrast | Luma standard deviation |
| Colour | Hasler–Süsstrunk colourfulness |
| Subject | Skin-tone pixel ratio in YCbCr — works across the full range of skin tones — plus subject centroid |
| Composition | Gradient energy concentrated near the rule-of-thirds intersections |
| Duplicate ID | 64-bit dHash, matched by Hamming distance |

Those combine into a 0–100 score. Frames that are badly soft or badly exposed
are vetoed outright regardless of score.

**Face detection.** Where the browser exposes the `FaceDetector` API, a second
pass replaces the skin-tone proxy with real geometry: shot type is re-derived
from face count and size (four or more faces reads as a party shot, one large
face as a portrait), the human bonus only applies when a face is actually
present, and the Ken Burns anchor moves to the area-weighted face centroid,
biased up to the eyeline. Where the API is missing — which includes most
current Chrome builds — the proxy stands and the Selects panel says so rather
than implying a capability the browser does not have.

`js/curator.js` then collapses bursts (Hamming distance < 11 means "same
moment"), enforces shot-type variety, and sequences the survivors along a
narrative arc — hero → detail → wide → portrait → party → closer — rather than
just sorting by score.

The derived gallery profile (light, palette, saturation, shot mix, cull
statistics) is fed to the copy engine, so a dark, saturated gallery gets
different adjectives from a bright, restrained one.

---

## Reel Lab

`js/reel.js` renders a 9:16 timeline on a canvas: Ken Burns motion biased
toward each frame's detected subject, cross-dissolves, a colour grade, a
vignette, and burnt-in caption beats. The hero shot holds longer; party shots
cut tighter.

Export writes a real `.webm` via `MediaRecorder`. **Recording is real time** —
MediaRecorder timestamps in wall-clock — so a 30-second reel takes 30 seconds
and the tab must stay visible.

---

## Music

**The built-in library is not licensed recordings.** The app *synthesises* ten
instrumental beds with the Web Audio API, rendered offline to exactly the length
your reel needs, with the fade-out landing on the last frame. Nothing to clear,
nothing to get flagged:

| Track | Mood | BPM |
|---|---|---|
| Gold Processional | Ceremonial | 72 |
| First Dance | Romantic | 76 |
| Still Room | Ambient | 84 |
| Gospel Hands | Gospel | 88 |
| Highlife Morning | Highlife | 96 |
| Lagos Gold | Afrobeats | 102 |
| Amapiano Dusk | Amapiano | 112 |
| Owambe Drums | Percussion | 118 |
| Cathedral Light | Cinematic | 60 |
| Reception Rush | High energy | 128 |

Every track is loudness-normalised toward a common RMS with a hard peak
ceiling, so switching between a sparse pad and a dense afrobeats bed doesn't
jump in level, and nothing clips.

**Your own songs** upload via drag-and-drop, decode locally and never leave the
browser. Reel Lab draws the waveform, marks the bar lines, and lets you set the
start point so the drop lands where you want it.

### Cutting on the beat

With a track loaded, cut points snap to the music's beat grid instead of
falling on arbitrary proportions of the runtime. The grid widens with the
rhythm setting — bars for slow edits, beats for fast — so a 60 BPM ballad
doesn't force a cut every second. Cuts land within ~3 ms of the grid, well
inside one frame at 30 fps.

### Tempo is editable, and it needs to be

Library tempos are **exact** — the track was generated at that BPM. Uploaded
tempos are **detected**, and onset-based detection is genuinely unreliable: on
the built-in tracks it lands exactly right on percussive material (128, 112, 96
all exact) and wrong on sparse material, typically by a musical ratio — a
102 BPM loop with a strong dotted pattern reads as 136 (102 × 4/3).

So the tempo field is editable, with ÷2, ×2 and tap-tempo next to it, and the
hint under it tells you which case you are in. That is how every editor handles
this, because auto-detection is a starting point rather than an answer.

### Export

Picture and sound are recorded together into one `.webm`
(`vp9,opus`) — the score is muxed in as a second track on the same
MediaRecorder stream, so they cannot drift.

**Export silent when you're posting to Instagram or TikTok.** Both platforms
match commercial recordings and will mute or block a burnt-in copyrighted
track; they also give far more reach to sounds picked from their own library.
The toggle is right under the tempo control. For a blog embed, a client gallery
or YouTube, burn the audio in.

## Storage

Weddings persist in IndexedDB: photo blobs in one store, the record (form
fields, per-shot metrics, select order, generated assets) in another. Reopening
a wedding does not re-run the analysis — it only re-decodes the images the Reel
needs. The Library is the switcher; the most recent wedding reopens
automatically on load, so a refresh costs nothing.

Metrics live alongside the blobs, which is why a 23-frame wedding with all
fourteen assets is roughly 10 MB. `navigator.storage.estimate()` drives the
usage readout in the Library header.

## Brand kit

Studio identity, applied everywhere:

- **Logo** — watermarked onto Reel previews and exports, four corner positions,
  adjustable opacity. Gated to Studio and above.
- **Palette** — accent colour drives the Reel progress bar and, optionally, the
  colour grade itself instead of the stock amber. Caption ink is configurable.
- **Voice** — free-text house rules plus a banned-word list. The local engine
  swaps banned words for neutral synonyms and repairs the grammar around them
  (`an amazing` → `a remarkable`, `obsessed with` → `taken with`), scoped to
  words it actually changed so legitimate phrasing like "an hour" survives.
  When live AI is on, the same rules go to Claude as a second system block —
  placed after the cached one, so the base prompt keeps its cache hit.
- **Signature** — appended to carousels, captions, BTS, blog and LinkedIn.

## Subscription tiers

| Plan | Price | Assets/month | Reel cap | Export |
|---|---|---|---|---|
| Starter | ₦5,000 | 40 | 30s | 720p |
| Studio | ₦12,000 | 200 | 60s | 1080p |
| Atelier | ₦20,000 | Unlimited | 90s | 1080p |

`js/billing.js` is the **entitlement layer only**. It gates the UI and tracks
monthly usage in `localStorage`. It deliberately does not touch payment.

To take real money, wire the "Choose plan" button to Paystack or Flutterwave
Checkout, verify the transaction server-side, and flip the plan from a verified
webhook. A client-side plan flag is trivially editable — never trust it for
billing.

---

## Optional: live AI copywriting

The engine writes everything locally by default — no key, no network, instant.
Under **Plan → Live AI generation** you can paste an Anthropic API key to route
the copy blocks through Claude Opus 5 instead. The engine hands Claude the
*derived facts* (what the pixel analysis found, which frames were chosen and
why) — the images themselves never leave the browser.

`js/ai.js` calls the Messages API over raw HTTPS with the
`anthropic-dangerous-direct-browser-access` header, because this project has no
build step and no npm. That header is also the warning label: it is fine for a
local tool, not for production. **Ship a backend proxy so the key never reaches
a browser.** The key here is stored only in this browser's `localStorage`.

The client streams the response (so long outputs can't hit an HTTP timeout) and
checks `stop_reason` before trusting the text — a refusal returns HTTP 200 with
empty content, not an error.

---

## Layout

```
index.html          landing page + studio markup
css/app.css         studio styles
css/landing.css     landing page styles
js/landing.js       landing interactions, live demos, entry into the studio
js/vision.js        per-image pixel analysis, scoring, face detection
js/curator.js       de-duplication, variety, narrative sequencing
js/lexicon.js       culture packs, tone packs, hashtag banks
js/engine.js        the fourteen generators
js/prompt.js        natural-language command parsing
js/reel.js          canvas video engine + MediaRecorder export
js/music.js         synthesised track library, upload decode, BPM, beat grid
js/store.js         IndexedDB persistence
js/brand.js         logo, palette, voice rules, signature
js/billing.js       plans, quotas, entitlement gating
js/ai.js            optional Claude API integration
js/demo.js          procedural sample gallery
js/main.js          state, wiring, rendering
serve.py            static file server
```

---

## Known limits

- **The face-detection path is largely untested against a real detector.**
  `FaceDetector` is absent from most current Chrome builds, so in practice the
  skin-tone proxy is what runs. The scoring, classification and centroid logic
  is unit-tested against synthetic face boxes, but it has not been exercised on
  real detections. A WASM face model (BlazeFace via TFJS or MediaPipe) would
  make this reliable everywhere — at the cost of the zero-dependency property.
- **Storage is per-browser and evictable.** IndexedDB is not backup. A user
  clearing site data loses every wedding. Export to a server if it matters.
- **Vendor handles are guessed** from the vendor names by stripping
  non-alphanumerics. The sheet says so, but check them before publishing.
- **BPM detection on uploads is a starting estimate, not an answer.** It is
  reliable on material with clear transients and unreliable on pads and
  sustains, where it typically lands on a musical multiple of the true tempo.
  Correct it with ÷2 / ×2 / Tap. A proper fix would be a spectral-flux onset
  detector with a dynamic-programming beat tracker, which is a far larger piece
  of work than the rest of this file.
- **Uploaded songs are session-scoped.** Unlike photos, audio buffers are not
  written to IndexedDB — a 5-minute WAV is larger than an entire wedding
  gallery. Re-upload after a refresh, or store the decoded buffer as compressed
  audio if you need it to persist.
- **Reel export is real time and webm-only.** Safari's MediaRecorder support is
  weaker than Chrome's; for MP4 you would need a WASM encoder.
- **The demo gallery is procedurally generated abstract shapes**, so the copy it
  produces is about a wedding that does not exist. Drop in real photos to judge
  the selection quality properly.
