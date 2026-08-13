/* ============================================================
   brand.js — studio identity applied across every asset.

   Holds the logo (as a dataURL), a palette, a saved voice preset and a
   signature block. The Reel renderer reads the logo and palette; the copy
   engine reads the voice rules and signature.
   ============================================================ */

const KEY = 'aso.brand.v1';

const DEFAULTS = {
  studioName: '',
  logo: null,            // dataURL
  logoPosition: 'br',    // tl | tr | bl | br
  logoOpacity: 0.85,
  accent: '#C9A227',
  ink: '#FDF9F2',
  shadow: '#1A1410',
  gradeFromBrand: false, // tint the Reel grade with the accent colour
  voice: '',             // free-text house rules
  banned: '',            // comma-separated words to avoid
  signature: '',         // appended to long-form captions
};

let brand = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
})();

export const get = () => ({ ...brand });

export function set(patch) {
  brand = { ...brand, ...patch };
  localStorage.setItem(KEY, JSON.stringify(brand));
  return get();
}

export function reset() {
  brand = { ...DEFAULTS };
  localStorage.removeItem(KEY);
  return get();
}

export const hasLogo = () => Boolean(brand.logo);

/** Hex → {r,g,b}, for canvas tinting. */
export function rgb(hex) {
  const h = (hex || '#000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Voice rules folded into the local copy engine and the Claude system prompt.
 * Returns null when the studio hasn't set anything, so we don't bloat prompts.
 */
export function voiceRules() {
  const bits = [];
  if (brand.studioName) bits.push(`The studio is called ${brand.studioName}.`);
  if (brand.voice) bits.push(brand.voice.trim());
  const banned = (brand.banned || '').split(',').map(s => s.trim()).filter(Boolean);
  if (banned.length) bits.push(`Never use these words: ${banned.join(', ')}.`);
  return bits.length ? bits.join(' ') : null;
}

/** Words the local generators should avoid, lowercased. */
export const bannedWords = () =>
  (brand.banned || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

/**
 * Strip banned words from generated copy by swapping in a neutral synonym
 * where we have one, and otherwise deleting the offending adjective.
 */
// Swaps are single words that slot into the same grammatical position as the
// word they replace — "obsessed" → "taken" keeps the following "with" valid.
// An empty string means "delete the word"; the cleanup below repairs spacing
// and the punctuation left behind.
const SWAPS = {
  stunning: 'striking', gorgeous: 'beautiful', amazing: 'remarkable',
  breathtaking: 'arresting', magical: 'rare', perfect: 'exact',
  epic: 'considerable', vibes: 'feeling', obsessed: 'taken',
  literally: '', absolutely: '', truly: '', very: '', really: '',
};

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchCase = (sample, word) =>
  /^[A-Z]/.test(sample) ? word[0].toUpperCase() + word.slice(1) : word;

export function applyVoice(text) {
  const banned = bannedWords();
  if (!banned.length) return text;
  let out = text;

  for (const word of banned) {
    const swap = SWAPS[word] ?? '';
    const w = escapeRe(word);

    // Pass 1: the word with an indefinite article in front of it. Swapping
    // can invalidate the article ("an amazing" → "a remarkable"), so rewrite
    // both together. Scoped to words we actually touched — a global a/an
    // sweep would "correct" legitimate cases like "an hour".
    out = out.replace(new RegExp(`\\b(an?)(\\s+)${w}\\b`, 'gi'), (_, art, gap) => {
      if (!swap) return art;                       // deletion: keep the article
      return matchCase(art, /^[aeiou]/i.test(swap) ? 'an' : 'a') + gap + matchCase(word[0], swap);
    });

    // Pass 2: every remaining occurrence.
    out = out.replace(new RegExp(`\\b${w}\\b`, 'gi'), m => (swap ? matchCase(m, swap) : ''));
  }

  return out
    .replace(/[ \t]{2,}/g, ' ')        // collapse the gaps deletions leave
    .replace(/\s+([.,!?;:])/g, '$1')   // no space before punctuation
    .replace(/,\s*,/g, ',')            // no doubled commas
    .replace(/^[ \t]+/gm, '');
}

/** The signature line appended to long-form assets. */
export function signature(handle) {
  if (brand.signature) return brand.signature.trim();
  if (brand.studioName && handle) return `— ${brand.studioName} · ${handle}`;
  return null;
}

/** Draw the watermark onto a canvas context sized W×H. */
export function drawWatermark(g, W, H, logoImg) {
  if (!logoImg) return;
  const pad = W * 0.05;
  const w = W * 0.20;
  const h = w * (logoImg.naturalHeight / logoImg.naturalWidth || 1);
  const pos = {
    tl: [pad, pad],
    tr: [W - w - pad, pad],
    bl: [pad, H - h - pad - H * 0.06],
    br: [W - w - pad, H - h - pad - H * 0.06],
  }[brand.logoPosition] || [W - w - pad, H - h - pad - H * 0.06];

  g.save();
  g.globalAlpha = brand.logoOpacity;
  g.shadowColor = 'rgba(0,0,0,0.45)';
  g.shadowBlur = W * 0.02;
  g.drawImage(logoImg, pos[0], pos[1], w, h);
  g.restore();
}
