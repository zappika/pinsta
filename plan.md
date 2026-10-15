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

## Waiting on Sarp
- Nudge testers to update and turn on Automatic Updates; ask the iPhone 13 (iOS 26) tester to try the latest build.
- The tester's tutorial photo (file + permission).
- Testers list → light CRM in backoffice: later, not started.
- Rate limiting and usage review: much later (Sarp, 2026-10-08). Don't bring up.

## To design (Sarp)
- **The "This post has N places" picker and the Google list import review, in one pass** (Sarp, 2026-10-15): the slide/caption list picker should look like the list import review.
- List import success state (many places at once, not the one-place card).
- What to offer for list places that couldn't be found (web has the same gap).
- **A moving tutorial:** a short screen recording of the real path (Instagram paper plane → Share to… → Vicolo → saved) in place of the static pictures. Sarp doesn't hate it (2026-10-14). Static pages stay until then.
- "From Emilie's list" on the iOS place card.
- "Wrong place?" after an automatic save, as part of reworking the steps before the success card.
- Two ideas from Corner's onboarding: "Try it with one of these" seed posts, and human "why it's here" lines (`backlog.md` → First experience).

## Open decisions
- **iCloud backup: deferred until the beta settles (CTO call, 2026-10-02).** SwiftData + CloudKit means dropping `@Attribute(.unique)` on `Place.id`, a CloudKit container, and deploying the schema to production in the CloudKit dashboard, or TestFlight builds silently don't sync. None of it can be checked on the simulator without an iCloud sign-in. Revisit when a friend loses a list.
- **Apify: keep, cache, or replace.** Decide from the Usage sheet once the beta has run a while.

## Last session — 2026-10-15: docs and workflow
- plan.md cut to one screen. Build log → `builds.md` (current vs next, `ios-N` tags on every build), beta feedback → `beta.md`, expansions and roadmap → `backlog.md`, dated decisions → `docs/decisions.md`, sessions and phases → `docs/history.md`.
- Earlier the same day (other machine): builds 24 and 25 (location primer, caption lists, What sub-rows, Culture, What's new) and the `/changelog` and `/parity` pages. See `builds.md`.
- Stale remote branches deleted.
- When a session ends, its notes replace this block and the previous block moves to the top of `docs/history.md` → Session log.
