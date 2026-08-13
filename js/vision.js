/* ============================================================
   vision.js — pixel-level image analysis, all in-browser.

   For each photo we compute:
     sharpness   Laplacian variance on a downsampled luma plane
     exposure    histogram balance + clipping penalty
     contrast    luma standard deviation
     colour      Hasler–Süsstrunk colourfulness metric
     subject     skin-tone pixel ratio (a cheap "are there people" proxy)
     composition energy concentrated near rule-of-thirds intersections
     warmth      R-vs-B bias, used for grading + culture cues
     hash        64-bit dHash for near-duplicate clustering
   Those feed a weighted score and a shot-type classification.
   ============================================================ */

const WORK = 256;              // analysis resolution (long edge)
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

/** Draw an image into the work canvas and pull raw pixels. */
function sample(img) {
  const ratio = img.naturalWidth / img.naturalHeight;
  const w = ratio >= 1 ? WORK : Math.round(WORK * ratio);
  const h = ratio >= 1 ? Math.round(WORK / ratio) : WORK;
  canvas.width = w; canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

const lumaOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Laplacian variance — the standard "is this in focus" measure. */
function sharpness(luma, w, h) {
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - w] - luma[i + w];
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  // ~0 for a soft frame, 1500+ for a crisp one. Compress to 0..1.
  return Math.min(1, Math.sqrt(variance) / 26);
}

/** Reward a full tonal range; punish blown highlights and crushed blacks. */
function exposure(luma) {
  const hist = new Uint32Array(64);
  for (let i = 0; i < luma.length; i++) hist[(luma[i] >> 2) & 63]++;
  const total = luma.length;
  const clipLow = hist[0] / total;
  const clipHigh = hist[63] / total;
  let occupied = 0;
  for (let i = 0; i < 64; i++) if (hist[i] / total > 0.0015) occupied++;
  const spread = occupied / 64;
  const mean = luma.reduce((a, b) => a + b, 0) / total / 255;
  // ideal mean luma sits around 0.45 for editorial wedding work
  const midtone = 1 - Math.min(1, Math.abs(mean - 0.45) / 0.45);
  const clipPenalty = Math.min(1, (Math.max(0, clipLow - 0.02) + Math.max(0, clipHigh - 0.02)) * 6);
  return { score: Math.max(0, spread * 0.45 + midtone * 0.55 - clipPenalty), mean };
}

function contrast(luma) {
  const n = luma.length;
  let sum = 0; for (let i = 0; i < n; i++) sum += luma[i];
  const mean = sum / n;
  let sq = 0; for (let i = 0; i < n; i++) { const d = luma[i] - mean; sq += d * d; }
  return Math.min(1, Math.sqrt(sq / n) / 68);
}

/** Hasler–Süsstrunk colourfulness. */
function colourfulness(data) {
  let rgSum = 0, rgSq = 0, ybSum = 0, ybSq = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    rgSum += rg; rgSq += rg * rg;
    ybSum += yb; ybSq += yb * yb;
    n++;
  }
  const rgMean = rgSum / n, ybMean = ybSum / n;
  const rgStd = Math.sqrt(Math.max(0, rgSq / n - rgMean * rgMean));
  const ybStd = Math.sqrt(Math.max(0, ybSq / n - ybMean * ybMean));
  const std = Math.hypot(rgStd, ybStd);
  const mean = Math.hypot(rgMean, ybMean);
  return Math.min(1, (std + 0.3 * mean) / 110);
}

/**
 * Skin-tone ratio in YCbCr — a fast stand-in for face detection that works
 * across the full range of skin tones, which matters a great deal here.
 * Also reports where in the frame those pixels sit, so we can tell a tight
 * portrait from a wide shot with people in it.
 */
function subject(data, w, h) {
  let hits = 0, cx = 0, cy = 0, total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const yv = lumaOf(r, g, b);
      if (cb >= 77 && cb <= 135 && cr >= 130 && cr <= 180 && yv > 24) {
        hits++; cx += x; cy += y;
      }
      total++;
    }
  }
  const ratio = hits / total;
  return {
    ratio,
    cx: hits ? cx / hits / w : 0.5,
    cy: hits ? cy / hits / h : 0.5,
  };
}

/** How much gradient energy falls near the rule-of-thirds intersections. */
function composition(luma, w, h) {
  const points = [[1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]];
  let near = 0, all = 0;
  const radius = Math.min(w, h) * 0.18;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      const gx = luma[i + 1] - luma[i - 1];
      const gy = luma[i + w] - luma[i - w];
      const e = Math.abs(gx) + Math.abs(gy);
      all += e;
      for (const [px, py] of points) {
        if (Math.hypot(x - px * w, y - py * h) < radius) { near += e; break; }
      }
    }
  }
  if (!all) return 0.5;
  // 4 circles cover roughly 25–30% of the frame; above that is "well placed".
  return Math.min(1, (near / all) / 0.34);
}

/** 64-bit difference hash, returned as a hex string. */
function dHash(luma, w, h) {
  const gw = 9, gh = 8;
  const small = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const sx = Math.floor(x / gw * w), sy = Math.floor(y / gh * h);
      small[y * gw + x] = luma[sy * w + sx];
    }
  }
  let bits = '';
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw - 1; x++)
      bits += small[y * gw + x] < small[y * gw + x + 1] ? '1' : '0';
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/** Bucket a frame into the shot types a wedding edit is built from. */
function classify(m) {
  const { subjectRatio, subjectSize, colour, brightness, aspect, sharp } = m;
  if (subjectRatio > 0.11 && subjectSize > 0.22) return 'portrait';
  if (subjectRatio > 0.045 && colour > 0.5 && brightness < 0.42) return 'party';
  if (subjectRatio > 0.045) return aspect > 1.25 ? 'wide' : 'portrait';
  if (sharp > 0.55 && colour > 0.42) return 'detail';
  if (aspect > 1.3) return 'wide';
  return 'detail';
}

/**
 * Analyse one loaded HTMLImageElement.
 * Returns a plain metrics object — no DOM references held.
 */
export function analyze(img) {
  const { data, w, h } = sample(img);
  const luma = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    luma[p] = lumaOf(data[i], data[i + 1], data[i + 2]);
  }

  const sharp = sharpness(luma, w, h);
  const exp = exposure(luma);
  const con = contrast(luma);
  const col = colourfulness(data);
  const subj = subject(data, w, h);
  const comp = composition(luma, w, h);

  let rSum = 0, bSum = 0;
  for (let i = 0; i < data.length; i += 4) { rSum += data[i]; bSum += data[i + 2]; }
  const warmth = Math.max(0, Math.min(1, 0.5 + (rSum - bSum) / (rSum + bSum + 1) * 1.6));

  // spread of skin pixels ≈ how large the subject is in frame
  const subjectSize = Math.min(1, Math.sqrt(subj.ratio) * 2.2);

  const m = {
    sharp,
    exposure: exp.score,
    brightness: exp.mean,
    contrast: con,
    colour: col,
    subjectRatio: subj.ratio,
    subjectSize,
    subjectX: subj.cx,
    subjectY: subj.cy,
    composition: comp,
    warmth,
    aspect: img.naturalWidth / img.naturalHeight,
    width: img.naturalWidth,
    height: img.naturalHeight,
    hash: dHash(luma, w, h),
  };
  m.type = classify(m);

  // Weighted score. Technical quality gates everything — a beautiful moment
  // that is out of focus still can't go in a carousel — then human presence
  // and composition decide the ordering among technically fine frames.
  const humanBonus = Math.min(1, m.subjectRatio * 6);
  m.score = Math.round(1000 * (
    sharp * 0.30 +
    exp.score * 0.18 +
    con * 0.08 +
    col * 0.12 +
    humanBonus * 0.20 +
    comp * 0.12
  )) / 10;

  // Hard vetoes: nothing badly soft or badly exposed reaches a select.
  m.usable = sharp > 0.20 && exp.score > 0.22;
  return m;
}

/* ============================================================
   Face detection.

   The skin-tone ratio above is fast and works on every browser, but it will
   happily read a terracotta wall or a wooden table as a subject. Where the
   browser exposes the FaceDetector API we use it to get the real answer and
   fold it back into the classification and score; elsewhere the proxy stands.
   ============================================================ */

let detector = null;
let detectorChecked = false;

export function faceDetectionAvailable() {
  if (!detectorChecked) {
    detectorChecked = true;
    try {
      if (typeof window !== 'undefined' && 'FaceDetector' in window) {
        detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 12 });
      }
    } catch { detector = null; }
  }
  return Boolean(detector);
}

/** Returns [{x,y,w,h}] in normalised 0..1 coordinates, or null if unsupported. */
export async function detectFaces(img) {
  if (!faceDetectionAvailable()) return null;
  try {
    const faces = await detector.detect(img);
    return faces.map(f => ({
      x: f.boundingBox.x / img.naturalWidth,
      y: f.boundingBox.y / img.naturalHeight,
      w: f.boundingBox.width / img.naturalWidth,
      h: f.boundingBox.height / img.naturalHeight,
    }));
  } catch {
    return null;   // detector can throw on odd image sizes; fall back quietly
  }
}

/**
 * Fold a face list into an existing metrics object: re-derives subject size
 * and position from real geometry, re-classifies, and re-scores.
 * Mutates and returns `m`.
 */
export function applyFaces(m, faces) {
  if (!faces) { m.faceSource = 'skin-tone'; return m; }

  m.faceSource = 'detector';
  m.faces = faces.length;
  m.faceArea = faces.reduce((a, f) => a + f.w * f.h, 0);

  if (faces.length) {
    // Weight the centroid by face area so the Reel frames the closest subject.
    let wx = 0, wy = 0, tot = 0;
    for (const f of faces) {
      const area = f.w * f.h;
      wx += (f.x + f.w / 2) * area;
      wy += (f.y + f.h / 2) * area;
      tot += area;
    }
    m.subjectX = wx / tot;
    // Bias upward a little: framing on the eyeline reads better than on the box centre.
    m.subjectY = Math.max(0.12, wy / tot - 0.04);
    m.subjectSize = Math.min(1, Math.sqrt(m.faceArea) * 3.2);
  } else {
    m.subjectSize = 0;
  }

  // Re-classify with real evidence rather than the colour proxy.
  const largest = faces.length ? Math.max(...faces.map(f => f.w * f.h)) : 0;
  if (faces.length >= 4) m.type = 'party';
  else if (largest > 0.045) m.type = 'portrait';
  else if (faces.length >= 1) m.type = m.aspect > 1.25 ? 'wide' : 'portrait';
  else if (m.sharp > 0.55 && m.colour > 0.42) m.type = 'detail';
  else m.type = m.aspect > 1.3 ? 'wide' : 'detail';

  // Re-score. A confirmed face is worth more than a skin-coloured region,
  // and a frame with no face at all should not be carrying a human bonus.
  const humanBonus = faces.length
    ? Math.min(1, 0.55 + Math.sqrt(largest) * 2.2)
    : 0;
  m.score = Math.round(1000 * (
    m.sharp * 0.30 +
    m.exposure * 0.18 +
    m.contrast * 0.08 +
    m.colour * 0.12 +
    humanBonus * 0.20 +
    m.composition * 0.12
  )) / 10;

  return m;
}

/** Load a File/Blob/URL into an <img> we can analyse and draw from. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = src;
  });
}
