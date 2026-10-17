# Vicolo — Decisions

Dated decisions, newest at the bottom unless noted. Add one whenever Sarp settles
something that a later session might otherwise undo. (Moved out of plan.md 2026-10-15.)

- **2026-10-16 — Save reports from the phones (Sarp).** Testers rarely report a miss, so every iOS save sheet reports how it ended (`/api/saves`, backoffice → Saves). Anonymous: link, outcome, build, a random install id; never names or the list. Free (one row in Neon), so it is not counted in Usage.
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
- **2026-10-15 — Everywhere frames every place (Sarp, from a tester).** Supersedes 2026-10-06's one country. A tester in Copenhagen with places in Lisbon, Paris and Oslo opened on Norway (nearest country, one bakery) and called it random. Now all places, like a Google Maps saved map; only places worlds apart (over 4,000 km) get one country, the one with most places, never the nearest.
- **2026-10-15 — Slide names Apple Maps misses are asked of Google.** Only once Apple has found the list's area, one place per slide, at most 6 queries a post.
- **2026-10-16 — Map pins: loud and quiet, explored on the web (Sarp).** Seventy imported pins (mostly the gilda) drowned the few saved from posts, and big pins made Barcelona a field of 2s and 3s. Post places are photos sized by zoom; the rest are small tinted dots, type icons at street level; thinner rings (2 px); names only where they fit. A temporary switch tries "text first" (post places as names until zoom 15). Google photos for imports: not now (they can look sad).
- **2026-10-16 — Google list imports match on the server (Sarp).** For the "we're on it, come back to review" redesign: Google Text Search per new entry (5,000 free a month, then ~3¢; 30-day match cache), so an import finishes with the app closed and a push can say it's ready. Supersedes Apple-first matching on iOS for list imports only.
- **2026-10-16 — Anonymous use counts (Sarp).** "I catch myself using the other views a lot less than the map": the app counts opens, view pill taps and seconds per screen, per install and day, with the save reports' random id. No places, links, names or location. Privacy page updated.
- **2026-10-16 — List post names off a street photo's signs start unticked (Sarp).** casa.lawa: a laundry and a café next to Bar Popolare. Shown, not dropped.
- **2026-10-16 — Later, not now (Sarp):** the in-app "new version ready" banner (testers are on 25+), list import photos beyond 5 a run, list posts on the web, "Try it with one of these".
- **2026-10-15 — Locate button, and no frame tighter than 4.5 km (Sarp).** Like Google Maps: a round arrow above the + frames you at town size; it is also the way to get the blue dot before the opening ask (2 places), so it may ask at any list size. Town views were too tight (fitted to the pins, street level for close ones); now at least 4.5 km across. Web first; iOS once Sarp has seen it on the phone.
- **2026-10-17 — Web ↔ iOS after build 29 (Sarp).** The Nordic caption lift is on both (same word list, `lib/language.ts` ↔ `PlaceSearch.languageCountries`). Carousel / caption-list posts and the "why it couldn't be read" / "no photo" lines stay iOS-only for now. Loud and quiet map pins go forward, but the design isn't locked: no iOS port yet.
- **2026-10-17 — One simulator, iPhone 17 Pro (Sarp).**
