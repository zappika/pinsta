# Vicolo — iOS builds

What's on the phone, and what's waiting for the next build, side by side. Internal;
testers read `changelog.md` (vicolo.space/changelog).

How it stays true:
- **Every iOS change** adds a line under "Next build" in the same commit. Write it the
  way a tester would notice it, so it can go into `changelog.md` as is; internal-only
  notes get *(internal)*.
- **Every upload**: "Next build" becomes the new "In TestFlight", its tester lines go to
  the top of `changelog.md`, the old one moves to "Earlier builds", and the bump commit
  is tagged `ios-N` (`git tag ios-N && git push origin ios-N`).
- `git log ios-N..HEAD -- ios lib app/api` is the check: anything there that isn't listed under Next build was forgotten.
- **Phone:** ☐ until Sarp says the build is fine on the phone, then ☑ (one word from Sarp is enough).

## Next build (since `ios-30`)
- *(internal)* Counts opening a saved place, Directions, the post button and Been there (no place names), for the backoffice's Pulse page.
- The Paste button sits inside the link field, with a clipboard icon, so it reads as "paste what you copied", not as a button to tap after pasting. *(not built yet: written on the Mac without Xcode)*

## In TestFlight: 1.0 (30) · 2026-10-17 · `ios-30` · phone ☑ (Sarp, 2026-10-17)
- When a post can't be read, the sheet says why (private or deleted, or Instagram didn't answer), and a place saved without a photo says so on the saved card.
- With a single suggestion, the button under it says "Not this one".
- A post written in Swedish, Danish, Norwegian, Finnish or Icelandic shows places in that country first.
- The Undo of "Removed …" is no longer hidden under the locate button.
- Sharing a post with many slides (a museum, a house tour) no longer gets stuck on "Finding the place…": the sheet says which slide it is reading and which name it is looking up, and if the slides name no place it says so.
- A post tagged with just a US town ("Los Angeles, California") no longer offers random places in that town.
- Restaurants whose account spells out New York ("misinewyork", "_ny") are looked for in New York, not in every town with that name.
- Settings → Help improve Vicolo: switch off sending how saves went and how the app is used.
- With larger text, the Where and What titles sit one above the other instead of being cut short.
- With Reduce Motion on, menus, cards and sheets fade instead of sliding and bouncing, and the map jumps instead of flying.
- VoiceOver can change or remove a card (actions on the card) and reads the Where and What titles.
- Menu → Help and Privacy: how to save, common questions, how to reach us, and what Vicolo does with your data.
- *(internal)* Privacy manifests (app + extension) declare UserDefaults (CA92.1, 1C8F.1) and the data that leaves the phone: links/places (Other User Content), usage counts, read errors. For the App Store.
- *(internal)* Testing launch arguments (`-addURL`, `-importURL`, `-slowNotices`, `-splashHold`) work in Debug builds only (`Views/TestArgs.swift`).

## Earlier builds

### 1.0 (29) · 2026-10-16 · `ios-29` · phone ☑ (Sarp, 2026-10-16)
- A post that names places only on signs in a street photo no longer ticks them for you: those names are listed unticked, the post's own places stay ticked.
- Vicolo now also counts how it's used (how often it's opened, which views you pick and how long each is on screen), with no places, links or names. The privacy page says so.
- *(internal)* `SlideText.Reading.signs`: a slide with any Vision line under 0.5 confidence is a photo of signs (casa.lawa `DeW-H5LCsup`, slide 5); its names start unticked. Vink's Oslo slides all read at 1.0, still 5 of 5 ticked.
- *(internal)* `Uses.swift` + `ScreenClock`: per-day running totals (`open`, `pick.<view>`, `sec.<screen>` incl. `tutorial`) in the App Group, sent to open `POST /api/uses` on launch and on background; the server keeps the larger count. Backoffice → Saves shows them, plus where saves came from (link kind × share sheet / in app).

Tags `ios-1` … `ios-30` mark the commit that set each build number (the upload may
include a commit or two after it).

| Build | Date | What | Phone |
|---|---|---|---|
| 28 | 10-16 | Save reports | ☑ (Sarp, 2026-10-16) |
| 27 | 10-16 | Locate button, 4.5 km minimum frame, Pophams fix (mentioned accounts' far-off namesakes) | ☑ (Sarp, 2026-10-16) |
| 26 | 10-16 | + menu, photo pins, place finding from handles and hashtags, list posts with busy covers, English town names | ☑ (Sarp, 2026-10-16) |
| 25 | 10-15 | What's new in the menu | ☑ |
| 24 | 10-15 | location primer, caption lists, What sub-rows, Culture | ☑ via 25 |
| 23 | 10-14 | list posts (several places from a carousel), "Address of the …:" lines, caption @mentions | ☑ via 25 |
| 22 | 10-14 | place finding (street tags, 📍, collabs), profile saves, Share to… tutorial page, stuck help, copied-link offer, Google fallback | ☑ via 25 |
| 21 | 10-14 | tutorial opens a post of a place, asks to favorite Vicolo — **first build testers installed** | ☑ |
| 20 | 10-11 | plain "Import N places" label | ☑ |
| 19 | 10-11 | list import asks Want to go or Been there | ☑ |
| 18 | 10-10 | save sheet steps animate as one, no frame-late jumps | ☑ |
| 17 | 10-10 | save sheet as in the /success sandbox, success card opens with its photo, burger from the handle | ☑ |
| 16 | 10-09 | travel areas in the Where menu, food icons | ☑ |
| 15 | 10-09 | opens on your town, blue dot, no Near me | ☑ |
| 14 | 10-09 | Google list import, town tags, pinned search, no link field on Share | ☑ |
| 13 | 10-09 | new save flow and success card | ☑ |
| 12 | 10-06 | Want to go / Been there with 😞 🙂 😃, Been there list, country chips removed — **build submitted for Beta App Review** | ☑ |
| 11 | 10-06 | 3D type icons, floating place card with why it's here and the venue's website, map by country | ☑ |
| 10 | 10-06 | menu → How to save | ☑ |
| 9 | 10-06 | share tutorial on an empty list, still splash, no embedded post, pill and + apart | ☑ |
| 8 | 10-05 | brand touches, animated splash, location from 3 places, the 10-02 review fixes, keyboard fix | ☑ |
| 7 | 10-02 | price, splash, Map · Near me, sheet ⋯ | ☑ |
| 6 | 10-02 | splash screen, light and dark | ☑ |
| 5 | 10-02 | glass pill shows the content behind it; no jump on view change | ☑ |
| 4 | 10-01 | icons, Liquid Glass, build 3 feedback (share card background, metro names) | ☑ |
| 2–3 | 10-01 | share card over the host app, reading steps, first-run steps, menu + Settings sheet | ☑ |
| 1 | 10-01 | first upload | ☑ |

Builds 21–25 answer the beta testers' feedback (`beta.md`). 25 was checked on Sarp's phone 2026-10-15, which covers 22–24; up to 21, later builds were tried on top of them.
