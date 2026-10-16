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

## Next build (since `ios-26`)

## In TestFlight: 1.0 (26) · 2026-10-16 · `ios-26` · phone ☐
- With no places near you, the map opens on all your places, not on the nearest country. Only places worlds apart (say Tokyo and Barcelona) still open on one country, the one with the most places.
- A carousel or caption list now also finds the places Apple Maps doesn't know, by asking Google.
- Posts whose account names its city (criollo_oax, jaja.berlin, strakers_nyc, selma__paris) find the place there, not a namesake abroad. Many more city shorthands are known: Oaxaca, Lisbon (lx), Milan, Vienna, Athens, Tokyo, Mexico City and the like.
- When Apple Maps only has far-off guesses for a post's city, Google is asked straight away.
- A restaurant @mentioned in the caption or a co-author comes first; airports, ferries and stations no longer show up just because they share the city's name.
- Removing a place and leaving the app right away removes it for real: sharing the post again no longer says "Already in Vicolo".
- Towns in Japan (and anywhere written in another alphabet) show in English; places already saved are fixed on the next launch.
- A post whose hashtags name a city (#tokyo) is searched there: no more saving a namesake at the other end of the country.
- The + now opens a small menu: Instagram post or Google Maps. Google Maps takes a single place or a whole shared list; a list goes straight to the import. Import from Google left the menu top right (it still shows there while a list is importing).
- The first few times you save a post by pasting its link, the success card mentions you can share straight from Instagram.
- Places saved from a post show the post's photo on the map; list imports keep their icons.
- Carousels with a busy cover slide still find every place on the later slides (a Berlin hotel's "3 Berlin spots" post: Julius Ernst, Hard Wax, Renate). A hashtag like #BerlinGuide now says the city.
- *(internal)* 2026-10-16: compiled with xcodebuild (device, unsigned) and the search checked with swiftc + real MapKit on Sarp's five links and Mert's cases; then run in the Simulator after `sudo xcodebuild -runFirstLaunch`: English town name and the delete-then-leave fix both checked on iPhone 17.
- *(internal)* List posts checked in the Simulator: gatrooms `DZFfxgUCL8I` 3 of 3; Vink's Oslo `C_OOWiDS7Gh` 5 of 6 (Tranen from Google as "Åpent Bakeri Tranen"; Hyde is on neither Apple nor Google now). Swift type-checked with swiftc only. Check on the other Mac: Vink's Oslo carousel `C_OOWiDS7Gh` should give 6 of 6 (Tranen from Google), and the opening map with places in two far-apart cities.

## Earlier builds
Tags `ios-1` … `ios-25` mark the commit that set each build number (the upload may
include a commit or two after it).

| Build | Date | What | Phone |
|---|---|---|---|
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
