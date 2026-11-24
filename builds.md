# Vicolo — iOS builds

What's on the phone, and what's waiting for the next build, side by side. Internal;
testers read `changelog.md` (vicolo.space/changelog).

How it stays true:
- **Every iOS change** adds a line under "Next build" in the same commit. Write it the
  way a tester would notice it, so it can go into `changelog.md` as is; internal-only
  notes get *(internal)*.
- **Every upload**: "Next build" becomes the new "In TestFlight", its tester lines go to
  the top of `changelog.md`, the old one moves to "Earlier builds", and the bump commit
  is tagged `ios-N` (`git tag ios-N && git push origin ios-N`).
- `git log ios-N..HEAD -- ios lib app/api` is the check: anything there that isn't listed under Next build was forgotten.
- **Phone:** ☐ until Sarp says the build is fine on the phone, then ☑ (one word from Sarp is enough).

## Next build (since `ios-38`)
- **A cleaner map screen:** the map now fills the whole screen, top to bottom. Where and What sit together in one glass pill at the top, with the menu button on its own beside it. At the bottom, the locate button moved to the left end, the Map / List / Tiles switch stays in the middle and + on the right.
- *(internal)* 2026-11-24: `PlacesListView.page` (map `ignoresSafeArea()`, header + Been filter floating over it), `FilterPillLook`, `BuddyLook` (48 pt glass), locate as its own bottom-leading overlay (48 pt). Seen in the Simulator: Map and List. **Not seen:** accessibility text sizes (old two-line header inside no pill), a long city name in the pill, framing of pins under the pill.
- **Check in opens faster:** the places around you are looked up ahead of time (when you open Vicolo, come back to it, or tap +), so Check in usually shows the list straight away instead of "Finding where you are…".
- *(internal)* 2026-11-24: `Views/Around.swift`. One Apple search covers 200 m around a fix and stays good while you're within 50 m of it (so everything within the list's 150 m was fetched), at most an hour; empty answers aren't kept. Every fix `NearMe` gets prefetches; + and foreground ask for one (`NearMe.recent`, the phone's last fix ≤2 min old and ≤100 m accurate, else a precise fix). Check in opens on the cached list at the recent fix, then swaps it only if the precise fix is 25 m+ away. Seen in the Simulator (Gràcia): the list was up as the + menu faded. **Not seen:** walking with the phone (the swap, the 50 m rule).

## In TestFlight: 1.0 (38) · 2026-11-24 · `ios-38` · phone ☐
- **Welcome to a city:** once a city other than your home has 3 or more of your places, Vicolo asks if it may say hello when you arrive. Then, arriving there, a notification says "🇮🇹 Benvenuti a Milano! 20 places you saved are here." (in the country's own language, with its flag); tapping it opens that city's map. Settings → Notifications turns it off. Two notifications a week at most.
- *(internal)* 2026-11-24: `Views/Nudges.swift` (`Nudges`, `HomeTown`, `Welcome`, `Flags`, `NotifyPrimer`). Local notifications with `UNLocationNotificationTrigger` ("While Using" is enough), rewritten on open, after a save and on background. Seen in the Simulator: the primer after the third Milan save, "Milan" → "Milano", the permission question, the welcome written (3.8 km area), its banner via `-welcomeNow`. **Not seen:** the location trigger firing (this Simulator's locationd "couldn't get fences" for notifications) and a tap opening the Milan map (Lock Screen taps didn't open the app). Both need the phone. A notification arriving with the app open now also stays in Notification Center.
- Picking a town in the Where menu flies the map there even with the Want to go / Been there filter on (before, a town with nothing under the filter left the map where it was).
- Two coloured dots right next to each other on the map no longer pulse: they become one dot.
- No more red dot on the menu button for a new build; What's new still says which build is new.
- The menu's Been there is now Timeline, and the timeline shows only check-ins with a day. Places you marked Been there without checking in are under Timeline → Places (swipe one for Not been).
- On a place's card, swipe left or right for the next or previous place, in the list's order (newest saved first); the map follows.
- The Cards view is gone: Map, List and Tiles stay.
- The + menu says "Social post" instead of "Instagram post".
- In Tiles, a place without a photo shows a small map of its street with its type icon on it and its name at the top, instead of a plain coloured tile.
- *(internal)* 2026-11-24: `Views/MapTile.swift`, an `MKMapSnapshotter` (~700 m across, muted, no POIs, light/dark) cached in memory and Caches/MapTiles; name at the top because the Apple Maps mark at the bottom must stay visible. Seen in the Simulator on The Blue Moon (forced for a photo place, then reverted).
- *(internal)* 2026-11-24: the city framing bug wasn't reproduced (the Simulator has one place); the fix is the likeliest cause, `focus` = the selection before the been filter. Pulsing: quiet dots now group at `quietSize + 2` (touching), and `FadeIn` fades a pin id in once per launch (MapKit re-mounting overlapping annotations re-ran it). `PeekCardView` `onStep`/`arrive`, `PlacesMapView.show` on `selected` change. `SwipeCard.swift` deleted. Built; card swipe and the Timeline sheet not seen in the Simulator (one place, menu taps didn't register).

## Earlier builds

### 1.0 (37) · 2026-11-22 · `ios-37` · phone ☐
- Your blue dot really stays on top now: in build 36 a place just below you on the map could still cover it.
- *(internal)* 2026-11-20: MapKit stacks annotations by latitude, so drawing `YouDot` last as an `Annotation` didn't help (Barcelona, Hotel Seventy's dot). It is now an overlay over the `Map`, placed with `MapProxy.convert` on every camera change and fix. Checked in the Simulator just north of Al Covo, and while panning.
- *(internal)* 2026-11-22: `VisitPhotos` and the visit methods that delete or add photo files moved from `Models/Visit.swift` to `Services/VisitPhotos.swift`, so `Models` is Foundation-only again and the search replay (`npm run review:replay`) compiles on macOS. No behaviour change.
- With a filter on the map (a type, Want to go), places close together stay coloured dots instead of turning into numbered circles.
- *(internal)* 2026-11-22: `quietPin` lost its count branch; a quiet group is the deep-tint dot (16 pt) in the roomy/street look too. Same on web (`PlacesMap.tsx`). Built; not seen with real data (the Simulator has one place).
- Tapping Been there on a place no longer says you were there today: it's Been there with no date. Only Check in records when you were there.
- *(internal)* 2026-11-22: `VisitSwitch` sets only `visitedAt` (no `checkIn()`); `lastVisit` reads dated visits only; `Visit.undated` (optional, so stored visits decode) marks an earlier undated Been there that `checkIn()` turns into a visit; the timeline lists those under "No date". Checked in the Simulator on a throwaway place (card says "Been there", no day) and with a macOS script over `Models` (Check in after: 2 visits, last = today, the first undated; a visit stored without the key decodes). Build 36's wrongly dated visits are left as they are.
- A place you saved by checking in says "Saved when you were here" on its card, not "Saved by name".
- A place's card tells where it came from in one block: who posted it and what they said, in quotes. Tap it to open the post. The round Instagram button is gone from the card; a place with more posts shows "+1 more post".
- *(internal)* 2026-11-22: `PlaceCardView` `source` (WhyHere sentence + `WhyHere.captionSnippet`, ported word for word from `lib/why-here.ts`, address lines skipped), round post button only off the floating card, `visitsRow` only when folded or with visits, the venue's Instagram hidden when it is the poster's. Designed on backoffice `/card`. Checked in the Simulator on The Blue Moon; the snippet rules checked side by side with the web on six captions.

### 1.0 (36) · 2026-11-20 · `ios-36` · phone ☐
- **Check in** is in the + menu now, not a button on the map; everything that said "I'm here" says Check in (also Siri: "Check in with Vicolo", and the Control Center button).
- The map shows your saved posts' photos from further out: no more black dots across a city, and photos only merge into one round picture when many sit on top of each other.
- Your blue dot stays on top: a place right where you stand no longer hides you.
- At the top of the map, All · Want to go · Been there shows only the places you want to go to, or only the ones you've been to. Opening the app or switching to the list shows all again.
- *(internal)* 2026-11-20: `hereButton` removed, `BeenFilter` + `beenSwitch` (system segmented control, top of the map) in `PlacesListView`; `PlacesMapView`: no `.mid` look, `overlap` 0.7, `fanMax` 4, own `YouDot` (CLLocationUpdate.liveUpdates, only when allowed) instead of `UserAnnotation`. Checked in the Simulator over build 35: + menu, filter, dot on Al Covo. Zoom steps not walked through on iOS (web was).

### 1.0 (35) · 2026-11-20 · `ios-35` · phone ☐
- **I'm here:** a new button on the map. It lists the places right around you with their icons, the likeliest one first; one tap checks you in. Then, if you like: a face, a photo (camera or your photos) and a note for next time.
- **You made it:** open Vicolo while you're at a place you saved, and it shows the post you saved it from, with its caption (often what to order). One tap checks you in.
- Places keep every visit: the card says "Been 3 times · last 12 Nov", shows your note and your photos under the post's. A place checked into without a post gets your photo as its own.
- On the Been there page, swipe a check-in left to delete it (a wrong tap, a double check-in), and tap any row to open the place on the map.
- **Been there** (menu) is now a timeline of your check-ins, day by day with the town ("Saturday 15 Nov · Bologna"), each with its time, face, note and photos; Places lists them by how often you went ("3×").
- The + menu's "Where I am" is now "I'm here" too: one list of the places around you, and a tap checks you in.
- "Been to any of these?" → Yes for a place you saved standing there counts as a visit on that day; removing a place removes your photos of it.
- I'm here from anywhere: add it to Control Center or the Lock Screen (or the Action button), or say "I'm here in Vicolo" to Siri.
- *(internal)* 2026-11-20: `Models/Visit.swift` (visits as a list on Place, photos as files in the App Group), `Views/CheckInView.swift`, `Views/CheckInIntent.swift`, new target `PinstaWidgets` (control). Upgrade over build 34 checked in the Simulator (list kept). Not checked: adding a photo, the control, a check-in that saves a new place.

- A place's own post finds it even when the place's name starts with "Lo", "Le", "The" and so on (Lo Gat for @gatbxl).
- A magazine's post naming a hotel as co-author finds the hotel, not something named like the magazine (Stamba Hotel).
- A 📍 line that names the place by its Instagram account ("📍@gatbxl Rue Lesbroussart 67") finds it.
- *(internal)* 2026-11-20, both sides: articles in `isOwnPlace`, the far-namesake filter anchors on `namedLikeAccount`, @handles in the 📍 line read as the handle's name, `bxl` glued like `bcn`. Replay checked.

### 1.0 (34) · 2026-11-15 · `ios-34` · phone ☐
- Map dots for imported places are a stronger colour, easier to see on the map.
- A place name that would run into a nearby pin now shows on the other side instead of disappearing.
- Places saved by name or from a Google Maps link show their photo on the map, like places saved from a post.
- A restaurant's own post saves itself more often: when the place is named exactly like the account (El Roca, Beak, Bon Jo), it's found on its own.
- Posts tagged with a town in a travel area ("Begur, Costa Brava") or a French/Italian street ("Rue du Parc-Royal") look for the venue instead of offering hotels around it.
- Captions saying "check out Bisou" find Bisou; a magazine tagged in a post (Time Out) no longer comes before the restaurant.
- Restaurants whose Instagram name ends in a web address (`mariadelrio.es`) are found like any other; a post that names its street ("Calle Doña Urraca 16") or a city hashtag (#madridgastro) is searched there.
- Posts tagged with a neighbourhood ("Barri de Sants") look for the venue instead of offering the station.
- A tag that only turns up a place with a different name no longer saves it by itself: you're asked first.
- A caption that gives the place's name and address ("The Blue Moon, 55 Rue de la Roquette, Paris") finds that place.
- *(internal)* `namedAddressQuery` (2026-11-15): a "Name, address" caption line is trusted like a 📍 line, results must carry the name's words.
- *(internal)* Save-miss fixes (2026-11-11, `PlaceSearch.swift`): `bareHandle`, `plain` (small capitals), `namesTag`, `addressIn` ported from the web, `resolveUntagged` takes hashtags, neighbourhoods in `areaOfTag`. Checked with the MapKit replay.
- *(internal)* Save-miss fixes (2026-11-01, `PlaceSearch.swift`): `isOwnPlace`, `mentioned` (media dropped, kind-glued handles first), travel areas in `areaOfTag`, "rue du / via della" in `streetOfTag`, `captionPlaceQuery` phrases and line breaks, "📌 Save it…" isn't a place line. Checked with the MapKit harness, not in the Simulator.
- *(internal)* Tried in the Simulator 2026-11-15 (iPhone 17 Pro recreated on iOS 27.2): the Blue Moon link saves itself. Replay 43/47. First build from this Mac.

### 1.0 (33) · 2026-10-31 · `ios-33` · phone ☐
- The map changes with zoom: far out, places close together show as one round picture of their photos with how many there are; across a city, dots with names; closer in, photos with names. Places right next to each other stack into one photo with "+1 more"; tap it to zoom in. Places from an imported list are small coloured dots, with their type icon up close.
- *(internal)* Compiled and tried in the Simulator 2026-10-31 (new iPhone 17 Pro on iOS 27.0; 27.1 refuses new devices): Venice opens with type-icon pins and names, two places 50 m apart group as "2". Zooming not checked in the Simulator.

### 1.0 (32) · 2026-10-27 · `ios-32` · phone ☑ (Sarp, 2026-10-27)
- A restaurant's own carousel with a receipt or bottle labels in the photos no longer turns into a list of random places: only text laid over a picture is read as place names (El Roca, Barcelona).
- A post tagged with a small town and naming the place as a co-author finds it (a building-materials yard in Eemnes).
- **Where I am** in the + menu: the places right around you, closest first, one tap to save the one you're at.
- Vicolo asks later whether you've been: the day after you saved a place where you stood, a week after one from a post. "Been to any of these?" lists up to four; Yes opens the faces to say how it was. Each place is asked twice at most, one sheet a day at most, and "Not yet" undoes a Yes tapped by mistake.
- *(internal)* Built and tried in the Simulator 2026-10-26: Where I am lists nearby places; the ask sheet shows, Yes opens the faces, Not yet undoes it. The locate button no longer sits on the ask sheet.

### 1.0 (31) · 2026-10-19 · `ios-31` · phone ☐
- Importing a list is calmer: paste the link, then one screen about the list: a map of where its places are, one row per type (tap one to leave places out; hold a place to change its type), what couldn't be found, and "Import all 13 places" (or "Import 12 of 13"). Everything comes in as Want to go. Later keeps the import for another time; Cancel import asks first.
- On a place, Want to go and Been there are one switch now (one side lit), so they read as a choice, not two buttons; picking Been there adds a 🙋🏻‍♀️.
- Zoomed far out, the map shows one bubble per city with a few of its photos and how many places it has; tap one to fly into that city.
- A place imported from a Google Maps list says whose list it came from on its card ("From Emilie’s “Paris” list").
- A post tagged with just a city ("Athens") now looks for the place in that city, and finds places Apple Maps only knows by their local-script name (Seychelles in Athens, not restaurants in the Seychelles).
- *(internal)* Counts opening a saved place, Directions, the post button and Been there (no place names), for the backoffice's Pulse page.
- The Paste button sits inside the link field, with a clipboard icon, so it reads as "paste what you copied", not as a button to tap after pasting.
- After importing a Google Maps list, every place gets its photo while the app is open, not five each time you open it.
- Importing a Google Maps list keeps going with Vicolo closed: a pill on the map shows how far it is ("Importing … 12/40"), the menu has an Import row, and a notification says when it's ready to review. Vicolo asks to send notifications when you start an import.
- Long lists import in full (up to 500 places), found with Google, so places Apple Maps lacks are found too.
- Places the import couldn't find are listed under the list, each with a Search button that opens the save sheet with its name.
- A list shared from Google Maps' own Share button now imports (it was dropped before): the card says it's importing, and the app has it when it's ready.
- *(internal)* Push: `aps-environment` entitlement; the notification needs the APNs key in Vercel (`APNS_KEY`, `APNS_KEY_ID`). Matching moved from MapKit to `POST /api/import/jobs`.
- *(internal)* Built on the Xcode Mac 2026-10-19: one fix (the list screen's body was too long to type-check, split in two); import of the Bicocca test list ran in the Simulator (notification question, 13 places in review); a 116-place Barcelona list: the pill counted up to "ready to review", Couldn't find had 3, Search opened the save sheet on the name and found it.

### 1.0 (30) · 2026-10-17 · `ios-30` · phone ☑ (Sarp, 2026-10-17)
- When a post can't be read, the sheet says why (private or deleted, or Instagram didn't answer), and a place saved without a photo says so on the saved card.
- With a single suggestion, the button under it says "Not this one".
- A post written in Swedish, Danish, Norwegian, Finnish or Icelandic shows places in that country first.
- The Undo of "Removed …" is no longer hidden under the locate button.
- Sharing a post with many slides (a museum, a house tour) no longer gets stuck on "Finding the place…": the sheet says which slide it is reading and which name it is looking up, and if the slides name no place it says so.
- A post tagged with just a US town ("Los Angeles, California") no longer offers random places in that town.
- Restaurants whose account spells out New York ("misinewyork", "_ny") are looked for in New York, not in every town with that name.
- Settings → Help improve Vicolo: switch off sending how saves went and how the app is used.
- With larger text, the Where and What titles sit one above the other instead of being cut short.
- With Reduce Motion on, menus, cards and sheets fade instead of sliding and bouncing, and the map jumps instead of flying.
- VoiceOver can change or remove a card (actions on the card) and reads the Where and What titles.
- Menu → Help and Privacy: how to save, common questions, how to reach us, and what Vicolo does with your data.
- *(internal)* Privacy manifests (app + extension) declare UserDefaults (CA92.1, 1C8F.1) and the data that leaves the phone: links/places (Other User Content), usage counts, read errors. For the App Store.
- *(internal)* Testing launch arguments (`-addURL`, `-importURL`, `-slowNotices`, `-splashHold`) work in Debug builds only (`Views/TestArgs.swift`).


### 1.0 (29) · 2026-10-16 · `ios-29` · phone ☑ (Sarp, 2026-10-16)
- A post that names places only on signs in a street photo no longer ticks them for you: those names are listed unticked, the post's own places stay ticked.
- Vicolo now also counts how it's used (how often it's opened, which views you pick and how long each is on screen), with no places, links or names. The privacy page says so.
- *(internal)* `SlideText.Reading.signs`: a slide with any Vision line under 0.5 confidence is a photo of signs (casa.lawa `DeW-H5LCsup`, slide 5); its names start unticked. Vink's Oslo slides all read at 1.0, still 5 of 5 ticked.
- *(internal)* `Uses.swift` + `ScreenClock`: per-day running totals (`open`, `pick.<view>`, `sec.<screen>` incl. `tutorial`) in the App Group, sent to open `POST /api/uses` on launch and on background; the server keeps the larger count. Backoffice → Saves shows them, plus where saves came from (link kind × share sheet / in app).

Tags `ios-1` … `ios-30` mark the commit that set each build number (the upload may
include a commit or two after it).

| Build | Date | What | Phone |
|---|---|---|---|
| 28 | 10-16 | Save reports | ☑ (Sarp, 2026-10-16) |
| 27 | 10-16 | Locate button, 4.5 km minimum frame, Pophams fix (mentioned accounts' far-off namesakes) | ☑ (Sarp, 2026-10-16) |
| 26 | 10-16 | + menu, photo pins, place finding from handles and hashtags, list posts with busy covers, English town names | ☑ (Sarp, 2026-10-16) |
| 25 | 10-15 | What's new in the menu | ☑ |
| 24 | 10-15 | location primer, caption lists, What sub-rows, Culture | ☑ via 25 |
| 23 | 10-14 | list posts (several places from a carousel), "Address of the …:" lines, caption @mentions | ☑ via 25 |
| 22 | 10-14 | place finding (street tags, 📍, collabs), profile saves, Share to… tutorial page, stuck help, copied-link offer, Google fallback | ☑ via 25 |
| 21 | 10-14 | tutorial opens a post of a place, asks to favorite Vicolo — **first build testers installed** | ☑ |
| 20 | 10-11 | plain "Import N places" label | ☑ |
| 19 | 10-11 | list import asks Want to go or Been there | ☑ |
| 18 | 10-10 | save sheet steps animate as one, no frame-late jumps | ☑ |
| 17 | 10-10 | save sheet as in the /success sandbox, success card opens with its photo, burger from the handle | ☑ |
| 16 | 10-09 | travel areas in the Where menu, food icons | ☑ |
| 15 | 10-09 | opens on your town, blue dot, no Near me | ☑ |
| 14 | 10-09 | Google list import, town tags, pinned search, no link field on Share | ☑ |
| 13 | 10-09 | new save flow and success card | ☑ |
| 12 | 10-06 | Want to go / Been there with 😞 🙂 😃, Been there list, country chips removed — **build submitted for Beta App Review** | ☑ |
| 11 | 10-06 | 3D type icons, floating place card with why it's here and the venue's website, map by country | ☑ |
| 10 | 10-06 | menu → How to save | ☑ |
| 9 | 10-06 | share tutorial on an empty list, still splash, no embedded post, pill and + apart | ☑ |
| 8 | 10-05 | brand touches, animated splash, location from 3 places, the 10-02 review fixes, keyboard fix | ☑ |
| 7 | 10-02 | price, splash, Map · Near me, sheet ⋯ | ☑ |
| 6 | 10-02 | splash screen, light and dark | ☑ |
| 5 | 10-02 | glass pill shows the content behind it; no jump on view change | ☑ |
| 4 | 10-01 | icons, Liquid Glass, build 3 feedback (share card background, metro names) | ☑ |
| 2–3 | 10-01 | share card over the host app, reading steps, first-run steps, menu + Settings sheet | ☑ |
| 1 | 10-01 | first upload | ☑ |

Builds 21–25 answer the beta testers' feedback (`beta.md`). 25 was checked on Sarp's phone 2026-10-15, which covers 22–24; up to 21, later builds were tried on top of them.
