/* ============================================================
   landing.js — the marketing page.

   Everything demonstrated here is driven by the real modules, not mocked:
   the scoring panel runs vision.js over generated frames, the asset explorer
   calls engine.js, the track list is music.js's actual library, and the
   pricing comes from billing.js. If the product changes, the landing page
   changes with it.
   ============================================================ */

import { analyze, loadImage } from './vision.js';
import { dedupe, sequence, profile as buildProfile } from './curator.js';
import { ASSETS, generate } from './engine.js';
import { LIBRARY } from './music.js';
import * as billing from './billing.js';
import * as brand from './brand.js';
import { demoGallery, DEMO_WEDDING } from './demo.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- entering the studio ---------------- */

export function enterStudio() {
  $('#landing').hidden = true;
  $('#app').hidden = false;
  document.body.style.overflow = '';
  window.scrollTo(0, 0);
  window.dispatchEvent(new CustomEvent('aso:entered'));
}

function backToSite() {
  $('#app').hidden = true;
  $('#landing').hidden = false;
  window.scrollTo(0, 0);
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-enter]')) { enterStudio(); return; }
  const scroller = e.target.closest('[data-scroll]');
  if (scroller) {
    document.querySelector(scroller.dataset.scroll)
      ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  if (e.target.closest('#btnBackHome')) backToSite();
});

// In-page anchors, smoothed.
$$('.lnav-links a').forEach(a => a.addEventListener('click', e => {
  const target = document.querySelector(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}));

/* ---------------- scroll chrome ---------------- */

const nav = $('#lnav');
addEventListener('scroll', () => nav.classList.toggle('stuck', scrollY > 20), { passive: true });

const io = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    en.target.classList.add('in');
    io.unobserve(en.target);
  }
}, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
$$('.reveal').forEach((el, i) => {
  el.style.transitionDelay = `${Math.min(i % 3, 2) * 90}ms`;
  io.observe(el);
});

// Safety net: a reveal must never leave content permanently invisible. If the
// observer hasn't fired for something already in (or near) the viewport — which
// can happen when transitions are paused in a throttled or background tab — show
// it directly. Runs once shortly after load and again when the tab refocuses.
function rescueReveals() {
  for (const el of $$('.reveal:not(.in)')) {
    if (el.getBoundingClientRect().top < innerHeight * 1.15) el.classList.add('in');
  }
}
setTimeout(rescueReveals, 2600);
document.addEventListener('visibilitychange', () => { if (!document.hidden) rescueReveals(); });

// Cursor-tracked hero glow.
const glow = $('#heroGlow');
if (glow && !reduceMotion) {
  addEventListener('pointermove', e => {
    const y = Math.min(1, e.clientY / innerHeight);
    glow.style.setProperty('--lx', `${(e.clientX / innerWidth) * 100}%`);
    glow.style.setProperty('--ly', `${y * 60 + 10}%`);
  }, { passive: true });
}

/* ---------------- counters ---------------- */

const counterIO = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const el = en.target;
    counterIO.unobserve(el);
    if (el.dataset.literal) { el.textContent = el.dataset.literal; continue; }
    const to = +el.dataset.count;
    const suffix = el.dataset.suffix || '';
    if (reduceMotion) { el.textContent = to + suffix; continue; }
    // Time-based for the same reason as the typing effect — a counter that
    // stops at "7" because frames dried up is worse than no animation.
    const t0 = performance.now(), dur = 1000;
    const timer = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p >= 1) clearInterval(timer);
    }, 16);
  }
}, { threshold: 0.6 });
$$('[data-count]').forEach(el => counterIO.observe(el));

/* ---------------- marquee ---------------- */

const MARQUEE = [
  'Instagram carousel', 'Reel', 'TikTok', 'YouTube Shorts', 'Behind the scenes',
  'Client testimonial', 'Captions', 'Story sequence', 'Pinterest pins',
  'Blog article', 'Email newsletter', 'LinkedIn post', 'Vendor tags', 'Shot list',
];
$('#marquee').innerHTML = [...MARQUEE, ...MARQUEE]
  .map(m => `<span>${esc(m)}</span>`).join('');

/* ============================================================
   Hero: the selection engine, animated.
   Frames appear, a scan sweeps each one, a score lands, the winners
   pull forward. Drawn directly — no image decoding, so it starts instantly.
   ============================================================ */

function heroEngine() {
  const canvas = $('#engineCanvas');
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const COLS = 4, ROWS = 3, PAD = 18;
  const cellW = (W - PAD * (COLS + 1)) / COLS;
  const cellH = (H - PAD * (ROWS + 1) - 46) / ROWS;

  // Deterministic pseudo-random so the layout is stable across loops.
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

  const PALETTES = [
    ['#f0d9b8', '#8b5e3c'], ['#e8c9a0', '#6b4226'], ['#f3e6cf', '#c9a227'],
    ['#dfe6ef', '#3c4a5e'], ['#2a1f1a', '#c9a227'], ['#f2e8d8', '#6d5a3f'],
    ['#241a20', '#b4552d'], ['#c9d6e0', '#2e3a4a'],
  ];

  const tiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const [a, b] = PALETTES[i % PALETTES.length];
      const score = 42 + Math.round(rnd() * 48);
      tiles.push({
        x: PAD + c * (cellW + PAD),
        y: 46 + PAD + r * (cellH + PAD),
        a, b, score,
        people: rnd() > 0.45,
        appear: i * 0.055,
        scanAt: 0.9 + i * 0.13,
        pick: false,
      });
    }
  }
  // The top four by score are the "selects".
  [...tiles].sort((x, y) => y.score - x.score).slice(0, 4).forEach(t => { t.pick = true; });

  const CYCLE = 8.2;
  let t0 = performance.now();

  const roundRect = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  function drawTile(tile, t) {
    const age = t - tile.appear;
    if (age < 0) return;
    const rise = Math.min(1, age / 0.45);
    const ease = 1 - Math.pow(1 - rise, 3);
    const scanned = t > tile.scanAt;
    const scanProg = Math.max(0, Math.min(1, (t - tile.scanAt) / 0.45));

    const y = tile.y + (1 - ease) * 16;
    g.save();
    g.globalAlpha = ease * (scanned && !tile.pick && t > tile.scanAt + 1.2 ? 0.34 : 1);

    // frame
    const grad = g.createLinearGradient(tile.x, y, tile.x + cellW, y + cellH);
    grad.addColorStop(0, tile.a);
    grad.addColorStop(1, tile.b);
    roundRect(tile.x, y, cellW, cellH, 9);
    g.fillStyle = grad;
    g.fill();

    // a couple of skin-tone forms so it reads as a photograph
    if (tile.people) {
      g.save(); g.clip();
      g.fillStyle = 'rgba(120,72,36,.82)';
      g.beginPath();
      g.ellipse(tile.x + cellW * 0.38, y + cellH * 0.52, cellW * 0.15, cellH * 0.19, 0, 0, 7);
      g.fill();
      g.beginPath();
      g.ellipse(tile.x + cellW * 0.63, y + cellH * 0.55, cellW * 0.14, cellH * 0.17, 0, 0, 7);
      g.fill();
      g.restore();
    }

    // scan sweep
    if (t >= tile.scanAt && scanProg < 1) {
      const sy = y + cellH * scanProg;
      const sg = g.createLinearGradient(0, sy - 22, 0, sy + 4);
      sg.addColorStop(0, 'rgba(201,162,39,0)');
      sg.addColorStop(1, 'rgba(201,162,39,.55)');
      g.save(); roundRect(tile.x, y, cellW, cellH, 9); g.clip();
      g.fillStyle = sg;
      g.fillRect(tile.x, sy - 22, cellW, 26);
      g.restore();
      g.strokeStyle = 'rgba(230,201,100,.9)';
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(tile.x, sy); g.lineTo(tile.x + cellW, sy); g.stroke();
    }

    // border + verdict
    roundRect(tile.x, y, cellW, cellH, 9);
    g.strokeStyle = scanned && tile.pick ? 'rgba(230,201,100,.95)' : 'rgba(255,255,255,.09)';
    g.lineWidth = scanned && tile.pick ? 2 : 1;
    g.stroke();

    if (scanProg >= 1) {
      const pop = Math.min(1, (t - tile.scanAt - 0.45) / 0.25);
      g.save();
      g.globalAlpha *= pop;
      const bw = 44, bh = 19;
      roundRect(tile.x + cellW - bw - 7, y + 7, bw, bh, 6);
      g.fillStyle = tile.pick ? 'rgba(201,162,39,.95)' : 'rgba(10,8,7,.8)';
      g.fill();
      g.fillStyle = tile.pick ? '#1a1410' : '#b9aea3';
      g.font = '600 11px ui-monospace, Menlo, monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(tile.score.toFixed(0), tile.x + cellW - bw / 2 - 7, y + 7 + bh / 2);
      g.restore();

      if (tile.pick) {
        g.save(); g.globalAlpha *= pop;
        g.fillStyle = 'rgba(230,201,100,.95)';
        g.font = '600 9.5px -apple-system, Helvetica, sans-serif';
        g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText('SELECT', tile.x + 9, y + 16);
        g.restore();
      }
    }
    g.restore();
  }

  // Render one frame at cycle-relative time `t` (0..CYCLE).
  function render(t) {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0d0b0a';
    g.fillRect(0, 0, W, H);

    // header row
    const scanned = tiles.filter(x => t > x.scanAt + 0.45).length;
    const picked = tiles.filter(x => x.pick && t > x.scanAt + 0.45).length;
    g.fillStyle = '#7d726a';
    g.font = '11px ui-monospace, Menlo, monospace';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(`analysing  ${String(scanned).padStart(2, '0')}/${tiles.length}`, PAD, 24);
    g.textAlign = 'right';
    g.fillStyle = '#e6c964';
    g.fillText(`${picked} selects`, W - PAD, 24);

    // progress rule
    g.fillStyle = 'rgba(255,255,255,.07)';
    g.fillRect(PAD, 36, W - PAD * 2, 1.5);
    g.fillStyle = '#c9a227';
    g.fillRect(PAD, 36, (W - PAD * 2) * (scanned / tiles.length), 1.5);

    for (const tile of tiles) drawTile(tile, t);
  }

  // Start part-way through the cycle so the very first paint already shows a
  // scanned grid with scores and selects — never the empty "00/12" state,
  // which is what a viewer sees if the animation is frozen at t≈0.
  t0 = performance.now() - CYCLE * 1000 * 0.4;
  const clockT = now => ((now - t0) / 1000) % CYCLE;

  if (reduceMotion) {
    render(CYCLE * 0.72);       // a settled, populated frame
    return;
  }

  // Drive with rAF when the tab is foreground, but rAF is fully paused when
  // the page is hidden or heavily throttled (background tab, some embedded
  // contexts). A slow interval keeps the pane advancing in those cases so it
  // is never a frozen still — it only draws when rAF has gone quiet, so the
  // two drivers never double-paint.
  let lastPaint = 0;
  const paint = now => { render(clockT(now)); lastPaint = now; };

  const rafLoop = now => { paint(now); requestAnimationFrame(rafLoop); };
  requestAnimationFrame(rafLoop);

  setInterval(() => {
    const now = performance.now();
    if (now - lastPaint > 250) paint(now);   // rAF has stalled — take over
  }, 1000 / 15);

  // Snap back to a fresh frame the instant the tab returns to foreground.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) paint(performance.now());
  });

  paint(performance.now());     // synchronous first paint
}
heroEngine();

/* ============================================================
   Asset explorer — real output from engine.js
   ============================================================ */

const explorerState = { shots: [], selects: [], profile: null, cache: {}, current: 'caption' };

function tinyFrame(canvas, shot) {
  // Downscale a demo frame into the sidebar thumbnails.
  const g = canvas.getContext('2d');
  canvas.width = 120; canvas.height = 150;
  if (shot?.img) {
    const s = Math.max(120 / shot.img.naturalWidth, 150 / shot.img.naturalHeight);
    const w = shot.img.naturalWidth * s, h = shot.img.naturalHeight * s;
    g.drawImage(shot.img, (120 - w) / 2, (150 - h) / 2, w, h);
  } else {
    g.fillStyle = '#1e1b18'; g.fillRect(0, 0, 120, 150);
  }
}

/** The tab strip comes from a synchronous source — paint it immediately so the
 *  section never renders empty while the demo gallery is being generated. */
function paintExplorerTabs() {
  $('#explorerTabs').innerHTML = Object.entries(ASSETS).map(([k, a]) =>
    `<button class="etab ${k === explorerState.current ? 'active' : ''}" data-etab="${k}">${esc(a.label)}</button>`
  ).join('');
  $('#miniShots').innerHTML = Array.from({ length: 6 }, () => '<canvas></canvas>').join('');
}
paintExplorerTabs();

async function primeExplorer() {
  // Eight frames is enough for a ten-slide sequence once bursts collapse, and
  // it halves the time to first paint versus the studio's full demo gallery.
  const items = demoGallery().slice(0, 8);
  const shots = items.map((it, i) => ({ id: `l${i}`, name: it.name, url: it.url }));
  for (const shot of shots) {
    try { shot.img = await loadImage(shot.url); shot.m = analyze(shot.img); }
    catch { shot.m = { score: 0, usable: false, type: 'detail', hash: '0'.repeat(16) }; }
    await new Promise(r => setTimeout(r, 0));   // keep the page responsive
  }
  dedupe(shots);
  explorerState.shots = shots;
  explorerState.profile = buildProfile(shots);
  explorerState.selects = sequence(shots, 10);

  $$('#miniShots canvas').forEach((c, i) => tinyFrame(c, explorerState.selects[i]));
  showAsset(explorerState.current);
}

/**
 * The text to show for an asset. Most carry a `copy` block; Pinterest carries
 * pins and the video assets carry beats, so render those rather than falling
 * back to the guidance note — the point of this panel is real output.
 */
function firstCopy(out) {
  const copy = out.blocks.find(b => b.t === 'copy');
  if (copy) return copy.text;

  const pins = out.blocks.find(b => b.t === 'pins');
  if (pins) {
    return pins.pins.map((p, i) =>
      `PIN ${i + 1}\n${p.title}\n${p.desc}\nBoard: ${p.board}`).join('\n\n');
  }

  const beats = out.blocks.find(b => b.t === 'beats');
  if (beats) {
    return beats.beats.map(b =>
      `${b.start.toFixed(1)}s  ${b.role.padEnd(9)} “${b.text}”  · holds ${b.dur.toFixed(1)}s`).join('\n');
  }

  const slides = out.blocks.find(b => b.t === 'slides');
  if (slides) return slides.slides.map(s => `${s.n}. ${s.caption}`).join('\n');

  return out.blocks.find(b => b.t === 'note')?.text || '—';
}

/**
 * Type text out over a fixed wall-clock duration.
 *
 * Driven by setInterval and derived from elapsed time rather than
 * accumulated per-frame steps: requestAnimationFrame is throttled hard in
 * background tabs and some embedded browsers, and a frame-counted animation
 * silently stalls part-written. Time-based always lands on the full string.
 */
let typingTimer = null;
function typeInto(el, text) {
  clearInterval(typingTimer);
  el.classList.remove('typing');

  if (reduceMotion || text.length > 1400) { el.textContent = text; return; }

  const DURATION = 900;
  const t0 = performance.now();
  el.textContent = '';
  el.classList.add('typing');

  typingTimer = setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / DURATION);
    el.textContent = text.slice(0, Math.round(text.length * p));
    if (p >= 1) { clearInterval(typingTimer); el.classList.remove('typing'); }
  }, 16);
}

function showAsset(kind) {
  explorerState.current = kind;
  $$('.etab').forEach(b => b.classList.toggle('active', b.dataset.etab === kind));
  $('#explorerLabel').textContent = ASSETS[kind]?.label || kind;

  // Clicked before the demo gallery finished generating — remember the choice
  // and let primeExplorer render it when the frames land.
  if (!explorerState.selects.length) {
    $('#explorerCopy').textContent = 'Generating the demo gallery…';
    return;
  }
  let out = explorerState.cache[kind];
  if (!out) {
    try {
      out = generate(kind, { ...DEMO_WEDDING }, explorerState.profile, explorerState.selects);
      explorerState.cache[kind] = out;
    } catch (err) {
      $('#explorerCopy').textContent = `Could not generate this asset: ${err.message}`;
      return;
    }
  }

  typeInto($('#explorerCopy'), firstCopy(out));

  const words = firstCopy(out).trim().split(/\s+/).length;
  $('#explorerMeta').innerHTML = [
    ['Format', out.subtitle.split('·')[0].trim()],
    ['Length', `${words} words`],
    ['Frames used', String(out.blocks.find(b => b.t === 'slides')?.slides.length
      || out.blocks.find(b => b.t === 'beats')?.beats.length
      || out.blocks.find(b => b.t === 'pins')?.pins.length || 0)],
    ['Culture pack', 'Igbo'],
    ['Tone', 'Luxury editorial'],
  ].map(([k, v]) => `<div class="emeta"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
}

$('#explorerTabs').addEventListener('click', e => {
  const b = e.target.closest('[data-etab]');
  if (b) showAsset(b.dataset.etab);
});

/* ============================================================
   Scoring panel — runs vision.js on four real generated frames
   ============================================================ */

async function scorePanel() {
  const host = $('#scoreDemo');
  if (!host) return;
  const items = demoGallery().slice(0, 8);
  const picked = [items[0], items[3], items[2], items[8] || items[1]].filter(Boolean).slice(0, 4);

  const rows = [];
  for (const it of picked) {
    try {
      const img = await loadImage(it.url);
      rows.push({ m: analyze(img), img });
    } catch { /* skip undecodable */ }
  }
  rows.sort((a, b) => b.m.score - a.m.score);

  host.innerHTML = rows.map((r, i) => `
    <div class="scorecard ${i < 2 ? 'win' : 'lose'}">
      <canvas></canvas>
      <div class="sc-body">
        <div class="sc-top">
          <span class="sc-verdict">${i < 2 ? '● Selected' : '○ Cut'}</span>
          <b>${r.m.score.toFixed(1)}</b>
        </div>
        <div class="sc-bars">
          ${['sharp', 'exposure', 'colour', 'composition'].map(k =>
            `<div class="sc-bar"><i data-w="${Math.round((r.m[k] || 0) * 100)}"></i></div>`).join('')}
        </div>
      </div>
    </div>`).join('');

  $$('#scoreDemo canvas').forEach((c, i) => tinyFrame(c, rows[i]));

  // Fill the bars once the panel scrolls into view.
  const barIO = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      barIO.unobserve(en.target);
      $$('#scoreDemo .sc-bar i').forEach((bar, n) => {
        setTimeout(() => { bar.style.width = `${bar.dataset.w}%`; }, n * 55);
      });
    }
  }, { threshold: 0.35 });
  barIO.observe(host);
}

/* ============================================================
   Music panel — the real library, with a fake-but-honest EQ
   ============================================================ */

function musicPanel() {
  const eq = $('#eqBars');
  const list = $('#trackDemo');
  if (!eq || !list) return;

  eq.innerHTML = Array.from({ length: 38 }, () => '<i></i>').join('');
  const bars = [...eq.children];

  list.innerHTML = LIBRARY.slice(0, 5).map((t, i) => `
    <button class="trackrow ${i === 0 ? 'on' : ''}" data-demo-track="${esc(t.id)}">
      <span class="tp">▶</span>
      <span class="tn">${esc(t.name)}<br><span style="color:var(--ink-3);font-size:10.5px">${esc(t.mood)}</span></span>
      <span class="tb">${t.bpm}</span>
    </button>`).join('');

  let bpm = LIBRARY[0].bpm;
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-demo-track]');
    if (!b) return;
    $$('#trackDemo .trackrow').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    bpm = LIBRARY.find(t => t.id === b.dataset.demoTrack)?.bpm || 100;
  });

  if (reduceMotion) {
    bars.forEach((bar, i) => { bar.style.height = `${20 + Math.abs(Math.sin(i / 3)) * 55}%`; });
    return;
  }

  // Bars pulse on the selected track's tempo — it is a visualiser for a beat
  // grid, not for audio we aren't playing, and it moves at the real BPM.
  let last = performance.now(), phase = 0;
  const tick = (now) => {
    const dt = (now - last) / 1000; last = now;
    phase += dt * (bpm / 60);
    const beat = Math.pow(1 - (phase % 1), 2.4);
    bars.forEach((bar, i) => {
      const env = Math.abs(Math.sin(i * 0.55 + phase * 1.7));
      const h = 12 + env * 44 * (0.45 + beat * 0.8);
      bar.style.height = `${Math.min(100, h)}%`;
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ============================================================
   Voice panel — runs brand.applyVoice for real
   ============================================================ */

function voicePanel() {
  const host = $('#voiceDemo');
  if (!host) return;
  const saved = brand.get().banned;
  brand.set({ banned: 'stunning, gorgeous, magical, obsessed, literally' });
  const before = 'An absolutely stunning day. I am literally obsessed with every magical frame.';
  const after = brand.applyVoice(before);
  brand.set({ banned: saved });   // leave the user's real kit untouched

  host.innerHTML = `
    <div style="font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px">Banned words</div>
    <div class="tags" style="margin-bottom:18px">
      ${['stunning', 'gorgeous', 'magical', 'obsessed', 'literally']
        .map(w => `<span class="tag" style="color:var(--red);border-color:rgba(196,85,63,.3)">${esc(w)}</span>`).join('')}
    </div>
    <div style="font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px">Before</div>
    <div class="explorer-copy" style="margin-bottom:14px;opacity:.55">${esc(before)}</div>
    <div style="font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-2);margin-bottom:8px">After your rules</div>
    <div class="explorer-copy">${esc(after)}</div>`;
}

/* ============================================================
   Pricing
   ============================================================ */

let annual = false;
function renderPricing() {
  $('#pricingGrid').innerHTML = Object.values(billing.PLANS).map(p => {
    const monthly = annual ? Math.round(p.price * 0.8) : p.price;
    return `<div class="pcard ${p.featured ? 'hot' : ''}">
      ${p.featured ? '<div class="pflag">Most studios pick this</div>' : ''}
      <h3>${esc(p.name)}</h3>
      <div class="pblurb">${esc(p.blurb)}</div>
      <div class="pprice"><b>${billing.naira(monthly)}</b><span>/month</span></div>
      <div class="psave">${annual ? `Billed ${billing.naira(monthly * 12)} yearly` : '&nbsp;'}</div>
      <ul>${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <button class="${p.featured ? 'btn-xl' : 'btn-quiet'}" data-enter>Start with ${esc(p.name)}</button>
    </div>`;
  }).join('');
}
$('#billToggle').addEventListener('click', e => {
  const b = e.target.closest('[data-bill]');
  if (!b) return;
  annual = b.dataset.bill === 'annual';
  $$('#billToggle button').forEach(x => x.classList.toggle('on', x === b));
  renderPricing();
});
renderPricing();

/* ---------------- boot the heavy panels after first paint ---------------- */
requestAnimationFrame(() => {
  musicPanel();
  voicePanel();
  primeExplorer().catch(() => {
    $('#explorerCopy').textContent = 'The demo gallery could not be generated in this browser.';
  });
  scorePanel().catch(() => {});
});
