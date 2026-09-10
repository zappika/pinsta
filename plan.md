# Pinsta — Plan

## What it is

Paste an Instagram post link, identify the place it shows, and save it to a
personal list with **Google Maps + Apple Maps** links. Over time the list
becomes browsable by **country / city** and by a small set of **categories**
(hotel, restaurant, bar, bakery, …) — so you can answer "what are the
restaurants I've seen in Barcelona?".

## What a working version looks like

You open the app, paste an Instagram URL, type the place name, pick the right
match from Google Places, and hit save. It appears in your list with working
Google Maps and Apple Maps buttons and a link back to the original post.

## Key constraint (why the design is what it is)

Instagram's official APIs do **not** expose location data for arbitrary public
posts (Graph API is for your own business accounts; oEmbed is embed-only and its
terms forbid extracting/persisting metadata). Automatic extraction needs a
third-party scraper (ToS gray area, per-call cost) + an LLM reading the caption —
fragile. So the MVP uses **manual-assist**: you paste the link and confirm the
place; automatic extraction is deferred to a later phase.

## Decisions

- **Extraction:** manual-assist for the MVP (paste link → type place → pick from
  Google Places → save). Auto-extraction is Phase 4.
- **Stack:** web-first — **Next.js (App Router, TS) on Vercel**. The same API
  serves a native iOS app later.
- **Accounts:** single-user, no login for the MVP.
- **DB:** serverless Postgres (**Neon** / Vercel Postgres) via **Drizzle ORM**.
- **Geocoding / categories:** **Google Places API (New)**, server-side only.
  One call returns coordinates, `place_id`, full address (→ country/city), and
  `types` (→ categories).
- **Maps links:**
  - Google: `https://www.google.com/maps/search/?api=1&query=<name>&query_place_id=<place_id>`
  - Apple: `https://maps.apple.com/?q=<name>&ll=<lat>,<lng>`

### Data model — `places`
`id`, `instagram_url`, `name`, `place_id`, `lat`, `lng`, `formatted_address`,
`country`, `city`, `primary_type`, `category`, `note`, `created_at`.
`country` / `city` / `category` columns exist from Phase 1 but are only
populated/used for navigation from Phase 2 — no migration between phases.

---

## Phase 1 — MVP ✅ done — https://pinsta-two.vercel.app

**Goal:** deployed page where you save a place from an IG link and see your list.

- [x] Scaffold Next.js + TS + Tailwind; init Drizzle + Neon; create `places` table
- [x] Server-side Google Places proxy: `POST /api/places/search` (Text Search)
- [x] Add flow on `app/page.tsx`: IG URL input + place search box → pick candidate
- [x] Save handler `POST /api/places`: re-fetch Place Details by `place_id`, insert row
- [x] List view: each place shows Google Maps + Apple Maps buttons, address, IG link
- [x] Deploy to Vercel; set `GOOGLE_PLACES_API_KEY` + `DATABASE_URL`

**Acceptance:** on the deployed URL, paste a real IG post, type a known place
(e.g. "Septime Paris"), pick it, save → it persists and the list shows it with
working Google + Apple Maps links that open the right spot, plus the IG source link.

## Phase 2 — Organize & navigate ✅ done

**Goal:** browse the list by location and category.

- [x] `lib/categories.ts`: map Google `primaryType` → ~10 buckets (Restaurant,
      Cafe, Bar, Bakery, Hotel, Shop, Attraction, Museum, Nature/Park, Other);
      populate `category` on save
- [x] Parse `country` / `city` from Places `addressComponents`; populate on save
- [x] List view filters/grouping by country, city, category ("Hotels in Paris")
- [x] Instagram embed preview (public `embed.js`, no token) for context

**Acceptance:** with places saved across two cities and categories, filtering to
"restaurants in Barcelona" shows exactly the right subset.

## Phase 3 — Accounts ⏸ deliberately not doing this

**Decision (2026-09-10):** a local, personal app asks nobody to create an
account or log in. Data lives on the device; iCloud (CloudKit) backs it up
invisibly once the Apple Developer membership exists. Accounts only appear
if social features ever do — and then only for those features.

- [ ] Turn on CloudKit sync in the SwiftData container (needs paid developer account)
- [ ] ~~Add auth~~ · ~~`user_id` on `places`~~ — dropped

## Phase 4 — Auto-extraction ("the magic") 🟡 tag-based done, caption reading deferred

**Goal:** reduce manual typing by reading the post automatically.

- [x] Integrate a scraper API (Apify `instagram-scraper`) to fetch caption + location tag + image
- [x] Copy the post image into Vercel Blob (IG CDN URLs expire) → thumbnail on every card
- [x] Location tag present → Places search pre-fills up to 5 candidates ("Name — City", address only to break ties); one tap saves
- [x] No tag / scrape fails → falls back to the Phase 1 typing flow inside the same sheet
- [ ] No tag → Claude reads the caption and proposes candidate place names
      (deferred: decide after seeing how often tags are missing on real posts;
      needs `ANTHROPIC_API_KEY`)

**Acceptance:** pasting a location-tagged post pre-fills the correct place without
typing; a caption listing 3 spots offers 3 candidates; ambiguous posts still
fall back to the Phase 1 manual flow.

**Verified 2026-09-10:** instagram.com/p/DafW4ZTNT-l (tagged "Bar Brutal") →
thumbnail + 3 candidates in ~7s, saved without typing.

## Phase 5 — Native iOS 🟡 in progress (Simulator only for now)

**Goal:** the full app native, local-first. The phone is the source of truth;
the cloud does exactly one thing — read the Instagram post.

| Web | Native |
|---|---|
| Neon Postgres | SwiftData on device (CloudKit later) |
| Google Places | MapKit `MKLocalSearch` — no key |
| Vercel Blob | image stored with the record |
| Apify scrape | stays on Vercel: `POST /api/extract` with `native: true` |

The web app stays live until the native one is trusted.

- [x] Xcode project (`ios/`, XcodeGen) · SwiftData `Place` · category buckets
- [x] List with `City ▾ Type ▾` header menus · cards with photo · Apple/Google Maps · Post
- [x] Add sheet: paste → read post → MapKit candidates from tag → tap to save; typing fallback
- [x] One-shot import of the web database on first launch
- [ ] Build + run in Simulator, verify end to end
- [ ] Share Extension: Instagram → Share → Pinsta opens the save flow
- [ ] Real device + CloudKit (needs Apple Developer Program)

**Acceptance:** from inside Instagram, Share → Pinsta opens the save flow
pre-loaded with the shared post and saves to the same list the app shows.
