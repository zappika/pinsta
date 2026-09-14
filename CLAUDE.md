# Pinsta — working notes

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
xcrun simctl launch  "iPhone 17 Pro" se.sarper.pinsta
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
- **Save flow** (`app/components/AddPlace.tsx` ↔ `ios/Pinsta/Views/AddPlaceView.swift`):
  fixed-height bottom sheet; one tag match saves itself → receipt with
  "Wrong place?"; several → tap; none → account suggestions → search. Same link
  twice → "Already saved". Edit mode re-selects the place behind a card.
- **Cards:** swipe right-to-left → round change/remove buttons; full swipe removes.
  Delete is deferred 5 s behind an Undo toast (`PinstaApp.tsx` / `PlacesListView.swift`).
- **iOS data:** SwiftData store in App Group `group.se.sarper.pinsta`, shared with
  the extension. First launch imports the web DB once (`WebImporter`). The list
  refetches on foreground because SwiftData doesn't see the extension's writes.

## Gotchas that cost time
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
- **Disk:** Xcode + Simulator eat space; the Mac ran out once mid-build. Keep 10 GB free.
- **Testing deletes:** never on real rows. The Undo window is 5 s and tool latency
  is often longer — a test once deleted a real place. Restore via read+save.

## Data operations
- Schema: `lib/db/schema.ts` → `npx drizzle-kit push` (needs `.env.local` sourced).
- One-off scripts in `scripts/*.mts`, run with `set -a; source .env.local; set +a; npx tsx scripts/<name>.mts`
  (`.mts` because top-level await). Existing: `backfill-region`, `fix-rows`.
- Inspect prod data: `curl -s https://pinsta-two.vercel.app/api/places`.

## Conventions
- Web first, then port to iOS in one pass. Keep shared rules identical.
- Low-tech first: no LLM/paid API where a heuristic does the job (Sarp's call).
- Commit per verified chunk; the message body says why. Push = deploy.
- Categories: `lib/categories.ts` ↔ `PlaceCategory.swift`, incl. Vineyard.
