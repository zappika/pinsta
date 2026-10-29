# Vicolo — web ↔ iOS

What each app has, side by side. Kept current with every change that adds or
closes a difference (CLAUDE.md). Last updated 2026-10-26 (build 31 in TestFlight). Also at backoffice.vicolo.space/parity.

## To close

| What | Web | iOS |
|---|---|---|
| Google Maps list import | `/import`: paste, then one screen about the list (a map of its places, types with counts that open their places, couldn't find, Import all / N of M; everything Want to go),  imports as Want to go unless "I've been to these" is on (both apps, 2026-10-19), keeps the list's name and owner; Google matches on the server | Same review (+ menu → Google Maps): from build 31 matched on the server like the web (`/api/import/jobs`, Google at the pin, 500 at most), runs with the app closed, a pill with the count on the map, an Import row in the buddy menu, a push when ready (permission asked at the first import); the review shows once all is found, Couldn't find has Search (the save sheet with the name). Lists shared from Google Maps' Share button import too. Photos by name + pin from `/api/photo`. Keeps the list's name and owner, shown on the place card · Web `/import` stays one request, no Search on its misses yet |
| Share tutorial (four pages: Share → Share to… → Vicolo → saved) | No (Sarp: not needed on web) | Empty list, and menu → How to save; back-from-Instagram note and copied-link offer on the empty list |
| What menu sub-rows (2+ places sharing a type, e.g. Wine bar under Bars; `lib/subtypes.ts` ↔ `Subtypes.swift`) | Google `primaryType` | Apple's category (brewery, movie_theater…), or Google's type when the fallback found it; no cuisines (Apple has none, Sarp: no rows from our food words). Only saves from now on carry a type |
| Map pins | Loud and quiet, being explored (2026-10-16): photos of places picked one at a time sized by zoom, list imports small tinted dots (type icon at street level), by zoom a mosaic with "N places", then named dots, then photos with names, close places stacked as "Name +N more" (Mix, picked 2026-10-29); zoomed out past 7, one bubble per city (its Where label, photos, count), tap flies there (2026-10-19) | Mix ported for the next build (2026-10-29, not compiled yet); city bubbles from build 31 · Same rule once build 33 is out |
| "Been to any of these?" on open (`lib/ask-visit.ts` ↔ `AskVisit.swift`): places saved where you stood the next day, the rest a week on, Yes folds open into the faces, twice at most | Yes (2026-10-26; `?ask=demo` shows it without writing) | Written 2026-10-26, not built yet (needs the Xcode Mac) |
| "Where I am" in the + menu: the places around you, closest first; typed names rank nearby | Google Nearby Search (paid, counted as Nearby Search Pro) | Apple Maps points of interest (free); written 2026-10-26, not built yet |
| Send to a friend: a walk (in order, numbered, dotted line, Walk it in Google Maps) or a list of places, as a public link `/w/<id>` (white hairline pins, names under them); + menu → Send to a friend (paste a list or type), or the send button on a Where selection; Sent in the buddy menu | Prototype (2026-10-26) | No · design first on the web; the friend's "Save these to Vicolo" waits for the app to open a send |
| Accessibility: larger text, Reduce Motion, VoiceOver | Not checked | Build 30: Where/What titles stack at large sizes, motion becomes fades, VoiceOver card actions |

## Different on purpose

| What | Web | iOS |
|---|---|---|
| List posts: several places on a carousel's slides or a numbered list in the caption, pick many | No: slides need text reading on the server (a caption list would not) | Yes (Vision on the phone); a slide name Apple Maps lacks is asked of Google; names off a street photo's signs start unticked · iOS-only for now (Sarp, 2026-10-17) |
| Why a post couldn't be read (private/deleted vs. no answer) on the search screen, and "no photo" on the success card | One generic line | Yes · iOS-only for now (Sarp, 2026-10-17) |
| Asset library | Backoffice `/library`, web-only artwork browser | No library UI |
| Wide screens (iPad, Mac) | 768 px and up: the map fills the window, the list floats on it in a panel at the left (List / Cards / Tiles), sheets and the place card open on the panel; a Phone / Wide switch top right (Phone by default with a mouse, Wide on the iPad); Flighty-style, for Sarp's iPad mini and Mac (2026-10-27) | iPhone only (`TARGETED_DEVICE_FAMILY` 1) |
| Whose list | Sarp's, behind the owner key ("Lock this browser") | Each phone's own |
| Where the list lives | Neon database | SwiftData on the phone |
| Finding places | Google Places (paid, counted) | Apple MapKit (free) |
| Photo when a post has none | Google photo | None; the post is re-read later (`PhotoRetry`) |
| Price ($–$$$$) | Google, on save | Asks `/api/price`, which asks Google |
| Usage sheet and `/usage` | Yes | No: the costs are Sarp's to watch |
| Save reports (`/api/saves`, backoffice `/saves`) | No: the web list is Sarp's own | Every save sheet reports how it ended (`SaveReport.swift`) |
| Use counts (`/api/uses`, on backoffice `/pulse`) | No: the web list is Sarp's own | Opens, view picks, seconds per screen (`Uses.swift`); from build 31 also a place opened, Directions, the post button, Been there |
| What's new (menu → `/changelog`) | Opens in a new tab, no dot (the changelog is about iOS builds) | In-app Safari sheet; red dot on the menu button until a new build's What's new is opened |
| Help and Privacy (menu → `/support`, `/privacy`) | No (the web list is Sarp's alone; the marketing page links both) | Buddy menu, below What's new, in the same in-app Safari sheet (`WebPageView`); the App Store asks for both in the app (2026-10-16) |
| Help improve Vicolo (Settings switch) | No (the web sends no save reports or usage counts) | Settings sheet; off stops `SaveReport` and `Uses` in the app and the extension (2026-10-16) |
| Share from Instagram | Paste a link | Share sheet → Vicolo, or paste |
| Save by typing a name / @handle (first field) | Yes (Google) | Yes (MapKit) |
| Save from an Instagram profile link / @handle | Yes | Yes; Apple Maps lacks some venues Google has (BATA) |
| Google when the map misses | Google is the search | Apple first; Google when Apple finds nothing, or on "None of these" |

## The same on both

- Place card: floating, one size, "why it's here" line, the venue's website ("@handle" for an Instagram one). iOS takes the website from MapKit, web from Google; Imported places say whose list they came from on both ("From Emilie’s “Paris” list"; iOS from build 31).
- Want to go / Been there: the place card's segmented switch, 😞 🙂 😃 after Been there, then folded into the face (tap to change or undo); buddy menu → Been there list, latest first. Date kept, not shown. Nothing on the map, no filter. Web stores it in Neon (`visited_at`, `rating`), iOS on the phone (`visitedAt`, `rating`).
- Map, Everywhere: every place framed; only places worlds apart (over 4,000 km) get one country, the one with most places. No country chips. iOS names countries in English from the ISO code (`CountryName` folds older local names like "日本").

- The + menu: fans out Instagram post / Google Maps (a place, or a list → import); Paste on both screens; a share-sheet tip on the first 3 pasted saves. iOS keeps an "Import" row in the buddy menu while an import runs or waits for its review (build 31; "Google list" since 26).
- Locate button above the + on the map (hidden while a place card, the save sheet or a notice is open), and no frame tighter than 4.5 km (iOS build 27).
- Town and region names in English (web: Google; iOS: asked again in English, `EnglishNames`, build 26).
- Place finding: the same rules on both (`lib/google-places.ts` ↔ `PlaceSearch.swift`), incl. handle cities and the Nordic caption lift (`lib/language.ts` ↔ `PlaceSearch.languageCountries`, 2026-10-17). Age-restricted posts are read from their preview by the server, for both.
- Views: Map, List, Cards, Tiles; the view pill with the round + apart from it (Liquid Glass on iOS 26+).
- Category icons: Sarp's 3D set (web `public/types`, iOS `Type*` assets).
- The post button opens the post; no embedded posts.
- Where/What pickers, both in the header (a web experiment with only What there was dropped, 2026-10-29), grouping (`lib/grouping.ts` ↔ `Grouping.swift`), metros, same-place merging.
- Opens on the town you're in (nearest place within 50 km), with a blue dot where you are; location asked only from 2 places. iOS first shows `LocationPrimer` (why, one Continue button → the system question; App Review rejects a skip button); web asks the browser directly (the web list is Sarp's). No Near me row.
- Settings: Directions app, Appearance.
- Swipe-to-delete with a 5 s Undo.
