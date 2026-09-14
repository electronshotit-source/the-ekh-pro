/*
  plates.js — generative "editorial plates" standing in for photography.

  There is no access to the studio's real image library in this build
  environment, so every visual on the page is a vector "plate": a duotone
  field plus a hand-tuned line-art figure, rendered as inline SVG. The style
  leans into the brand pun (archi- + -grapher: an architect's eye applied to
  the human form) rather than trying to fake a photograph.

  Swap in real photography later by dropping files into /archigrapher/img
  and replacing renderPlate() calls with <img> tags — the DOM structure
  (.work-card, .intro-plate, etc.) already expects a single full-bleed child.
*/

const DUOTONES = [
  ['#c69a5c', '#0a0a0b'],
  ['#e3c894', '#141416'],
  ['#8a6a3a', '#0a0a0b'],
  ['#d9b872', '#111114'],
  ['#b6863f', '#0d0d0e'],
  ['#f0dcae', '#161513'],
  ['#a97c3f', '#0a0a0b'],
  ['#c69a5c', '#1a1712'],
  ['#e8cf9c', '#0a0a0b'],
  ['#9c7539', '#141210'],
  ['#c69a5c', '#000000'],
  ['#dcb877', '#0a0a0b'],
];

// Each figure is a set of stroke paths drawn in a 400x500 viewbox, built to
// read as architectural/fashion line-work: columns, arches, drapery curves.
const FIGURES = [
  // 0 — arch + standing silhouette
  `<path d="M60 460 V 240 Q 60 120 200 120 Q 340 120 340 240 V 460" />
   <path d="M150 460 C 150 340 130 300 170 260 C 190 240 210 240 230 260 C 270 300 250 340 250 460" />
   <circle cx="200" cy="205" r="26" />`,
  // 1 — colonnade
  `<path d="M40 460 V 80 M120 460 V 80 M200 460 V 80 M280 460 V 80 M360 460 V 80" />
   <path d="M20 90 H 380" /><path d="M20 460 H 380" />
   <path d="M150 460 C 160 360 150 300 200 280 C 250 300 240 360 250 460" />`,
  // 2 — draped curve / fabric
  `<path d="M80 100 C 40 220 60 340 140 420 C 200 470 260 470 320 420 C 370 380 360 300 320 260" />
   <path d="M120 140 C 100 240 120 320 180 380" />
   <path d="M200 90 C 220 180 260 220 300 200" />`,
  // 3 — portrait bust, architectural crop
  `<rect x="40" y="60" width="320" height="380" rx="4" />
   <circle cx="200" cy="200" r="70" />
   <path d="M110 460 C 110 340 150 300 200 300 C 250 300 290 340 290 460" />`,
  // 4 — staircase / runway steps
  `<path d="M40 460 H140 V400 H220 V340 H300 V280 H360 V220" />
   <path d="M200 460 C 210 360 190 300 240 260 C 270 235 300 235 320 210" />`,
  // 5 — twin arch window with figure
  `<path d="M40 460 V220 Q40 140 100 140 Q160 140 160 220 V460" />
   <path d="M200 460 V220 Q200 140 260 140 Q320 140 320 220 V460" />
   <path d="M155 460 C155 380 175 340 200 340 C225 340 245 380 245 460" />`,
  // 6 — long gown silhouette
  `<circle cx="200" cy="120" r="30" />
   <path d="M140 155 C 100 220 90 320 60 460 H 340 C 310 320 300 220 260 155" />
   <path d="M170 200 L 230 200" /><path d="M180 260 L 220 260" />`,
  // 7 — grid facade
  `<path d="M60 60 H340 V460 H60 Z" />
   <path d="M60 140 H340 M60 220 H340 M60 300 H340 M60 380 H340" />
   <path d="M140 60 V460 M260 60 V460" />`,
  // 8 — profile + cornice
  `<path d="M120 460 C110 360 130 300 130 260 C130 200 160 160 210 160 C240 160 250 190 240 210 C270 205 285 225 275 250" />
   <path d="M30 470 H370" /><path d="M30 90 H370" />`,
  // 9 — spiral / motion figure
  `<path d="M200 460 C 130 440 90 380 110 320 C 130 260 210 250 220 190 C 228 140 190 100 150 110" />
   <circle cx="150" cy="90" r="22" />`,
  // 10 — pillars with sash
  `<path d="M90 460 V100 M310 460 V100" />
   <path d="M60 110 H340" />
   <path d="M120 200 C 170 240 230 240 280 200" />
   <path d="M120 300 C 170 260 230 260 280 300" />`,
  // 11 — veiled bust, high fashion crop
  `<path d="M200 90 C 260 90 280 150 260 200 C 320 220 330 300 300 360 C 270 420 130 420 100 360 C 70 300 80 220 140 200 C 120 150 140 90 200 90 Z" />
   <path d="M150 250 H250" />`,
];

function grainFilterId(seed){ return `grain-${seed}`; }

export function renderPlate({ seed = 0, label = '', ratio = 'auto' } = {}){
  const [a, b] = DUOTONES[seed % DUOTONES.length];
  const figure = FIGURES[seed % FIGURES.length];
  const gid = `plateGrad-${seed}-${Math.random().toString(36).slice(2,7)}`;
  const nid = grainFilterId(`${seed}-${Math.random().toString(36).slice(2,7)}`);

  return `
  <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label || 'Editorial plate'}">
    <defs>
      <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${a}" />
        <stop offset="100%" stop-color="${b}" />
      </linearGradient>
      <filter id="${nid}">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="noise"/>
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0"/>
      </filter>
    </defs>
    <rect width="400" height="500" fill="url(#${gid})" />
    <g fill="none" stroke="${b === '#0a0a0b' || b.startsWith('#0') || b.startsWith('#1') ? 'rgba(244,240,232,0.55)' : 'rgba(10,10,11,0.55)'}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85">
      ${figure}
    </g>
    <rect width="400" height="500" filter="url(#${nid})" opacity="0.7" />
  </svg>`;
}

export function mountPlates(root = document){
  root.querySelectorAll('[data-plate]').forEach((el) => {
    const seed = Number(el.dataset.plate) || 0;
    const label = el.dataset.plateLabel || '';
    el.innerHTML = renderPlate({ seed, label });
  });
}
