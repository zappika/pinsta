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

## Next build (since `ios-27`)

## In TestFlight: 1.0 (27) · 2026-10-16 · `ios-27` · phone ☐
- A round arrow above the + on the map shows where you are: one tap and the map frames you and your surroundings, with the blue dot.
- The map never zooms in tighter than a neighbourhood, so a single place shows the streets around it.
- *(internal)* Locate button and 4.5 km frame ported from the web (they were waiting on Sarp's look and missed build 26). Checked in the Simulator from Barcelona.
- A person tagged in a venue's post no longer pulls in namesakes from another country (Pophams' London post offered places in Lille).

## Earlier builds
Tags `ios-1` … `ios-25` mark the commit that set each build number (the upload may
include a commit or two after it).

| Build | Date | What | Phone |
|---|---|---|---|
| 26 | 10-16 | + menu, photo pins, place finding from handles and hashtags, list posts with busy covers, English town names | ☐ |
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
