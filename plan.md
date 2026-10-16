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
3. **Save reports** (2026-10-16): from build 28, backoffice → Saves shows how every tester save ended, misses first. Work the misses from there instead of waiting for messages.

## Waiting on Sarp
- Before the App Store (not needed for TestFlight): App Store Connect → App Privacy → Product Interaction, not linked to the user, Analytics.
- Before every upload, check `parity.md` for web-only rows (the locate button missed 26 that way).
- Nudge testers to update and turn on Automatic Updates; ask the iPhone 13 (iOS 26) tester to try the latest build.
- The tester's tutorial photo (file + permission).
- Testers list → light CRM in backoffice: later, not started.
- Rate limiting and usage review: much later (Sarp, 2026-10-08). Don't bring up.

## To design (Sarp)
- **Google list import, "we're on it, come back to review"** (Sarp, 2026-10-16): the import runs on its own, a piece of UI says it's working, and the review waits until it's ready. Also fixes a list shared from Google Maps' share sheet (today the extension drops it: the save sheet goes blank) and long lists. First in our own UI, later the first notification. Matching runs on the server (Sarp, 2026-10-16): Google, ~3¢ a new entry after 5,000 free a month, finishes with the phone in a pocket, allows push later.
- **Tutorial says what Vicolo is** (Sarp's list, 2026-10-16): next after the easy ones.
- **Map pins, loud and quiet** (web, 2026-10-16): try Tiers vs Text on the phone, pick one, then iOS. Remove the switch once picked.
- **The "This post has N places" picker and the Google list import review, in one pass** (Sarp, 2026-10-15): the slide/caption list picker should look like the list import review.
- List import success state (many places at once, not the one-place card).
- What to offer for list places that couldn't be found (web has the same gap).
- **A moving tutorial:** a short screen recording of the real path (Instagram paper plane → Share to… → Vicolo → saved) in place of the static pictures. Sarp doesn't hate it (2026-10-14). Static pages stay until then. It also carries the share-sheet setup (More → Edit → green + by Vicolo): the success card only says it can be done (Sarp, 2026-10-16; a step-by-step card there was built and dropped).
- "From Emilie's list" on the iOS place card.
- "Wrong place?" after an automatic save, as part of reworking the steps before the success card.
- Two ideas from Corner's onboarding: "Try it with one of these" seed posts, and human "why it's here" lines (`backlog.md` → First experience).

## Open decisions
- **iCloud backup: deferred until the beta settles (CTO call, 2026-10-02).** SwiftData + CloudKit means dropping `@Attribute(.unique)` on `Place.id`, a CloudKit container, and deploying the schema to production in the CloudKit dashboard, or TestFlight builds silently don't sync. None of it can be checked on the simulator without an iCloud sign-in. Revisit when a friend loses a list.
- **Apify: keep, cache, or replace.** Decide from the Usage sheet once the beta has run a while.

## Last session — 2026-10-15 (work Mac): map fixes from the beta, workflow
- **Map, Everywhere** frames every place, unless they're over 4,000 km apart (then the country with most places). A tester in Copenhagen was opened on Norway, one bakery. Web + iOS.
- **List posts (iOS):** slide names Apple Maps misses (Tranen) are asked of Google, at most 6 a post.
- **Web map:** a locate button above the + and no frame tighter than 4.5 km. Checked in the preview with stub data; waits for Sarp on the phone before iOS.
- **Not done here:** this Mac has no Xcode (iOS type-checked with swiftc only) and the owner key isn't on it (sensitive in Vercel). Build 26 and the iOS port happen on the other Mac.
- Earlier the same session: docs restructured (`builds.md`, `beta.md`, `docs/`), `ios-1`…`ios-25` tags, stale branches deleted, build 25 checked on the phone.
