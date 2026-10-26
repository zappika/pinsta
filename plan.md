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
1. **The 2026-10-14 feedback round:** answered by builds 21–25 (25 checked on the phone 2026-10-15); what's still open is in `beta.md`.
2. **Design pass, list pickers:** see "To design".
3. **Pulse** (2026-10-18): backoffice → Pulse says whether people can save, come back and find things; Saves lists the misses (Copy links → work through them in a session) instead of waiting for messages.

4. **"Been there?" later + "Around you"** (2026-10-26, decisions.md): web first to see the design, iOS written alongside, built and tried on the Xcode Mac.

## Waiting on Sarp
- **APNs key for the "list is ready" push:** developer.apple.com → Keys → + → tick Apple Push Notifications service → download the .p8 (once only) and note its Key ID. In Vercel (pinsta, Production): `APNS_KEY` = the .p8 file's contents (sensitive), `APNS_KEY_ID` = the Key ID, then redeploy. Until then imports work, just without the notification.
- Pulse: add backoffice.vicolo.space to the Home Screen (asks the owner key once), then mark your own phones and the simulator as Mine (BFA7CCD6, 19 saves, looks like yours) and name the testers.
- Before the App Store: everything is in `docs/app-store.md` (researched 2026-10-16). Start with the DSA trader declaration (weeks to verify). App Privacy needs more than Product Interaction (§4 there).
- Before every upload, check `parity.md` for web-only rows (the locate button missed 26 that way).
- Nudge testers to update and turn on Automatic Updates; ask the iPhone 13 (iOS 26) tester to try the latest build.
- The tester's tutorial photo (file + permission).
- Testers list → light CRM in backoffice: Pulse names phones now (2026-10-18); more than that later, not started.
- Rate limiting and usage review: much later (Sarp, 2026-10-08). Don't bring up.

## To design (Sarp)
- **Google list import on the server**: built 2026-10-19 (server live, iOS waits for the Xcode build and the APNs key above).
- **Tutorial says what Vicolo is** (Sarp's list, 2026-10-16): next after the easy ones.
- **Map pins, loud and quiet** (web, 2026-10-16): try Tiers vs Text on the phone, pick one, then iOS. Remove the switch once picked.
- **The "This post has N places" picker and the Google list import review, in one pass** (Sarp, 2026-10-15): the slide/caption list picker should look like the list import review.
- List import success state (many places at once, not the one-place card).
- What to offer for list places that couldn't be found (web has the same gap).
- **A moving tutorial:** a short screen recording of the real path (Instagram paper plane → Share to… → Vicolo → saved) in place of the static pictures. Sarp doesn't hate it (2026-10-14). Static pages stay until then. It also carries the share-sheet setup (More → Edit → green + by Vicolo): the success card only says it can be done (Sarp, 2026-10-16; a step-by-step card there was built and dropped).
- "Wrong place?" after an automatic save, as part of reworking the steps before the success card.
- Two ideas from Corner's onboarding: "Try it with one of these" seed posts, and human "why it's here" lines (`backlog.md` → First experience).

## Open decisions
- **iCloud backup: deferred until the beta settles (CTO call, 2026-10-02).** SwiftData + CloudKit means dropping `@Attribute(.unique)` on `Place.id`, a CloudKit container, and deploying the schema to production in the CloudKit dashboard, or TestFlight builds silently don't sync. None of it can be checked on the simulator without an iCloud sign-in. Revisit when a friend loses a list.
- **Apify: keep, cache, or replace.** Decide from the Usage sheet once the beta has run a while.

## Last session — 2026-10-18/19: Pulse, docs
- **Backoffice Pulse** (`/pulse`, now the backoffice home): four questions answered in phones, not percentages: saves that worked (found alone / after digging / gave up), which kinds of post miss, phones that saved on 2+ days and who went quiet, phones that came back to find a place. One row per phone; tap to name it or mark it Mine (left out of the numbers). Saves keeps the misses with a Copy links button; Pulse, Saves and Usage share a tab bar; the backoffice installs on the Home Screen (dark app icon, opens on Pulse).
- **iOS, for build 31:** counts a place opened, Directions, the post button and Been there (no place names), the data "come back to find something" needs. Built for the simulator, not run.
- **Docs:** parity.md caught up (it still said build 24), history has 10-15 to 10-17, stale backlog and beta lines cleared.
