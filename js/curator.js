/* ============================================================
   curator.js — turns a scored pile of frames into an edit.

   Three jobs:
     1. Kill near-duplicates (a burst of 6 near-identical frames should
        contribute one slide, not six).
     2. Enforce variety, so a carousel isn't ten portraits in a row.
     3. Sequence the survivors into a narrative arc, because the order
        a wedding story is told in is not the order of the score column.
   ============================================================ */

import { hamming } from './vision.js';

const DUPE_THRESHOLD = 11;  // hamming distance below this ⇒ same moment

/**
 * Cluster near-identical frames and keep only the best of each cluster.
 * Returns every shot with `.dupeOf` set on the losers.
 */
export function dedupe(shots) {
  const kept = [];
  const sorted = [...shots].sort((a, b) => b.m.score - a.m.score);
  for (const shot of sorted) {
    const twin = kept.find(k => hamming(k.m.hash, shot.m.hash) < DUPE_THRESHOLD);
    if (twin) { shot.dupeOf = twin.id; twin.burst = (twin.burst || 1) + 1; }
    else { shot.dupeOf = null; kept.push(shot); }
  }
  return shots;
}

/** The narrative spine of a wedding edit, in order. */
const ARC = [
  { role: 'hero',    want: ['portrait'],           note: 'Open on the couple — the strongest frame you have.' },
  { role: 'detail',  want: ['detail'],             note: 'Slow down: rings, lace, gele, stationery.' },
  { role: 'wide',    want: ['wide'],               note: 'Establish the room. Give the scale.' },
  { role: 'portrait',want: ['portrait'],           note: 'Back to faces. Hold the emotion.' },
  { role: 'detail',  want: ['detail'],             note: 'Texture beat — fabric, florals, the table.' },
  { role: 'party',   want: ['party', 'wide'],      note: 'Energy. Dancing, spraying, the noise.' },
  { role: 'portrait',want: ['portrait'],           note: 'A quieter portrait for contrast.' },
  { role: 'wide',    want: ['wide', 'detail'],     note: 'Pull back — venue, sky, the room emptying.' },
  { role: 'party',   want: ['party', 'portrait'],  note: 'Peak joy. The frame people screenshot.' },
  { role: 'closer',  want: ['portrait', 'wide'],   note: 'Close on them. Leave the viewer with the couple.' },
];

/**
 * Build a narrative-ordered sequence of `count` shots.
 * Falls back to raw score order when a shot type is unavailable.
 */
export function sequence(shots, count = 10) {
  const pool = shots
    .filter(s => !s.dupeOf && s.m.usable)
    .sort((a, b) => b.m.score - a.m.score);

  if (!pool.length) return [];
  const used = new Set();
  const out = [];

  const take = (types) => {
    for (const t of types) {
      const hit = pool.find(s => !used.has(s.id) && s.m.type === t);
      if (hit) { used.add(hit.id); return hit; }
    }
    const any = pool.find(s => !used.has(s.id));
    if (any) used.add(any.id);
    return any || null;
  };

  for (let i = 0; i < count; i++) {
    const beat = ARC[i % ARC.length];
    // The opening frame is always the highest scorer with a person in it.
    const shot = i === 0
      ? (pool.find(s => s.m.type === 'portrait') || pool[0])
      : take(beat.want);
    if (!shot) break;
    used.add(shot.id);
    out.push({ ...shot, role: beat.role, note: beat.note });
  }
  return out;
}

/** Everything the copywriter needs to know about the gallery, derived. */
export function profile(shots) {
  const live = shots.filter(s => s.m.usable && !s.dupeOf);
  const avg = k => live.length ? live.reduce((a, s) => a + s.m[k], 0) / live.length : 0;
  const counts = live.reduce((acc, s) => (acc[s.m.type] = (acc[s.m.type] || 0) + 1, acc), {});
  const warmth = avg('warmth');
  const brightness = avg('brightness');
  const colour = avg('colour');

  return {
    total: shots.length,
    usable: live.length,
    rejected: shots.filter(s => !s.m.usable).length,
    duplicates: shots.filter(s => s.dupeOf).length,
    counts,
    avgScore: live.length ? +(live.reduce((a, s) => a + s.m.score, 0) / live.length).toFixed(1) : 0,
    topScore: live.length ? Math.max(...live.map(s => s.m.score)) : 0,
    // These drive word choice downstream: a bright, saturated, warm gallery
    // gets different adjectives from a dark, moody one.
    mood: brightness < 0.36 ? 'moody' : brightness > 0.58 ? 'airy' : 'balanced',
    palette: warmth > 0.56 ? 'warm' : warmth < 0.44 ? 'cool' : 'neutral',
    saturation: colour > 0.55 ? 'rich' : colour < 0.32 ? 'muted' : 'natural',
    peopleHeavy: (counts.portrait || 0) + (counts.party || 0) > live.length * 0.5,
  };
}
