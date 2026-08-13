/* ============================================================
   demo.js — a synthetic wedding gallery.

   Generates procedural frames so the scoring engine can be exercised
   without uploading real photographs. They're deliberately uneven:
   some soft, some blown out, some near-duplicates, so the curator has
   something real to reject.
   ============================================================ */

const PALETTES = {
  portrait: [['#f0d9b8', '#8b5e3c'], ['#e8c9a0', '#6b4226'], ['#f5e0c0', '#a0704a']],
  detail:   [['#f3e6cf', '#c9a227'], ['#efe4d4', '#b4552d'], ['#f7f0e2', '#8a7c4f']],
  wide:     [['#dfe6ef', '#3c4a5e'], ['#f2e8d8', '#6d5a3f'], ['#c9d6e0', '#2e3a4a']],
  party:    [['#2a1f1a', '#c9a227'], ['#1c1a24', '#b4552d'], ['#241a20', '#d4832f']],
};

const rnd = (seed) => {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
};

function frame(kind, seed, { blur = 0, exposure = 1, w = 1200, h = 1500 } = {}) {
  const r = rnd(seed);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const [light, dark] = PALETTES[kind][Math.floor(r() * PALETTES[kind].length)];

  // Ground
  const bg = g.createLinearGradient(0, 0, w * 0.6, h);
  bg.addColorStop(0, light);
  bg.addColorStop(1, dark);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  // Soft light falloff
  const glow = g.createRadialGradient(w * (0.3 + r() * 0.4), h * 0.3, 10, w * 0.5, h * 0.5, h * 0.9);
  glow.addColorStop(0, 'rgba(255,244,222,0.55)');
  glow.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);

  if (kind === 'portrait' || kind === 'party') {
    // Skin-tone forms so the subject detector has something to find.
    const people = kind === 'portrait' ? 2 : 3 + Math.floor(r() * 3);
    for (let i = 0; i < people; i++) {
      const scale = kind === 'portrait' ? 0.30 + r() * 0.10 : 0.13 + r() * 0.08;
      const cx = w * (0.22 + r() * 0.56);
      const cy = h * (kind === 'portrait' ? 0.34 + r() * 0.10 : 0.42 + r() * 0.24);
      const rad = w * scale * 0.42;
      const tone = ['#8d5524', '#c68642', '#7a4a22', '#a9713f', '#5c3317'][Math.floor(r() * 5)];
      g.fillStyle = tone;
      g.beginPath(); g.ellipse(cx, cy, rad * 0.72, rad, 0, 0, Math.PI * 2); g.fill();      // head
      g.beginPath(); g.ellipse(cx, cy + rad * 1.9, rad * 1.5, rad * 1.6, 0, 0, Math.PI * 2); g.fill(); // shoulders
      // garment
      g.fillStyle = ['#c9a227', '#6d2e46', '#1f3a5f', '#8a1c3b', '#2f5d3a'][Math.floor(r() * 5)];
      g.beginPath(); g.ellipse(cx, cy + rad * 3.1, rad * 1.9, rad * 2.1, 0, 0, Math.PI * 2); g.fill();
    }
  } else if (kind === 'detail') {
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.35})`;
      g.lineWidth = 1 + r() * 5;
      g.beginPath();
      g.arc(w * r(), h * r(), 20 + r() * 190, 0, Math.PI * (0.6 + r() * 1.4));
      g.stroke();
    }
    g.fillStyle = 'rgba(201,162,39,0.55)';
    for (let i = 0; i < 8; i++) {
      g.beginPath(); g.arc(w * r(), h * r(), 8 + r() * 30, 0, Math.PI * 2); g.fill();
    }
  } else { // wide
    g.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i < 9; i++) {
      const x = w * r(), y = h * (0.45 + r() * 0.4);
      g.fillRect(x, y, 40 + r() * 130, h - y);
    }
    g.fillStyle = 'rgba(20,16,12,0.35)';
    g.fillRect(0, h * 0.72, w, h * 0.28);
  }

  // Fine grain — keeps sharpness scores realistic
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 26;
    d[i] = Math.max(0, Math.min(255, d[i] * exposure + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * exposure + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * exposure + n));
  }
  g.putImageData(img, 0, 0);

  if (blur > 0) {
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tg = tmp.getContext('2d');
    tg.filter = `blur(${blur}px)`;
    tg.drawImage(c, 0, 0);
    return tmp.toDataURL('image/jpeg', 0.9);
  }
  return c.toDataURL('image/jpeg', 0.9);
}

/** A believable gallery: mostly good, some rejects, a couple of bursts. */
export function demoGallery() {
  const plan = [
    ['portrait', {}], ['portrait', {}], ['portrait', { blur: 6 }],
    ['detail', {}], ['detail', {}], ['detail', { exposure: 1.55 }],
    ['wide', {}], ['wide', {}], ['wide', { blur: 9 }],
    ['party', {}], ['party', {}], ['party', { exposure: 0.35 }],
    ['portrait', {}], ['detail', {}], ['party', {}],
    ['wide', {}], ['portrait', {}], ['detail', {}],
  ];
  const out = [];
  plan.forEach(([kind, opts], i) => {
    const seed = 9001 + i * 137;
    out.push({ name: `DSC_${String(1200 + i * 3).padStart(5, '0')}.jpg`, url: frame(kind, seed, opts) });
    // Every fourth frame gets a near-identical sibling, as a real burst would.
    if (i % 4 === 1) {
      out.push({ name: `DSC_${String(1201 + i * 3).padStart(5, '0')}.jpg`, url: frame(kind, seed + 1, opts) });
    }
  });
  return out;
}

export const DEMO_WEDDING = {
  bride: 'Adaeze',
  groom: 'Tobenna',
  venue: 'Balmoral Convention Centre',
  city: 'Lagos',
  culture: 'igbo',
  tone: 'luxury',
  handle: '@goldenhourstudio',
  date: new Date().toISOString().slice(0, 10),
  vendors: 'Planner: Trina Events, Dress: Yartel Bridal, Makeup: Bimpe Onakoya, Cake: Cakes by Tosin',
};
