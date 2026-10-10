# Vicolo — Plan

_Formerly Pinsta. Renamed 2026-09-29; the repo, folder, Vercel project and code names still say pinsta._

## 2026-10-10: three save-flow fixes after build 16 (Sarp, on the phone)
- **Share card is a full-width sheet on the bottom edge** (was a floating card): the system share sheet stays up behind the extension and showed around and below the card. Not checked end to end: Safari's share ignores taps on the simulator, so it needs a TestFlight build.
- **Success card opens with its photo**: the photo is fetched while the place is found and decoded before the card shows (2 s at most, then the icon). It used to open on the type icon and jump. The card's fallback is now the food icon, not the plain Restaurant (gilda). Checked on the simulator (new save and "Already in Vicolo").
- **Food icon reads the account handle too**, glued words included (`hundredburgers_` → burger), web + iOS.
- The "No location on this post" line and search field no longer flash while the place is still being found.

## Last session — 2026-10-09: save flow + success card, web + iOS
- **Save flow redesigned in a sandbox** (`/success`, backoffice) and built on both apps: the question in the sheet's small label, one loading bar, Save pills on every row, one success card for every save (post photo or type icon on its tint, "Saved to Vicolo" + elephant, milestone line: first save in a town, else first of a type). "Wrong place?" removed for now. iOS in **1.0 (13), uploaded to TestFlight 2026-10-09**; the share extension end to end is unchecked (Safari share ignores taps on the simulator).
- **Account match:** a city glued to the handle is split off (`barabbacph` → "barabba Copenhagen"), web + iOS.
- Beta submitted for review (see Waiting on Sarp).
- **No Near me (Sarp):** both apps open on the town you are in (nearest place within 50 km) with a blue dot where you are. Google list share text (name + link) fixed on the server.
- **1.0 (15) uploaded 2026-10-09**: the above plus everything in 14.
- **Where menu: travel areas** (Costa Brava, Penedès, Priorat, Maresme, Roussillon, West Coast Sweden…) and real regions (Spanish provinces → region). **Food icons** for restaurants (GPT-6 set + library). Open: a neutral icon for plain restaurants (still gilda).
- **1.0 (16) uploaded 2026-10-09**: areas + food icons.

## iOS Google list import — decisions (Sarp, 2026-10-09)
- Same flow as web `/import`: paste the list link → review → import. Reuse the web review's design as is (it is already mobile).
- Matching continues in the background, also after the person leaves the screen.
- Over 250 places: the review asks them to untick down to 250 before Import; nobody below 250 sees the limit.
- Places Google/Apple couldn't find: at the bottom of the review.
- Import can be tapped before matching is done; matched picks save at once, the rest save as they match (built that way).
- **Built 2026-10-09, checked on the simulator with Sarp's "BCN Nearby" (27):** first pass found 18; a second, looser pass adds towns and big sites; reading again marks them "Already in your list"; photos arrive. Towns come in as Other. In **1.0 (14), uploaded 2026-10-09**.

## To design (Sarp)
- List import success state (many places at once, not the one-place card).
- What to offer for list places that couldn't be found (web has the same gap).
- "From Emilie's list" on the iOS place card.
- "Wrong place?" after an automatic save, as part of reworking the steps before the success card.

## Asset library — 2026-10-09
- Converted all 72 city/object crops to transparent RGBA PNGs using local masks, with manual repairs and dark-background review. Original artwork retained in `source-crops/`. Menu assets unchanged. Catalog reports transparency accurately.

## Asset library — 2026-10-08
- Added backoffice `/library`: 21 city icons, 51 objects, 11 transparent menu icons, search, preview backgrounds, individual PNG and menu-size downloads. Sources stay in `assets/vicolo-library`; generated public copies are built automatically. No AI service or database required.

## Earlier — 2026-10-08: vicolo.space domains
- **Hosts split by `proxy.ts`** in the one `pinsta-two` project: `vicolo.space` (index + `/privacy`), `app.vicolo.space` (list + `/import`), `backoffice.vicolo.space` (`/usage`). `pinsta-two.vercel.app` still serves the list at `/` for the iOS app's API and old links. Sarp added all domains in Vercel.
- **Index on vicolo.space:** a very simple placeholder with the resin elephant, plus a share card (`app/opengraph-image.tsx`) for iMessage/WhatsApp previews.
- **/import is product, not owner tooling** (Sarp): it lives on app.vicolo.space.
- Checked: every host × path against a local production build (curl with Host headers), the share card image, tsc, next build.
- Index logo follows the theme: pink resin elephant in light, the cobalt app icon in dark. The share card stays light: previewers fetch one image and can't follow the reader's theme (Sarp: fine).
- Share previews confirmed working from the phone (Sarp, 2026-10-08).
- Next: Sarp designs success states and the share sheet; then the friends beta link.

## Earlier — 2026-10-06 (afternoon): Want to go / Been there, web + iOS, build 12
- **Want to go / Been there** (Sarp's design reference: a check-in app's card). Every place starts as Want to go. The floating place card has two equal buttons acting as one switch. Been there stamps `visited_at` (kept for later, **not shown**: today's dates are when a place was marked, not visited) and asks "How was it?" with 😞 🙂 😃 (`rating` 1–3). Picking a face folds the switch into that face among the card's round buttons; tapping it opens the switch again (same face folds back, Want to go undoes; the face is kept on undo so a slip loses nothing).
- **Buddy menu → Been there:** a plain list, latest marked first, with faces. No dates, no sort controls, rows don't open anything yet.
- **Deliberately not done (Sarp):** nothing on the map, no filter, no date shown.
- **Country chips over the map removed** on both (Sarp didn't want them); Everywhere still frames one country, the rest is a zoom out away.
- Web: `places.visited_at`, `places.rating` (pushed to Neon), `PATCH /api/places/[id]` takes `{visited, rating}`. iOS: optional `Place.visitedAt` / `rating` (SwiftData migrated by itself: build 12 installed over build 11's list on the Simulator kept it), `Views/BeenThere.swift`.
- Checked: web in the preview at phone size, light and dark (switch, faces, fold/unfold, undo keeps the face, list sheet, saves survive a reload); iOS on the Simulator (switch, faces, fold, menu → list). **1.0 (12) uploaded to TestFlight.**
- Possible next steps, none started: rows in the Been there list open the place; the switch + faces folded into one control (Sarp: "maybe consolidate later"); a filter once the list has been lived with.

## Earlier — 2026-10-06: tutorial on demand, /usage, drawer motion, Google import
- **iOS: buddy menu → "How to save"** opens the three-page tutorial full screen over any list (× to close; Paste a link opens the save sheet). For testing the first run on a full phone, and for showing a friend. Checked on the simulator; in build 10.
- **/usage** (web, owner key): the month's costs as in the sheet, plus a bar a day for the last 30 days, Instagram reads and Google calls as separate charts. The Usage sheet links to it.
- **Web drawer motion:** slides up from the edge, slides away however it closes (from where the finger let go), photo grows short ↔ full. Measured frame by frame in the browser; iOS port waits for Sarp's verdict.
- **/import (web MVP):** shared Google Maps list link → review (untick, change a category, "All as…") → saved through POST /api/places (now takes a category). Reading goes through Google Maps' unofficial getlist endpoint. Read correctly on Sarp's Tokyo Coffee and Tokyo Bars lists (short and long share links); nothing imported by me, the save step is Sarp's to try.
- New: `backlog.md` holds the small-improvements and big-directions lists.

## Earlier — 2026-10-05 (late): iOS empty-list tutorial
- **Empty list is now the approved three-page tutorial** (brief: `exports/vicolo-onboarding-handoff/BUILD-BRIEF.md`): Found a place? → Send it to Vicolo (with "Don’t see Vicolo? More → Edit → Add to Favorites", page 2 only) → Your next favorite, saved. Native SwiftUI, swipe or tap the dots, "Paste a link" opens the save sheet and the page is kept. Replaces the old first-run steps (which also mentioned TikTok; the tutorial is Instagram-only, other links still work).
- **Splash is a still again (Sarp: the movie was wrong on every level).** Sarp's two stills (cobalt night / cream day) on the launch screen, held 1.2 s, then a fade. Movies removed from the app. The stills are 853 × 1844, below the phone's 1206 × 2622 — a full-size export would be sharper.
- Checked on the simulator (iOS 27 runtime re-downloaded; simulators recreated, all empty): three pages light and dark on iPhone 17, dot taps and swipes, sheet open/close, iPhone SE at accessibility-large text (page scrolls, help chips stack), a populated list (tutorial gone, tab bar back). **Not checked:** VoiceOver by ear, and the real share-sheet path More → Edit → Favorites on a phone with iOS 26/27.

## Earlier — 2026-10-05: animated splash, location question later
- **Animated splash (Take 1) integrated**, replacing the timed still: launch storyboard with the movie's first frame, then the movie (AVPlayerLayer), muted, once, fading into the app. Phone's light/dark, frozen; in-app Appearance after. Skipped with Reduce Motion and on resume; can't block the app (missing file, failure, background, timeouts). Checked on the simulator: light, dark, dark phone + Light in-app, resume, Reduce Motion, iPhone 17 / 17 Pro / 17e.
- **No hand-off jump, measured.** A frame-by-frame difference over screen recordings found two problems and both are fixed: (1) the splash cut to the app in one frame (SwiftUI's fade never ran; it also did in build 7 — that was the "little jump"), now a 0.45 s UIKit fade; (2) the posters' HDTV colour profile made the launch screen brighter than the movie, a dim at the hand-off; posters relabelled sRGB (`ios/scripts/splash-poster.swift`), poster and movie now match on screen within 0.2 brightness. What remains in the first 0.2 s is iOS's own open-app zoom.
- **The location question waits** (Sarp): asked on open only once the list has 3 places, and on iOS only after the splash. Below that, the map of everything, no question. Same rule on the web. Picking Near me always may ask; refused still opens the List.
- **Higher-quality splash export integrated** (both movies 1320 × 2854, 16 Mbps, AI-enhanced; dark recoloured to the icon's cobalt/lime/lilac). Posters relabelled sRGB; each poster matches its movie's first frame on screen (dark 105.6 vs 105.7, light 230.8 vs 231.0). The dark coffee steam couldn't be recovered.
- **Brand touches (Sarp approved 2026-10-02), web + iOS:** elephant menu button, new first-run and filtered-empty states (resin elephant, coffee cup for Cafe), faint coral/lilac tint on the chosen Where/What row, elephant + version in Settings. Web is `fb24bed` (from `codex/vicolo-brand-touches`, brief in `docs/vicolo-brand-ios-handoff.md`), checked in the browser; iOS port compiles but was **not seen on a simulator**: the iOS simulator runtime vanished from this Mac mid-session (`simctl runtime list` empty; restore with `xcodebuild -downloadPlatform iOS`).
- **1.0 (8) uploaded to TestFlight 2026-10-05 22:35** with all of the above. An earlier build-8 upload that morning never finished, so this is the first build 8 Apple has.

## Earlier — 2026-10-02 (late): hygiene, review fixes, embeds
Everything below is on `main` and deployed. iOS changes are in code and checked on the simulator, **not yet in a TestFlight build** (build 7 predates them).
- **Code review (web + iOS) and fixes.** Two read-only reviews found 32 issues; all fixed except web rate limiting (needs Sarp, see below). Highlights:
  - *Data safety:* iOS never opens an empty stand-in store when the shared one fails (it showed as a lost list); web "Wrong place?" on an "Already saved" receipt could hard-delete the existing card; a reload could bring back a place pending delete.
  - *Money:* iOS photo and price retries back off (6 h → 2 weeks, six tries) instead of paying again on every foreground; posts that are gone are given up on (`/api/extract` now says `permanent: true`); `/api/price` reports Google failures as errors instead of "no price". Web saves check for a duplicate link before any paid call, and don't re-run Apify for a photo when the client's read already failed. Usage sheet counts every paid call.
  - *Reliability:* Apify can't outlast the 60 s function; non-JSON server errors read cleanly (web and iOS); malformed API input gets 4xx; a Maps link with a bad place id falls back to its name.
  - *State:* iOS no longer closes the save sheet or resets filters on return to the app (it rebuilds only when the share extension saved); web map no longer drops a Where pick made while tiles load; Near me races fixed on both.
  - *Performance:* iOS photos decoded once, downsampled, off the main thread; web cards and images load only where shown (`loading="lazy"`).
  - *Dead code:* `WebImporter.swift`, unused exports/types, `note` field handling.
- **iOS full sheet embeds the posts** (as the web does): the platform's embed page in a web view sized to its content. Fixed on the way: a tall photo covered the sheet's handle for touches, so tapping the handle did nothing.
- **iOS keyboard jump:** focus waits for the sheet to rise and only the sheet follows the keyboard; the share card no longer avoids it twice. Needs a look on the phone (the simulator can't show the jump at speed).
- **Privacy page** (`/privacy`) updated: location asked on open, price lookups send a place's name and pin.
- Verified: `tsc`, `next build`, iOS simulator build; migration over an existing list with the new fields; duplicate save makes no paid call (usage unchanged); gone post → 404 permanent; bad input → 400/404. Not verified here: the web map redraw fix (the browser pane was hidden, so MapLibre never painted), the share extension end to end.

## Waiting on Sarp
1. **Friends beta: submitted for Beta App Review 2026-10-09** (external group, build 1.0 (12), privacy URL https://www.vicolo.space/privacy). After approval: turn on Public Link in the group, share it (friends need the TestFlight app). Earlier note — **Friends beta via TestFlight public link** (Sarp, 2026-10-08: builds tested on the phone, no issues). A public link needs no email list: fill beta info, privacy URL, external group, submit for Beta App Review once, then share the link.
2. **vicolo.space domains** (bought on Vercel, 2026-10-08). Done 2026-10-08 (domains added, `proxy.ts` routes them). TestFlight privacy URL: `https://vicolo.space/privacy`.
3. **Testers list → light CRM** (Sarp, 2026-10-08): first 13 close friends named (kept out of this public repo). Sarp invites them personally — **nothing automatic, no emails or invites from code.** CRM in backoffice later, not started.
4. Rate limiting and usage review: much later (Sarp, 2026-10-08). Don't bring up.

## Open decisions
- **iCloud backup — deferred until after the beta (CTO call, 2026-10-02).** SwiftData + CloudKit means dropping `@Attribute(.unique)` on `Place.id`, a CloudKit container, and deploying the schema to production in the CloudKit dashboard, or TestFlight builds silently don't sync. None of it can be checked on the simulator without an iCloud sign-in, and a wrong migration the night before friends install is the worst kind of bug. Revisit when a friend loses a list, or right after the beta settles.
- **First experience — cards UI okay for now (Sarp, 2026-10-08)**; narrowed to success states, see "Next design areas".
- **Apify: keep, cache, or replace** — decide from the Usage sheet after the beta weekend.

## Phase 6 — Friends & family beta (TestFlight) 🟡 target: link out Sat 2026-10-03
Goal: friends install Vicolo from a TestFlight public link and use it on their own, with their own list.
- [x] Web list owner-only; `/api/extract` open for the app, no Google candidates for strangers
- [x] iOS: no web import; every install starts empty; empty state explains Share → Vicolo
- [x] iOS: export compliance, shared version numbers for app + extension, privacy manifests
- [x] Paid developer account, team 8D6ML34D52, App Store Connect record "Vicolo"; builds 1–7 uploaded (2026-10-01/02)
- [x] Category precedence, links inside shared text, canonical duplicate checks, Near me counts, Maps action by place id (2026-09-29)
- [x] Privacy page for TestFlight (`/privacy`)
- [ ] Phone checks and App Store Connect steps: see "Waiting on Sarp"

Acceptance: a friend with no connection to Sarp installs from the link, shares a post from Instagram, and sees it saved in their own empty list — while Sarp's web list stays private.

Known limits for the beta (tell friends):
- The list lives only on the phone. Deleting the app deletes it; TestFlight updates keep it.
- Every friend's save runs on Sarp's Apify account (free plan: 5 reads at a time, $5 a month). Busy shows "try again in a minute".

## Expansion: First experience — the one to nail (Sarp, 2026-10-01) — not started
Sarp tried the app fresh twice: it's flat and boring. Friends and family see it next, so the first minutes have to be great. Design it properly first (web prototype, then iOS); don't patch it.
- Questions for the design pass: what the first screen shows before anything is saved, how the first share is taught (share sheet → More → Favorites is a real hurdle), what the first save feels like (a moment, not a receipt), and when the list starts to feel like *yours*.
- Folds in the "What's New" idea: an Apple-style splash with a few highlights, on first launch and after meaningful updates, never on every launch.

## Expansion: Menu, Settings and Imports (Sarp, 2026-10-01)
- [x] The buddy button opens a real menu; Settings (Appearance, Directions) and Usage are sheets inside it.
- [ ] **Import from Google** (placeholder in the menu): saved Google Maps places/lists become Vicolo cards.
- [ ] Later: **lists you already keep elsewhere** (notes, text lists of places), read and turned into cards.

## Expansion: Social (after the beta)
- Send a place to a friend: name, Maps link, the Instagram post
- Later: see what friends saved. Needs to know who people are — accounts come back here.

## Expansion: Check-ins (after the beta)
- "Been there" / "Want to go" on every place, with a filter for each
- Check in at a place
- Meets Social: "Nika wants to go here"

**Accounts belong to Social (Sarp, 2026-09-29).** The app knows its user locally and works fully without an account. Creating one (username + login) is the step into "I want to be social now". Open for CTO when Social starts: how a local-first list joins an account later.

## Roadmap — after the beta
**Reliability**
- iCloud backup (CloudKit), see "Open decisions". Local-first stays; no app accounts.
- Cheaper, sturdier Instagram reads: decide from beta usage.

**Reading posts better**
- Untagged posts: the caption pattern covers "at X in Y". Reading captions with Claude would catch more, but it's paid; only if tags turn out to be missing often (decided: low-tech first).

**Expansions** (sections above): First experience first, then Menu/Imports, Check-ins, Social.

## Build log
- **1.0 (12), 2026-10-06:** Want to go / Been there with 😞 🙂 😃 on the place card, folded into the face; buddy menu → Been there list; country chips removed.
- **1.0 (11), 2026-10-06:** 3D type icons; floating place card with why it's here and the venue's website; map Everywhere by country with chips.
- **1.0 (10), 2026-10-06:** buddy menu → How to save (the share tutorial over any list).
- **1.0 (9), 2026-10-06:** share tutorial on an empty list, still splash, no embedded post, view pill and + separate again.
- **1.0 (8), 2026-10-05:** brand touches, animated splash (HQ export), location asked only from 3 places, the 2026-10-02 review fixes, embedded posts in the full sheet, keyboard fix.
- **1.0 (7), 2026-10-02:** price, splash, Map · Near me, sheet ⋯. Uploaded from this Mac once Sarp signed into Xcode; Apple's `swinfo` step took ~11 min, normal.
- **1.0 (6):** splash screen, light and dark. **(5):** glass pill shows the content behind it; no jump on view change. **(4):** icons, Liquid Glass, build 3 feedback (share card background, metro names, web pickers and icons on iOS). **(2–3):** share card over the host app, reading steps, first-run steps, menu + Settings sheet. **(1), 2026-10-01:** first upload.
- ~~On iOS 26+ the view pill and + are the system `TabView` tab bar~~ Undone 2026-10-06 (Sarp): the + inside the tab bar felt wrong. Back to the web layout, a glass view pill centred and a separate glass round + on the right.

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

## Phase 5 — Native iOS ✅ done (TestFlight since 2026-10-01)

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
- [x] ~~One-shot import of the web database on first launch~~ removed 2026-09-29 (every install starts empty); code deleted 2026-10-02
- [x] Build + run in Simulator, verify end to end
- [x] Share Extension: Share → Pinsta opens the save flow, saves into the shared App Group store
      (verified from Safari in the Simulator; Instagram itself needs a real device)
- [x] App icon in the asset catalog (2026-09-14; light + dark) — verify on the Simulator
- [x] Parity with web (2026-09-12): compact fixed-height sheet, zero-tap save +
      receipt + undo, MapKit tag cascade + account fallback, destination
      grouping, Vineyard, card rules, swipe edit/delete with undo toast

- [x] Real device via TestFlight (2026-10-01)
- [ ] CloudKit backup: deferred, see "Open decisions"

**Acceptance:** from inside Instagram, Share → Pinsta opens the save flow
pre-loaded with the shared post and saves to the same list the app shows.

## Decisions log (dated)
- **2026-10-09 — iOS Google list import: all Apple (Sarp).** The list is read through the free getlist endpoint; each entry is matched with MapKit on the phone, with no Google. Matching starts in the background while the person picks what to import (an unticked entry is dropped), so a 150-place list being ready in ~3 min is fine. A limit applies above 250 places and is never shown below it. Photos: after the match, a server call fetches a Google photo by name + pin (Text Search IDs only and Details photos-only are free; only the photo itself is paid, 1,000 free a month); the type tile shows until it arrives. Measured on this Mac: MKLocalSearch allows 50 searches, then returns `loadingThrottled` (MKError 3) at once, and refills on a rolling ~60 s window (100 done by 82 s).
- **2026-10-08 — Domains: subdomains, not paths (Sarp).** vicolo.space = marketing (+ /privacy), app.vicolo.space = the product, backoffice.vicolo.space = owner tooling (usage, anything future); /import is product and lives on app.. One Vercel project; `proxy.ts` routes by host.
- **2026-10-08 — No Sander on Vicolo (Sarp).** Sarp does the designs.
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
- **2026-10-01 — How we design: iterate on the web, port to iOS once settled (Sarp).** Iterating on iOS (build, install, simulator taps) is too slow for design. Web is the sketchbook; iOS gets the agreed version in one pass.
- **2026-10-02 — Opens on Map · Near me, List as the fallback (Sarp).** Supersedes the 2026-09-29 "never prompts on load"; the view is no longer remembered.
- **2026-10-02 — No type dots on cards or list rows (Sarp).** Clean cards beat the colour cue; pins and tiles keep the tints.
- **2026-10-01 — iOS Maps-link saves keep the emoji tile, no Look Around photo (Sarp).** Look Around images aren't good enough to stand in for a place photo.
- **2026-10-02 — Price level shown, web and iOS (Sarp).** iOS asks Google through `/api/price` for food and drink places; this spends Sarp's quota on friends' saves, accepted.
- **2026-10-02 — Cost tracker in the buddy menu (Sarp).** Google estimated from counted calls, Apify from its own API.
- **2026-10-02 — iOS embeds posts in the full sheet**, like the web (it was a "decide" item; the web version is the settled one).
- **2026-10-02 — iCloud backup deferred past the beta (CTO).** Can't be verified without a device and iCloud sign-in; a migration mistake the night before friends install costs more than the feature gives.
- **2026-10-02 — Keyboard jump in the add sheet fixed** (Sarp asked for the after-beta fixes; supersedes "not fixing for now", 2026-09-29).
- **2026-10-05 — Animated splash (Take 1) replaces the still**; the launch screen becomes a storyboard so the poster can aspect-fill like the movie.
- **2026-10-05 — Location is asked on open only from 3 saved places, and after the splash (Sarp).** A new user's first launches never open on a permission question.
- **2026-10-02 — Background retries back off; gone posts are never retried.** Each retry is a paid call on Sarp's accounts.
