# Task: App Store listing — app information and assets (for GPT6)

Written 2026-10-16. Owner of the result: Sarp (approves every word and picture; nothing is uploaded
to App Store Connect by you). No app preview video for now.

## Read first
- `CLAUDE.md`: what Vicolo is, how to run the iOS app, test links, gotchas.
- `docs/app-store.md`: §2 Metadata (field limits and rules), §3 Assets (sizes and the screenshot
  story), §6 Review notes, §7 risks 1 and 5 (trademarks). These are the rules for this task.
- `changelog.md` and `app/support/page.tsx`: how Vicolo talks to people. Short, plain, concrete, no
  hype. "Saved to Vicolo", not "Supercharge your travel".

## Deliverables
Everything under `appstore/` at the repo root (new folder, committed):

```
appstore/
  README.md                 what you chose and why, open questions for Sarp
  metadata/en-US/
    name.txt                ≤30 chars (it's "Vicolo"; propose a suffix only if it helps search)
    subtitle.txt            ≤30
    promotional_text.txt    ≤170
    description.txt         ≤4000
    keywords.txt            ≤100 chars total, comma-separated, no spaces after commas
    review_notes.txt        from docs/app-store.md §6, links checked to still exist
    categories.txt          primary + secondary, one line each, with a sentence why
  screenshots/
    6.9/01.png …            1320 × 2868 (iPhone 17 Pro Max simulator)
    6.3/01.png …            1206 × 2622 (iPhone 17 Pro simulator)
    duo-outer/01.png …      1398 × 2034 (iPhone Duo simulator, folded)    — optional
    duo-inner/01.png …      2007 × 2853 (iPhone Duo simulator, unfolded)  — optional
    raw/                    the untouched simulator captures the framed ones are made from
  creative/                 optional
    header-21x9.png         3840 × 1646
    search-3x2.png          1920 × 1280 to 3840 × 2560
```

Give each field 2–3 alternatives in `README.md` where the choice is a matter of taste (subtitle,
first sentence of the description, screenshot headlines); put your pick in the `.txt`.

## Rules that get an app rejected (docs/app-store.md)
- No "Instagram", "TikTok" or "Google" in name, subtitle or keywords; no other platforms' logos
  anywhere. The description body may say it works with links from them.
- No prices, "free", "#1", "best", URLs or Apple awards in any text or image.
- Screenshots: more than half of each set shows the real app in use; headlines short, never covering
  the UI; current UI exactly as it is (no mock-ups); PNG without alpha; everything suitable for 4+.
- Only places and posts that are public venues; no real people's names or faces as the subject.
- Keywords: don't repeat words already in the name or subtitle.

## Screenshots: how
1. Build the app (CLAUDE.md → Run it) and install on the **iPhone 17 Pro Max** and **iPhone 17 Pro**
   simulators (and **iPhone Duo** if you do the optional set). Don't use the main simulator's list
   for anything destructive; a fresh install starts empty.
2. Make a believable demo list: one city with 10–15 places (cafés, restaurants, a bar, a museum,
   a park) plus a second city with a few, saved the real way: `-addURL <link>` launches the save sheet
   with a link (Instagram posts with a location tag, TikToks with one, Google Maps place links), or
   + → Google Maps with a shared list. Check each one lands on the right place.
3. Clean status bar on every device:
   `xcrun simctl status_bar <device> override --time 9:41 --dataNetwork wifi --wifiBars 3 --batteryState charged --batteryLevel 100`
4. Capture with `xcrun simctl io <device> screenshot <file>.png` (the Simulator tool's own screenshot
   can be stale, CLAUDE.md). Light mode for the set; one dark frame is fine if it's the best one.
5. The story (docs/app-store.md §3), 5–6 frames:
   - the map of a city full of saved places
   - a post shared → "Saved to Vicolo"
   - "Is this the place?" with choices
   - a list post → "This post has N places"
   - Where / What grouping
   - a place card with directions and Been there
6. Framing: a short headline (≤5 words) above the screen on a background from the brand
   (`docs/vicolo-brand-ios-handoff.md`, `assets/vicolo-library/`). Keep it simple and the same on
   every frame. Script it (e.g. a small node + sharp or a Swift/AppKit script under `appstore/`), so
   a UI change means re-running, not redrawing.
7. Check: `sips -g pixelWidth -g pixelHeight -g hasAlpha appstore/screenshots/*/*.png`. Every size
   exact, `hasAlpha: no`.

## Creative assets (optional)
Product page header and search result asset (specs above, docs/app-store.md §3): one clear idea
(the map of a city full of places from posts), little or no text, key art centred, 4+. Templates:
developer.apple.com/app-store/asset-best-practices/.

## Done when
- Every file above exists, within its limits (count characters, report them in README.md).
- Screenshots pass the `sips` check and the rules list.
- README.md lists your choices, alternatives and anything you were unsure about.
- One commit, message says why. Don't push: Sarp reviews first.
