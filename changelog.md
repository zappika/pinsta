<!--
What's new in each iOS build, for testers. Shown at vicolo.space/changelog and from
the app's menu → What's new. Every TestFlight upload adds its section at the top, in
the same commit as the build bump (CLAUDE.md → Shipping a TestFlight build).
Write what a tester notices, in plain words; leave out what only Sarp sees (costs,
backoffice, web-only changes). Headings read "## Build N · D Month".
-->

# What's new in Vicolo

## Build 40 · 24 November

- **Want to go / Been there moved.** The switch at the top of the map is gone: long-press the map icon at the bottom to pick All, Want to go or Been there. While one is on, the icon has a small badge.
- **Checks on places you've been.** Zoomed right in, they have a small green check on their pin.
- **Moving the map follows you.** Scroll from the town you picked to another one and Where switches to it, so its places show.
- Small dots on the map are much easier to tap, and place names are darker.
- The top pill is only as wide as its words.

## Build 39 · 24 November

- **Check in opens faster.** Vicolo looks up the places around you ahead of time (when you open it, come back to it, or tap +), so the list is usually there straight away.
- **A cleaner map.** The map fills the whole screen. Where and What sit together in one pill at the top, with the menu button beside it; at the bottom, the locate button is on the left, Map / List / Tiles in the middle and + on the right.

## Build 38 · 24 November

- **A hello when you arrive somewhere.** Once a city (not your home) has 3 or more of your places, Vicolo asks if it may tell you when you get there. Then, arriving, you get "🇮🇹 Benvenuti a Milano! 20 places you saved are here." Tap it for that city's map. Two notifications a week at most; Settings → Notifications turns it off.
- **Timeline** replaces Been there in the menu: your check-ins day by day, and under Places everywhere you've been.
- On a place's card, swipe left or right for the next or previous place; the map follows.
- The Cards view is gone: Map, List and Tiles stay.
- In Tiles, a place without a photo shows a little map of its street with its name.
- Picking a town in the Where menu always flies the map there, even with a filter on.
- Two coloured dots right next to each other on the map no longer pulse: they become one dot.
- The + menu says "Social post" instead of "Instagram post".
- No more red dot on the menu button for a new build.

## Build 37 · 22 November

- A place's card now tells you where it came from: who posted it and what they said. Tap that to open the post. (The round Instagram button is gone; it looked like the place's own account.)
- Tapping **Been there** no longer says you were there today. Only **Check in** records when you went.
- A place you saved by checking in says "Saved when you were here".
- With a filter on the map, places close together stay little coloured dots instead of numbered circles.
- Your blue dot really stays on top of the pins now.

## Build 36 · 20 November

- **Check in** moved into the + menu (no more button on the map), and that's its name everywhere now, also for Siri ("Check in with Vicolo") and the Control Center button.
- The map shows your posts' photos from further out: no more black dots across a city, and photos only merge into one round picture when many sit on top of each other.
- Your blue dot stays on top: a place right where you're standing no longer hides you.
- At the top of the map: **All · Want to go · Been there**, to see only the places you still want to try, or only the ones you've been to.

## Build 35 · 20 November

- **I'm here:** a new button on the map (and in the + menu). It lists the places right around you, the likeliest one first; one tap checks you in. Then, if you like, a face, a photo and a note for next time.
- **You made it:** open Vicolo while you're at a place you saved, and it shows the post you saved it from, with its caption. One tap checks you in.
- Every visit counts: a place's card says "Been 3 times · last 12 Nov", with your note and your photos.
- **Been there** (menu) is now a timeline of where you've been, day by day with the town. Tap a row to open the place; swipe a check-in to delete it.
- Add I'm here to Control Center, the Lock Screen or the Action button, or say "I'm here in Vicolo" to Siri.
- A post that names the place by its Instagram account, or a place whose name starts with "The" or "Le", is found more often.

## Build 34 · 15 November

- More posts save by themselves: when a restaurant posts about itself and the place is named like the account, it's found on its own.
- Posts tagged with a street, a neighbourhood ("Barri de Sants") or a town in an area ("Begur, Costa Brava") look for the venue, not the station or hotels nearby.
- A caption that gives the place's name and address ("The Blue Moon, 55 Rue de la Roquette, Paris") finds that place; so do captions saying "check out Bisou".
- Restaurants whose Instagram name ends in a web address (like ".es") are found like any other.
- A tag that only turns up a place with a different name no longer saves it by itself: you're asked first.
- On the map, imported places are a stronger colour, names move to the other side instead of disappearing, and places saved by name or from Google Maps show their photo.

## Build 33 · 31 October

- The map changes as you zoom: far out, places close together become one round picture with how many there are; across a city, dots with names; closer in, photos with names. Places right next to each other stack into one photo with "+1 more"; tap it to zoom in. Places from an imported list are small coloured dots.

## Build 32 · 27 October

- **Where I am** in the + menu: the places right around you, closest first. One tap saves the one you are at.
- Vicolo asks later whether you have been: the day after you saved a place where you stood, a week after one from a post. "Been to any of these?" shows up to four; Yes lets you pick a face for how it was, and "Not yet" undoes a Yes tapped by mistake. At most one question a day.
- A restaurant posting its own photos (a receipt, wine labels) no longer turns into a list of random places.
- A post tagged with a small town that names the place as a co-author now finds it.

## Build 31 · 19 October

- Importing a Google Maps list is much simpler: paste the link, and you see a map of the list and how many restaurants, bars and so on it has. Tap a type to leave places out, then "Import all". Places come in as Want to go.
- Imports keep going with Vicolo closed. A pill on the map shows how far along it is, and a notification says when the list is ready. Later keeps an import for another time; it waits in the menu.
- Long lists import in full (up to 500 places), and lists shared straight from Google Maps' Share button work too.
- Places the import couldn't find have a Search button that looks them up by name.
- A place from a list says whose list it came from ("From Emilie’s “Paris” list").
- Zoom far out on the map: one bubble per city with a few photos and a count. Tap one to fly there.
- Want to go and Been there are one switch now; picking Been there adds a 🙋🏻‍♀️.
- In the save sheet, Paste sits inside the link field.
- A post tagged with just a city finds the place in that city, including places Apple Maps only knows by a name in another script.

## Build 30 · 17 October

- Sharing a post with many slides (a museum, a house tour) no longer gets stuck on "Finding the place…". The sheet shows which slide it's reading and which name it's looking up, and tells you if the slides don't name a place.
- When Vicolo can't read a post, it says why: the account is private or the post was deleted, or Instagram didn't answer. A place saved without a photo says so on the saved card.
- With only one suggestion, the button under it now reads "Not this one".
- A post in Swedish, Danish, Norwegian, Finnish or Icelandic shows places in that country first, so Liebling in Stockholm comes before Liebling in Vienna.
- Accounts that spell out New York ("misinewyork", "_ny") are looked for in New York, not in every town with that name.
- A post tagged with just a town, like "Los Angeles, California", no longer suggests random places there.
- The Undo next to "Removed …" is no longer hidden under the locate button.
- Menu → Help and Privacy: how to save, common questions, how to reach us, and what Vicolo does with your data.
- Settings → Help improve Vicolo: a switch to stop sending how saves went and how the app is used.
- Larger text: the Where and What titles stack instead of being cut off.
- Reduce Motion: menus, cards and sheets fade instead of sliding, and the map jumps instead of flying.
- VoiceOver can change or remove a card and reads the Where and What titles.

## Build 29 · 16 October

- A post that names places only on signs in a street photo no longer ticks them for you: those names are listed unticked, the post's own places stay ticked.
- Vicolo now also counts how it's used (how often it's opened, which views you pick and how long each is on screen), with no places, links or names. The privacy page says so.

## Build 28 · 16 October

- Vicolo now notes how each save went (the post's link, and whether it found the place or you gave up) so wrong places can be fixed without you having to tell Sarp. No names, no list. The privacy page says exactly what is sent.

## Build 27 · 16 October

- A round arrow above the + on the map shows where you are: one tap and the map frames you and your surroundings, with the blue dot.
- The map never zooms in tighter than a neighbourhood, so a single place shows the streets around it.
- A person tagged in a venue's post no longer pulls in namesakes from another country.

## Build 26 · 16 October

- The + now opens a small menu: Instagram post or Google Maps. Google Maps takes a single place or a whole shared list. Import from Google moved here from the menu top right.
- Places saved from a post show the post's photo on the map. Places imported from a list keep their icons.
- Finding the place is smarter when the post has no clear tag. If the account names its city (criollo_oax, jaja.berlin, strakers_nyc) or a hashtag does (#tokyo, #BerlinGuide), Vicolo looks there, not for a namesake abroad.
- A restaurant @mentioned in the caption comes first. Airports, ferries and stations no longer show up just because they share the city's name.
- When Apple Maps only has far-off guesses, Vicolo asks Google straight away.
- Carousels with a busy cover still find every place on the later slides, including ones Apple Maps doesn't know.
- With no places near you, the map opens on all your places, not on the nearest country.
- Towns in Japan, and anywhere written in another alphabet, show in English.
- Removing a place and leaving the app right away now really removes it, so sharing that post again works.

## Build 25 · 15 October

- What's new in the menu shows what changed in each build. A red dot on the menu button means there's something you haven't read yet.

## Build 24 · 15 October

- Before asking for your location, Vicolo now explains why. It asks from your second saved place.
- A post that lists places in its caption ("1. …, 2. …, 3. …") saves them all in one go.
- The What menu splits a category once you have two or more of a kind, like Wine bar under Bars.
- A new Culture category for cinemas, theatres and concert halls.
- New restaurant artwork in the tutorial.

## Build 23 · 14 October

- A carousel that names several places on its slides can be saved in one go: they're all ticked, untick any you don't want, then Save.
- Better at finding the place: an "Address of the bar:" line in the caption and accounts @mentioned in it now count as clues.

## Build 22 · 14 October

- Save from an Instagram profile: share the profile, paste its link, or type @handle.
- Type a place's name in the first field of the save sheet to search for it.
- Better with untagged posts: a 📍 line in the caption, a street as the location tag, and collabs like "Broth Boy x Vrå".
- When Apple Maps can't find a place, Vicolo asks Google. "None of these" under Apple's suggestions asks Google too.
- The tutorial has a new step for Instagram's Share to… button.
- Back from Instagram without saving anything? The empty list helps you try again, and offers to save a link you copied.

## Build 21 · 14 October

- The tutorial's last button opens a real post of a place in Instagram, so your first try always has something to save.
- The tutorial shows how to make Vicolo a favorite in the Share sheet, so it's always at hand.

## Build 20 · 11 October

- Importing a Google Maps list asks once whether its places are Want to go or Been there.

## Build 18 · 10 October

- The save sheet moves smoothly from finding the place to the saved card, without jumps.

## Build 17 · 10 October

- A new save sheet that fits what it shows, and a saved card that opens with the post's photo.
- A burger place gets the burger icon even when only its account name says so.

## Build 16 · 9 October

- The Where menu groups villages into travel areas like Costa Brava, Penedès and Priorat.
- Restaurants get a food icon on the map: pizza, sushi, burger and more.

## Build 15 · 9 October

- Vicolo opens on the map of the town you're in, with a blue dot for you. Near me is gone.

## Build 14 · 9 October

- Import a shared Google Maps list: menu → Import from Google.
- A post tagged with just a town now finds the place in that town.
- The share card no longer shows a link field.

## Build 13 · 9 October

- A new save flow: the sheet asks one question at a time, and every save ends on a "Saved to Vicolo" card.

Earlier builds aren't listed.
