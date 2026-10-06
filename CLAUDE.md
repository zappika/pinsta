# Vicolo (formerly Pinsta) — working notes

The product is **Vicolo**. Code, repo, folder and the Vercel project still say pinsta; that's intentional, not a leftover to fix.

**`parity.md` is the web ↔ iOS comparison** (what each app has, what differs on purpose). Update it in the same commit as any change that adds or closes a difference.

Read `plan.md` first: it has the "Last session" block, what's waiting on Sarp,
and the dated decisions. This file is *how things work* so a session can
continue without re-deriving anything.

## What it is, in one line
Paste (or share) an Instagram post → the place it shows is saved to a personal
list with Google/Apple Maps links. Web app + native iOS app, same rules.

## Run it

**Web** (Next.js, Vercel, Neon Postgres) — live at https://pinsta-two.vercel.app
```bash
npm run dev            # port 3010 — or the "pinsta" entry in .claude/launch.json
npx tsc --noEmit       # the type check that stands in for tests
```
Secrets live in `.env.local` (Apify, Google Places, Neon, Blob). Pushing to
`main` deploys production.

**iOS** (SwiftUI + SwiftData; Simulator for development, TestFlight for the phone)
```bash
cd ios && xcodegen generate    # ALWAYS after adding/removing Swift files (brew install xcodegen if missing)
xcodebuild -project Pinsta.xcodeproj -scheme Pinsta -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath DerivedData build
xcrun simctl install "iPhone 17 Pro" DerivedData/Build/Products/Debug-iphonesimulator/Pinsta.app
xcrun simctl launch  "iPhone 17 Pro" se.sarper.vicolo
```
Share extension test: open a post URL in Safari on the Simulator → `⋯` → Share →
Pinsta. Instagram itself can't be installed in the Simulator.

## How the pieces fit
- **One cloud call:** `POST /api/extract` reads the post through Apify and copies
  the image to Blob. Web also gets Google Places candidates from it; iOS sends
  `native: true` and resolves places itself with MapKit (no key, no quota).
- **Three kinds of link** (`lib/sources.ts` parses all of them): Instagram (Apify), TikTok (`lib/tiktok.ts`: the video page's `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON has caption, author and `poi` = location tag; oEmbed for the thumbnail), Google Maps (`lib/google-link.ts`: name + `!3d/!4d` pin from the URL, short links followed). `instagram_url` in the DB holds any of them. Untagged posts also try `captionPlaceQuery` ("at X in Y").
- **Tag → place** (`lib/google-places.ts: resolveTag/resolveAccount`, ported to
  `ios/Pinsta/Services/PlaceSearch.swift`): several cheap queries merged and
  ranked — tag, account display name, tag + category word from the caption,
  tag + a hashtag naming a known city. No tag → the posting account's name is
  searched and offered as *suggestions* (never auto-saved).
- **Grouping** (`lib/grouping.ts` ↔ `ios/Pinsta/Services/Grouping.swift`): the
  "Where" menu label per place. Town with 2+ places = own row; 1-place town folds
  into its region only if the region then bundles 2+. Same comments both sides —
  change one, change the other.
  Before that, a place inside a big city (`lib/metros.ts` ↔ `Metros.swift`, by
  coordinates) is filed under that city: MapKit names districts ("Beyoğlu", "Nordhavn").
- **Views** (`ViewSwitch.tsx` ↔ `ViewSwitch.swift`): the bottom pill picks Map / List / Cards / Tiles for the
  current Where·What selection; the round + sits apart on its right (both apps; on iOS 26+ both are Liquid Glass, not the system tab bar, which Sarp undid 2026-10-06). Map pins are Sarp's 3D type icons (`public/types`, iOS `Type*` assets) on type tints, grouped when they overlap. The round + opens the save sheet and becomes its ×. Tapping a place opens it (web: a floating card, one size, with a "why it's here" line from `lib/why-here.ts`; iOS: still the pull-up sheet, short → full → away). No embedded posts any more: the post button opens the post. Map: MapLibre + OpenFreeMap on web, MapKit on iOS, framed to fit the
  selection (web, Everywhere: one country — most places, or nearest with a location — and country chips for the rest). Tiles: Instagram profile grid. Pin/tile tap → `PeekCard`. Every visit/launch opens on Map · Near me (both apps); offline, refused location, or a map that hasn't drawn in 12 s → List of everything. Nothing within 50 km → the map of everything. Location is never *asked* on open until the list has 3 places (`ASK_AFTER` in `lib/geo.ts` ↔ `NearMe.askAfter`), and on iOS only after the splash; before that it opens on the map of everything. Picking Near me always may ask.
- **Photos:** a place never goes without one. Web: `lib/photo.ts` (post image → Google photo) on save; a client whose read failed sends `postUnreadable` so the save doesn't pay Apify again.
  iOS: `PhotoRetry` re-reads photo-less posts on launch/foreground, with `Backoff` (6 h doubling to 2 weeks, six tries; the least-tried first) and `photoGaveUp` once `/api/extract` says `permanent: true` (deleted/private post, 404). `PriceLookup` uses the same backoff. No Google there.
  Shown through `PlacePhoto` (downsampled once, off the main thread, cached) — never `UIImage(data:)` in a view body.
- **Save flow** (`app/components/AddPlace.tsx` ↔ `ios/Pinsta/Views/AddPlaceView.swift`):
  fixed-height bottom sheet; one tag match saves itself → receipt with
  "Wrong place?"; several → tap; none → account suggestions → search. Same link
  twice → "Already saved". Edit mode re-selects the place behind a card.
- **Google list import** (web, `/import` → `app/api/import/google`, `lib/google-list.ts`): a shared list link is read through Google Maps' unofficial `entitylist/getlist` (free, no key; positions documented in the file). Each entry: already a card → no call; matched in the last 30 days → `list_matches` table, no call; else one Text Search at its pin (≤150 m or no match). Review is grouped by category (Move / Move all), then saves through `POST /api/places` (takes `category` and `fromList` {title, owner}, stored in `places.from_list`).
- **One place, many posts** (`lib/same-place.ts`): a save that matches an existing place (same Google id, or ≤60 m + a shared name word) appends to its `posts` jsonb instead of inserting. First post stays in the row columns.
- **Usage (cost tracker):** every paid call bumps a per-day row in `usage` via `countCall()` (`lib/usage.ts`, which also holds the SKU prices and free allowances): Apify reads, Google Text Search Pro (`searchPlaces`) / Enterprise (`findPriceLevel`), Place Details Pro / Enterprise (`getPlace` without / with price), Place Photos (the media call in `lib/photo.ts`; its details call asks only `photos`, the free IDs Only SKU). A new paid call needs a `countCall` and, for a new SKU, an entry in `SERVICES`. Owner-only `GET /api/usage` sums the month, and Apify's real dollars come from its API (`/users/me/usage/monthly` + plan credit from `/users/me`). Buddy menu → Usage.
- **Settings, per device** (web localStorage / iOS `Settings` in UserDefaults): Directions app (asked on first use), Appearance (System/Light/Dark). Both live in the round buddy menu, top right.
- **Near me:** a Where option, 50 km. Asked on open only from 3 saved places (see Views), or when picked.
- **Want to go / Been there** (web only so far, `PlaceCard` → `Visit`): every place starts Want to go (`visited_at` null). The floating card has two equal buttons acting as one switch; Been there stamps `visited_at` (kept, not shown; a second Been there keeps the first date) and shows 😞 🙂 😃 (`rating` 1–3, tap again to clear). Back to Want to go clears the date, keeps the rating. `PATCH /api/places/[id]` with `{visited, rating}`. No filter yet (Sarp, 2026-10-06).
- **Edit / delete:** Cards: swipe right-to-left (or right-click on web) → round change/remove buttons; full swipe removes. Map/List/Tiles: the place sheet (`PeekCard` ↔ `PeekCardView`) has a ⋯ ("Change or remove") → Change place / Remove. Delete is deferred 5 s behind an Undo toast (`PinstaApp.tsx` / `PlacesListView.swift`); a delete the server rejects brings the place back on reload; opening the save sheet commits a pending delete first.
- **iOS empty list = tutorial** (`Views/EmptyTutorial.swift`, design in `exports/vicolo-onboarding-handoff`, not in git): three swipeable pages teaching Instagram → Share → Vicolo, the More → Edit → Favorites help on page 2 only, and a "Paste a link" that opens the save sheet (no floating + there). Shown whenever the list has nothing to show — no "seen" flag; filtered-empty stays `noMatchState`. Trattoria Lina is artwork (`OnboardingRestaurant`, `OnboardingAppIcon` assets), never a saved place. Colours are tutorial-local (`Tutorial`), not app tokens.
- **Cards and list rows:** name, then type · price · town in grey. No type dots (Sarp, 2026-10-02); the type tints stay on map pins and photo-less tiles.
- **Price ($–$$$$):** Google `priceLevel` → `price_level` 1–4. Web: only `getPlace(id, { price: true })` on save/change asks (Enterprise tier); keep it off searches. iOS: `PriceLookup` (in `PostReader.swift`) calls open `POST /api/price` for food and drink places after a save and on foreground; `priceChecked` stops repeats.
- **iOS splash (a still, Sarp 2026-10-05; the Take 1 movie is gone):** `Resources/LaunchScreen.storyboard` shows `VicoloSplashPoster` aspect fill to the edges; `SplashView` draws the same still over the app, holds it 1.2 s and fades *itself* out in UIKit (a SwiftUI removal transition never animated it). Light/dark = the phone's at launch, frozen; the in-app Appearance applies after. Skipped on `-addURL` and after a return from the background. `Launch.shared.splashDone` tells the list it may start (location question). See "Splash assets" for replacing it.
- **iOS data:** SwiftData store in App Group `group.se.sarper.vicolo`, shared with
  the extension. Every install starts empty (no web import). `Persistence.opened` is the
  store or its error — it never opens a different store in its place (an empty stand-in
  looked like a lost list); a failure shows `StoreErrorView`. SwiftData doesn't see the
  extension's writes, so the extension stamps `lastWrite` in the App Group defaults and the
  list rebuilds on foreground only when that changed, never under an open sheet. What the
  screen shows (filters, open sheet, location) lives in `Screen`, outside the rebuilt view.
- **New `Place` fields need a default** (`= 0`, `= false`, or optional): that is what lets
  SwiftData migrate an existing store by itself. Test with the worktree upgrade below.

## Splash assets
New light/dark stills:
1. Convert to PNG (`sips -s format png`) as `light.png` / `dark.png` in `ios/Pinsta/Resources/Assets.xcassets/VicoloSplashPoster.imageset`, and set the storyboard's `<image name="VicoloSplashPoster" width=… height=…>` to their size. `SplashBackground` should match the stills' edges (#FDFCF5 / #041553 now).
2. `swift ios/scripts/splash-poster.swift ios/Pinsta/Resources/Assets.xcassets/VicoloSplashPoster.imageset` relabels an "HDTV" colour profile as sRGB without touching pixels (earlier exports carried one).
3. Check: uninstall **and reboot the simulator** first (iOS caches launch screens; a stale one shows as a ghosted double image), then launch with `-splashHold` (keeps the still up) and screenshot in light and dark.

## iOS app icon
The active `AppIcon.appiconset` uses the 1024px masters from `Vicolo-App-Icons.zip` (2026-10-02): pink/orange/yellow for Any (light/default), cobalt/lime/lilac for Dark. Xcode generates device renditions from these opaque PNGs; `ios/project.yml` selects `AppIcon`. Home Screen icon appearance is controlled by iOS, independently of the in-app Appearance preference.

## Dark mode
No `dark:` classes. `globals.css` flips Tailwind's stone palette variables (and white, red, amber) when `<html data-theme="dark">`, or on a dark system unless `data-theme="light"`. The buddy menu sets it (`lib/theme.ts`); an inline script in `layout.tsx` applies it before first paint. The dark rules exist twice (pinned and system); edit both. Any stone/white class works in both themes; a colour outside that palette needs an entry in both blocks. The map switches to OpenFreeMap `dark`.

## The owner key
The web list is Sarp's alone (`lib/owner.ts`). Every `/api/places*` route and
`/api/places/search` need header `x-pinsta-key: $PINSTA_OWNER_KEY`; the web app
asks for it once and keeps it in localStorage (`lib/api.ts`). `/api/extract` is
open for the iOS app, but only the owner gets Google candidates from it. `/api/price` is open too (one Google call per iOS food/drink save). Both are paid and unthrottled; a firewall rate limit is proposed in plan.md. The key
lives in `.env.local` and Vercel env — **never in the repo, which is public**.
While the env var is unset the lock is off. Local curl with the key:
`curl -H "x-pinsta-key: $(grep PINSTA_OWNER_KEY .env.local | cut -d= -f2)" localhost:3010/api/places`

## Gotchas that cost time
- **Saved posts can vanish.** Instagram posts get deleted (Bar Brutal's did); the
  reader then says "Post does not exist" and the app falls back to typing. Test
  auto-save with a tagged post that still exists — Ästad Vingård (`DdJIacKIplU`).
- **Test fresh installs on a second simulator** (e.g. iPhone 17) so the main one
  keeps its list.
- **This shell is zsh:** unquoted `$VAR` doesn't word-split, and `echo` rewrites `\n` inside JSON. Write API tests as small `node` scripts, not curl pipelines.
- **Bundle ID changed to `se.sarper.vicolo`.** The old `se.sarper.pinsta` app is a separate install on simulators; its local list stays with it.
- **iOS scene phase:** dialogs and menus send the app through `.inactive`. The list only rebuilds on a return from `.background`; rebuilding on every `.active` wiped view state (it ate the Directions confirmation).
- **Share extension background:** iOS 26+ ignores `.overFullScreen` and paints an opaque white sheet behind the extension; `ShareViewController.clearSheetBackground` clears the superview chain so only the card shows. No dim of our own (the system dims).
- **Share extension compiles `Pinsta/Services` and `Models`.** Anything using `UIApplication.shared` (opening apps) must live in `Pinsta/Views`, which the extension doesn't include.
- **Pull before you start.** Two sessions (two machines) work on this repo. On
  2026-09-29 a session built on a copy eight commits old and had to rebase.
- **Xcode license after an OS update.** macOS 27 brought Xcode 27; until
  `sudo xcodebuild -license accept` runs, `xcodebuild` *and* `/usr/bin/python3`
  refuse to run. Use `node` for scripted edits meanwhile.
- **XcodeGen blanks `.entitlements` files** unless the App Group is declared under
  `entitlements.properties` in `project.yml`. It is — keep it there.
- **Ad-hoc signing** (`CODE_SIGN_IDENTITY: "-"`) is what embeds entitlements for
  the Simulator. Unsigned builds crash on the App Group container.
- **Apify free plan = 5 concurrent runs.** The URL field is debounced (600–700 ms)
  so typing a link doesn't launch a run per keystroke.
- **Google address components can lack `types`.** The parser tolerates it; an
  earlier crash there looked like "search found nothing".
- **Xcode updates break the CLI.** After an Xcode update, `xcodebuild` may report "CoreSimulator is
  out of date" / a missing iOS platform, and `xcode-select` may point at CommandLineTools. Fix (sudo):
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer && sudo xcodebuild -runFirstLaunch && xcodebuild -downloadPlatform iOS`.
  Without sudo, `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` in front of a command gets partway.
- **Map on web:** MapLibre needs its worker served from `public/maplibre/` (Turbopack breaks the
  `import.meta.url` lookup) — `scripts/copy-maplibre-worker.sh` runs on postinstall.
- **Never poll production in a loop.** Vercel's automatic mitigation challenged this Mac's IP after
  ~70 curl requests in ten minutes; the Simulator shares the IP, so the app's import/extract calls
  failed silently too. Check a deploy with `npx vercel ls` / `npx vercel inspect`, one request at a time.
  `npx vercel firewall persistent-actions list` shows an active challenge; it expires by itself (~10 min).
- **Disk:** Xcode + Simulator eat space; the Mac ran out once mid-build. Keep 10 GB free.
- **SwiftUI `clipped()` clips drawing, not touches.** A fill-scaled photo that overflows its
  box still takes taps above and below it (it ate the place sheet's handle). Photos get
  `.allowsHitTesting(false)` (`PlacePhoto` does it).
- **The iOS Simulator tool's screenshot can be stale** after taps; `xcrun simctl io <device> screenshot` shows the truth.
- **Hidden browser pane = no map.** MapLibre never fires `load` when the Browser pane isn't on screen, so map checks need the pane visible.
- **Testing deletes:** never on real rows. The Undo window is 5 s and tool latency
  is often longer — a test once deleted a real place. Restore via read+save.

## Data operations
- Schema: `lib/db/schema.ts` → `npx drizzle-kit push` (needs `.env.local` sourced).
- One-off scripts in `scripts/*.mts`, run with `set -a; source .env.local; set +a; npx tsx scripts/<name>.mts`
  (`.mts` because top-level await). Existing: `backfill-region`, `backfill-images`, `backfill-price`, `fix-rows`, `merge-places <keep> <duplicate>` (ids or exact names; refuses ambiguous names and a card into itself).
- Inspect prod data: same curl as above against `https://pinsta-two.vercel.app/api/places`, with the key once the lock is on. One request at a time (see the Vercel polling gotcha).

## Shipping a TestFlight build
```bash
cd ios && xcodegen generate   # bump CURRENT_PROJECT_VERSION in project.yml first — every upload needs a new number
xcodebuild -project Pinsta.xcodeproj -scheme Pinsta -sdk iphoneos -destination 'generic/platform=iOS' \
  -archivePath build/Vicolo.xcarchive -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath build/Vicolo.xcarchive -exportOptionsPlist build/export.plist \
  -exportPath build/export -allowProvisioningUpdates   # export.plist: method app-store-connect, destination upload, teamID 8D6ML34D52
```
`ios/build/` is gitignored; recreate `export.plist` if missing. Archiving needs an Apple account in Xcode → Settings → Accounts; without one it fails with "No Accounts" / "No profiles for 'se.sarper.vicolo'" (the Mac Sarp worked on 2026-10-02 had none; earlier builds came from the other machine). Team 8D6ML34D52 (paid), Sarp's iPhone 15 is registered. Processing at Apple takes 10–20 min.

## Testing iOS
- Use the second simulator (iPhone 17) for fresh-install and destructive tests; the main one (iPhone 17 Pro) keeps a list. UDIDs differ per Mac: `xcrun simctl list devices`.
- SwiftData migration test: build the previous commit in a `git worktree`, install it, save a place, then install the new build over it (`simctl install` keeps the data).
- `xcrun simctl location <id> set 41.39,2.17` + `xcrun simctl privacy <id> grant location se.sarper.vicolo` for Near me.
- `-splashHold` keeps the splash still up (see "Splash assets").
- Launch with `-slowNotices` to keep toasts up 30 s while checking them, and `-addURL <link>` to open the save sheet with a link the way a share does (Safari's Share menu ignores injected taps on the iOS 27 simulator).
- Test auto-save with a tagged post that still exists (Ästad Vingård `DdJIacKIplU`) or a Maps link; Bar Brutal's post was deleted.

## Conventions
- Web first, then port to iOS in one pass. Keep shared rules identical. Design iteration happens on the web only (Sarp, 2026-10-01); iOS gets the settled version.
- Low-tech first: no LLM/paid API where a heuristic does the job (Sarp's call).
- Commit per verified chunk; the message body says why. Push = deploy.
- Categories: `lib/categories.ts` ↔ `PlaceCategory.swift`, incl. Vineyard.
