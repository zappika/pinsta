# Vicolo — Backlog

Two lists, kept by Sarp. plan.md is what's being worked on now; this is
everything else worth keeping. Move an item to plan.md when it starts.

## Small improvements
Things that make what exists better. Hours, not weeks.

- **iOS town names in the local script:** MapKit gives "渋谷区" for Shibuya; the card and Where menu show it. English from the ISO code works for countries; towns need a reverse geocode in English or a lookup.
- **Privacy page is out of date:** it says location is asked on first open, but since build 8 it's asked only once you have 3 places (`app/privacy/page.tsx`).
- **Splash stills are below phone resolution** (853 × 1844 vs 1206 × 2622): a full-size export would be sharper.
- **Per-install usage?** The usage numbers are totals per service. Telling friends' saves apart would need an anonymous install id sent with each save: a small privacy call.
- **Share tutorial on the web:** iOS-only for now (Sarp, 2026-10-06: not needed on web).
- **"Why it's here" wording:** a first draft in `lib/why-here.ts`; worth a pass with Sander.
- **Import photos arrive five at a time** (iOS): `PhotoRetry` takes 5 per run, so after a big list import the rest wait for the next open or return to the app. Keep running until none are due while an import is on.
- **Towns import as "Other"** (iOS list import): Begur, Portbou… come in with a town photo but no fitting type. Maybe a Town type, or leave them unticked by default.
- **Location question over the success card:** opening the app straight into a save (`-addURL`) can raise the location prompt on top of the card once the list reaches 3 places. Seen only with the test shortcut; check whether a real + save or share can hit it.
- **iOS town-tag fix not run on a real post:** the Burro post's link was cut off in the screenshot; Sarp's phone test of build 14 covers it.

## Big feature directions
Each one is weeks, and needs a design pass before code.

- **First experience** — the share tutorial (build 9) and the success card (build 13, 2026-10-09) are in. Still open: when the list starts to feel like *yours*.
- **Import from Google Maps lists** — built on web and iOS (build 14). Open design items are in plan.md "To design".
- **Hooks that bring people back** — nothing does today. Options: "you're near a saved place" (needs Always location), a Home Screen widget of nearby/random places (no new permission), "you have 6 places in Paris" on arrival (Always location again).
- **Social: "Nika saved a place in Tokyo"** — see what friends save, send a place to a friend. Accounts arrive here and only here.
- **Check-ins** — Want to go / Been there with faces is in (build 12). Still open: filters, and meeting Social ("Nika wants to go here").
- **iCloud sync** — the list survives a reinstall and appears on other devices. Deferred until the data model settles (plan.md, Open decisions).
- **Lists kept elsewhere** — notes or text lists of places, read and turned into cards.
- **Cheaper Instagram reads** — only once Apify cost becomes a problem (Sarp, 2026-10-06: keep Apify for now).
