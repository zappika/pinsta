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

### 2026-10-19: how people save places now (Sarp asked two people, plus a Google Maps screenshot)
- One person pins places abroad in Google Maps, **city by city**, or under the **trip name** when a trip is close. Places in Turkey aren't saved, just sent to a friend.
- Another files everything in **Instagram Saved collections** (Antalya, İzmir…), not only places.
- A Google Maps "You" screen: Manchester (29 places), November trip (5), Berlin (54, shared).
- What it says: city is how people sort; trips are the second way; Google lists are where the places already are (list import is the way in); sharing is common; your own town gets less saving than travel.

### 2026-10-16 round, on build 26
- ~~Pophams `DeeRAfqIuGl`: "Stuart Studio" in Lille first~~: from `@lilliestuart` (a person) in the caption, ranked first by the new mention rule. A mentioned account's results more than 100 km from the poster's own are dropped. Build 27.
- ~~casa.lawa `DeW-H5LCsup` (Catania): a laundry and a café from a street photo's signs, ticked next to Bar Popolare~~: names off a slide Vision reads shakily start unticked. Oslo still 5 of 5 ticked. Build 29.
- ~~Jolene `Deb1PksCAdA`~~: worked on Sarp's phone on retry (2026-10-16); the earlier failure was the read, likely Apify being busy.

### 2026-10-16 round (Sarp's own tries)
Most were "can't read the location" or "Apple Maps doesn't have it". Fixed for build 26 (search on web and iOS):
- ~~Criollo `DeM0Nu5Ke2H` (tag "Criollo", @criollo_oax): Italian namesakes until "Oaxaca" was typed~~: the handle's city now pins a tag search; `oax` and many Monocle-city shorthands added.
- ~~JaJa `DehDPLMoj30` (tag "JAJA", @jaja.berlin): same~~.
- ~~Straker's `DehOwL8G6hx` (@strakers_nyc with co-author @thomas_straker): "Thomas Strake" in Hanau~~: one city for the whole post, from any account's handle; every search kept within 30 km of it. Apple has Straker's.
- ~~Selma `selma__paris`: LittleBig in Bratislava, Cape Town…~~: an "at Selma" guess has to carry the name, and far-off junk is dropped, so Google gets asked. Apple offers "SELMA'S" in Paris first; is that it? If not, "None of these" → Google. Not done: reading the poster's bio address (one more Apify read per stuck post).
- ~~Arraval `Ded7Z8SigdT`: Barcelona airport and ferry above Arraval~~: transport must match the name, not the city; @mentioned accounts rank first.
- ~~Deleted a place, shared again: "Already in Vicolo"~~: the Undo timer stopped when the app went to the background; leaving now commits the delete.
- ~~Japanese town names (`DegsdXSFG26`, 楽園 in Kyōdō)~~: asked again in English (checked in the Simulator: "Fukuoka").
- 楽園 itself: the tag saved "Rakusuien" in Fukuoka by itself. Now a hashtag naming a city (#tokyo) keeps a tag search there: offers Tokyo-area "Rakuen"s, saves nothing by itself. Still not the curry shop: Apple finds it only as "rakuen curry Tokyo" (Latin letters, from @rakuen_curry); adding co-authors to tag searches put JaJa's photographer @gushy.me above JaJa, so left out.
- ~~Elena `@elenamontreal`: hotels in Spain and Italy~~: Montreal is a known handle city now; "Elena" in Montréal first.
- ~~gatrooms `DZFfxgUCL8I` (Dua Lipa's 3 Berlin spots): offered the hotel itself~~: no city (only #BerlinGuide) and the cover's twelve lines used up the slide searches. Hashtag prefixes give the city; every slide's first line is searched first; Google asked per unfound line. 3 of 3. Oslo now 5 of 6 (Tranen via Google; Hyde gone from both maps).
- **Map pins:** places saved from a post show the post's photo (web, and iOS since build 26). List imports and Maps links keep the type icon. Sarp, 2026-10-16: "the Google Maps imports make the map view ugly"; photos for them too is open.

### 2026-10-14 round (Mert + testers)
Builds 21–25 (2026-10-14 → 10-15) are the answer to this round: place finding, profile saves, list posts, the Share to… tutorial, stuck help, the location primer, What's new. Build 25 checked on Sarp's phone 2026-10-15. Still open:
- **Testers on old builds:** all on 25 or later by 2026-10-16 (Sarp); the banner idea is backlog. Earlier: all five were on 21. Nudge them to update and turn on Automatic Updates. Idea, not built: an in-app "new version ready" banner (server holds the latest build number, opens TestFlight).
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
