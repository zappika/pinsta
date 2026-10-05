# Vicolo: restrained brand touches — iOS handoff

Sarp approved all four touches below on 2026-10-02. He explicitly excluded successful-save styling. The splash is a separate ongoing design task; do not modify it in this pass.

## Coordination

The web implementation is isolated on `codex/vicolo-brand-touches`, based on current main at `4ab5f65` (iOS build 8), and completed on 2026-10-05. The original checkout and its pending plan/exports work are preserved. Inspect current history and apply only this brand commit where needed; preserve newer menu actions, including Usage. This is a web reference implementation plus an iOS port brief, not a completed iOS change.

Keep the current Map/Near me opening behavior, price labels, edit/delete behavior, native iOS tab bar, and removal of category dots. No new collection/category filtering behavior is needed. Do not change the save receipt, save animation/haptics, app icon, splash, schema, API, signing, or build number.

## 1. Menu signature

Replace the person glyph in `BuddyMenu.swift` with the flat elephant from `public/brand/elephant-mark.svg`. Render as a template asset in the current primary label color, about 22pt inside the existing neutral circular button. Minimum 44pt hit target. Keep accessibility label "Menu", existing menu actions and standard pressed feedback. No multicolor resin at this small size.

The vector follows the original flat Vicolo mark: rounded arch, circular upper-right eye cutout and bottom central leg cutout. Do not substitute an anatomical elephant or SF Symbol.

## 2. Empty states

First empty collection: use `public/brand/elephant-resin.png`, decorative, 112pt square, centered. Title: "Your next favorite starts here". Keep existing iOS share-extension setup instructions (Share > More > add Vicolo to Favorites) accurate and reachable. An optional "Save your first place" button should open the EXISTING add flow, not a new flow. Body: "Save a place you want to try. Keep it for when you’re nearby." Standard neutral text/surfaces; illustration does not float or loop.

Filtered zero results: "No places here yet" / "Try another area or clear your filters." Use `public/brand/coffee.png` for Cafe, the elephant otherwise, max 112pt. "Show all places" clears city/category using the existing state logic; do not alter default launch or location behavior. Avoid adding fake categories to make this state reachable. Leave map-specific location/offline states intact.

## 3. Where/What picker selection

In `FilterPicker.swift`, add a faint rounded/row background to the selected option only:
- Light: #FAEEE9 (subtle coral tint).
- Dark: #302937 (subtle lilac tint).

Retain the existing primary-color checkmark, selected font weight, counts, row heights and neutral sheet surfaces. Follow the app's selected appearance, including pinned Light/Dark. Selection must never rely on color alone. No category dots, all-over pink surfaces, colored body text or extra animations.

## 4. Settings detail

Place a small 48pt resin elephant beside a quiet Vicolo label near the Settings footer/version area. iOS may show real bundle version/build read from Bundle.main; do not hardcode a release number. Keep standard system typography, existing settings controls and sheet behavior. Optional secondary line, used on web: "A little collection of places."

## Assets

Both transparent PNGs are 384px square for up to 3x rendering at 112pt. The pink elephant is a restrained signature in both light/dark app surfaces; no need for additional theme variants for these small illustrations. Existing app icon light/dark behavior remains separate. Treat illustrations as decorative for VoiceOver; surrounding copy supplies meaning. Use the vector template for the menu, not the resin PNG.

Assets generated with the built-in image tool from the approved Vicolo artwork:
- Elephant prompt: extract only the original pink/orange/yellow resin logo, preserving silhouette, holes, perspective and confetti texture, transparent background/no shadow, 10% margin.
- Coffee prompt: extract the reference's yellow chunky ceramic cup, preserve oversized handle, coffee and tilt, transparent background/no shadow, no steam, 15% margin.
- Outputs downsampled to 384px for app use. Flat mark reproduced as vector from the original flat reference.

## Verify before integration

Check light, dark, and pinned appearance opposite to system; first empty collection; filtered zero results; Where/What selected rows and counts; menu opens and Settings opens/closes; current populated cards/list/map remain unchanged. Check 320pt width, larger Dynamic Type, VoiceOver labels and 44pt hit areas. Use fresh simulator fixtures, not real user deletions. Regenerate Xcode project after adding source/assets as needed, compile app plus share extension, and accurately report any simulator/device checks not run.

Successful-save and splash work remain outside this handoff.

## Web verification (2026-10-05)

- TypeScript (`tsc --noEmit`) and whitespace/diff checks passed against main `4ab5f65`.
- Local browser with an empty synthetic collection: first-empty illustration and copy render; elephant menu opens with Settings and Usage retained; Settings opens and pinned Dark renders the brand detail correctly.
- No production data or credentials used. Temporary API fixture removed; no API changes included.
- Filter styling and reset handler reviewed in code. Populated/filtered screens and narrow viewport were not browser-verified in this pass.
- Production build attempted but blocked by local disk exhaustion (`ENOSPC`); rerun after freeing disk space. Native iOS build and simulator checks belong to the port.
