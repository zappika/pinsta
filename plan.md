# Vicolo — Plan

_Formerly Pinsta. Renamed 2026-09-29; the repo, folder, Vercel project and code names still say pinsta._

## Latest handoff — 2026-09-29
- The web and iOS feature pass is complete. The web owner lock is **on** in Vercel (verified: 401 without the key). Friends' iOS lists remain local.
- Beta reliability fixes now in code: iOS name-first vineyard/bakery categories, short links inside shared text, canonical duplicate detection, Near me category counts, photo-retry filtering, coordinate-based Google Maps links, and a web owner-key fallback when browser storage rejects writes.
- Verification: `npm run build` (including TypeScript), local mocked short-link redirect checks (`node --import tsx scripts/check-links.mts`), Swift syntax checks, and isolated Swift type checks passed. **A full iOS build and real-link/device tests are still pending.** This Codex shell could not run Xcode's SwiftUI macro service. Do not treat the earlier simulator build as verification of these new changes.
- Sarp confirmed the paid Apple Developer membership is **not yet active**. Once active: set the real team in `ios/project.yml`, run a full signed build, test the share flow and Google Maps opening on his phone, then proceed to internal and external TestFlight.
- The code review backlog below lists new reliability and performance findings. The iOS keyboard jump remains deferred; the Maps-link photo and inline-post decisions remain open.

## Phase 6 — Friends & family beta (TestFlight) 🟡 target: link out Sat 2026-10-03
Goal: friends install Vicolo from a TestFlight public link and use it on their own, with their own list.

Code (mine):
- [x] Web list owner-only; `/api/extract` stays open for the app, no Google spend from strangers
- [x] iOS: no web import; every install starts empty; empty state explains Share → Vicolo
- [x] iOS: `ITSAppUsesNonExemptEncryption = NO`, `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` shared by app + extension, privacy manifests
- [x] Build + Simulator check of the above (2026-09-29, clean iPhone 17 simulator)
- [x] Add-sheet issue from 2026-09-15: keyboard jump deferred by Sarp; double-bordered Paste and the Save sliver are gone with the round + redesign.
- [x] iOS category precedence: an explicit vineyard or bakery word in the name beats MapKit's category (2026-09-29). Ästad still needs a device check for its city label.
- [x] Share-text links: web and iOS accept a supported URL inside shared caption text; the share extension selects that URL (2026-09-29).
- [x] iOS checks the canonical URL again after resolving a short link, so sharing the same post twice shows Already saved (2026-09-29).
- [x] iOS Near me category counts reflect nearby places; photo retry skips Maps saves before its five-post limit (2026-09-29).
- [x] Web owner key works for the current page even when browser storage rejects writes (2026-09-29).
- [x] iOS Google Maps action uses a place ID when available, otherwise the saved coordinates instead of an ambiguous name search (2026-09-29); confirm app opening on a phone.
- [ ] Try real `vm.tiktok.com` and `maps.app.goo.gl` links on a phone. Local redirect checks pass with simulated responses, but no real links were available for an end-to-end check.
- [ ] Run a full iOS build after these changes. Swift parsing and isolated type checks pass; this Codex sandbox cannot run Xcode's SwiftUI macro service.
- [ ] Real team in `project.yml` (`DEVELOPMENT_TEAM`, automatic signing) → archive → upload
- [ ] Sarp's own phone via internal TestFlight: **Share from inside Instagram** (never tested on a real device), swipe thresholds, undo timing
- [ ] Submit for external Beta App Review by Thu 2026-10-01 → public link

Apple (Sarp's — needs his identity and payment):
- [ ] Apple Developer Program, paid ($99/yr). The free team can't distribute: cable installs only, expire in 7 days.
- [ ] App Store Connect app record. Name: Vicolo. It must be unique store-wide; if taken, try "Vicolo — Places" (the home-screen name can stay Vicolo).
- [ ] TestFlight beta info: short description, feedback email, possibly a privacy policy URL (one page on the web app would do).

Acceptance: a friend with no connection to Sarp installs from the link, shares a post from Instagram, and sees it saved in their own empty list — while Sarp's web list stays private.

Known limits for the beta (tell friends):
- The list lives only on the phone. Deleting the app deletes it; TestFlight updates keep it. iCloud backup comes after the paid account.
- Every friend's save runs on Sarp's Apify account. The free plan allows 5 reads at a time; busy shows "try again in a minute". Check Apify usage after the first weekend.

## iOS port of the 2026-09-29 web pass — done
Each chunk is built, checked on the simulator, committed and pushed on its own, then ticked here. A new session continues at the first unticked chunk.
- [x] 1. Links (2026-09-29): TikTok + Google Maps links in the app and the share extension; Maps links searched in MapKit around their pin, a match on the pin auto-saves; caption pattern + stricter account match for untagged posts. Maps-link saves have no photo on iOS (that would need Google, paid).
- [x] 2. Bottom bar (2026-09-29): SF Symbol view pill with List; round + with a springy press that turns into × above the save sheet; List view (photo rows, tap → sheet)
- [x] 3. Map (2026-09-29): emoji pins on type tints (`PlaceCategory.tint` / `.dot`, same hex as web); pins within 44pt group into a count, tap zooms until it splits; no grouping below ~1 km span
- [x] 4. Cards (2026-09-29): round Directions + Post icons, no button row; Directions asks once, remembers, confirms (5 s); buddy menu with Appearance (System/Light/Dark) + Directions. Launch arg `-slowNotices` keeps notices 30 s for testing.
- [x] 5. Data + colour (2026-09-29): one place many posts (`Place.extraPostURLs`, `SamePlace` port; receipt "Added to this place", undo removes just that link; card "2 posts", Post menu); type dots on cards and list, tints behind photo-less thumbnails and tiles; tiles padded to six with a nudge
- [x] 6. Pull-up sheet, Near me, dark mode (2026-09-29): place sheet on the bottom edge with a handle, short → full (300pt photo, post links) → away; Near me in Where (50 km, asks only when picked, distances in List, a plain notice if refused, `NSLocationWhenInUseUsageDescription` added); dark fixes: buddy icon, raised save sheet with inset fields, stronger dim, visible Near me arrow

## Before friends get it (agreed 2026-09-29)
- [x] Save from TikTok and Google Maps links too (web, 2026-09-29). Google Maps: the link names the place (name + pin, or a place id), auto-saves one clear match, photo from Google. TikTok: the page's own data gives caption, author and the location tag when there is one; oEmbed for the thumbnail. No new paid service. Untagged posts: a caption pattern ("at Cal Pep in Barcelona") and the account, suggestions only.
- [x] Icon buttons on cards: directions and post as round icons beside the name; the text button row is gone
- [x] Group nearby map pins (web): pins within 44 px merge into a count on the tint of their most common type; tap zooms in; from zoom 16 no grouping, overlapping pins fan out with names hidden
- [x] One place, many posts (web): same Google id, or within ~60 m with a shared name word, adds the post to that card (`posts` jsonb). Card shows "2 posts" and embeds all; "Wrong place?" removes just that post. Bar Brutal / Can Cisa merged into one card with both posts (2026-09-29, `scripts/merge-places.mts`).
- [x] Directions: one button; first tap asks Apple Maps or Google Maps, remembers it, and confirms: "Saved Google Maps as your default. You can change it anytime in the menu, top right."

## Design ideas from 2026-09-29 — done
- [x] Type colors everywhere (web): soft tint behind photo-less tiles and list rows; a full-strength dot beside the type in List and Cards (`CATEGORY_DOT`)
- [x] Place preview as a pull-up sheet (web): opens short, drag or tap the handle for the full card (big photo, posts open), drag down to go back or away; the map stays live behind it
- [x] Dark mode (web): System / Light / Dark under the buddy menu (System follows the phone); the stone palette is flipped once in `globals.css`, the map uses OpenFreeMap "dark"

## Expansion: Social (after the beta)
- Send a place to a friend: name, Maps link, the Instagram post
- Later: see what friends saved. Needs to know who people are — accounts come back here.

## Expansion: Check-ins (after the beta)
- "Been there" / "Want to go" on every place, with a filter for each
- Check in at a place
- Meets Social: "Nika wants to go here"

**Accounts belong to Social (Sarp, 2026-09-29).** The app knows its user locally and works fully without an account. Creating one (username + login) is the step into "I want to be social now". Open for CTO when Social starts: how a local-first list joins an account later.

## Next steps
1. ~~Vercel key~~ done 2026-09-29.
2. Sarp: enroll in the Apple Developer Program. It gates everything below.
3. Real team in `project.yml` → archive → internal TestFlight on Sarp's phone. Test Share **from inside Instagram and TikTok** (never done on a real device), swipe and undo timing by thumb, Near me outdoors.
4. Submit for external Beta App Review → public link → friends.
5. After the first weekend: check Apify usage (every friend's Instagram save runs on Sarp's account).

## Waiting on Sarp
- Paid Apple Developer Program — unblocks TestFlight

## Roadmap — after the beta
Ordered roughly by how soon friends will feel it. The category and share-text fixes above were pulled into the beta work; real-device checks remain a beta gate.

**Reliability**
- iCloud backup (CloudKit) so a friend's list survives deleting the app. Needs the paid account. Then add iCloud/Background Modes capabilities, check the SwiftData schema and App Group store migration, enable the CloudKit configuration, and verify sync plus reinstall on real devices. Local-first stays; no app accounts.
- Cheaper, sturdier Instagram reads. Apify is the one paid dependency on every save; watch cost and failure rate from the beta, then decide (keep, cache, or an alternative).

**Small fixes**
- iOS places saved from a Maps link have no photo (web gets Google's; iOS doesn't pay for Google). Options: the MapKit Look Around snapshot, or keep the emoji.
- Web embeds posts inside the full place sheet; iOS shows links. Decide whether iOS should embed too.
- Keyboard jump in the iOS add sheet (deferred by Sarp).

**Reading posts better**
- Untagged posts: the caption pattern covers "at X in Y". Reading captions with Claude would catch more, but it's paid; only if tags turn out to be missing often (decided: low-tech first).

**Expansion packages** (sections above)
- Social: send a place to a friend; later, see friends' saves. Accounts arrive here, optional, as the step into being social.
- Check-ins: Been there / Want to go, check in, and "Nika wants to go here" where it meets Social.
- Open for CTO before either: how a local-first list joins an account later.

## Code review — 2026-09-29
Items to address after the local fixes above, ordered by user impact:
- Web deletion is optimistic and ignores a failed DELETE response (`PinstaApp.tsx`); a failed request can make a place disappear until reload. Keep it visible or restore it on failure.
- iOS photo retry still tries permanently unavailable Instagram posts on every foreground and can keep later missing photos outside its five-post batch (`PhotoRetry.swift`). Track attempts and back off, while rotating through eligible places.
- A signed iOS build should not silently switch from the App Group store to a private store when opening the shared container fails (`Persistence.swift`); that can look like a lost list.
- `/api/extract` is intentionally public for friends' iOS apps and can spend Apify/Blob resources for any caller. Add abuse and cost controls before sharing the public TestFlight link.
- Performance: a web save may re-read the same Instagram post when the extracted image is missing (`/api/places` → `findPhoto`); reuse the extraction result or avoid the second paid read. iOS decodes full image data in every card and tile render; cache scaled thumbnails if lists grow.

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

## Decisions (founding — why the design is what it is)

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

## Phase 5 — Native iOS ✅ working in Simulator (real device pending developer account)

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
- [x] Build + run in Simulator, verify end to end
- [x] Share Extension: Share → Pinsta opens the save flow, saves into the shared App Group store
      (verified from Safari in the Simulator; Instagram itself needs a real device)
- [x] App icon in the asset catalog (2026-09-14; light + dark) — verify on the Simulator
- [x] Parity with web (2026-09-12): compact fixed-height sheet, zero-tap save +
      receipt + undo, MapKit tag cascade + account fallback, destination
      grouping, Vineyard, card rules, swipe edit/delete with undo toast

- [ ] Real device + CloudKit (needs Apple Developer Program)

**Acceptance:** from inside Instagram, Share → Pinsta opens the save flow
pre-loaded with the shared post and saves to the same list the app shows.

## Decisions log (dated)
- **2026-09-12 — Grouping is a pure count heuristic, no LLM.** A town needs 2+
  saved places for its own row; a 1-place town folds into its region only if the
  region then bundles 2+ places. Labels shift as the list grows — accepted.
  Sarper: "we don't need to throw tech at everything."
- **2026-09-12 — Paid APIs only when unavoidable.** Apify (post read) and Google Places (web)
  are the only ones. iOS resolves places with MapKit for free.
- **2026-09-12 — Delete has no confirm; it has Undo** (5s toast, deferred delete).
- **2026-09-12 — Auto-save only from a location tag.** Account-derived suggestions always need a tap.
- **2026-09-12 — Swipe for edit/delete, round icon buttons, full swipe deletes** (Sarp's design, not Sander's).
- **2026-09-12 — Save sheet is a fixed-height bottom card**, sized like the Where picker; no jumping.
- **2026-09-12 — Vineyard is a category**; vineyards were "Other".
- **2026-09-14 — Map is a view, not the home.** Where·What stays the way in; a bottom pill switches Map / Cards / Tiles for the chosen set. A Europe-wide map is wallpaper; Helsinki with one pin is information. MapLibre + OpenFreeMap on web (free, no key); MapKit on iOS.
- **2026-09-14 — A place never goes without a photo.** The post's image first; if the post can't be read, the place's Google photo (`lib/photo.ts`, on save and via `scripts/backfill-images`). Photo-less tiles read as holes in the grid.
- **2026-09-14 — Web app stays live.** It's the fastest place to prototype; iOS follows once an idea sticks.
- **2026-09-13 — Process: hygiene over ritual.** plan.md + CLAUDE.md stay current at every stopping point whether or not a command was typed.
- **2026-09-29 — The web list is owner-only; friends get the iOS app, local-first.** One secret (`PINSTA_OWNER_KEY`, env only — the repo is public) guards every `/api/places*` route and the Google search. `/api/extract` stays open because the app needs it, but strangers get native mode (no Google spend). Rejected: per-device IDs on the web and real accounts — not needed while friends only use iOS.
- **2026-09-29 — No automatic web import on iOS.** It would hand Sarp's list to every friend.
- **2026-09-29 — Distribute through a TestFlight public link**, not per-email invites or cable installs.
- **2026-09-29 — App name stays Pinsta.** Keyboard jump in the iOS add sheet: not fixing for now (Sarp).
- **2026-09-29 — Web design pass (Sarp):** map pins show only the category emoji; a short Tiles grid is padded to two rows with placeholders and a nudge; Where gets a "Near me" option (50 km, asked only when picked, not the default, so the page never prompts on load); a round buddy button top right opens a menu (today: Lock this browser).
- **2026-09-29 — Pins get a white border and a soft per-type tint** (`CATEGORY_TINT`). **Save a place becomes a round + at the bottom right**, in one row with the view pill (Sarp picked it over + in the pill or + in the header). Settles the two-row bottom stack question; no Sander needed.
- **2026-09-29 — List view added** (Map · List · Cards · Tiles): rounded square photo, name, type, "distance · town" (distance only after Near me). Tap opens the PeekCard, like Tiles. **The + animates:** springy press, turns into × while the sheet is open, and the sheet rises from it.
- **2026-09-29 — The view pill is glyphs, not words** (map, list, card, grid line icons; labels kept for screen readers and hover). Not emoji, per Sarp.
- **2026-09-29 — Renamed to Vicolo** (supersedes "name stays Pinsta"). Visible name on web and iOS; iOS bundle ID `se.sarper.vicolo` and App Group `group.se.sarper.vicolo`, changed before the App Store Connect record exists. Internal names (repo, folder, Vercel project `pinsta-two`, file/CSS/storage names) unchanged.
- **2026-09-29 — Vicolo accepts TikTok and Google Maps links** alongside Instagram, with no new paid service: TikTok page data + oEmbed, Google Maps links parsed from the URL. The DB field `instagram_url` keeps its name but holds any supported link.
