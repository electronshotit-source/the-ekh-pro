/* ============================================================
   main.js — state, wiring and rendering.
   ============================================================ */

import { analyze, loadImage, detectFaces, applyFaces, faceDetectionAvailable } from './vision.js';
import { dedupe, sequence, profile as buildProfile } from './curator.js';
import { ASSETS, generate, buildContext, buildBeats } from './engine.js';
import { parse, describe } from './prompt.js';
import * as billing from './billing.js';
import * as ai from './ai.js';
import * as store from './store.js';
import * as brand from './brand.js';
import { Reel } from './reel.js';
import * as music from './music.js';
import { demoGallery, DEMO_WEDDING } from './demo.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- state ---------------- */
const state = {
  id: store.newId(),   // current wedding record id
  shots: [],           // { id, name, url, blob, img, m, dupeOf }
  selects: [],         // narrative-ordered subset with .role and .note
  profile: null,
  outputs: [],
  filter: 'all',
  reel: null,
  reelBeats: [],
  logoImg: null,
  dirty: false,
  // music
  player: new music.Player(),
  track: null,        // { buffer, bpm, name, source, id }
  uploads: [],        // decoded user songs, session-scoped
  moodFilter: 'all',
};

const FIELDS = ['bride', 'groom', 'venue', 'city', 'culture', 'tone', 'handle', 'date', 'vendors'];
const fieldEl = k => $(`#f${k[0].toUpperCase()}${k.slice(1)}`);

const wedding = () => Object.fromEntries(
  FIELDS.map(k => [k, (fieldEl(k)?.value ?? '').trim()])
);

const setWedding = w => FIELDS.forEach(k => { if (fieldEl(k) && w?.[k] != null) fieldEl(k).value = w[k]; });

/* ---------------- chrome ---------------- */
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

function go(view) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'library') renderWeddings();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$('#nav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-item');
  if (!btn) return;
  state.userNavigated = true;   // stop the boot restore from stealing the view
  go(btn.dataset.view);
});

/* ---------------- gallery intake ---------------- */
const dz = $('#dropzone');
['dragenter', 'dragover'].forEach(ev =>
  dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev =>
  dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
dz.addEventListener('drop', e => intake([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))));

$('#btnPick').addEventListener('click', () => $('#filePicker').click());
$('#filePicker').addEventListener('change', e => intake([...e.target.files]));

$('#btnDemo').addEventListener('click', async () => {
  setWedding(DEMO_WEDDING);
  const items = demoGallery();
  state.shots = items.map((it, i) => ({ id: `s${i}`, name: it.name, url: it.url }));
  renderThumbs();
  toast(`Loaded ${items.length} demo frames`);
  $('#btnAnalyze').disabled = false;
});

function intake(files) {
  if (!files.length) return;
  const start = state.shots.length;
  files.forEach((f, i) => {
    state.shots.push({
      id: `s${start + i}`, name: f.name,
      url: URL.createObjectURL(f), blob: f,
    });
  });
  renderThumbs();
  $('#btnAnalyze').disabled = state.shots.length === 0;
  toast(`${files.length} photo${files.length > 1 ? 's' : ''} added`);
}

$('#btnClearGallery').addEventListener('click', () => {
  state.shots = []; state.selects = []; state.profile = null;
  renderThumbs(); renderSelects();
  $('#btnAnalyze').disabled = true;
  toast('Gallery cleared');
});

function renderThumbs() {
  $('#uploadThumbs').innerHTML = state.shots
    .map(s => `<img src="${esc(s.url)}" alt="${esc(s.name)}" loading="lazy">`).join('');
}

/* ---------------- analysis ---------------- */
$('#btnAnalyze').addEventListener('click', runAnalysis);

async function runAnalysis() {
  if (!state.shots.length) return toast('Add some photos first');
  const bar = $('#analyzeBar');
  bar.hidden = false;
  $('#btnAnalyze').disabled = true;

  const useFaces = faceDetectionAvailable();
  for (let i = 0; i < state.shots.length; i++) {
    const shot = state.shots[i];
    $('#abLabel').textContent =
      `Analysing ${i + 1} of ${state.shots.length} — ${shot.name}${useFaces ? ' · face detection on' : ''}`;
    $('#abFill').style.width = `${((i + 1) / state.shots.length) * 100}%`;
    try {
      shot.img = await loadImage(shot.url);
      shot.m = analyze(shot.img);
      // Second pass: where the browser can actually find faces, use them.
      applyFaces(shot.m, await detectFaces(shot.img));
    } catch {
      shot.m = { score: 0, usable: false, type: 'detail', hash: '0'.repeat(16) };
    }
    if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
  }

  dedupe(state.shots);
  state.profile = buildProfile(state.shots);
  state.selects = sequence(state.shots, 10);
  billing.recordWedding();
  state.dirty = true;

  $('#abLabel').textContent =
    `Done — ${state.selects.length} selects from ${state.shots.length} frames` +
    (useFaces ? ' (faces detected)' : ' (skin-tone proxy — this browser has no FaceDetector)');
  $('#btnAnalyze').disabled = false;
  renderSelects();
  renderAssetMenu();
  buildReel();
  go('select');
  toast(`${state.selects.length} strongest images selected`);

  persist().catch(() => { /* storage errors surface in the Library */ });
}

/* ---------------- persistence ---------------- */
async function persist() {
  if (!store.available() || !state.profile) return;
  const record = store.toRecord({
    id: state.id,
    wedding: wedding(),
    profile: state.profile,
    shots: state.shots,
    selects: state.selects,
    outputs: state.outputs,
  });
  // Write blobs first so a half-saved record never points at missing images.
  for (const shot of state.shots) {
    const key = `${state.id}/${shot.id}`;
    const blob = shot.blob || await store.toBlob(shot.url);
    shot.blob = blob;
    await store.putBlob(key, blob);
  }
  await store.save(record);
  state.dirty = false;
  return record;
}

async function openWedding(id, { restoreView = true } = {}) {
  const rec = await store.get(id);
  if (!rec) return toast('That wedding is no longer stored');

  state.id = rec.id;
  setWedding(rec.wedding);
  state.profile = rec.profile;

  const shots = [];
  for (const s of rec.shots) {
    const blob = await store.getBlob(`${rec.id}/${s.id}`);
    if (!blob) continue;
    const url = URL.createObjectURL(blob);
    const shot = { ...s, url, blob };
    try { shot.img = await loadImage(url); } catch { /* leave undecoded */ }
    shots.push(shot);
  }
  state.shots = shots;

  const byId = Object.fromEntries(shots.map(s => [s.id, s]));
  state.selects = (rec.selectIds || [])
    .map(sel => byId[sel.id] && { ...byId[sel.id], role: sel.role, note: sel.note })
    .filter(Boolean);
  state.outputs = store.rehydrateOutputs(rec.outputs, byId);
  state.dirty = false;

  renderThumbs(); renderSelects(); renderOutputs(); renderLibrary(); renderWeddings();
  $('#btnAnalyze').disabled = !state.shots.length;
  buildReel();
  toast(`Opened ${rec.name}`);
  // Opening from the Library should jump to the selects; the boot restore
  // passes restoreView:false so it never moves the user.
  if (restoreView) go('select');
}

function newWedding() {
  state.id = store.newId();
  state.shots = []; state.selects = []; state.profile = null; state.outputs = [];
  FIELDS.forEach(k => { if (fieldEl(k) && k !== 'handle' && k !== 'tone') fieldEl(k).value = ''; });
  $('#fDate').value = new Date().toISOString().slice(0, 10);
  renderThumbs(); renderSelects(); renderOutputs(); renderLibrary(); renderWeddings();
  $('#btnAnalyze').disabled = true;
  go('upload');
  toast('New wedding started');
}

$('#btnNewWedding').addEventListener('click', newWedding);
$('#btnSaveWedding').addEventListener('click', async () => {
  if (!state.profile) return toast('Analyse a gallery before saving');
  try {
    await persist();
    await renderWeddings();
    toast('Wedding saved to this browser');
  } catch (err) {
    toast(`Could not save: ${err.message}`, 4500);
  }
});

async function renderWeddings() {
  const list = $('#weddingList');
  if (!store.available()) {
    list.innerHTML = `<p class="muted">This browser has no IndexedDB, so weddings cannot be saved.</p>`;
    return;
  }
  const rows = await store.list();
  const use = await store.usage();
  $('#storageUse').textContent = use
    ? `${store.formatBytes(use.used)} used of ${store.formatBytes(use.quota)}`
    : '';

  if (!rows.length) {
    list.innerHTML = `<p class="muted">Nothing saved yet. Analyse a gallery and it is stored here automatically.</p>`;
    return;
  }

  // Covers come from the blob store, so revoke them when we re-render.
  list._urls?.forEach(u => URL.revokeObjectURL(u));
  list._urls = [];

  const cards = await Promise.all(rows.map(async r => {
    let cover = '';
    if (r.coverId) {
      const blob = await store.getBlob(`${r.id}/${r.coverId}`);
      if (blob) { cover = URL.createObjectURL(blob); list._urls.push(cover); }
    }
    const open = r.id === state.id;
    return `<div class="wed ${open ? 'open' : ''}" data-wed="${esc(r.id)}">
      ${cover ? `<img class="wed-cover" src="${esc(cover)}" alt="">`
              : `<div class="wed-cover blank">◈</div>`}
      <div class="wed-body">
        <b>${esc(r.name)}</b>
        <small>${esc(r.wedding?.venue || '—')}${r.wedding?.city ? `, ${esc(r.wedding.city)}` : ''}</small>
        <small>${r.shots.length} frames · ${(r.selectIds || []).length} selects · ${(r.outputs || []).length} assets</small>
        <small>${new Date(r.updatedAt).toLocaleString()}</small>
        ${open ? '<span class="wed-badge">Open</span>' : ''}
      </div>
      <div class="wed-actions">
        <button class="ghost tiny" data-open="${esc(r.id)}">${open ? 'Reload' : 'Open'}</button>
        <button class="ghost tiny" data-del="${esc(r.id)}">Delete</button>
      </div>
    </div>`;
  }));
  list.innerHTML = cards.join('');
}

$('#weddingList').addEventListener('click', async e => {
  const openId = e.target.dataset?.open;
  const delId = e.target.dataset?.del;
  if (openId) return openWedding(openId);
  if (delId) {
    const rec = await store.get(delId);
    if (!confirm(`Delete "${rec?.name || 'this wedding'}" and its ${rec?.shots?.length || 0} stored photos? This cannot be undone.`)) return;
    await store.remove(delId);
    if (delId === state.id) newWedding();
    await renderWeddings();
    toast('Wedding deleted');
  }
});

/* ---------------- selects view ---------------- */
$('#selectFilter').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn');
  if (!b) return;
  $$('#selectFilter .seg-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.filter = b.dataset.f;
  renderSelects();
});

function renderSelects() {
  const stats = $('#selectStats');
  const grid = $('#selectGrid');
  if (!state.profile) {
    stats.innerHTML = '';
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-mark">◎</div><p>Upload and analyse a gallery to see the selects.</p></div>`;
    return;
  }
  const p = state.profile;
  const faces = state.shots.reduce((a, s) => a + (s.m?.faces || 0), 0);
  const detected = state.shots.some(s => s.m?.faceSource === 'detector');
  stats.innerHTML = [
    [p.total, 'Frames in'],
    [state.selects.length, 'Selected'],
    [p.rejected, 'Culled'],
    [p.duplicates, 'Duplicates'],
    [p.topScore.toFixed(1), 'Top score'],
    [detected ? faces : '—', detected ? 'Faces found' : 'Faces (no detector)'],
    [`${p.mood} · ${p.palette}`, 'Light & palette'],
  ].map(([v, l]) => `<div class="stat"><div class="stat-v">${esc(v)}</div><div class="stat-l">${esc(l)}</div></div>`).join('');

  const selectIds = new Set(state.selects.map(s => s.id));
  const ranked = [...state.shots].sort((a, b) => (b.m?.score || 0) - (a.m?.score || 0));

  const rows = ranked.filter(s => {
    if (state.filter === 'all') return true;
    if (state.filter === 'rejected') return !s.m?.usable || s.dupeOf;
    if (state.filter === 'hero') return selectIds.has(s.id);
    return s.m?.type === state.filter && s.m?.usable && !s.dupeOf;
  });

  grid.innerHTML = rows.map((s, i) => {
    const m = s.m || {};
    const cut = !m.usable || s.dupeOf;
    const picked = selectIds.has(s.id);
    const rank = state.selects.findIndex(x => x.id === s.id);
    const label = cut ? (s.dupeOf ? 'DUPE' : 'CUT') : picked ? `#${rank + 1}` : `${i + 1}`;
    const bar = k => `<div class="bar"><i style="width:${Math.round((m[k] || 0) * 100)}%"></i></div>`;
    const faceTag = m.faceSource === 'detector'
      ? (m.faces ? `${m.faces} face${m.faces > 1 ? 's' : ''}` : 'no face')
      : (m.type || '—');
    return `
      <div class="shot ${cut ? 'cut' : ''} ${picked ? 'pick' : ''}">
        <img src="${esc(s.url)}" alt="${esc(s.name)}" loading="lazy">
        <div class="shot-rank ${picked ? 'top' : ''}">${esc(label)}</div>
        <div class="shot-score">${(m.score ?? 0).toFixed(1)}</div>
        <div class="shot-meta">
          <span class="shot-type">${esc(m.type || '—')}</span>
          <span>${esc(faceTag)}</span>
        </div>
        <div class="bars" title="sharpness · exposure · colour · subject · composition">
          ${bar('sharp')}${bar('exposure')}${bar('colour')}
          <div class="bar"><i style="width:${Math.round((m.subjectSize || 0) * 100)}%"></i></div>
          ${bar('composition')}
        </div>
      </div>`;
  }).join('') || `<div class="empty" style="grid-column:1/-1"><p>Nothing in this bucket.</p></div>`;
}

/* ---------------- studio ---------------- */
function renderAssetMenu() {
  $('#assetMenu').innerHTML = Object.entries(ASSETS).map(([k, a]) => `
    <button class="asset-btn" data-asset="${k}">
      <span class="asset-icon">${a.icon}</span>
      <b>${esc(a.label)}</b>
      <small>${esc(a.blurb)}</small>
    </button>`).join('') +
    `<button class="asset-btn" data-asset="__all"><span class="asset-icon">✦</span><b>Generate everything</b><small>All ${Object.keys(ASSETS).length} assets from this wedding in one pass.</small></button>`;
}

$('#assetMenu').addEventListener('click', e => {
  const b = e.target.closest('.asset-btn');
  if (!b) return;
  const kind = b.dataset.asset;
  if (kind === '__all') runPlan({ assets: Object.keys(ASSETS) });
  else runPlan({ assets: [kind] });
});

async function runPlan(plan) {
  if (!state.selects.length) {
    toast('Analyse a gallery first');
    return go('upload');
  }
  if (!billing.canGenerate(plan.assets.length)) return showPaywall();

  const w = wedding();
  if (plan.tone) { w.tone = plan.tone; $('#fTone').value = plan.tone; }
  if (plan.culture) { w.culture = plan.culture; $('#fCulture').value = plan.culture; }

  const made = [];
  for (const kind of plan.assets) {
    const opts = {};
    if (plan.seconds) opts.seconds = Math.min(billing.maxReelSeconds(), plan.seconds);
    if (plan.count) opts.count = plan.count;
    try {
      made.push(generate(kind, w, state.profile, state.selects, opts));
    } catch (err) {
      toast(`Could not generate ${kind}: ${err.message}`);
    }
  }
  if (!made.length) return;

  billing.recordAssets(made.length);
  state.outputs = [...made, ...state.outputs];
  renderOutputs();
  renderLibrary();
  renderPlanChip();
  go('studio');
  persist().catch(() => {});

  const reelAsset = made.find(m => m.kind === 'reel');
  if (reelAsset && plan.seconds) {
    $('#reelDuration').value = String(Math.min(billing.maxReelSeconds(), plan.seconds));
    buildReel();
  }

  if (ai.isEnabled()) enhanceWithAI(made, w);
}

async function enhanceWithAI(assets, w) {
  for (const asset of assets) {
    const instruction = ai.INSTRUCTIONS[asset.kind];
    if (!instruction) continue;
    const block = asset.blocks.find(b => b.t === 'copy');
    if (!block) continue;
    const original = block.text;
    block.text = '…writing with Claude…';
    renderOutputs();
    try {
      const text = await ai.write({
        wedding: w, profile: state.profile, selects: state.selects,
        asset: asset.title, instruction,
        voice: brand.voiceRules(),
      });
      block.text = brand.applyVoice(text);
      block.label = `${block.label || 'Copy'} · Claude`;
    } catch (err) {
      block.text = original;
      toast(`Claude: ${err.message}`);
      break;
    }
    renderOutputs();
  }
  persist().catch(() => {});
}

function renderOutputs() {
  const stack = $('#outputStack');
  if (!state.outputs.length) {
    stack.innerHTML = `<div class="empty"><div class="empty-mark">✦</div><p>Nothing generated yet. Pick an asset above, or type a request in the command bar.</p></div>`;
    return;
  }
  stack.innerHTML = state.outputs.map(renderOutput).join('');
}

function renderOutput(o) {
  const body = o.blocks.map(b => {
    switch (b.t) {
      case 'note':
        return `<p class="muted tiny">${esc(b.text)}</p>`;
      case 'copy':
        // The Copy button below reads the .copyblock immediately above it.
        return `${b.label ? `<h4>${esc(b.label)}</h4>` : ''}
          <div class="copyblock" data-copy>${esc(b.text)}</div>
          <div class="row-end"><span></span><button class="ghost tiny" data-copybtn>Copy</button></div>`;
      case 'tags':
        return `<h4>Hashtags</h4><div class="tags">${b.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          <div class="row-end"><span></span><button class="ghost tiny" data-copytags="${esc(b.tags.join(' '))}">Copy tags</button></div>`;
      case 'slides':
        return `<h4>Slides</h4><div class="slides">${b.slides.map(s => `
          <div class="slide">
            ${s.shot ? `<img src="${esc(s.shot.url)}" alt="">` : ''}
            <div class="slide-cap"><span class="slide-n">${s.n != null ? `Slide ${s.n}` : ''}</span>${esc(s.caption)}</div>
          </div>`).join('')}</div>`;
      case 'beats':
        return `<h4>Shot list</h4><div class="beats">${b.beats.map(x => `
          <div class="beat">
            ${x.shot ? `<img src="${esc(x.shot.url)}" alt="">` : '<div></div>'}
            <div class="beat-t">${x.start.toFixed(1)}s</div>
            <div class="beat-d"><b>${esc(x.role)}</b> — “${esc(x.text)}” <span class="muted">· holds ${x.dur.toFixed(1)}s</span></div>
          </div>`).join('')}</div>`;
      case 'pins':
        return `<h4>Pins</h4><div class="pins">${b.pins.map(p => `
          <div class="pin">
            <div class="pin-img">
              ${p.shot ? `<img src="${esc(p.shot.url)}" alt="">` : ''}
              <div class="pin-overlay">${esc(p.title)}</div>
            </div>
            <div class="pin-body">${esc(p.desc)}<br><span style="color:var(--gold)">Board: ${esc(p.board)}</span></div>
          </div>`).join('')}</div>`;
      default: return '';
    }
  }).join('');

  return `<article class="out" data-id="${esc(o.id)}">
    <div class="out-head">
      <div><div class="out-title">${esc(o.title)}</div><div class="out-sub">${esc(o.subtitle)}</div></div>
      <div class="out-actions">
        ${o.printable ? `<button class="ghost tiny" data-print>Print</button>` : ''}
        ${o.kind === 'reel' ? `<button class="ghost tiny" data-openreel>Open Reel Lab</button>` : ''}
        <button class="ghost tiny" data-regen="${esc(o.kind)}">Regenerate</button>
        <button class="ghost tiny" data-remove>Remove</button>
      </div>
    </div>
    <div class="out-body">${body}</div>
  </article>`;
}

$('#outputStack').addEventListener('click', async e => {
  const card = e.target.closest('.out');
  if (e.target.closest('[data-copybtn]')) {
    const row = e.target.closest('.row-end');
    const block = row.previousElementSibling?.matches('[data-copy]')
      ? row.previousElementSibling
      : e.target.closest('.out-body').querySelector('[data-copy]');
    if (!block) return;
    try {
      await navigator.clipboard.writeText(block.textContent);
      toast('Copied to clipboard');
    } catch {
      toast('Clipboard blocked — select the text and copy manually.');
    }
  } else if (e.target.dataset.copytags) {
    await navigator.clipboard.writeText(e.target.dataset.copytags);
    toast('Hashtags copied');
  } else if (e.target.dataset.regen) {
    runPlan({ assets: [e.target.dataset.regen] });
  } else if (e.target.matches('[data-print]')) {
    printAsset(state.outputs.find(o => o.id === card.dataset.id));
  } else if (e.target.matches('[data-remove]')) {
    state.outputs = state.outputs.filter(o => o.id !== card.dataset.id);
    renderOutputs(); renderLibrary(); persist().catch(() => {});
  } else if (e.target.matches('[data-openreel]')) {
    go('reel');
  }
});

/** Open a print-ready window for assets that carry a `printable` payload. */
function printAsset(asset) {
  if (!asset?.printable) return;
  const b = brand.get();
  const win = window.open('', '_blank', 'width=820,height=1000');
  if (!win) return toast('Allow pop-ups to print this sheet.');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${esc(asset.printable.title)}</title>
    <style>
      @page { margin: 18mm; }
      body { font: 12pt/1.7 Georgia, "Times New Roman", serif; color:#111; max-width:44em; margin:0 auto; padding:24px; }
      header { border-bottom:2px solid ${esc(b.accent)}; padding-bottom:10px; margin-bottom:22px;
               display:flex; align-items:center; gap:14px; }
      header img { max-height:46px }
      header div { font: 700 10pt/1.4 -apple-system,Helvetica,Arial,sans-serif;
                   letter-spacing:.18em; text-transform:uppercase; color:#555 }
      pre { font: inherit; white-space: pre-wrap; margin:0 }
      @media print { button { display:none } }
    </style></head><body>
    <header>${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ''}<div>${esc(b.studioName || 'Shot list')}</div></header>
    <pre>${esc(asset.printable.body)}</pre>
    <button onclick="window.print()" style="margin-top:28px;padding:9px 18px;font:inherit">Print</button>
    </body></html>`);
  win.document.close();
}

/* ---------------- command bar ---------------- */
$('#cmdGo').addEventListener('click', runCommand);
$('#cmdInput').addEventListener('keydown', e => { if (e.key === 'Enter') runCommand(); });
$('#cmdHints').addEventListener('click', e => {
  const b = e.target.closest('.hint');
  if (!b) return;
  $('#cmdInput').value = b.textContent;
  runCommand();
});

function runCommand() {
  const q = $('#cmdInput').value.trim();
  if (!q) return toast('Tell the engine what you want.');
  const plan = parse(q);
  if (!plan.assets.length) {
    return toast('Try naming an asset: carousel, reel, TikTok, Shorts, blog, pins, story, caption, BTS, testimonial, newsletter, LinkedIn, vendor tags or shot list.', 5000);
  }
  const summary = describe(plan, ASSETS);
  if (summary) toast(summary);
  runPlan(plan);
}

/* ---------------- reel lab ---------------- */
function buildReel() {
  if (!state.selects.length) return;
  const seconds = Math.min(billing.maxReelSeconds(), +$('#reelDuration').value);
  const rhythm = $('#reelRhythm').value;
  const ctx = buildContext(wedding(), state.profile, state.selects);

  // With a track loaded and snapping on, cuts land on the music's beat grid.
  // `every` widens the grid for slower rhythms so a 60 BPM ballad doesn't
  // force a cut every second.
  let grid = null;
  if (state.track && $('#snapToBeat')?.checked) {
    const every = { slow: 4, medium: 2, fast: 1 }[rhythm] ?? 2;
    grid = music.beatGrid(state.track.bpm, seconds, { offset: 0, every });
  }
  state.reelBeats = buildBeats(ctx, seconds, rhythm, grid);

  state.reel ||= new Reel($('#reelCanvas'));
  state.reel.onTick = (t, d) => {
    $('#reelTime').textContent = `${t.toFixed(1)}s / ${d.toFixed(1)}s`;
    $('#reelScrubFill').style.width = `${(t / d) * 100}%`;
    // The picture loops at the end; restart the audio with it so they
    // don't drift apart over repeated plays.
    if (t < 0.12 && state.track && state.reel.playing) state.player.play(0);
  };
  state.reel.load(state.reelBeats, seconds, {
    motion: $('#reelMotion').value,
    grade: $('#reelGrade').value,
    captions: $('#reelCaptions').checked,
  });
  state.reel.setLogo(state.logoImg);

  $('#reelTime').textContent = `0.0s / ${seconds.toFixed(1)}s`;
  $('#shotList').innerHTML = state.reelBeats.map((b, i) => `
    <div class="sl-row">
      <img src="${esc(b.shot.url)}" alt="">
      <div><div class="sl-title">${i + 1}. ${esc(b.role)}${b.onBeat ? ' <span style="color:var(--gold)">♪</span>' : ''}</div>
           <div class="sl-sub">“${esc(b.text)}”</div></div>
      <div class="sl-dur">${b.dur.toFixed(1)}s</div>
    </div>`).join('');
}

/* ---------------- music ---------------- */

function renderMoodFilter() {
  const moods = ['all', ...new Set(music.LIBRARY.map(t => t.mood))];
  $('#moodFilter').innerHTML = moods.map(m =>
    `<button class="seg-btn ${m === state.moodFilter ? 'active' : ''}" data-mood="${esc(m)}">${esc(m === 'all' ? 'All' : m)}</button>`
  ).join('');
}

function renderTracks() {
  const rows = music.LIBRARY.filter(t => state.moodFilter === 'all' || t.mood === state.moodFilter);
  $('#trackList').innerHTML = rows.map(t => `
    <button class="track ${state.track?.id === t.id ? 'active' : ''}" data-track="${esc(t.id)}">
      <span class="track-play">▶</span>
      <span>
        <span class="track-mood">${esc(t.mood)}</span>
        <span class="track-name">${esc(t.name)}</span>
        <span class="track-blurb">${esc(t.blurb)}</span>
      </span>
      <span class="track-bpm">${t.bpm}<br>BPM</span>
    </button>`).join('');
}

function renderUploads() {
  const list = $('#uploadList');
  if (!state.uploads.length) {
    list.innerHTML = `<p class="muted tiny" style="padding:10px 2px">No songs uploaded this session.</p>`;
    return;
  }
  list.innerHTML = state.uploads.map(t => `
    <button class="track ${state.track?.id === t.id ? 'active' : ''}" data-upload="${esc(t.id)}">
      <span class="track-play">▶</span>
      <span>
        <span class="track-mood">Your upload</span>
        <span class="track-name">${esc(t.name)}</span>
        <span class="track-blurb">${Math.round(t.buffer.duration)}s · detected tempo</span>
      </span>
      <span class="track-bpm">${t.bpm}<br>BPM</span>
    </button>`).join('');
}

function drawWaveform() {
  const c = $('#waveform');
  if (!c || !state.track) return;
  const g = c.getContext('2d');
  // Match the backing store to the CSS box so the peaks aren't stretched.
  const rect = c.getBoundingClientRect();
  c.width = Math.max(300, Math.round(rect.width));
  const W = c.width, H = c.height;
  const peaks = music.waveform(state.track.buffer, Math.floor(W / 3));
  g.clearRect(0, 0, W, H);

  const barW = W / peaks.length;
  const trimAt = state.player.trim / state.track.buffer.duration;
  peaks.forEach((p, i) => {
    const h = Math.max(1.5, p * H * 0.86);
    g.fillStyle = (i / peaks.length) < trimAt ? 'rgba(125,114,106,.45)' : '#c9a227';
    g.fillRect(i * barW, (H - h) / 2, Math.max(1, barW - 1), h);
  });

  // Beat markers, so "cut on the beat" is visible rather than asserted.
  const dur = Math.min(state.track.buffer.duration, +$('#reelDuration').value);
  const grid = music.beatGrid(state.track.bpm, dur, { every: 4 });
  g.fillStyle = 'rgba(253,249,242,.35)';
  for (const t of grid) {
    const x = (t / dur) * W;
    g.fillRect(x, 0, 1, H);
  }
}

async function selectTrack(track) {
  state.track = track;
  state.player.load(track.buffer);
  state.player.trim = 0;
  state.player.setVolume(+$('#trackVolume').value);

  $('#nowPlaying').hidden = false;
  $('#npName').textContent = track.name;
  $('#npMeta').textContent =
    `${track.source === 'library' ? 'Library · royalty-free' : 'Your upload'} · ${Math.round(track.buffer.duration)}s`;
  $('#trackTrim').max = String(Math.max(1, Math.floor(track.buffer.duration - 5)));
  $('#trackTrim').value = '0';
  $('#trackBpm').value = String(track.bpm);
  syncBpmHint();

  renderTracks(); renderUploads(); drawWaveform();
  buildReel();      // re-cut to the new tempo
}

/**
 * Library tempos are exact by construction. Detected tempos are a starting
 * point — onset-based detection lands on a subdivision or a multiple often
 * enough that the honest thing is to say so and make correcting it one click.
 */
function syncBpmHint() {
  const t = state.track;
  const el = $('#bpmHint');
  if (!t) { el.textContent = ''; return; }
  if (t.source === 'library') {
    el.textContent = 'Exact — this track was generated at this tempo.';
    return;
  }
  const conf = t.confidence ?? 0;
  el.textContent = conf > 0.45
    ? 'Detected from the audio. If the cuts feel half- or double-time, use ÷2 or ×2.'
    : 'Detected, but this track has a weak pulse — check it by ear and use Tap if the cuts drift.';
}

function setBpm(bpm) {
  if (!state.track) return;
  const v = Math.max(40, Math.min(220, Math.round(bpm)));
  state.track.bpm = v;
  $('#trackBpm').value = String(v);
  drawWaveform();
  buildReel();
}

$('#trackBpm').addEventListener('change', e => setBpm(+e.target.value));
$('#btnBpmHalf').addEventListener('click', () => setBpm(state.track.bpm / 2));
$('#btnBpmDouble').addEventListener('click', () => setBpm(state.track.bpm * 2));

// Tap tempo: average the gaps between taps, discarding a stale run.
let taps = [];
$('#btnTapTempo').addEventListener('click', () => {
  const now = performance.now();
  if (taps.length && now - taps.at(-1) > 2200) taps = [];
  taps.push(now);
  const btn = $('#btnTapTempo');
  btn.classList.add('tapping');
  setTimeout(() => btn.classList.remove('tapping'), 120);

  if (taps.length < 3) {
    $('#bpmHint').textContent = `Keep tapping — ${3 - taps.length} more.`;
    return;
  }
  if (taps.length > 8) taps = taps.slice(-8);
  const gaps = taps.slice(1).map((t, i) => t - taps[i]);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  setBpm(60000 / avg);
  $('#bpmHint').textContent = `Tapped ${state.track.bpm} BPM from ${taps.length} taps.`;
});

$('#musicSource').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn');
  if (!b) return;
  $$('#musicSource .seg-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  const lib = b.dataset.src === 'library';
  $('#musicLibrary').hidden = !lib;
  $('#musicUpload').hidden = lib;
});

$('#moodFilter').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn');
  if (!b) return;
  state.moodFilter = b.dataset.mood;
  renderMoodFilter(); renderTracks();
});

$('#trackList').addEventListener('click', async e => {
  const btn = e.target.closest('[data-track]');
  if (!btn) return;
  const id = btn.dataset.track;
  if (state.track?.id === id) return;   // already loaded
  btn.classList.add('loading');
  try {
    const seconds = Math.min(billing.maxReelSeconds(), +$('#reelDuration').value);
    // Render exactly the length the reel needs, so the fade-out lands on the end.
    const track = await music.renderTrack(id, seconds);
    await selectTrack(track);
    toast(`${track.name} loaded — ${track.bpm} BPM`);
  } catch (err) {
    toast(`Could not load that track: ${err.message}`);
  } finally {
    btn.classList.remove('loading');
  }
});

$('#uploadList').addEventListener('click', e => {
  const btn = e.target.closest('[data-upload]');
  if (!btn) return;
  const track = state.uploads.find(t => t.id === btn.dataset.upload);
  if (track) selectTrack(track);
});

const audioDrop = $('#audioDrop');
['dragenter', 'dragover'].forEach(ev =>
  audioDrop.addEventListener(ev, e => { e.preventDefault(); audioDrop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev =>
  audioDrop.addEventListener(ev, e => { e.preventDefault(); audioDrop.classList.remove('over'); }));
audioDrop.addEventListener('drop', e =>
  takeAudio([...e.dataTransfer.files].filter(f => f.type.startsWith('audio/'))[0]));

$('#btnAudioPick').addEventListener('click', () => $('#audioPicker').click());
$('#audioPicker').addEventListener('change', e => takeAudio(e.target.files[0]));

async function takeAudio(file) {
  if (!file) return;
  if (file.size > 40_000_000) return toast('Audio file must be under 40 MB');
  toast('Decoding and analysing tempo…');
  try {
    const track = await music.decodeUpload(file);
    state.uploads.unshift(track);
    renderUploads();
    await selectTrack(track);
    toast(`${track.name} — detected ${track.bpm} BPM`);
  } catch (err) {
    toast(`Could not decode that file: ${err.message}`, 4500);
  }
}

$('#btnClearTrack').addEventListener('click', () => {
  state.player.stop();
  state.track = null;
  $('#nowPlaying').hidden = true;
  renderTracks(); renderUploads(); buildReel();
  toast('Track removed — the reel is silent');
});

$('#trackVolume').addEventListener('input', e => state.player.setVolume(+e.target.value));
$('#trackTrim').addEventListener('input', e => {
  state.player.trim = +e.target.value;
  drawWaveform();
  if (state.reel?.playing) state.player.play(state.reel.t);
});
$('#snapToBeat').addEventListener('change', () => {
  buildReel();
  toast($('#snapToBeat').checked ? 'Cuts snapped to the beat grid' : 'Cuts back to weighted timing');
});

['#reelDuration', '#reelRhythm', '#reelMotion', '#reelGrade', '#reelCaptions'].forEach(sel =>
  $(sel).addEventListener('change', () => {
    const want = +$('#reelDuration').value;
    const cap = billing.maxReelSeconds();
    if (want > cap) {
      $('#reelDuration').value = String(cap);
      toast(`Your plan caps reels at ${cap} seconds`);
    }
    buildReel();
  }));

$('#btnBuildReel').addEventListener('click', () => { buildReel(); toast('Reel rebuilt'); });
$('#btnPlayReel').addEventListener('click', () => {
  if (!state.reel || !state.reelBeats.length) return toast('Analyse a gallery first');
  state.reel.toggle();
  // Picture and sound share the reel's clock — the transport drives both.
  if (state.reel.playing) state.player.play(state.reel.t);
  else state.player.stop();
  $('#btnPlayReel').textContent = state.reel.playing ? '❚❚ Pause' : '▶ Play';
});

$('#btnExportReel').addEventListener('click', async () => {
  if (!state.reel || !state.reelBeats.length) return toast('Nothing to export yet');
  const btn = $('#btnExportReel');
  btn.disabled = true;
  state.player.stop();
  $('#btnPlayReel').textContent = '▶ Play';

  const silent = $('#muteExport').checked || !state.track;
  try {
    toast(silent
      ? 'Recording in real time — keep this tab visible until it finishes.'
      : 'Recording picture and sound in real time — keep this tab visible.', 6000);
    const blob = await state.reel.export({
      height: billing.exportHeight(),
      audioTrack: silent ? null : state.player.exportTrack(),
      onAudioStart: silent ? null : () => state.player.play(0),
      onProgress: p => { btn.textContent = `⬇ ${Math.round(p * 100)}%`; },
    });
    state.player.stop();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const w = wedding();
    a.download = `${(w.bride || 'wedding')}-${(w.groom || 'reel')}-reel.webm`.toLowerCase().replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Reel exported');
  } catch (err) {
    toast(`Export failed: ${err.message}`);
  } finally {
    state.player.stop();
    btn.disabled = false;
    btn.textContent = '⬇ Export .webm';
  }
});

/* ---------------- library (assets in the open wedding) ---------------- */
function renderLibrary() {
  const list = $('#libraryList');
  if (!state.outputs.length) {
    list.innerHTML = `<p class="muted">Nothing generated for this wedding yet.</p>`;
    return;
  }
  list.innerHTML = state.outputs.map(o => `
    <div class="lib-row">
      <div><b>${esc(o.title)}</b><small>${esc(o.subtitle)} · ${new Date(o.createdAt).toLocaleString()}</small></div>
      <button class="ghost tiny" data-jump="${esc(o.id)}">View</button>
    </div>`).join('');
}
$('#libraryList').addEventListener('click', e => {
  const id = e.target.dataset?.jump;
  if (!id) return;
  go('studio');
  setTimeout(() => document.querySelector(`.out[data-id="${id}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
});

/* ---------------- brand kit ---------------- */
const B_FIELDS = {
  bStudio: 'studioName', bLogoPos: 'logoPosition', bLogoOpacity: 'logoOpacity',
  bAccent: 'accent', bInk: 'ink', bGradeFromBrand: 'gradeFromBrand',
  bSignature: 'signature', bVoice: 'voice', bBanned: 'banned',
};

function syncBrandUI() {
  const b = brand.get();
  for (const [elId, key] of Object.entries(B_FIELDS)) {
    const el = $(`#${elId}`);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = Boolean(b[key]);
    else el.value = b[key] ?? '';
  }
  const prev = $('#logoPreview');
  prev.innerHTML = b.logo ? `<img src="${esc(b.logo)}" alt="logo">` : '<span>No logo</span>';
  $('#brandSwatches').innerHTML = [
    ['accent', b.accent], ['caption ink', b.ink], ['shadow', b.shadow],
  ].map(([label, hex]) =>
    `<div class="swatch" style="background:${esc(hex)};color:${label === 'shadow' ? '#f4efe8' : '#1a1410'}">${esc(hex)}</div>`
  ).join('');
  loadLogoImage(b.logo);
}

async function loadLogoImage(dataUrl) {
  if (!dataUrl) { state.logoImg = null; state.reel?.setLogo(null); return; }
  try {
    state.logoImg = await loadImage(dataUrl);
    state.reel?.setLogo(state.logoImg);
  } catch {
    state.logoImg = null;
  }
}

Object.entries(B_FIELDS).forEach(([elId, key]) => {
  const el = $(`#${elId}`);
  if (!el) return;
  el.addEventListener('input', () => {
    const value = el.type === 'checkbox' ? el.checked
      : el.type === 'range' ? +el.value
      : el.value;
    brand.set({ [key]: value });
    if (['accent', 'ink', 'gradeFromBrand', 'logoPosition', 'logoOpacity'].includes(key)) {
      $('#brandSwatches') && syncSwatches();
      state.reel?.draw(state.reel.t);
    }
  });
});

function syncSwatches() {
  const b = brand.get();
  $('#brandSwatches').innerHTML = [
    ['accent', b.accent], ['caption ink', b.ink], ['shadow', b.shadow],
  ].map(([label, hex]) =>
    `<div class="swatch" style="background:${esc(hex)};color:${label === 'shadow' ? '#f4efe8' : '#1a1410'}">${esc(hex)}</div>`
  ).join('');
}

$('#btnLogoPick').addEventListener('click', () => {
  if (billing.current().id === 'starter') {
    toast('Logo watermarking is a Studio feature — upgrade to enable it.', 4000);
    return go('billing');
  }
  $('#logoPicker').click();
});
$('#logoPicker').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2_000_000) return toast('Logo must be under 2 MB');
  const reader = new FileReader();
  reader.onload = () => { brand.set({ logo: reader.result }); syncBrandUI(); toast('Logo saved'); };
  reader.readAsDataURL(file);
});
$('#btnLogoClear').addEventListener('click', () => {
  brand.set({ logo: null }); syncBrandUI(); toast('Logo removed');
});
$('#btnBrandReset').addEventListener('click', () => {
  if (!confirm('Reset the whole brand kit to defaults?')) return;
  brand.reset(); syncBrandUI(); state.reel?.draw(state.reel.t); toast('Brand kit reset');
});
$('#btnBrandTest').addEventListener('click', () => {
  const box = $('#brandPreview');
  const sample = 'This was a stunning, absolutely gorgeous day and I am literally obsessed with every magical frame.';
  const after = brand.applyVoice(sample);
  const sig = brand.signature(wedding().handle || '@yourstudio');
  const rules = brand.voiceRules();
  box.hidden = false;
  box.textContent =
    `BEFORE\n${sample}\n\nAFTER YOUR RULES\n${after}${sig ? `\n\n${sig}` : ''}` +
    (rules ? `\n\n---\nSent to Claude as voice rules:\n${rules}` : '\n\n---\nNo voice rules set yet.');
});

/* ---------------- billing ---------------- */
function planCard(p) {
  const cur = billing.current().id === p.id;
  return `<div class="plan ${p.featured ? 'featured' : ''}">
    ${p.featured ? '<div class="plan-tag">Most popular</div>' : ''}
    <h4>${esc(p.name)}</h4>
    <div class="blurb">${esc(p.blurb)}</div>
    <div class="price">${billing.naira(p.price)}<small> /month</small></div>
    <ul>${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <button class="${cur ? 'ghost' : 'primary'}" data-plan="${p.id}" ${cur ? 'disabled' : ''}>
      ${cur ? 'Current plan' : `Choose ${esc(p.name)}`}
    </button>
  </div>`;
}

function renderPlans() {
  const html = Object.values(billing.PLANS).map(p => planCard(p)).join('');
  $('#plansGrid').innerHTML = html;
  $('#paywallPlans').innerHTML = html;
}

function renderPlanChip() {
  const p = billing.current();
  const u = billing.usage();
  $('#planChip').querySelector('.plan-name').textContent = p.name;
  const pct = p.assetsPerMonth === Infinity ? 8 : Math.min(100, (u.assets / p.assetsPerMonth) * 100);
  $('#planMeterFill').style.width = `${pct}%`;
  $('#planUsage').textContent = p.assetsPerMonth === Infinity
    ? `${u.assets} assets · unlimited`
    : `${u.assets} / ${p.assetsPerMonth} assets`;
}

document.addEventListener('click', e => {
  const id = e.target.dataset?.plan;
  if (!id) return;
  // Real money belongs behind a server-verified Paystack/Flutterwave webhook.
  billing.setPlan(id);
  renderPlans(); renderPlanChip();
  $('#paywall').hidden = true;
  toast(`Switched to ${billing.PLANS[id].name} — ${billing.naira(billing.PLANS[id].price)}/month`);
});

const showPaywall = () => { $('#paywall').hidden = false; };
$('#btnClosePaywall').addEventListener('click', () => { $('#paywall').hidden = true; });
$('#btnUpgradeSide').addEventListener('click', () => go('billing'));

/* ---------------- live AI settings ---------------- */
function syncAIUI() {
  const c = ai.config();
  $('#fApiKey').value = c.apiKey || '';
  $('#fModel').value = c.model;
  $('#fUseAI').checked = Boolean(c.enabled);
  $('#aiStatus').textContent = ai.isEnabled() ? `Claude ${c.model} active` : 'Local engine active';
}
$('#fApiKey').addEventListener('change', e => { ai.setConfig({ apiKey: e.target.value.trim() }); syncAIUI(); });
$('#fModel').addEventListener('change', e => { ai.setConfig({ model: e.target.value }); syncAIUI(); });
$('#fUseAI').addEventListener('change', e => {
  if (e.target.checked && !ai.config().apiKey) {
    e.target.checked = false;
    return toast('Paste an API key first');
  }
  ai.setConfig({ enabled: e.target.checked });
  syncAIUI();
  toast(e.target.checked ? 'Copy will be written by Claude' : 'Back to the local engine');
});
$('#btnTestAI').addEventListener('click', async () => {
  if (!ai.config().apiKey) return toast('Paste an API key first');
  $('#btnTestAI').disabled = true;
  try {
    toast(`Connected — model replied "${await ai.ping()}"`);
  } catch (err) {
    toast(`Connection failed: ${err.message}`, 5000);
  } finally {
    $('#btnTestAI').disabled = false;
  }
});

/* ---------------- boot ---------------- */

// The app shell starts hidden behind the landing page, so anything that
// measures layout (the waveform's backing store, the reel canvas) has to be
// redrawn once it becomes visible.
window.addEventListener('aso:entered', () => {
  if (state.track) drawWaveform();
  if (state.reel) state.reel.draw(state.reel.t);
});

renderAssetMenu();
renderSelects();
renderOutputs();
renderLibrary();
renderPlans();
renderPlanChip();
syncAIUI();
syncBrandUI();
renderWeddings();
renderMoodFilter();
renderTracks();
renderUploads();
$('#fDate').value = new Date().toISOString().slice(0, 10);

// Reopen the most recent wedding so a refresh doesn't lose the session.
// Decoding the gallery takes a moment, so if the user has already clicked
// into a view by the time it lands, leave them where they are.
(async () => {
  if (!store.available()) return;
  const [recent] = await store.list();
  if (!recent) return;
  await openWedding(recent.id, { restoreView: false });
  if (!state.userNavigated) go('upload');
})().catch(() => {});
