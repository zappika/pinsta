# Vicolo — Backlog

Two lists, kept by Sarp. plan.md is what's being worked on now; this is
everything else worth keeping. Move an item to plan.md when it starts.

## Small improvements
Things that make what exists better. Hours, not weeks.

- **Place card on iOS** (2026-10-06): the web drawer became a floating card with a "why it's here" line; port both once Sarp has lived with them (parity.md).
- **Privacy page is out of date:** it says location is asked on first open, but since build 8 it's asked only once you have 3 places (`app/privacy/page.tsx`).
- **Splash stills are below phone resolution** (853 × 1844 vs 1206 × 2622): a full-size export would be sharper.
- **Per-install usage?** The usage numbers are totals per service. Telling friends' saves apart would need an anonymous install id sent with each save: a small privacy call.
- **Share tutorial on the web:** iOS-only for now (Sarp, 2026-10-06: not needed on web).
- **"Why it's here" wording:** a first draft in `lib/why-here.ts`; worth a pass with Sander.

## Big feature directions
Each one is weeks, and needs a design pass before code.

- **First experience** — before the beta (Sarp, 2026-10-06). The share tutorial is in (build 9). Still open: the first save as a moment rather than a receipt, and when the list starts to feel like *yours*. Design with Sander.
- **Import from Google Maps lists** — choose what comes in, check and fix each category, skip duplicates. MVP on the web first.
- **Hooks that bring people back** — nothing does today. Options: "you're near a saved place" (needs Always location), a Home Screen widget of nearby/random places (no new permission), "you have 6 places in Paris" on arrival (Always location again).
- **Social: "Nika saved a place in Tokyo"** — see what friends save, send a place to a friend. Accounts arrive here and only here.
- **Check-ins** — "Been there" / "Want to go" per place, with filters; meets Social ("Nika wants to go here").
- **iCloud sync** — the list survives a reinstall and appears on other devices. Deferred until the data model settles (plan.md, Open decisions).
- **Lists kept elsewhere** — notes or text lists of places, read and turned into cards.
- **Cheaper Instagram reads** — only once Apify cost becomes a problem (Sarp, 2026-10-06: keep Apify for now).
