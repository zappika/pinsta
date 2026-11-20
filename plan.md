# Vicolo — Plan

_Formerly Pinsta. Renamed 2026-09-29; the repo, folder, Vercel project and code names still say pinsta._

One screen: what's happening now. Elsewhere:
- `builds.md`: what's in TestFlight and what waits for the next build
- `beta.md`: testers and their feedback
- `backlog.md`: everything for later
- `parity.md`: web ↔ iOS
- `docs/decisions.md`: dated decisions
- `docs/history.md`: past sessions and the founding plan

## Now
The friends beta is running (since 2026-10-14). Feedback from it comes first; see `beta.md`.
1. **I'm here** (build 35, 2026-11-20): check-ins, You made it, the Been there timeline, the Control Center control. Try it on the phone at a real place; not checked anywhere yet: adding a photo, the control, a check-in that saves a new place.
2. **Server-side search** (step one 2026-11-20): so search fixes reach phones on deploy, not with a build. Next: move the Swift-only rules (small-town tag, the handle's name alone, Google when Apple finds nothing) into the shared code until the server replay matches the phone's (44 vs 46 of 51), then let iOS ask the server.
3. **Save misses, weekly:** the Monday review (`scripts/review/REVIEWER.md`, backoffice `/review`) replays every save and proposes one fix; Pulse and Saves show who saves, comes back, and gives up.
4. **Send to a friend** (2026-10-26, web prototype, decisions.md): live, the Kreuzberg walk is www.vicolo.space/w/umwi4e3c4r. Ask once how the friend used it, then decide what the iOS version keeps.
5. **Design pass, list pickers:** see "To design".

## Waiting on Sarp
- **App Store, if and when Sarp wants it (undecided, 2026-11-20):** everything is in `docs/app-store.md` (researched 2026-10-16). Start with the DSA trader declaration (weeks to verify). App Privacy needs more than Product Interaction (§4 there).

## To design (Sarp)
- **Tutorial says what Vicolo is** (Sarp's list, 2026-10-16): next after the easy ones.
- **The "This post has N places" picker and the Google list import review, in one pass** (Sarp, 2026-10-15): the slide/caption list picker should look like the list import review.
- List import success state (many places at once, not the one-place card).
- What to offer for list places that couldn't be found (web has the same gap).
- **A moving tutorial:** a short screen recording of the real path (Instagram paper plane → Share to… → Vicolo → saved) in place of the static pictures. Sarp doesn't hate it (2026-10-14). Static pages stay until then. It also carries the share-sheet setup (More → Edit → green + by Vicolo): the success card only says it can be done (Sarp, 2026-10-16; a step-by-step card there was built and dropped).
- "Wrong place?" after an automatic save, as part of reworking the steps before the success card.
- Two ideas from Corner's onboarding: "Try it with one of these" seed posts, and human "why it's here" lines (`backlog.md` → First experience).

## Open decisions
- **iCloud backup: deferred until the beta settles (CTO call, 2026-10-02).** SwiftData + CloudKit means dropping `@Attribute(.unique)` on `Place.id`, a CloudKit container, and deploying the schema to production in the CloudKit dashboard, or TestFlight builds silently don't sync. None of it can be checked on the simulator without an iCloud sign-in. Revisit when a friend loses a list.
- **Apify: keep, cache, or replace.** Decide from the Usage sheet once the beta has run a while.

## Last session — 2026-11-20: I'm here, server search step one, build 35
- **Why:** after Italy, Sarp remembered places through Swarm check-ins, not Vicolo: being *at* a place had nothing in the app. And search fixes only reach phones with a new TestFlight build (Sarp, 2026-11-17: they should arrive on deploy).
- **I'm here (iOS, build 35):** a pill on the map lists the places within 150 m, one tap checks in, then an optional face, photo and note. **You made it:** opening the app at a Want to go place shows its post and caption. A place keeps every visit ("Been 3 times"); Been there in the menu is a timeline of check-ins by day and town, swipe deletes one. Also a Control Center / Lock Screen / Action button control and a Siri phrase. Not checked: adding a photo, the control, a check-in that saves a new place.
- **Server-side search, step one:** `lib/resolve-post.ts`, an Apple Maps Server client (`lib/apple-maps.ts`, keys local only), `npm run review:replay-server`. On 51 cases the phone finds 46 first, the server on Apple 44. Next: move the Swift-only rules (small-town tag, the handle's name alone, Google when Apple finds nothing) into the shared code, then let iOS ask the server.
- **Save misses of 2026-11-17:** Lo Gat (articles), Stamba Hotel (far-namesake anchor), @handles on the 📍 line. Replay 47/51.
- **Housekeeping:** weekly review's approvals fixed (`REVIEWER.md`), the My Tokyo test send deleted, "Waiting on Sarp" trimmed to App Store prep (undecided).
- **Open:** builds 33–35 not confirmed on Sarp's phone yet.
