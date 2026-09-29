# Vicolo (formerly Pinsta) — working notes

The product is **Vicolo**. Code, repo, folder and the Vercel project still say pinsta; that's intentional, not a leftover to fix.

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

**iOS** (SwiftUI + SwiftData, Simulator only until the developer account exists)
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
- **Tag → place** (`lib/google-places.ts: resolveTag/resolveAccount`, ported to
  `ios/Pinsta/Services/PlaceSearch.swift`): several cheap queries merged and
  ranked — tag, account display name, tag + category word from the caption,
  tag + a hashtag naming a known city. No tag → the posting account's name is
  searched and offered as *suggestions* (never auto-saved).
- **Grouping** (`lib/grouping.ts` ↔ `ios/Pinsta/Services/Grouping.swift`): the
  "Where" menu label per place. Town with 2+ places = own row; 1-place town folds
  into its region only if the region then bundles 2+. Same comments both sides —
  change one, change the other.
- **Views** (`ViewSwitch.tsx` ↔ `ViewSwitch.swift`): the bottom pill picks Map / Cards / Tiles for the
  current Where·What selection. Map: MapLibre + OpenFreeMap on web, MapKit on iOS, framed to fit the
  selection. Tiles: Instagram profile grid. Pin/tile tap → `PeekCard`. Choice persisted, filters not.
- **Photos:** a place never goes without one. Web: `lib/photo.ts` (post image → Google photo) on save.
  iOS: `PhotoRetry` re-reads photo-less posts on launch; no Google there.
- **Save flow** (`app/components/AddPlace.tsx` ↔ `ios/Pinsta/Views/AddPlaceView.swift`):
  fixed-height bottom sheet; one tag match saves itself → receipt with
  "Wrong place?"; several → tap; none → account suggestions → search. Same link
  twice → "Already saved". Edit mode re-selects the place behind a card.
- **One place, many posts** (`lib/same-place.ts`): a save that matches an existing place (same Google id, or ≤60 m + a shared name word) appends to its `posts` jsonb instead of inserting. First post stays in the row columns.
- **Cards:** swipe right-to-left → round change/remove buttons; full swipe removes.
  Delete is deferred 5 s behind an Undo toast (`PinstaApp.tsx` / `PlacesListView.swift`).
- **iOS data:** SwiftData store in App Group `group.se.sarper.vicolo`, shared with
  the extension. First launch imports the web DB once (`WebImporter`). The list
  refetches on foreground because SwiftData doesn't see the extension's writes.

## Dark mode
No `dark:` classes. `globals.css` flips Tailwind's stone palette variables (and white, red, amber) when `<html data-theme="dark">`, or on a dark system unless `data-theme="light"`. The buddy menu sets it (`lib/theme.ts`); an inline script in `layout.tsx` applies it before first paint. The dark rules exist twice (pinned and system); edit both. Any stone/white class works in both themes; a colour outside that palette needs an entry in both blocks. The map switches to OpenFreeMap `dark`.

## The owner key
The web list is Sarp's alone (`lib/owner.ts`). Every `/api/places*` route and
`/api/places/search` need header `x-pinsta-key: $PINSTA_OWNER_KEY`; the web app
asks for it once and keeps it in localStorage (`lib/api.ts`). `/api/extract` is
open for the iOS app, but only the owner gets Google candidates from it. The key
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
- **Testing deletes:** never on real rows. The Undo window is 5 s and tool latency
  is often longer — a test once deleted a real place. Restore via read+save.

## Data operations
- Schema: `lib/db/schema.ts` → `npx drizzle-kit push` (needs `.env.local` sourced).
- One-off scripts in `scripts/*.mts`, run with `set -a; source .env.local; set +a; npx tsx scripts/<name>.mts`
  (`.mts` because top-level await). Existing: `backfill-region`, `backfill-images`, `fix-rows`, `merge-places` (fold a duplicate card into another).
- Inspect prod data: same curl as above against `https://pinsta-two.vercel.app/api/places`, with the key once the lock is on. One request at a time (see the Vercel polling gotcha).

## Conventions
- Web first, then port to iOS in one pass. Keep shared rules identical.
- Low-tech first: no LLM/paid API where a heuristic does the job (Sarp's call).
- Commit per verified chunk; the message body says why. Push = deploy.
- Categories: `lib/categories.ts` ↔ `PlaceCategory.swift`, incl. Vineyard.
