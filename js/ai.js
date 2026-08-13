/* ============================================================
   ai.js — optional live copywriting via the Claude API.

   The engine works fully offline; this is an upgrade path. When enabled,
   we hand Claude the *derived facts* about the gallery (what the pixel
   analysis found, which frames were selected and why) plus the wedding
   details, and ask it to rewrite the copy blocks in the photographer's
   voice. The images themselves never leave the browser.

   Note on transport: this project has no build step and no npm, so we
   call the Messages API over raw HTTPS rather than through the official
   SDK. Browser calls require the `anthropic-dangerous-direct-browser-access`
   header — which also tells you what this is: a convenience for a local
   tool, not a production pattern. In production, proxy through your own
   backend so the key never reaches a browser.
   ============================================================ */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const KEY = 'aso.ai.v1';

let cfg = (() => {
  try { return { enabled: false, model: 'claude-opus-5', apiKey: '', ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { enabled: false, model: 'claude-opus-5', apiKey: '' }; }
})();

export const config = () => ({ ...cfg });
export const isEnabled = () => Boolean(cfg.enabled && cfg.apiKey);

export function setConfig(patch) {
  cfg = { ...cfg, ...patch };
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

const SYSTEM = `You are the copywriter for a wedding photography studio. You write the studio's social captions, blog posts and pitch copy.

Voice rules:
- Write as the photographer, first person, no corporate register.
- Be specific. Name the fabric, the ritual, the room, the light. Generic wedding copy is the thing the studio is paying to avoid.
- No emoji unless the requested tone is playful. At most one.
- No "in this day and age", no "little did they know", no rhetorical questions as openers.
- Never invent a fact you were not given: no vendor names, no guest counts, no quotes from the couple, no weather. If a detail would strengthen the copy and you do not have it, write around it.
- Match the requested tone exactly. Luxury means restrained, not ornate.

Return ONLY the requested copy. No preamble, no explanation, no markdown fences unless the asset is the blog article (which is Markdown).`;

/** Build the fact sheet Claude writes from. */
function factSheet(wedding, profile, selects, asset) {
  return [
    `ASSET REQUESTED: ${asset}`,
    '',
    'WEDDING',
    `  Couple: ${[wedding.bride, wedding.groom].filter(Boolean).join(' & ') || 'not given'}`,
    `  Venue: ${wedding.venue || 'not given'}`,
    `  City: ${wedding.city || 'not given'}`,
    `  Date: ${wedding.date || 'not given'}`,
    `  Culture pack: ${wedding.culture}`,
    `  Requested tone: ${wedding.tone}`,
    `  Studio handle: ${wedding.handle || 'not given'}`,
    `  Vendors to credit: ${wedding.vendors || 'none given'}`,
    '',
    'WHAT THE IMAGE ANALYSIS FOUND (derived from the actual pixels — you may reference this)',
    `  Frames shot: ${profile.total}`,
    `  Frames that passed technical review: ${profile.usable}`,
    `  Rejected as soft or badly exposed: ${profile.rejected}`,
    `  Near-duplicate frames collapsed: ${profile.duplicates}`,
    `  Overall light: ${profile.mood}`,
    `  Palette: ${profile.palette}`,
    `  Colour intensity: ${profile.saturation}`,
    `  Shot mix: ${Object.entries(profile.counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'unknown'}`,
    '',
    'SELECTED FRAMES, IN SEQUENCE',
    ...selects.map((s, i) => `  ${i + 1}. [${s.role}] ${s.note} (score ${s.m.score}/100, ${s.m.type})`),
  ].join('\n');
}

/**
 * Ask Claude to write one asset's copy. Streams so long outputs never hit
 * an HTTP timeout; resolves with the accumulated text.
 * @param {(chunk:string)=>void} [onChunk] optional progressive callback
 */
export async function write({ wedding, profile, selects, asset, instruction, voice }, onChunk) {
  if (!isEnabled()) throw new Error('Live AI is not enabled.');

  // The studio's house rules go in a second system block, after the cached
  // one — the base prompt stays byte-identical across requests and keeps
  // its cache hit, while the brand rules vary per studio.
  const system = [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }];
  if (voice) system.push({ type: 'text', text: `STUDIO HOUSE RULES — these override the general guidance above:\n${voice}` });

  const body = {
    model: cfg.model,
    max_tokens: 8000,
    stream: true,
    system,
    output_config: { effort: 'medium' },
    messages: [{ role: 'user', content: `${factSheet(wedding, profile, selects, asset)}\n\nTASK\n${instruction}` }],
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { detail = (await res.json())?.error?.message || detail; } catch { /* keep status */ }
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let stopReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let evt;
      try { evt = JSON.parse(payload); } catch { continue; }

      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
        text += evt.delta.text;
        onChunk?.(evt.delta.text);
      } else if (evt.type === 'message_delta' && evt.delta?.stop_reason) {
        stopReason = evt.delta.stop_reason;
      } else if (evt.type === 'error') {
        throw new Error(evt.error?.message || 'Stream error');
      }
    }
  }

  // Check the stop reason before trusting the text — a refusal returns 200
  // with little or no content rather than an HTTP error.
  if (stopReason === 'refusal') {
    throw new Error('The model declined this request. Falling back to the local engine.');
  }
  if (!text.trim()) throw new Error('Empty response from the model.');
  return text.trim();
}

/** Cheap round-trip to validate the key and model. */
export async function ping() {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
    }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { detail = (await res.json())?.error?.message || detail; } catch { /* keep status */ }
    throw new Error(detail);
  }
  const data = await res.json();
  return data.content?.find(b => b.type === 'text')?.text?.trim() || 'ok';
}

/** The instruction per asset type, used when live AI is on. */
export const INSTRUCTIONS = {
  carousel:    'Write the Instagram caption for this carousel. Open with a hook that stops the scroll, name the venue and city, reference one specific cultural detail, and close with a booking call to action. 90–140 words.',
  reel:        'Write the Instagram Reel caption. Two to four short lines. Hook first. Close with a booking call to action.',
  tiktok:      'Write the TikTok caption and the on-screen text for the first frame. The on-screen text must work as a hook in under six words. Keep the caption under 20 words.',
  bts:         'Write a behind-the-scenes Instagram caption. Be honest about the difficulty — the light, the timing, the number of frames culled. Do not be self-pitying. 110–160 words.',
  testimonial: 'Write a testimonial draft in the voice of the couple, for the photographer to send them as a starting point. Warm, specific, not gushing. 60–90 words.',
  caption:     'Write three captions for the same set of images: one under 15 words, one around 40 words, and one around 130 words. Label them Short, Medium and Long.',
  story:       'Write the copy for an eight-frame Instagram Story sequence. One short line per frame, numbered, with the frame purpose in brackets.',
  pinterest:   'Write six Pinterest pins. For each: a keyword-led title under 60 characters and a description of 100–160 characters. Pinterest is a search engine — lead with what someone would type.',
  blog:        'Write the full blog article in Markdown: H1 title, an opening paragraph, a section on the day, a section of planning notes for couples, and a closing enquiry line. 500–750 words.',
  newsletter:  'Write the email that tells the studio mailing list this gallery is live. Subject line, preview text, body, and two calls to action (view the gallery, check your date). 180–260 words.',
  shorts:      'Write the YouTube Shorts title and description. The title must read like a search query someone would actually type. Description: three short paragraphs plus a booking line.',
  linkedin:    'Write a LinkedIn post aimed at wedding planners and venues, not couples. Lead with one concrete, useful observation about how the day was scheduled. No hashtag spam, no inspirational filler. 130–190 words.',
  vendorsheet: 'Write the blog credit line and the Instagram caption block crediting each vendor by role. Do not invent handles you were not given.',
  shotlist:    'Write a client shot list grouped into: before the ceremony, the ceremony itself, portraits, and reception. Use checkbox bullets. Be specific to the culture pack given.',
};
