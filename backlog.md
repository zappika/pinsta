# Vicolo — Backlog

Everything for later, in one place. plan.md is what's being worked on now; move an
item there when it starts. Beta feedback lives in `beta.md` until it becomes work.

## Small improvements
Things that make what exists better. Hours, not weeks.

- **Splash stills are below phone resolution** (853 × 1844 vs 1206 × 2622): a full-size export would be sharper.
- **Costs per phone?** Save reports and use counts carry an anonymous install id (Pulse shows each phone); the cost tracker (`usage`) is still totals per service.
- **Share tutorial on the web:** iOS-only for now (Sarp, 2026-10-06: not needed on web).
- **"Why it's here" wording:** a first draft in `lib/why-here.ts`; see First experience below.
- **Towns import as "Other"** (iOS list import): Begur, Portbou… come in with a town photo but no fitting type. Maybe a Town type, or leave them unticked by default.
- **Location question over the success card:** opening the app straight into a save (`-addURL`) could raise the location question on top of the card. Seen only with the test shortcut; the build 24 primer waits for the card to go, so check whether this is gone.
- **Neutral icon for plain restaurants** (still the gilda).
- **Been there list:** rows open the place; maybe fold the switch and faces into one control (Sarp: "maybe consolidate later").
- **In-app "new version ready" banner:** the server holds the latest build number and the banner opens TestFlight (from the 2026-10-14 beta round).

## Big feature directions
Each one is weeks and needs a design pass before code.

- **Home by type, cities when planning a trip** (Sarp, 2026-10-19, after that day's beta round). The home screen filters only by type (What); the cities a person has saved get their own way in, for trip-planning mood, with a nicer interaction than today's Where menu (not designed yet). Related: **trips** (a set of places for one trip, often across towns, like Google's "November trip") and **shared lists** (people send places to a friend; Berlin was a shared list).

- **First experience.** The share tutorial (build 9), the success card (build 13) and the location primer (build 24) are in. Still open: when the list starts to feel like *yours*. Two ideas, not decided (2026-10-14):
  - **"Try it with one of these."** Seen in Corner's onboarding. Copied as is it doesn't fit: Vicolo has no catalog, and ticking cards doesn't teach the Share to… step testers get stuck on. The version that fits: 3 real Instagram posts from the user's city (hand-picked JSON, a few per tester city: Stockholm, Göteborg, Barcelona, Copenhagen). A tap runs the real save sheet, as `-addURL` does, and ends on the real success card. Every place still has its post, the map isn't empty, and the saves reach the location question. Comes before the Share tutorial, maybe instead of "Go to Instagram" opening Ästad Vingård.
  - **Human "why it's here" lines.** Corner's come from other users' data; ours can come from what's already stored, by heuristics, with no LLM and no new paid calls. One line per place, the strongest signal, falling back to today's source line (`lib/why-here.ts`):
    - from the post: *Just opened* (opening words in a recent caption), *You've saved this 3 times* (`posts`), *@account posted it*
    - from you: *Saved in June, still haven't been*, *Same account as Bar Gros, which you loved 😃*, *Like the 4 wine bars you rated 😃*
    - from where you are: *Around the corner from Focacha* (a place you know, not metres)
    - from friends: "From Emilie's list" exists; "your friend saved this" waits for Social.
    Prototype on the web card first.
- **Hooks that bring people back.** Nothing does today. Options: "you're near a saved place" (needs Always location), a Home Screen widget of nearby or random places (no new permission), "you have 6 places in Paris" on arrival (Always location again).
- **Sending, after the web prototype (2026-10-26, decisions.md).** Next: the friend's "Save these to Vicolo" opening the app on the review (as a list import); iOS: Send to a friend in the + menu and on a Where selection; pasting a list to *save* (a friend's WhatsApp, a ChatGPT answer) in the + menu, the same name reader (`namesIn` in `lib/sends.ts`); **guides**, the living kind ("Keep as a guide"); a preview of her page before the share sheet; drag to reorder instead of ▲▼; Apple Maps for the walk (no multi-stop link known); try the sent page's white hairline pins on the main map too (Sarp liked them more, 2026-10-26).
- **Social.** Send a place to a friend (name, Maps link, the post). Later, see what friends save ("Nika saved a place in Tokyo"). **Accounts arrive here and only here** (Sarp, 2026-09-29): the app works fully without one, and creating one is the step into "I want to be social now". Open for CTO when Social starts: how a local-first list joins an account later.
- **Check-ins.** Want to go / Been there with faces is in (build 12). Still open: filters, checking in at a place, and meeting Social ("Nika wants to go here").
- **iCloud sync.** The list survives a reinstall and appears on other devices. Local-first stays; no app accounts. Deferred (plan.md → Open decisions).
- **Lists kept elsewhere.** Notes or text lists of places, read and turned into cards.
- **Reading posts better.** Untagged posts: captions are read by patterns today ("at X in Y", 📍, addresses, numbered lists). Reading captions with Claude would catch more, but it's paid; only if tags turn out to be missing often (decided: low-tech first).
- **Cheaper Instagram reads.** Only once Apify cost becomes a problem (Sarp, 2026-10-06: keep Apify for now).
