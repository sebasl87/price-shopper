# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

**Local setup:**
```bash
npm install
cp .env.example .env.local
# Edit .env.local and add your RAPIDAPI_KEY
npx vercel dev
```

The app runs at http://localhost:3000. `vercel dev` is required (not a plain static server) because it handles the `/api/rooms` serverless function locally.

**There is no build step** — the frontend is a single static HTML file (`public/index.html`). The only "build" script echoes a message.

**Deploy:** Push to GitHub, import on vercel.com, and set `RAPIDAPI_KEY` as an environment variable.

## Architecture

```
Browser (public/index.html) → /api/rooms (Vercel serverless) → RapidAPI Booking.com → response
```

- **`public/index.html`** — entire frontend: all CSS, HTML, and JavaScript in one self-contained file. Uses Chart.js (CDN) for the line chart and vanilla JS for everything else. No framework, no bundler.
- **`api/rooms.js`** — Vercel serverless function (ES module, `export default`). Acts as a proxy to `apidojo-booking-v1.p.rapidapi.com`. Reads `RAPIDAPI_KEY` from `process.env` so the key is never exposed to the browser. Accepts query params: `hotel_id`, `arrival_date`, `departure_date`, `rec_guest_qty`, `currency_code`.

## Key frontend details

- **State** is a single `state` object: `{ hotels, results, currency, isDemo, chart, filter, abort }`.
- **`extractPrice(data)`** normalizes the Booking.com API response — the API returns price data in multiple possible locations (`block[].min_price.price`, `block[].product_price_breakdown.gross_amount.value`, etc.).
- Fetches are sequential with a 150 ms delay between requests to respect rate limits (~6 req/s).
- The fetch loop checks `state.abort` to support a stop button.
- `renderDashboard()` is called after each hotel completes (progressive rendering).
- Hotel IDs default to Ushuaia hotels; the Lennox Hotel ID (`186029`) is pre-filled.
- Demo mode (`loadDemo()`) generates synthetic price data locally without any API calls.

## Environment

- `RAPIDAPI_KEY` — required. Get from RapidAPI (apidojo-booking-v1 host).
- Finding a Booking.com hotel ID: open the hotel page → view source → search for `hotel_id`.
