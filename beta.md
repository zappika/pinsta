# Vicolo — Friends beta

**Started 2026-10-14.** TestFlight external group, approved by Beta App Review
(submitted 2026-10-09 with build 12). Testers installed build 21 the morning of
10-14. Sarp invites people personally; **nothing automatic, no emails or invites
from code.** Tester names stay out of this public repo; refer to them by first name
or device ("the iPhone 13 tester").

What's new for testers: `changelog.md` → vicolo.space/changelog (menu → What's new).

## Tell testers
- The list lives only on the phone. Deleting the app deletes it; TestFlight updates keep it.
- Every save runs on Sarp's Apify account (free plan: 5 reads at a time). Busy shows "try again in a minute".
- TestFlight only updates by itself with Automatic Updates on: "TestFlight → Vicolo → Update, and turn on Automatic Updates".

## Open from feedback
Newest round first. When something is fixed, strike it through with the build it shipped in, then drop it next round.

### 2026-10-14 round (Mert + testers)
Builds 21–25 (2026-10-14 → 10-15) are the answer to this round: place finding, profile saves, list posts, the Share to… tutorial, stuck help, the location primer, What's new. Build 25 checked on Sarp's phone 2026-10-15. Still open:
- **Testers on old builds:** all five were on 21. Nudge them to update and turn on Automatic Updates. Idea, not built: an in-app "new version ready" banner (server holds the latest build number, opens TestFlight).
- ~~iOS 26 untested~~ Testers on 26 seem fine; left (Sarp, 2026-10-15).
- ~~Dark mode of the new screens~~ Checked by Sarp, 2026-10-15.
- ~~**"The app shows a random place when I open it"**~~ (tester in Copenhagen with places in Lisbon, Paris and Oslo; she asked for the whole map, like a Google Maps saved map). The map framed the country *nearest* to her: Norway, one bakery in Oslo. Fixed for build 26: Everywhere frames every place unless they're worlds apart.
- **Tutorial photo:** a tester offered a real one for page 1. Waiting for the file (original, with permission); it's a swap of `OnboardingRestaurant/restaurant.jpg`.
- **For testers to verify (Sarp):** Apple Maps results on their own posts, the least-tested area.
- ~~A slide name Apple Maps doesn't have is dropped (Tranen)~~ Google fallback for build 26. Still open: web has no list posts (needs server-side text reading).
- **Noted, left (Sarp):** pre-fill the search with the account's name when nothing is found.
- **Not solvable from the post:** a venue named nowhere (only an event collective's @handle), places only *spoken* in a reel, places on no map at all.

## Test links that still work
- Tagged post that auto-saves: Ästad Vingård `DdJIacKIplU`
- Carousel list post: Vink's Oslo `C_OOWiDS7Gh` (5 of 6 found; Tranen isn't on Apple Maps)
- Caption list post: Amsterdam reel `DAblyc9ICgR` (five places)
- Reel: La Lucha Libre `Dc-iywHIy7b`
