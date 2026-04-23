/**
 * Automatic Genius discount calibration script.
 *
 * How it works:
 *  1. Opens Booking.com using your saved Genius session cookies
 *  2. Visits each competitor hotel for the next 7 days + 3 random dates
 *  3. Extracts the genius_discount_percentage from the page
 *  4. Saves the resulting ratio to Supabase (genius_discounts table)
 *
 * Required env vars:
 *  BOOKING_GENIUS_COOKIES   — JSON array exported from Cookie-Editor browser extension
 *  SUPABASE_URL             — same as NEXT_PUBLIC_SUPABASE_URL
 *  SUPABASE_SERVICE_ROLE_KEY
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const COMPETITOR_HOTELS = [
  { id: '239632', name: 'Las Lengas' },
  { id: '245606', name: 'Los Naranjos' },
  { id: '266628', name: 'Alto Andino' },
  { id: '8017079', name: 'Canal Beagle' },
];

// How many dates to sample beyond the next 7 days (random, 14–60 days out)
const EXTRA_RANDOM_DATES = 3;

// Minimum samples needed to trust the calibration for a hotel
const MIN_SAMPLES = 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSampleDates() {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  for (let i = 0; i < EXTRA_RANDOM_DATES; i++) {
    const days = 14 + Math.floor(Math.random() * 47);
    const d = new Date(today);
    d.setDate(today.getDate() + days);
    dates.push(d.toISOString().split('T')[0]);
  }

  return [...new Set(dates)].sort();
}

function nextDay(date) {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Normalize cookies exported from browsers/extensions so Playwright accepts them.
 * Different exporters use different sameSite values (e.g. "no_restriction", "unspecified").
 */
function normalizeCookies(raw) {
  const sameSiteMap = {
    no_restriction: 'None',
    none: 'None',
    lax: 'Lax',
    strict: 'Strict',
    unspecified: 'Lax',
  };
  return raw.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain ?? '.booking.com',
    path: c.path ?? '/',
    expires: c.expirationDate ?? c.expires ?? -1,
    httpOnly: c.httpOnly ?? false,
    secure: c.secure ?? false,
    sameSite: sameSiteMap[(c.sameSite ?? '').toLowerCase()] ?? 'Lax',
  }));
}

// ── Price extraction ──────────────────────────────────────────────────────────

/**
 * Returns the minimum genius_discount_percentage found on the page, or 0 if none.
 * Returns null on navigation error.
 */
async function extractGeniusPct(page, hotelId, checkin) {
  const checkout = nextDay(checkin);
  const url = new URL('https://www.booking.com/searchresults.html');
  url.searchParams.set('hotel_id', hotelId);
  url.searchParams.set('checkin', checkin);
  url.searchParams.set('checkout', checkout);
  url.searchParams.set('group_adults', '2');
  url.searchParams.set('no_rooms', '1');
  url.searchParams.set('selected_currency', 'USD');
  url.searchParams.set('lang', 'en-us');

  try {
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sleep(2000); // let the page settle

    const html = await page.content();

    // Primary: look for genius_discount_percentage in embedded JSON
    const jsonMatches = [...html.matchAll(/"genius_discount_percentage"\s*:\s*(\d+)/g)];
    const jsonPcts = jsonMatches.map(m => parseInt(m[1])).filter(p => p > 0);
    if (jsonPcts.length > 0) return Math.min(...jsonPcts);

    // Fallback: look for "10% off" / "15% off" near the word "Genius" in the HTML
    const geniusSection = html.match(/genius[^<]{0,200}/gi) ?? [];
    for (const section of geniusSection) {
      const pctMatch = section.match(/(\d+)\s*%/);
      if (pctMatch) return parseInt(pctMatch[1]);
    }

    return 0; // no genius discount on this date
  } catch (e) {
    console.error(`    Navigation error (${hotelId} ${checkin}): ${e.message}`);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const cookiesJson = process.env.BOOKING_GENIUS_COOKIES;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cookiesJson) { console.error('Missing BOOKING_GENIUS_COOKIES'); process.exit(1); }
  if (!supabaseUrl || !supabaseKey) { console.error('Missing Supabase env vars'); process.exit(1); }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const cookies = JSON.parse(cookiesJson);
  const dates = getSampleDates();

  console.log(`Sampling ${dates.length} dates: ${dates.join(', ')}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });

  await context.addCookies(normalizeCookies(cookies));
  const page = await context.newPage();
  const updates = [];

  for (const hotel of COMPETITOR_HOTELS) {
    console.log(`── ${hotel.name} (${hotel.id}) ──`);
    const pcts = [];

    for (const date of dates) {
      const pct = await extractGeniusPct(page, hotel.id, date);
      if (pct === null) {
        console.log(`  ${date}: ⚠ error`);
      } else if (pct === 0) {
        console.log(`  ${date}: – no genius`);
      } else {
        console.log(`  ${date}: ✓ ${pct}% genius`);
        pcts.push(pct);
      }
      await sleep(1000 + Math.random() * 1000);
    }

    if (pcts.length >= MIN_SAMPLES) {
      // Use median to avoid outliers
      pcts.sort((a, b) => a - b);
      const median = pcts[Math.floor(pcts.length / 2)];
      const ratio = parseFloat((1 - median / 100).toFixed(4));
      updates.push({ hotel_id: hotel.id, ratio });
      console.log(`  → discount: ${median}%  ratio: ${ratio}\n`);
    } else if (pcts.length > 0) {
      const ratio = parseFloat((1 - pcts[0] / 100).toFixed(4));
      updates.push({ hotel_id: hotel.id, ratio });
      console.log(`  → discount: ${pcts[0]}% (single sample)  ratio: ${ratio}\n`);
    } else {
      console.log(`  → no genius discounts detected — skipping\n`);
    }
  }

  await browser.close();

  if (updates.length === 0) {
    console.log('No calibration updates to save.');
    return;
  }

  const rows = updates.map(u => ({
    hotel_id: u.hotel_id,
    ratio: u.ratio,
    calibrated_at: new Date().toISOString(),
    calibrated_by: 'github-actions',
  }));

  const { error } = await supabase
    .from('genius_discounts')
    .upsert(rows, { onConflict: 'hotel_id' });

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  console.log(`Saved ${rows.length} calibration(s) to Supabase.`);
  for (const r of rows) console.log(`  hotel_id=${r.hotel_id}  ratio=${r.ratio}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
