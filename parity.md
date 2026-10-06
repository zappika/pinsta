# Vicolo — web ↔ iOS

What each app has, side by side. Kept current with every change that adds or
closes a difference (CLAUDE.md). Last updated 2026-10-06.

## To close

| What | Web | iOS |
|---|---|---|
| Google Maps list import | `/import`: grouped review, Move / Move all, keeps the list's name and owner | Menu item says "Soon". Open question: photos (MapKit has none) |
| Place card | Floating card, one size, fades in and out, swipe down on the photo closes | Pull-up sheet, short → full → away |
| "Why it's here" line | On the card: "Saved from @burro_cafe on Instagram · 14 Sep", "From Emilie's "Paris" list · 6 Oct" | None |
| Map, Everywhere | Frames one country (most places; nearest with a location), country chips for the rest | Frames every pin |
| Share tutorial (three pages) | No (Sarp: not needed on web) | Empty list, and menu → How to save |

## Different on purpose

| What | Web | iOS |
|---|---|---|
| Whose list | Sarp's, behind the owner key ("Lock this browser") | Each phone's own |
| Where the list lives | Neon database | SwiftData on the phone |
| Finding places | Google Places (paid, counted) | Apple MapKit (free) |
| Photo when a post has none | Google photo | None; the post is re-read later (`PhotoRetry`) |
| Price ($–$$$$) | Google, on save | Asks `/api/price`, which asks Google |
| Usage sheet and `/usage` | Yes | No: the costs are Sarp's to watch |
| Share from Instagram | Paste a link | Share sheet → Vicolo, or paste |

## The same on both

- Views: Map, List, Cards, Tiles; the view pill with the round + apart from it (Liquid Glass on iOS 26+).
- Category icons: Sarp's 3D set (web `public/types`, iOS `Type*` assets).
- The post button opens the post; no embedded posts.
- Where/What pickers, grouping (`lib/grouping.ts` ↔ `Grouping.swift`), metros, same-place merging.
- Near me (50 km), location asked on open only from 3 places.
- Settings: Directions app, Appearance.
- Swipe-to-delete with a 5 s Undo.
