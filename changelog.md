<!--
What's new in each iOS build, for testers. Shown at vicolo.space/changelog and from
the app's menu → What's new. Every TestFlight upload adds its section at the top, in
the same commit as the build bump (CLAUDE.md → Shipping a TestFlight build).
Write what a tester notices, in plain words; leave out what only Sarp sees (costs,
backoffice, web-only changes). Headings read "## Build N · D Month".
-->

# What's new in Vicolo

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
