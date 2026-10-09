# Vicolo — web ↔ iOS

What each app has, side by side. Kept current with every change that adds or
closes a difference (CLAUDE.md). Last updated 2026-10-06 (build 12).

## To close

| What | Web | iOS |
|---|---|---|
| Google Maps list import | `/import`: grouped review, Move / Move all, keeps the list's name and owner; Google matches on the server | Same screen (buddy menu → Import from Google): the list read by `/api/list`, matched with MapKit on the phone (a second, looser pass for towns and big sites), Import any time, carries on in the background, 250 at most; photos by name + pin from `/api/photo`. Keeps the list's name and owner, not shown yet |
| Share tutorial (three pages) | No (Sarp: not needed on web) | Empty list, and menu → How to save |

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
| Share from Instagram | Paste a link | Share sheet → Vicolo, or paste |

## The same on both

- Place card: floating, one size, "why it's here" line, the venue's website ("@handle" for an Instagram one). iOS takes the website from MapKit, web from Google; iOS has no "From Emilie's list" until it imports.
- Want to go / Been there: the place card's two-button switch, 😞 🙂 😃 after Been there, then folded into the face (tap to change or undo); buddy menu → Been there list, latest first. Date kept, not shown. Nothing on the map, no filter. Web stores it in Neon (`visited_at`, `rating`), iOS on the phone (`visitedAt`, `rating`).
- Map, Everywhere: one country framed (most places; nearest with a location), no country chips. iOS names countries in English from the ISO code (`CountryName` folds older local names like "日本").

- Views: Map, List, Cards, Tiles; the view pill with the round + apart from it (Liquid Glass on iOS 26+).
- Category icons: Sarp's 3D set (web `public/types`, iOS `Type*` assets).
- The post button opens the post; no embedded posts.
- Where/What pickers, grouping (`lib/grouping.ts` ↔ `Grouping.swift`), metros, same-place merging.
- Near me (50 km), location asked on open only from 3 places.
- Settings: Directions app, Appearance.
- Swipe-to-delete with a 5 s Undo.
