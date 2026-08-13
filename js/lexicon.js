/* ============================================================
   lexicon.js — the vocabulary the copy engine draws from.
   Culture packs carry real, specific nouns; generic wedding copy is
   exactly what photographers are trying to escape.
   ============================================================ */

export const CULTURES = {
  yoruba: {
    label: 'Yoruba',
    ceremony: 'traditional engagement',
    ceremonyAlt: 'Introduction',
    attire: ['aso-oke gele', 'agbada', 'iro and buba', 'fila', 'coral beads'],
    people: ['Alaga Ijoko', 'Alaga Iduro', 'aso-ebi family', 'the elders'],
    rituals: ['the prostration', 'the presentation of the dowry', 'the parents\' prayer', 'the spraying'],
    food: ['jollof', 'asun', 'small chops', 'party rice'],
    words: ['owambe', 'aso-ebi', 'gele', 'agbada', 'Alaga'],
    phrases: ['E ku ayo o', 'Congratulations to the new Mr & Mrs'],
    hashtags: ['#yorubawedding','#traditionalwedding','#asoebibella','#gele','#owambe','#nigerianwedding','#lagosweddings','#asooke'],
  },
  igbo: {
    label: 'Igbo',
    ceremony: 'Igba Nkwu',
    ceremonyAlt: 'wine carrying',
    attire: ['isiagu', 'george wrapper', 'red cap', 'coral beads', 'ichafu'],
    people: ['the umunna', 'the bride\'s father', 'the age grade', 'the kinsmen'],
    rituals: ['the search for the groom', 'the palm wine', 'kola nut breaking', 'the kneel'],
    food: ['ofe nsala', 'jollof', 'abacha', 'palm wine'],
    words: ['Igba Nkwu', 'umunna', 'isiagu', 'nwunye m'],
    phrases: ['Igba Nkwu done right', 'She found him in a room full of people'],
    hashtags: ['#igbawedding','#igbanwu','#igbowedding','#igbobride','#traditionalwedding','#nigerianwedding','#asoebibella','#igbotraditionalwedding'],
  },
  hausa: {
    label: 'Hausa / Fulani',
    ceremony: 'Fatiha',
    ceremonyAlt: 'Kamu',
    attire: ['babban riga', 'hijab and lace', 'gyale', 'kallabi', 'gold jewellery'],
    people: ['the Imam', 'the bride\'s guardians', 'the family delegation'],
    rituals: ['the Fatiha', 'the lalle night', 'the Kamu', 'the dowry recitation'],
    food: ['dambu nama', 'masa', 'kilishi', 'zobo'],
    words: ['Fatiha', 'Kamu', 'lalle', 'walima'],
    phrases: ['Barka da aure', 'A quiet Fatiha and a loud walima'],
    hashtags: ['#hausawedding','#northernwedding','#fatiha','#kamu','#hausabride','#nigerianwedding','#lalle','#walima'],
  },
  nigerian: {
    label: 'Nigerian',
    ceremony: 'traditional ceremony',
    ceremonyAlt: 'white wedding',
    attire: ['aso-ebi', 'gele', 'agbada', 'lace', 'beads'],
    people: ['the aso-ebi girls', 'the families', 'the elders'],
    rituals: ['the spraying', 'the first dance', 'the family prayer'],
    food: ['jollof', 'small chops', 'suya'],
    words: ['owambe', 'aso-ebi', 'gele'],
    phrases: ['Nigerian weddings do not miss', 'The jollof was not playing'],
    hashtags: ['#nigerianwedding','#asoebibella','#owambe','#naijawedding','#lagosweddings','#weddingdigestnaija','#bellanaijaweddings','#gele'],
  },
  ghanaian: {
    label: 'Ghanaian',
    ceremony: 'knocking ceremony',
    ceremonyAlt: 'traditional engagement',
    attire: ['kente', 'kaba and slit', 'gold beads', 'duku'],
    people: ['the abusua', 'the linguists', 'the aunties'],
    rituals: ['the knocking', 'the schnapps', 'the dowry list'],
    food: ['jollof', 'waakye', 'kelewele'],
    words: ['kente', 'abusua', 'kaba'],
    phrases: ['Kente and gold, always'],
    hashtags: ['#ghanaianwedding','#kente','#ghanawedding','#africanwedding','#traditionalwedding','#accraweddings','#ghanabride'],
  },
  global: {
    label: 'Destination',
    ceremony: 'ceremony',
    ceremonyAlt: 'reception',
    attire: ['the dress', 'the veil', 'the suit', 'silk'],
    people: ['the guests', 'the families', 'the wedding party'],
    rituals: ['the vows', 'the first look', 'the first dance', 'golden hour'],
    food: ['the long table', 'champagne'],
    words: ['destination', 'editorial'],
    phrases: ['An entire love story in one day'],
    hashtags: ['#destinationwedding','#weddingphotography','#editorialwedding','#realwedding','#loveauthentic','#weddingday','#bridetobe'],
  },
};

export const TONES = {
  luxury: {
    label: 'Luxury editorial',
    hooks: [
      'This is what {tone_word} looks like when nobody is performing.',
      'A {city} wedding that understood restraint — and then quietly broke it.',
      'Some galleries you edit. This one you just get out of the way of.',
      'Every frame of this day was already composed before I raised the camera.',
      'We have photographed {city} for years. This one is going in the book.',
    ],
    adjectives: ['considered','restrained','impeccable','unhurried','deliberate','arresting'],
    closers: [
      'Full gallery on the blog.',
      'The film is coming. Brace yourself.',
      'More from this day soon.',
    ],
    cta: [
      'Enquiries open for {nextYear} — link in bio.',
      'Two {nextYear} dates left. DM to hold one.',
      'Now booking {nextYear}. Link in bio.',
    ],
    voice: 'measured, confident, low on exclamation marks',
  },
  warm: {
    label: 'Warm & documentary',
    hooks: [
      'I have looked at this frame about forty times now.',
      'Nobody asked them to do this. That is the whole point.',
      'You can hear this photo, honestly.',
      'The best moment of the day happened while everyone was looking elsewhere.',
      'Ten hours with {bride} and {groom} and I would happily do it again tomorrow.',
    ],
    adjectives: ['tender','honest','unguarded','easy','generous','quiet'],
    closers: [
      'Swipe for the rest of them.',
      'There are so many more.',
      'Full set on the blog this week.',
    ],
    cta: [
      'Still taking {nextYear} weddings — say hi in the DMs.',
      'If this is your kind of day, my inbox is open.',
      'Booking {nextYear}. Come talk to me.',
    ],
    voice: 'first person, conversational, generous',
  },
  playful: {
    label: 'Playful & loud',
    hooks: [
      'The DJ has not recovered. Neither have I.',
      'They said small wedding. Look at this.',
      'Somebody\'s uncle out-danced the entire wedding party.',
      'The jollof was NOT playing and neither were these two.',
      'Slide four is doing something to me.',
    ],
    adjectives: ['unserious','loud','glorious','chaotic','electric','ridiculous'],
    closers: [
      'Save this one.',
      'Send this to your person.',
      'Slide 6 is free therapy.',
    ],
    cta: [
      '{nextYear} dates are going fast — DM me.',
      'Want this energy at yours? You know what to do.',
      'Link in bio, let\'s talk.',
    ],
    voice: 'high energy, short sentences, humour',
  },
  cinematic: {
    label: 'Cinematic & moody',
    hooks: [
      'Shot mostly in the dark. Wouldn\'t change a thing.',
      'The light did exactly one good thing that day, and we were ready.',
      'Grain, shadow, and two people who did not care who was watching.',
      'This is the frame the whole day was building toward.',
      'We waited forty minutes for this light. Worth every one.',
    ],
    adjectives: ['moody','cinematic','shadowed','textural','still','weighted'],
    closers: [
      'Full story on the blog.',
      'The film cut lands Friday.',
      'More frames from this night soon.',
    ],
    cta: [
      'Booking {nextYear}. Link in bio.',
      'Available for {nextYear} — DM to enquire.',
      'Enquiries via the link in bio.',
    ],
    voice: 'sparse, atmospheric, image-led',
  },
};

/* Platform-specific hashtag banks, kept separate from culture tags. */
export const HASHTAGS = {
  instagram: ['#weddingphotographer','#realwedding','#weddinginspo','#bridalstyle','#weddingday','#loveandlight','#documentarywedding','#weddingcontent'],
  tiktok: ['#weddingtok','#bridetok','#weddingphotographer','#fyp','#weddingseason','#africanwedding','#weddinginspo'],
  pinterest: ['wedding photography','bridal inspiration','african wedding','wedding colour palette','traditional wedding','reception decor'],
};

/* Reel/story caption beats keyed to the narrative role of each shot. */
export const BEAT_TEXT = {
  hero:     ['They said yes.', 'And then this happened.', '{bride} & {groom}'],
  detail:   ['Every detail, on purpose.', 'Look closer.', 'The small things.'],
  wide:     ['The room held its breath.', 'All of this. For them.', 'Setting the scene.'],
  portrait: ['Just look at them.', 'No direction needed.', 'This face right here.'],
  party:    ['And then the room went up.', 'Nobody sat down after this.', 'Peak joy.'],
  closer:   ['{city}, {year}.', 'Congratulations, you two.', 'Until the next one.'],
};

/* Story-sequence frame types for the 24h Instagram Stories build. */
export const STORY_FRAMES = [
  { kind: 'cover',    label: 'Cover',        copy: '{bride} + {groom}\n{venue} · {city}' },
  { kind: 'teaser',   label: 'Teaser',       copy: 'A preview. The full set is coming.' },
  { kind: 'poll',     label: 'Poll sticker', copy: 'Favourite frame?  ①  or  ②' },
  { kind: 'detail',   label: 'Detail',       copy: 'The details they agonised over.' },
  { kind: 'quote',    label: 'Quote card',   copy: '"{testimonialPull}"' },
  { kind: 'bts',      label: 'Behind it',    copy: 'What it took to get this one →' },
  { kind: 'vendors',  label: 'Vendor tags',  copy: 'The team that built this day' },
  { kind: 'cta',      label: 'CTA + link',   copy: 'Full gallery on the blog →' },
];

export const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

/** Deterministic string hash, so the same wedding regenerates consistently
 *  but a nudge to any field produces genuinely different copy. */
export function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
