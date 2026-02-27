# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

**Local setup:**
```bash
npm install
cp .env.example .env.local
# Fill in all env vars in .env.local (see below)
npm run dev
```

The app runs at http://localhost:3000.

**Deploy:** Push to GitHub, import on Vercel, set all env vars from `.env.example`.

## Architecture

```
Browser → Next.js App Router (src/app/)
        → /api/auth/*  — Keycloak ROPC → JWT cookie
        → /api/rooms   — proxy to RapidAPI Booking.com
        → /api/prices  — read/write Supabase price_snapshots
        → middleware.ts — Edge JWT verification
```

## Stack

- **Next.js 16 App Router, TypeScript strict**
- **Tailwind CSS** + CSS custom properties (defined in `globals.css`)
- **TanStack React Query v5** — data fetching and caching
- **Supabase** — `price_snapshots` table (shared cache, 1 row/day)
- **Keycloak** — ROPC auth flow, JWT signed with `jose`, stored in `ps-token` cookie
- **react-chartjs-2** + chart.js — price line chart

## File structure

```
src/
├── app/
│   ├── (auth)/login/page.tsx      # login form
│   ├── (dashboard)/
│   │   ├── layout.tsx             # protected shell (header + user info)
│   │   └── page.tsx               # main dashboard (sidebar + chart + table)
│   ├── api/
│   │   ├── auth/login/route.ts    # POST → Keycloak ROPC → ps-token cookie
│   │   ├── auth/logout/route.ts   # POST → clear cookies
│   │   ├── auth/me/route.ts       # GET → reads middleware-injected headers
│   │   ├── rooms/route.ts         # GET → proxy RapidAPI (auth-protected)
│   │   └── prices/route.ts        # GET Supabase snapshot / POST save
│   ├── globals.css                # CSS custom properties + all component CSS
│   └── layout.tsx                 # root layout (QueryClientProvider)
├── components/
│   ├── auth/LoginForm.tsx
│   ├── auth/SignOutButton.tsx
│   ├── QueryProvider.tsx
│   └── dashboard/
│       ├── HotelList.tsx
│       ├── StatsBar.tsx
│       ├── PriceChart.tsx
│       ├── PriceTable.tsx
│       └── ProgressLog.tsx
├── hooks/
│   ├── useAuth.ts       # GET /api/auth/me (singleton via React Query)
│   ├── usePrices.ts     # GET /api/prices
│   └── useFetchPrices.ts # useMutation — sequential loop + POST save
├── lib/
│   ├── hotels.ts        # HOTELS[], COLORS, CUR_SYM constants
│   ├── extractPrice.ts  # normalises Booking.com API response
│   ├── supabaseAdmin.ts # Supabase client (SERVICE_ROLE_KEY, server-only)
│   └── queryClient.ts   # QueryClient singleton
└── types/
    ├── prices.ts        # PricePoint, HotelResult, PriceSnapshot, FetchParams
    └── auth.ts          # AuthUser
middleware.ts            # Edge: JWT verify → inject x-user-* headers
```

## Environment variables

| Variable | Purpose |
|---|---|
| `RAPIDAPI_KEY` | RapidAPI key for apidojo-booking-v1 |
| `KEYCLOAK_URL` | Keycloak base URL (no trailing slash) |
| `KEYCLOAK_REALM` | Realm name (e.g. `price-shopper`) |
| `KEYCLOAK_CLIENT_ID` | Client ID with Direct Access Grants enabled |
| `KEYCLOAK_CLIENT_SECRET` | Client secret |
| `JWT_SECRET` | 32+ byte random string for signing ps-token |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |

## Supabase schema

```sql
create table public.price_snapshots (
  id         uuid primary key default uuid_generate_v4(),
  date       date not null,
  results    jsonb not null,
  currency   text not null default 'USD',
  adults     text not null default '2',
  days       integer not null default 90,
  fetched_at timestamptz not null default now(),
  fetched_by text not null
);
create unique index on public.price_snapshots (date, currency, adults, days);
create index on public.price_snapshots (date desc);
```

## Keycloak setup

1. Create realm `price-shopper`
2. Create client `price-shopper-app`:
   - Access Type: `confidential`
   - Enable: **Direct Access Grants**
3. Create team users (email + password)
4. Copy Client Secret → `KEYCLOAK_CLIENT_SECRET`

## Key design decisions

- **Auth flow:** Keycloak ROPC → custom JWT signed with HS256 stored in `ps-token` cookie. Middleware verifies on every request and injects `x-user-*` headers.
- **Dashboard fetch:** The dashboard page handles the sequential fetch loop directly for progressive rendering (one hotel at a time). After all hotels complete, it POSTs to `/api/prices` to save the snapshot in Supabase.
- **Shared cache:** `price_snapshots` in Supabase is shared across all users. If user A fetches today's data, user B sees it immediately on next load.
- **CSS:** All styles are global CSS classes in `globals.css` (preserving the original dark design). CSS custom properties define the color palette.
- **Hotels:** Fixed list in `src/lib/hotels.ts` — Lennox Hotel (mine) + 4 Ushuaia competitors.
- Finding a Booking.com hotel ID: open the hotel page → view source → search for `hotel_id`.
