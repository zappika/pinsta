# The weekly search review

A scheduled task on Sarp's Mac runs this every Monday morning (set up 2026-11-01). It checks the
save search against everything the phones have reported, works out why what fails fails, tries
one fix on a local branch, and reports on the backoffice (`/review`). Sarp decides what to take.

Read `CLAUDE.md` first (the "Tag → place" rules, "Low-tech first", the conventions).

## Rules
- **Never push, never touch `main`** or the checkout at `~/Projects/pinsta` (Sarp or another session
  may be working in it). All work happens in a worktree of `origin/main`.
- **Never poll production.** Everything here reads and writes the database directly.
- Fixes follow the repo's conventions: the same rule on the web (`lib/google-places.ts`) and iOS
  (`ios/Pinsta/Services/PlaceSearch.swift`), same comments both sides, heuristics, no paid API, no LLM.
  A fix names the real case that asked for it in its comment, like the existing ones.
- Tester names never go anywhere: the cases are links, not people.
- Design calls (what a sheet says or shows) are Sarp's: propose search logic only.

## Steps
1. Set up the worktree (D is today, `YYYY-MM-DD`):
   ```bash
   git -C ~/Projects/pinsta fetch origin
   git -C ~/Projects/pinsta worktree add ~/Projects/pinsta-review/D -b review/D origin/main
   cd ~/Projects/pinsta-review/D
   ln -s ~/Projects/pinsta/node_modules node_modules && ln -s ~/Projects/pinsta/.env.local .env.local
   ```
   Remove review worktrees older than four weeks whose branch was never merged
   (`git worktree remove`, `git branch -D`), and say so in the summary.
2. `npm run review:sync` — new save reports become cases; new links are read once (Apify, cents).
3. `npm run --silent review:replay > before.json` — every case through the iOS search on MapKit
   (about 12 s a case, in the background; it is free).
4. Read the failing cases (`pass: false` with an `expect`). For each, look at the case's post
   (`select post from review_cases where url = …`) and the code path it took, as in
   the first review (commit 568913d: own place, town/street tags, caption phrases, media mentions). Group them into causes, ranked by how many cases they hit.
   Gave-ups without an answer (`expect` null) aren't scored; list them only if one looks fixable.
5. Take the biggest cause that a heuristic can fix. Change both sides, then:
   `npx tsc --noEmit` and `npm run --silent review:replay -- --ios ios/Pinsta > after.json`.
   Keep the change only if `after` passes more cases and **no case that passed before fails**
   (if one does, adjust or drop it). Commit on the `review/D` branch with a message that says why.
   No change worth making? Say so; that's a fine week.
6. Write `report.json`:
   ```json
   { "passed": 0, "total": 0, "summary": "…", "results": [/* before.json's results */],
     "causes": [{ "title": "…", "count": 0, "examples": ["url"], "code": "file: function", "fix": "…" }],
     "proposal": { "branch": "review/D", "title": "…", "why": "…", "files": ["…"], "passedAfter": 0, "broke": [] } }
   ```
   `passed`/`total` are the *before* numbers; `proposal` is null when nothing was tried.
   Plain words, as for Sarp: what fails, why, what the change does. Then `npm run review:post -- report.json`.
7. Leave the worktree and branch in place for Sarp. Nothing else.
