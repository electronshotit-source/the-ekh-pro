/* ============================================================
   billing.js — subscription tiers and quota gating.

   This is the entitlement layer only: it decides what the UI allows.
   It deliberately does NOT collect card details or process payment —
   wire the "Choose plan" button to Paystack or Flutterwave Checkout
   server-side, and have your backend flip the plan after a verified
   webhook. Never trust a client-side plan flag for real money.
   ============================================================ */

export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 5000,
    blurb: 'For the solo photographer shooting a couple of weddings a month.',
    assetsPerMonth: 40,
    weddingsPerMonth: 4,
    features: [
      '40 generated assets / month',
      '4 weddings / month',
      'All 14 asset types',
      'Automatic image scoring & selects',
      'Reel Lab up to 30 seconds',
      '720p video export',
    ],
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    price: 12000,
    featured: true,
    blurb: 'For a working studio with a full season booked.',
    assetsPerMonth: 200,
    weddingsPerMonth: 20,
    features: [
      '200 generated assets / month',
      '20 weddings / month',
      'All 14 asset types',
      'Reel Lab up to 60 seconds',
      '1080p video export',
      'Saved brand voice & tone presets',
      'Vendor tagging blocks',
    ],
  },
  atelier: {
    id: 'atelier',
    name: 'Atelier',
    price: 20000,
    blurb: 'For studios with second shooters, editors and a content person.',
    assetsPerMonth: Infinity,
    weddingsPerMonth: Infinity,
    features: [
      'Unlimited assets & weddings',
      'Everything in Studio',
      'Reel Lab up to 90 seconds',
      'Priority generation',
      'Bring-your-own Claude API key',
      'Multi-seat: 5 team members',
      'White-label client galleries',
    ],
  },
};

const KEY = 'aso.billing.v1';

const monthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (raw.month !== monthKey()) return { plan: raw.plan || 'starter', month: monthKey(), assets: 0, weddings: 0 };
    return { plan: 'starter', assets: 0, weddings: 0, month: monthKey(), ...raw };
  } catch {
    return { plan: 'starter', month: monthKey(), assets: 0, weddings: 0 };
  }
}

let state = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

export const current = () => PLANS[state.plan] || PLANS.starter;
export const usage = () => ({ ...state });

export function setPlan(id) {
  if (!PLANS[id]) return;
  state.plan = id;
  save();
}

/** Can we generate `n` more assets this month? */
export function canGenerate(n = 1) {
  return state.assets + n <= current().assetsPerMonth;
}

export function recordAssets(n = 1) {
  state.assets += n;
  save();
}

export function recordWedding() {
  state.weddings += 1;
  save();
}

/** Longest reel the current plan allows, in seconds. */
export function maxReelSeconds() {
  return { starter: 30, studio: 60, atelier: 90 }[state.plan] ?? 30;
}

export function exportHeight() {
  return state.plan === 'starter' ? 1280 : 1920;
}

export const naira = n =>
  n === Infinity ? '—' : '₦' + n.toLocaleString('en-NG');
