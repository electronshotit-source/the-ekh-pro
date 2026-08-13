/* ============================================================
   engine.js — the nine generators.

   Every generator takes the same context object:
     { wedding, profile, selects, seed }
   and returns { kind, title, subtitle, blocks[] } where a block is one of:
     {t:'copy', text}          plain copy the user will paste
     {t:'tags', tags[]}        hashtag row
     {t:'slides', slides[]}    image + caption pairs
     {t:'beats', beats[]}      timed shot list
     {t:'pins', pins[]}        pinterest pin cards
     {t:'note', text}          guidance, not for pasting
   The renderer in ui.js knows how to draw each block type.
   ============================================================ */

import { CULTURES, TONES, HASHTAGS, BEAT_TEXT, STORY_FRAMES, pick, seedOf } from './lexicon.js';
import * as brand from './brand.js';

/* ---------- shared helpers ---------- */

function vars(ctx) {
  const w = ctx.wedding;
  const year = w.date ? new Date(w.date).getFullYear() : new Date().getFullYear();
  return {
    bride: w.bride || 'she',
    groom: w.groom || 'he',
    couple: [w.bride, w.groom].filter(Boolean).join(' & ') || 'the couple',
    venue: w.venue || 'the venue',
    city: w.city || 'Lagos',
    handle: w.handle || '@yourstudio',
    year,
    nextYear: year + (new Date().getMonth() > 7 ? 1 : 0) + 1,
    tone_word: ctx.tone.adjectives[ctx.seed % ctx.tone.adjectives.length],
  };
}

const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);

function context(wedding, profile, selects) {
  const culture = CULTURES[wedding.culture] || CULTURES.nigerian;
  const tone = TONES[wedding.tone] || TONES.luxury;
  const seed = seedOf(JSON.stringify({ ...wedding, n: selects.length }));
  const ctx = { wedding, profile, selects, culture, tone, seed };
  ctx.v = vars(ctx);
  return ctx;
}

/** Blend platform, culture and a couple-specific tag into one clean row. */
function tagRow(ctx, platform, n = 14) {
  const w = ctx.wedding;
  const couple = (w.bride && w.groom)
    ? `#${w.bride}${w.groom}${ctx.v.year}`.replace(/\s+/g, '')
    : null;
  const city = w.city ? `#${w.city.toLowerCase().replace(/\s+/g, '')}weddings` : null;
  const pool = [
    ...(couple ? [couple] : []),
    ...ctx.culture.hashtags,
    ...(HASHTAGS[platform] || []),
    ...(city ? [city] : []),
  ];
  return [...new Set(pool)].slice(0, n);
}

/** A sentence describing the light/palette, derived from actual pixels. */
function paletteLine(ctx) {
  const p = ctx.profile;
  const moodWord = { moody: 'low, deliberate light', airy: 'clean, open light', balanced: 'even, generous light' }[p.mood];
  const palWord = { warm: 'gold and amber running through it', cool: 'cool blues holding the frame', neutral: 'a restrained, neutral palette' }[p.palette];
  const satWord = { rich: 'colour turned all the way up', muted: 'colour pulled right back', natural: 'colour left honest' }[p.saturation];
  return `${moodWord[0].toUpperCase()}${moodWord.slice(1)}, ${palWord}, ${satWord}.`;
}

const shotOf = (ctx, i) => ctx.selects[i % Math.max(1, ctx.selects.length)] || null;

/** "A Yoruba wedding" / "An Igbo wedding" — vowel-aware indefinite article.
 *  Named `indefinite`, not `article`, because blogArticle() has a local
 *  `article` binding that would shadow it into a temporal dead zone. */
const indefinite = word => (/^[aeiou]/i.test(word) ? 'An' : 'A');

/* ============================================================
   1 · INSTAGRAM CAROUSEL
   ============================================================ */
export function instagramCarousel(ctx) {
  const { v, tone, culture } = ctx;
  const count = Math.min(10, Math.max(3, ctx.selects.length));
  const slides = ctx.selects.slice(0, count).map((s, i) => ({
    shot: s,
    n: i + 1,
    caption: i === 0
      ? `Slide 1 — the stop-scroll frame. ${s.note}`
      : `Slide ${i + 1} — ${s.note}`,
  }));

  const hook = fill(pick(tone.hooks, ctx.seed), v);
  const body = [
    hook,
    '',
    `${v.couple} · ${v.venue}, ${v.city}.`,
    '',
    `${culture.ceremony[0].toUpperCase()}${culture.ceremony.slice(1)} in ${v.city}, and the ${pick(culture.attire, ctx.seed + 1)} alone deserved its own post. ${paletteLine(ctx)}`,
    '',
    `Swipe to ${count}. ${pick(tone.closers, ctx.seed + 2)}`,
    '',
    fill(pick(tone.cta, ctx.seed + 3), v),
  ].join('\n');

  return {
    kind: 'carousel',
    title: 'Instagram carousel',
    subtitle: `${count} slides · ${tone.label}`,
    blocks: [
      { t: 'note', text: `Post at 11:00 or 19:30 local. Slide 1 is doing all the work — it scored ${slides[0]?.shot.m.score ?? '–'}/100 in the selects pass.` },
      { t: 'slides', slides },
      { t: 'copy', text: body, label: 'Caption' },
      { t: 'tags', tags: tagRow(ctx, 'instagram') },
    ],
  };
}

/* ============================================================
   2 · INSTAGRAM REEL  (script + shot list; rendering lives in reel.js)
   ============================================================ */
export function instagramReel(ctx, seconds = 30) {
  const beats = buildBeats(ctx, seconds);
  const { v, tone } = ctx;

  const script = [
    `HOOK (0–2s):  ${beats[0]?.text || 'They said yes.'}`,
    `BUILD (2–${Math.round(seconds * 0.45)}s):  details, room, the families arriving.`,
    `TURN (${Math.round(seconds * 0.45)}–${Math.round(seconds * 0.75)}s):  the ceremony beat — hold two seconds longer than feels right.`,
    `PAYOFF (${Math.round(seconds * 0.75)}–${seconds}s):  the party, then close on the couple.`,
    '',
    'AUDIO: pick a trending sound with a clear beat drop around 60% through and cut the party section to it.',
  ].join('\n');

  const caption = [
    fill(pick(tone.hooks, ctx.seed + 5), v),
    '',
    `${v.couple} — ${v.venue}, ${v.city}.`,
    '',
    fill(pick(tone.cta, ctx.seed + 6), v),
  ].join('\n');

  return {
    kind: 'reel',
    title: `Instagram Reel · ${seconds}s`,
    subtitle: `${beats.length} cuts · open Reel Lab to preview and export`,
    blocks: [
      { t: 'note', text: 'Built from your selects, sequenced hero → detail → wide → party → closer. Open Reel Lab to play it and export a .webm.' },
      { t: 'beats', beats },
      { t: 'copy', text: script, label: 'Edit script' },
      { t: 'copy', text: caption, label: 'Caption' },
      { t: 'tags', tags: tagRow(ctx, 'instagram', 10) },
    ],
  };
}

/**
 * Shared beat builder — Reel Lab consumes this too.
 * Pass `grid` (an array of beat times in seconds, from music.js) to snap every
 * cut onto the music. Without it, cuts fall on weighted proportions of the
 * total duration, which is fine for a silent edit but reads as sloppy the
 * moment there is a track underneath.
 */
export function buildBeats(ctx, seconds = 30, rhythm = 'medium', grid = null) {
  const hold = { slow: 2.4, medium: 1.4, fast: 0.7 }[rhythm] ?? 1.4;
  const n = Math.max(3, Math.min(ctx.selects.length, Math.round(seconds / hold)));
  const chosen = [];
  for (let i = 0; i < n; i++) chosen.push(ctx.selects[i % ctx.selects.length]);

  // The hero holds longer; the party section is cut tighter.
  const weights = chosen.map((s, i) => {
    if (i === 0) return 1.6;
    if (i === chosen.length - 1) return 1.5;
    if (s.role === 'party') return 0.75;
    if (s.role === 'detail') return 0.9;
    return 1;
  });
  const totalW = weights.reduce((a, b) => a + b, 0);

  // Ideal cut points from the weights, then pulled to the nearest beat.
  const cuts = [0];
  let acc = 0;
  for (let i = 0; i < chosen.length - 1; i++) {
    acc += seconds * weights[i] / totalW;
    cuts.push(acc);
  }

  let starts = cuts;
  if (grid?.length > 1) {
    const snapped = [];
    for (const want of cuts) {
      let best = grid[0], bestD = Infinity;
      for (const g of grid) {
        const d = Math.abs(g - want);
        if (d < bestD) { bestD = d; best = g; }
      }
      // Never let two cuts collapse onto the same beat.
      const prev = snapped.at(-1);
      if (prev != null && best <= prev) {
        const next = grid.find(g => g > prev);
        best = next != null && next < seconds ? next : prev + (grid[1] - grid[0]);
      }
      snapped.push(+best.toFixed(3));
    }
    starts = snapped;
  }

  return chosen.map((s, i) => {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : seconds;
    return {
      shot: s,
      role: s.role,
      start: +start.toFixed(2),
      dur: +Math.max(0.25, end - start).toFixed(2),
      text: fill(pick(BEAT_TEXT[s.role] || BEAT_TEXT.portrait, ctx.seed + i), ctx.v),
      onBeat: Boolean(grid?.length),
    };
  });
}

/* ============================================================
   3 · TIKTOK
   ============================================================ */
export function tiktok(ctx) {
  const { v, tone, culture } = ctx;
  const beats = buildBeats(ctx, 22, 'fast');

  const script = [
    'ON-SCREEN TEXT (0–1s):',
    `  "${fill(pick(['POV: you booked the {city} photographer who actually shows up early','Nigerian weddings vs everyone else','Tell me it\'s a {culture} wedding without telling me','I was NOT ready for this entrance'], ctx.seed), { ...v, culture: culture.label })}"`,
    '',
    'HOOK: land the loudest frame in the first 0.8 seconds. No logo, no slow fade.',
    'CUTS: 0.5–0.8s per shot. Cut on the beat, not on the bar.',
    `PAYOFF: ${pick(culture.rituals, ctx.seed + 1)} — that is the moment people stitch.`,
    'LOOP: end on a frame that visually matches the first, so it replays seamlessly.',
    '',
    'CAPTION OVERLAY at 60%: "wait for it" — TikTok rewards retention, not beauty.',
  ].join('\n');

  const caption = fill(
    `${pick(['this is why I shoot Nigerian weddings','the {city} wedding scene is undefeated','no notes. none.'], ctx.seed + 2)} 🇳🇬 ${v.couple} at ${v.venue}`,
    v
  );

  return {
    kind: 'tiktok',
    title: 'TikTok',
    subtitle: `${beats.length} fast cuts · ~22s`,
    blocks: [
      { t: 'note', text: 'Different edit from the Reel on purpose — TikTok wants the loud frame first and rewards a clean loop.' },
      { t: 'beats', beats },
      { t: 'copy', text: script, label: 'Shot direction' },
      { t: 'copy', text: caption, label: 'Caption' },
      { t: 'tags', tags: tagRow(ctx, 'tiktok', 8) },
    ],
  };
}

/* ============================================================
   4 · BEHIND-THE-SCENES
   ============================================================ */
export function behindTheScenes(ctx) {
  const { v, tone, profile, culture } = ctx;
  const hard = ctx.selects.find(s => s.m.brightness < 0.4) || ctx.selects[0];
  const bright = ctx.selects.find(s => s.m.brightness > 0.5) || ctx.selects[1] || ctx.selects[0];

  const body = [
    pick([
      'Nobody posts the part before the photo.',
      'Here is what that frame actually cost.',
      'The honest version of this gallery.',
    ], ctx.seed),
    '',
    `${v.venue} at ${profile.mood === 'moody' ? 'the point in the night where the lights go down' : 'peak daylight'}. ${
      profile.mood === 'moody'
        ? 'Almost nothing usable straight out of camera — we lit it ourselves, dragged the shutter, and shot for the grade we knew we\'d apply.'
        : 'Hard, unflattering light across the whole space, so we shot into it deliberately rather than fighting it.'
    }`,
    '',
    `${pick(culture.rituals, ctx.seed + 1)[0].toUpperCase()}${pick(culture.rituals, ctx.seed + 1).slice(1)} happens once and it happens fast. You get one attempt. That is why we walk the room an hour before anyone arrives.`,
    '',
    `Shot ${profile.total} frames. ${profile.usable} made the cut. ${profile.rejected} were culled outright and ${profile.duplicates} were near-duplicates of a better frame. The gallery ${v.couple} receives is the ${Math.round(profile.usable / Math.max(1, profile.total) * 100)}% that earned it.`,
    '',
    pick([
      'That is the job. Most of it is not glamorous.',
      'Anyway. Worth it.',
      'Would do it again tomorrow.',
    ], ctx.seed + 2),
    '',
    fill(pick(tone.cta, ctx.seed + 3), v),
  ].join('\n');

  return {
    kind: 'bts',
    title: 'Behind-the-scenes post',
    subtitle: 'Builds trust · high save rate',
    blocks: [
      { t: 'note', text: 'BTS posts convert better than pretty ones — they show the buyer what they are actually paying for. Pair the hard-light frame with the finished frame.' },
      { t: 'slides', slides: [hard, bright].filter(Boolean).map((s, i) => ({
          shot: s, n: i + 1,
          caption: i === 0 ? 'The conditions.' : 'The result.',
        })) },
      { t: 'copy', text: body, label: 'Caption' },
      { t: 'tags', tags: ['#behindthescenes','#weddingphotographer','#bts', ...tagRow(ctx, 'instagram', 7)] },
    ],
  };
}

/* ============================================================
   5 · CLIENT TESTIMONIAL
   ============================================================ */
export function testimonial(ctx) {
  const { v, culture, tone } = ctx;
  const openers = [
    `We didn't want to be posed. ${v.handle} understood that in the first ten minutes.`,
    `I cried when the gallery landed. Then my mother cried. Then we started again.`,
    `Everyone talks about the photos. Nobody warns you about how calm the right photographer makes the day feel.`,
    `We booked on a recommendation and spent the whole day wondering how we got so lucky.`,
  ];
  const middles = [
    `Half the frames we love most, we never noticed being taken.`,
    `${pick(culture.rituals, ctx.seed)[0].toUpperCase()}${pick(culture.rituals, ctx.seed).slice(1)} is over in seconds and somehow every second of it is in the gallery.`,
    `Our parents are in these photos properly — not just in the background of ours.`,
    `The ${pick(culture.attire, ctx.seed + 1)} looks exactly the way it looked in person, which I did not expect.`,
  ];
  const closers = [
    `If you are deciding: decide.`,
    `Book them. That is the whole review.`,
    `Worth every naira and then some.`,
    `We will be using them again for everything.`,
  ];

  const quote = [
    pick(openers, ctx.seed),
    '',
    pick(middles, ctx.seed + 1),
    '',
    pick(closers, ctx.seed + 2),
  ].join('\n');

  const post = [
    `From ${v.couple} 🤍`,
    '',
    `"${pick(openers, ctx.seed)} ${pick(middles, ctx.seed + 1)}"`,
    '',
    `— ${v.couple}, ${v.venue}, ${v.city}`,
    '',
    fill(pick(tone.cta, ctx.seed + 4), v),
  ].join('\n');

  return {
    kind: 'testimonial',
    title: 'Client testimonial',
    subtitle: 'Draft to send · post-ready version included',
    blocks: [
      { t: 'note', text: 'Send the draft to the couple as a starting point — clients freeze at a blank box, but happily edit a draft. Never publish it as theirs without their sign-off.' },
      { t: 'copy', text: quote, label: 'Draft to send the couple' },
      { t: 'copy', text: post, label: 'Post-ready graphic copy' },
      { t: 'slides', slides: ctx.selects.slice(0, 2).map((s, i) => ({ shot: s, n: i + 1, caption: i === 0 ? 'Quote card background' : 'Alternate' })) },
    ],
  };
}

/* ============================================================
   6 · CAPTION (standalone, three lengths)
   ============================================================ */
export function caption(ctx) {
  const { v, tone, culture } = ctx;
  const short = fill(pick(tone.hooks, ctx.seed + 7), v);
  const mid = [
    fill(pick(tone.hooks, ctx.seed + 8), v),
    '',
    `${v.couple} · ${v.venue}, ${v.city}`,
    fill(pick(tone.cta, ctx.seed + 9), v),
  ].join('\n');
  const long = [
    fill(pick(tone.hooks, ctx.seed + 10), v),
    '',
    `There is a moment during ${pick(culture.rituals, ctx.seed)} where everyone in the room forgets there is a photographer present. That is the frame you are looking at.`,
    '',
    `${paletteLine(ctx)} We shot ${ctx.profile.total} frames across the day and this one has not left my head since.`,
    '',
    `${v.couple} — thank you for letting us stand that close.`,
    '',
    fill(pick(tone.cta, ctx.seed + 11), v),
  ].join('\n');

  return {
    kind: 'caption',
    title: 'Captions',
    subtitle: 'Three lengths · same voice',
    blocks: [
      { t: 'note', text: `Voice: ${tone.voice}. Short for a single frame, medium for a carousel, long for the post you actually want people to read.` },
      { t: 'copy', text: short, label: 'Short — one-liner' },
      { t: 'copy', text: mid, label: 'Medium — standard post' },
      { t: 'copy', text: long, label: 'Long — the storytelling one' },
      { t: 'tags', tags: tagRow(ctx, 'instagram') },
    ],
  };
}

/* ============================================================
   7 · STORY SEQUENCE
   ============================================================ */
export function storySequence(ctx) {
  const { v } = ctx;
  const pull = 'Half the frames we love most, we never noticed being taken.';
  const slides = STORY_FRAMES.map((f, i) => ({
    shot: shotOf(ctx, i),
    n: i + 1,
    caption: `${f.label} — ${fill(f.copy, { ...v, testimonialPull: pull }).replace(/\n/g, ' · ')}`,
  }));

  const plan = STORY_FRAMES.map((f, i) =>
    `${String(i + 1).padStart(2, '0')}. ${f.label.padEnd(13)} ${fill(f.copy, { ...v, testimonialPull: pull }).replace(/\n/g, ' / ')}`
  ).join('\n');

  return {
    kind: 'story',
    title: 'Story sequence',
    subtitle: `${STORY_FRAMES.length} frames · 24-hour arc`,
    blocks: [
      { t: 'note', text: 'Post frames 1–4 the morning after, 5–8 that evening. The poll on frame 3 is the retention device — it doubles the completion rate on the rest.' },
      { t: 'slides', slides },
      { t: 'copy', text: plan, label: 'Frame-by-frame plan' },
    ],
  };
}

/* ============================================================
   8 · PINTEREST PINS
   ============================================================ */
export function pinterestPins(ctx, count = 6) {
  const { v, culture, profile } = ctx;
  const angles = [
    { title: `${culture.label} wedding inspiration — ${v.city}`, desc: `${culture.ceremony[0].toUpperCase()}${culture.ceremony.slice(1)} at ${v.venue}. ${pick(culture.attire, ctx.seed)}, ${pick(culture.attire, ctx.seed + 3)}, and a colour story worth saving.` },
    { title: `${profile.palette === 'warm' ? 'Gold & amber' : profile.palette === 'cool' ? 'Blue & silver' : 'Neutral'} wedding palette`, desc: `A ${profile.saturation} palette pulled straight from a real ${v.city} wedding. Save for your mood board.` },
    { title: `${pick(culture.attire, ctx.seed + 1)} styling ideas`, desc: `How ${v.bride} styled ${pick(culture.attire, ctx.seed + 1)} for a ${culture.ceremony}. Real wedding, not a styled shoot.` },
    { title: `${v.venue} wedding — real gallery`, desc: `What a wedding actually looks like at ${v.venue}, ${v.city}. Lighting, layout, and the shots you should ask your photographer for.` },
    { title: `${culture.label} reception decor`, desc: `Tablescape and reception styling from a real ${v.city} celebration. Colour, texture, and scale.` },
    { title: `Wedding photo shot list — ${culture.label}`, desc: `The frames you cannot recreate later: ${culture.rituals.slice(0, 3).join(', ')}. Save this before your planning call.` },
  ];

  const pins = angles.slice(0, count).map((a, i) => ({
    shot: shotOf(ctx, i + 1),
    title: a.title,
    desc: `${a.desc} Photography: ${v.handle}.`,
    board: pick(HASHTAGS.pinterest, ctx.seed + i),
  }));

  return {
    kind: 'pinterest',
    title: 'Pinterest pins',
    subtitle: `${pins.length} pins · 2:3 vertical`,
    blocks: [
      { t: 'note', text: 'Pinterest is a search engine, not a feed — the title carries the keyword and the description carries the long tail. These pins keep driving enquiries eighteen months after posting.' },
      { t: 'pins', pins },
    ],
  };
}

/* ============================================================
   9 · BLOG ARTICLE
   ============================================================ */
export function blogArticle(ctx) {
  const { v, culture, tone, profile } = ctx;
  const title = pick([
    `${v.couple}'s ${culture.ceremony} at ${v.venue}, ${v.city}`,
    `${indefinite(culture.label)} ${culture.label} wedding at ${v.venue} — ${v.couple}`,
    `${v.venue} Wedding Photography · ${v.couple}`,
  ], ctx.seed);

  const vendors = (ctx.wedding.vendors || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const article = [
    `# ${title}`,
    '',
    `*${culture.label} ${culture.ceremony} · ${v.venue}, ${v.city} · ${ctx.wedding.date || v.year}*`,
    '',
    fill(pick(tone.hooks, ctx.seed + 12), v),
    '',
    '## The day',
    '',
    `${v.bride} and ${v.groom} were married at ${v.venue} in ${v.city}. ${paletteLine(ctx)} We covered the full day — preparation through to the last dance — and came away with ${profile.total} frames, of which ${profile.usable} made the final gallery.`,
    '',
    `The ${culture.ceremony} carried the weight of the morning. ${pick(culture.rituals, ctx.seed)[0].toUpperCase()}${pick(culture.rituals, ctx.seed).slice(1)} drew the room in completely, and the ${pick(culture.attire, ctx.seed + 1)} did what it always does — turned a room full of guests into a single photograph.`,
    '',
    `By the reception the room had changed character entirely. ${pick(culture.people, ctx.seed + 2)[0].toUpperCase()}${pick(culture.people, ctx.seed + 2).slice(1)} set the tempo, ${pick(culture.food, ctx.seed + 3)} came out, and nobody sat down again for the rest of the night.`,
    '',
    '## How we photographed it',
    '',
    `${profile.mood === 'moody'
      ? `${v.venue} is a low-light room, so we shot for it rather than against it — fast glass wide open, our own light kept deliberately soft, and an exposure that protects highlights and lets the shadows fall where they want to.`
      : profile.mood === 'airy'
        ? `${v.venue} gave us a lot of light and very little shade, so most of the day was about placement — finding the one wall, doorway or window that turned hard sun into something usable.`
        : `${v.venue} gave us workable light for most of the day, which meant we could stay out of the way and shoot the room as we found it rather than rebuilding it.`
    }`,
    '',
    `Two of us worked the day: one staying with ${v.bride}, one moving with ${v.groom} and the wider room, so nothing on either side of the ${culture.ceremony} went unphotographed. Between us we do not ask anyone to repeat a moment. If it happened once, it is in the gallery once — properly.`,
    '',
    '## What we photographed',
    '',
    ...ctx.selects.slice(0, 6).map((s, i) => `${i + 1}. **${s.role[0].toUpperCase() + s.role.slice(1)}** — ${s.note}`),
    '',
    '## Notes for couples planning something similar',
    '',
    `- **Give the ${culture.ceremony} its own time block.** It moves fast and it will not be repeated for the camera.`,
    `- **Decide early who is being photographed with you.** ${pick(culture.people, ctx.seed + 4)[0].toUpperCase()}${pick(culture.people, ctx.seed + 4).slice(1)} will not think to ask, and those are the frames people frame.`,
    `- **Build in twenty minutes at golden hour.** ${profile.mood === 'moody' ? 'Especially if the reception space is dark — it may be the only soft light of the day.' : 'It is the single highest-return twenty minutes of the schedule.'}`,
    `- **Feed your photographer when you eat.** Practical, unromantic, and it changes the back half of the gallery.`,
    `- **Tell your family the ceremony matters to you.** They will make space for it, and you will have photographs of it.`,
    '',
    ...(vendors.length ? ['## The team', '', ...vendors.map(x => `- ${x}`), ''] : []),
    '## Enquire',
    '',
    fill(`Now booking {nextYear} weddings in {city} and beyond. Get in touch to check your date.`, v),
    '',
    `*Photography: ${v.handle}*`,
  ].join('\n');

  const seo = [
    `SEO title:  ${title} | ${v.handle}`.slice(0, 70),
    `Slug:       ${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`,
    `Meta desc:  ${culture.label} wedding photography at ${v.venue}, ${v.city}. Real gallery from ${v.couple}'s ${culture.ceremony}, plus planning notes for couples.`.slice(0, 155),
    `Keywords:   ${v.city.toLowerCase()} wedding photographer, ${culture.label.toLowerCase()} wedding photography, ${v.venue.toLowerCase()} wedding, ${culture.ceremony} photographer`,
    `Alt text:   "${v.couple} during ${culture.ceremony} at ${v.venue}, ${v.city}" — vary per image.`,
  ].join('\n');

  return {
    kind: 'blog',
    title: 'Blog article',
    subtitle: `~${Math.round(article.split(/\s+/).length)} words · SEO block included`,
    blocks: [
      { t: 'note', text: 'This is the asset with the longest half-life. Publish it, then link it from every Pinterest pin and the Instagram bio.' },
      { t: 'copy', text: article, label: 'Article (Markdown)' },
      { t: 'copy', text: seo, label: 'SEO metadata' },
      { t: 'slides', slides: ctx.selects.slice(0, 6).map((s, i) => ({ shot: s, n: i + 1, caption: s.note })) },
    ],
  };
}

/* ============================================================
   10 · EMAIL NEWSLETTER
   ============================================================ */
export function newsletter(ctx) {
  const { v, culture, profile } = ctx;
  const subjectLines = [
    `${v.couple}'s gallery is ready`,
    `${v.venue}, and the wedding we haven't stopped talking about`,
    `Inside: ${v.couple} at ${v.venue}`,
    `A ${culture.label} wedding in ${v.city} — full gallery`,
  ];

  const email = [
    `SUBJECT:  ${pick(subjectLines, ctx.seed)}`,
    `PREVIEW:  ${profile.usable} frames from a day in ${v.city} that earned every one of them.`,
    '',
    '---',
    '',
    `Hello,`,
    '',
    `${v.bride} and ${v.groom} were married at ${v.venue} last ${new Date(ctx.wedding.date || Date.now()).toLocaleDateString('en-GB', { month: 'long' })}, and their gallery has just gone live.`,
    '',
    `We shot ${profile.total} frames across the day. ${profile.usable} made the final set. The ${culture.ceremony} is in there properly — not as three establishing shots, but as the thing the whole morning was built around.`,
    '',
    `→ View the full gallery`,
    '',
    `**If you are planning something similar**`,
    '',
    `We are booking ${v.nextYear} now, and ${v.city} dates in the ${culture.ceremony} season go first. Reply to this email and we will send availability and pricing the same day.`,
    '',
    `→ Check your date`,
    '',
    brand.signature(v.handle) || `— ${v.handle}`,
    '',
    '---',
    'Unsubscribe · Update preferences',
  ].join('\n');

  return {
    kind: 'newsletter',
    title: 'Email newsletter',
    subtitle: 'Subject lines · body · two CTAs',
    blocks: [
      { t: 'note', text: 'Email still outperforms every social channel for actual bookings. Send within a week of the gallery going live, while the couple are still sharing it.' },
      { t: 'copy', text: email, label: 'Email' },
      { t: 'copy', text: subjectLines.map((s, i) => `${i + 1}. ${s}`).join('\n'), label: 'Subject lines to A/B test' },
      { t: 'slides', slides: ctx.selects.slice(0, 3).map((s, i) => ({ shot: s, n: i + 1, caption: i === 0 ? 'Hero image — above the fold' : 'Body image' })) },
    ],
  };
}

/* ============================================================
   11 · YOUTUBE SHORTS
   ============================================================ */
export function shorts(ctx) {
  const { v, culture } = ctx;
  const beats = buildBeats(ctx, 55, 'slow');

  const script = [
    'TITLE (shows in search — this is the whole game on Shorts):',
    `  "${culture.label} Wedding at ${v.venue} | ${v.city} Wedding Film"`,
    '',
    'STRUCTURE — Shorts rewards watch time, not the 3-second hook TikTok wants:',
    `  0–3s    Establish. Wide of ${v.venue}. Let it breathe.`,
    `  3–15s   Preparation. Slower cuts than the Reel — 2s holds.`,
    `  15–35s  ${culture.ceremony[0].toUpperCase()}${culture.ceremony.slice(1)}. This is the section people stay for.`,
    `  35–50s  Reception and dancing. Pick up the pace.`,
    `  50–55s  Close on the couple. Hold the last frame two full seconds.`,
    '',
    'AUDIO: licensed instrumental, not a trending sound — Shorts surfaces this in search',
    'months later and a dated audio track ages the whole film.',
    '',
    'END SCREEN: studio name + "booking " + link. Shorts allows a clickable',
    'description link; TikTok effectively does not. Use it.',
  ].join('\n');

  const description = [
    `${v.couple}'s ${culture.ceremony} at ${v.venue}, ${v.city}.`,
    '',
    `Full gallery and the written story on the blog.`,
    `Booking ${v.nextYear} weddings — link below.`,
    '',
    `${v.handle}`,
    '',
    `#Shorts ${tagRow(ctx, 'tiktok', 6).join(' ')}`,
  ].join('\n');

  return {
    kind: 'shorts',
    title: 'YouTube Shorts · 55s',
    subtitle: `${beats.length} cuts · slower pacing than TikTok`,
    blocks: [
      { t: 'note', text: 'Deliberately not the TikTok edit. Shorts behaves like search — longer holds, a title that reads as a query, and a description link that actually works.' },
      { t: 'beats', beats },
      { t: 'copy', text: script, label: 'Edit direction' },
      { t: 'copy', text: description, label: 'Title & description' },
    ],
  };
}

/* ============================================================
   12 · LINKEDIN (vendor-facing)
   ============================================================ */
export function linkedin(ctx) {
  const { v, culture, profile } = ctx;
  const vendors = (ctx.wedding.vendors || '').split(',').map(s => s.trim()).filter(Boolean);

  const post = [
    pick([
      `A note on what actually makes a wedding run well, using last week as the example.`,
      `Second shooters, planners, and the unglamorous logistics of a ${profile.total}-frame day.`,
      `The vendor team is the reason this gallery looks the way it does.`,
    ], ctx.seed),
    '',
    `We photographed ${v.couple}'s ${culture.ceremony} at ${v.venue} in ${v.city}.`,
    '',
    `The thing worth writing down: the ${culture.ceremony} was given its own protected block in the schedule. No overlap with setup, no guests still arriving, no photographer negotiating for position. That single planning decision is the difference between covering a ritual and documenting it.`,
    '',
    `Planners who build that in are doing the photography team's job for them, and it shows in the final gallery every time.`,
    '',
    ...(vendors.length ? ['Full credit to the team:', ...vendors.map(x => `• ${x}`), ''] : []),
    `If you plan weddings in ${v.city} and want a photography team that will tell you honestly what the schedule needs, my inbox is open.`,
    '',
    brand.signature(v.handle) || v.handle,
  ].join('\n');

  return {
    kind: 'linkedin',
    title: 'LinkedIn post',
    subtitle: 'Vendor-facing · B2B tone',
    blocks: [
      { t: 'note', text: 'LinkedIn is where planners and venues find suppliers. This post is not for couples — it is a competence signal aimed at the people who make referrals.' },
      { t: 'copy', text: post, label: 'Post' },
      { t: 'tags', tags: ['#weddingindustry', '#weddingplanning', `#${v.city.toLowerCase().replace(/\s+/g, '')}events`, '#eventphotography', '#weddingsuppliers'] },
    ],
  };
}

/* ============================================================
   13 · VENDOR TAG SHEET
   ============================================================ */
export function vendorSheet(ctx) {
  const { v } = ctx;
  const raw = (ctx.wedding.vendors || '').split(',').map(s => s.trim()).filter(Boolean);

  if (!raw.length) {
    return {
      kind: 'vendorsheet',
      title: 'Vendor tag sheet',
      subtitle: 'No vendors entered yet',
      blocks: [{ t: 'note', text: 'Add vendors on the Wedding tab — "Planner: Trina Events, Dress: Yartel" — and regenerate. The sheet builds tag strings per platform so you are not retyping handles at 11pm.' }],
    };
  }

  const parsed = raw.map(entry => {
    const [role, ...rest] = entry.split(':');
    const name = rest.join(':').trim() || role.trim();
    const hasRole = rest.length > 0;
    const handle = '@' + name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return { role: hasRole ? role.trim() : 'Vendor', name, handle };
  });

  const table = parsed.map(p => `${p.role.padEnd(12)} ${p.name.padEnd(26)} ${p.handle}`).join('\n');
  const igLine = `Team:\n${parsed.map(p => `${p.role}: ${p.handle}`).join('\n')}`;
  const flat = parsed.map(p => p.handle).join(' ');

  return {
    kind: 'vendorsheet',
    title: 'Vendor tag sheet',
    subtitle: `${parsed.length} vendors · handles guessed, verify before posting`,
    blocks: [
      { t: 'note', text: 'Handles are derived from the vendor names, so check each one before you publish — tagging the wrong account is worse than not tagging. Vendor tags are the cheapest reach you have: every tagged supplier is a potential reshare to an audience of engaged couples.' },
      { t: 'copy', text: table, label: 'Reference sheet' },
      { t: 'copy', text: igLine, label: 'Instagram caption block' },
      { t: 'copy', text: flat, label: 'Flat list — for story stickers' },
      { t: 'copy', text: `Photography by ${v.handle}. Team: ${parsed.map(p => `${p.name} (${p.role.toLowerCase()})`).join(', ')}.`, label: 'Blog credit line' },
    ],
  };
}

/* ============================================================
   14 · CLIENT SHOT LIST  (printable)
   ============================================================ */
export function shotList(ctx) {
  const { v, culture } = ctx;

  const sections = [
    ['Before the ceremony', [
      'Both partners getting ready — separate rooms, natural light',
      `The ${pick(culture.attire, ctx.seed)} before it is worn — laid out, detail`,
      'Rings, invitations, shoes, jewellery together',
      'Parents seeing their child dressed for the first time',
      'The room before anyone is in it',
    ]],
    [`${culture.ceremony[0].toUpperCase()}${culture.ceremony.slice(1)}`, [
      ...culture.rituals.map(r => `${r[0].toUpperCase()}${r.slice(1)} — wide and close`),
      `${pick(culture.people, ctx.seed + 1)[0].toUpperCase()}${pick(culture.people, ctx.seed + 1).slice(1)} in the middle of it`,
      'Both families reacting, not posing',
      'The exchange itself, uninterrupted',
    ]],
    ['Portraits', [
      'The two of you alone, twenty minutes, golden hour if possible',
      'Immediate family — list every grouping in advance',
      'Wedding party, one formal and one that is not',
      'Grandparents and elders seated, unhurried',
    ]],
    ['Reception', [
      'Room set, before guests enter',
      'Entrance and first dance',
      `${pick(culture.food, ctx.seed + 2)[0].toUpperCase()}${pick(culture.food, ctx.seed + 2).slice(1)} being served`,
      'Speeches — the speaker and the faces listening',
      'The spraying, from behind the couple',
      'The dance floor after 10pm, no flash if avoidable',
      'The two of you, last frame of the night',
    ]],
  ];

  const doc = [
    `SHOT LIST — ${v.couple}`,
    `${v.venue}, ${v.city}${ctx.wedding.date ? ` · ${ctx.wedding.date}` : ''}`,
    `Photography: ${v.handle}`,
    '',
    'Bring this to the planning call. Cross off anything you do not want,',
    'and add the family groupings by name — that is the part we cannot guess.',
    '',
    ...sections.flatMap(([heading, items]) => [
      heading.toUpperCase(),
      ...items.map(i => `  ☐  ${i}`),
      '',
    ]),
    'FAMILY GROUPINGS — write these out in full',
    '  ☐  ______________________________________________',
    '  ☐  ______________________________________________',
    '  ☐  ______________________________________________',
    '  ☐  ______________________________________________',
    '',
    'MUST-NOT-MISS — anything above that is non-negotiable',
    '  ☐  ______________________________________________',
    '  ☐  ______________________________________________',
  ].join('\n');

  return {
    kind: 'shotlist',
    title: 'Client shot list',
    subtitle: `${sections.reduce((a, [, i]) => a + i.length, 0)} items · printable`,
    printable: { title: `Shot list — ${v.couple}`, body: doc },
    blocks: [
      { t: 'note', text: 'Send this before the planning call, not after. It turns a vague conversation into a checklist and surfaces the family politics you would otherwise discover on the day.' },
      { t: 'copy', text: doc, label: 'Shot list' },
    ],
  };
}

/* ============================================================
   Registry + dispatcher
   ============================================================ */
export const ASSETS = {
  carousel:    { label: 'Instagram carousel', icon: '▤', blurb: 'Up to 10 sequenced slides plus caption and tags.',  fn: instagramCarousel },
  reel:        { label: 'Instagram Reel',     icon: '▶', blurb: 'Beat-cut vertical edit, script and shot list.',      fn: (c, o) => instagramReel(c, o?.seconds ?? 30) },
  tiktok:      { label: 'TikTok',             icon: '♪', blurb: 'Faster edit, hook-first, built to loop.',            fn: tiktok },
  bts:         { label: 'Behind the scenes',  icon: '◐', blurb: 'The honest post. Highest save rate you own.',        fn: behindTheScenes },
  testimonial: { label: 'Client testimonial', icon: '❝', blurb: 'A draft to send, and a version to publish.',         fn: testimonial },
  caption:     { label: 'Caption',            icon: '✎', blurb: 'Short, medium and long, in your tone.',              fn: caption },
  story:       { label: 'Story sequence',     icon: '▢', blurb: 'Eight frames across a 24-hour arc.',                 fn: storySequence },
  pinterest:   { label: 'Pinterest pins',     icon: '⚲', blurb: 'Six keyword-led pins that keep working.',            fn: (c, o) => pinterestPins(c, o?.count ?? 6) },
  blog:        { label: 'Blog article',       icon: '¶', blurb: 'Full article plus SEO metadata.',                    fn: blogArticle },
  newsletter:  { label: 'Email newsletter',   icon: '✉', blurb: 'Gallery-is-ready email with subject-line tests.',    fn: newsletter },
  shorts:      { label: 'YouTube Shorts',     icon: '▷', blurb: 'Slower 55s cut built for search, not the feed.',     fn: shorts },
  linkedin:    { label: 'LinkedIn post',      icon: 'in', blurb: 'Vendor-facing. Aimed at planners who refer.',       fn: linkedin },
  vendorsheet: { label: 'Vendor tag sheet',   icon: '⊞', blurb: 'Every handle, formatted per platform.',              fn: vendorSheet },
  shotlist:    { label: 'Client shot list',   icon: '☑', blurb: 'Printable checklist for the planning call.',         fn: shotList },
};

/** Long-form assets that get the studio signature appended. */
const SIGNED = new Set(['carousel', 'bts', 'caption', 'blog', 'linkedin']);

export function generate(kind, wedding, profile, selects, opts = {}) {
  const def = ASSETS[kind];
  if (!def) throw new Error(`Unknown asset type: ${kind}`);
  if (!selects.length) throw new Error('No selects available — analyse a gallery first.');
  const ctx = context(wedding, profile, selects);
  const out = def.fn(ctx, opts);

  // Apply the studio's house voice: strip banned words, append the signature.
  const sig = brand.signature(ctx.v.handle);
  for (const block of out.blocks) {
    if (block.t !== 'copy') continue;
    block.text = brand.applyVoice(block.text);
    if (sig && SIGNED.has(kind) && block.label !== 'SEO metadata' && !block.text.includes(sig)) {
      block.text = `${block.text}\n\n${sig}`;
    }
  }

  out.id = `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  out.createdAt = Date.now();
  return out;
}

export { context as buildContext };
