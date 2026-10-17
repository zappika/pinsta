# Vicolo — web ↔ iOS

What each app has, side by side. Kept current with every change that adds or
closes a difference (CLAUDE.md). Last updated 2026-10-15 (build 24). Also at backoffice.vicolo.space/parity.

## To close

| What | Web | iOS |
|---|---|---|
| Google Maps list import | `/import`: grouped review, Move / Move all, asks Want to go or Been there for the whole list (icons), keeps the list's name and owner; Google matches on the server | Same screen (buddy menu → Import from Google): the list read by `/api/list`, matched with MapKit on the phone (a second, looser pass for towns and big sites), Import any time (after Want to go / Been there is picked), carries on in the background, 250 at most; photos by name + pin from `/api/photo`. Keeps the list's name and owner, not shown yet |
| Share tutorial (four pages: Share → Share to… → Vicolo → saved) | No (Sarp: not needed on web) | Empty list, and menu → How to save; back-from-Instagram note and copied-link offer on the empty list |
| What menu sub-rows (2+ places sharing a type, e.g. Wine bar under Bars; `lib/subtypes.ts` ↔ `Subtypes.swift`) | Google `primaryType` | Apple's category (brewery, movie_theater…), or Google's type when the fallback found it; no cuisines (Apple has none, Sarp: no rows from our food words). Only saves from now on carry a type |
| Locate button and a 4.5 km minimum frame | Round arrow above the + on the map; frames you at town size, may ask for location at any list size. No frame tighter than 4.5 km | Same, for build 27 (`PlacesMapView.minFrameKm`, `goHere`); off-location shows a notice pointing to Settings |
| The + menu | Fans out Instagram post / Google Maps (a place or a list → /import); Import left the buddy menu; Paste on both screens; a share-sheet tip on the first 3 pasted saves (Sarp, 2026-10-16) | Same (`AddMenu.swift`); a list link opens ImportView. The buddy menu keeps a "Google list" row only while an import runs, for its progress |
| Map pins | Loud and quiet, being explored (2026-10-16): photos of places picked one at a time sized by zoom, list imports small tinted dots (type icon at street level), names where they fit, a Tiers / Text switch | Post photo, else type icon on its tint (`PlacesMapView.fromPost`); gets the web's once Sarp picks |
| Town names in English | Google answers in English | A town or region in another script is geocoded again in English (`EnglishNames`) |
| List posts: several places on a carousel's slides or a numbered list in the caption, pick many | No: slides need text reading on the server (a caption list would not) | Yes (Vision on the phone); a slide name Apple Maps lacks is asked of Google; names off a street photo's signs start unticked |
| Nordic caption lifts its country (Swedish → Sweden first among suggestions; English lifts nothing) | No | Yes, Apple's on-device language detection (`PlaceSearch.languageCountry`) |
| Why a post couldn't be read (private/deleted vs. no answer) on the search screen, and "no photo" on the success card | No: one generic line | Yes |

## Different on purpose

| What | Web | iOS |
|---|---|---|
| Asset library | Backoffice `/library`, web-only artwork browser | No library UI |
| Whose list | Sarp's, behind the owner key ("Lock this browser") | Each phone's own |
| Where the list lives | Neon database | SwiftData on the phone |
| Finding places | Google Places (paid, counted) | Apple MapKit (free) |
| Photo when a post has none | Google photo | None; the post is re-read later (`PhotoRetry`) |
| Price ($–$$$$) | Google, on save | Asks `/api/price`, which asks Google |
| Usage sheet and `/usage` | Yes | No: the costs are Sarp's to watch |
| Save reports (`/api/saves`, backoffice `/saves`) | No: the web list is Sarp's own | Every save sheet reports how it ended (`SaveReport.swift`) |
| Use counts (`/api/uses`, on backoffice `/saves`) | No: the web list is Sarp's own | Opens, view picks, seconds per screen (`Uses.swift`) |
| What's new (menu → `/changelog`) | Opens in a new tab, no dot (the changelog is about iOS builds) | In-app Safari sheet; red dot on the menu button until a new build's What's new is opened |
| Help and Privacy (menu → `/support`, `/privacy`) | No (the web list is Sarp's alone; the marketing page links both) | Buddy menu, below What's new, in the same in-app Safari sheet (`WebPageView`); the App Store asks for both in the app (2026-10-16) |
| Help improve Vicolo (Settings switch) | No (the web sends no save reports or usage counts) | Settings sheet; off stops `SaveReport` and `Uses` in the app and the extension (2026-10-16) |
| Share from Instagram | Paste a link | Share sheet → Vicolo, or paste |
| Save by typing a name / @handle (first field) | Yes (Google) | Yes (MapKit) |
| Save from an Instagram profile link / @handle | Yes | Yes; Apple Maps lacks some venues Google has (BATA) |
| Google when the map misses | Google is the search | Apple first; Google when Apple finds nothing, or on "None of these" |

## The same on both

- Place card: floating, one size, "why it's here" line, the venue's website ("@handle" for an Instagram one). iOS takes the website from MapKit, web from Google; iOS has no "From Emilie's list" until it imports.
- Want to go / Been there: the place card's two-button switch, 😞 🙂 😃 after Been there, then folded into the face (tap to change or undo); buddy menu → Been there list, latest first. Date kept, not shown. Nothing on the map, no filter. Web stores it in Neon (`visited_at`, `rating`), iOS on the phone (`visitedAt`, `rating`).
- Map, Everywhere: every place framed; only places worlds apart (over 4,000 km) get one country, the one with most places. No country chips. iOS names countries in English from the ISO code (`CountryName` folds older local names like "日本").

- Views: Map, List, Cards, Tiles; the view pill with the round + apart from it (Liquid Glass on iOS 26+).
- Category icons: Sarp's 3D set (web `public/types`, iOS `Type*` assets).
- The post button opens the post; no embedded posts.
- Where/What pickers, grouping (`lib/grouping.ts` ↔ `Grouping.swift`), metros, same-place merging.
- Opens on the town you're in (nearest place within 50 km), with a blue dot where you are; location asked only from 2 places. iOS first shows `LocationPrimer` (why, one Continue button → the system question; App Review rejects a skip button); web asks the browser directly (the web list is Sarp's). No Near me row.
- Settings: Directions app, Appearance.
- Swipe-to-delete with a 5 s Undo.
