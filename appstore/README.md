# Vicolo App Store listing draft

Prepared for Sarp's review on 16 October 2026. Nothing here has been uploaded to App Store Connect.

## Choices

| Field | Selected | Characters | Limit | Why |
| --- | --- | ---: | ---: | --- |
| Name | Vicolo | 6 | 30 | The existing product name stands alone. |
| Subtitle | Places worth keeping | 20 | 30 | Says what the app is for without naming another platform. |
| Promotional text | See `metadata/en-US/promotional_text.txt` | 98 | 170 | Leads with the share action and the map. |
| Description | See `metadata/en-US/description.txt` | 740 | 4,000 | Explains the save, browse and revisit flows, including the lack of cross-device sync. |
| Keywords | See `metadata/en-US/keywords.txt` | 95 | 100 | No words from the name or subtitle, spaces after commas, or platform names. |

Counts exclude the final newline in each file. Categories: **Travel** is primary because the map organizes places for trips and days out; **Food & Drink** is secondary because cafés, restaurants and bars are common saves. The two lines and the reasoning are in `metadata/en-US/categories.txt`.

## Copy alternatives for Sarp

- **Name:** Keep `Vicolo` (selected). If the name is unavailable in a storefront, `Vicolo: Saved Places` or `Vicolo: Your Place Map` are under 30 characters. Check availability in App Store Connect before changing it.
- **Subtitle:** `Places worth keeping` (selected); `A map of saved places`; `Keep places on a map`.
- **Promotional text:** The selected text starts `Find a place in a post?`. Alternatives: `Save places from public posts and map links. Find them later on your own map, organized by city and kind.` or `The café you spotted, the museum someone shared, the bar for next time: save them to your map in Vicolo.`
- **Description opening:** `Keep the places you come across in one place.` (selected); `Keep a map of places you want to go.`; `A place catches your eye. Save it for later.`
- **Keywords:** The selected set fills 95 characters. A more travel-focused swap is `vacation` for `drink`; a more local-focused swap is `neighborhood` for `itinerary` (both need a recount before use).
- **Secondary category:** Food & Drink (selected); Navigation if Sarp wants to emphasize the map rather than venue discovery.

## Screenshots

Both required sets contain six frames. `6.9/` is 1320 × 2868 from an iPhone 17 Pro Max simulator; `6.3/` is 1206 × 2622 from a disposable iPhone 17 Pro simulator. `raw/` keeps the untouched UI captures. The captures came from `XCUIScreen.main.screenshot()` attachments during temporary UI tests so transient save sheets could be captured at the right moment. The prepared venues were saved through the app's `-addURL` flow; the scratch list was copied to the second disposable simulator. Neither the existing personal iPhone 17 Pro simulator nor its list was changed. `frame.py` adds the same #FAEEE9 brand-tinted background and headline to each capture and keeps 86% of each image dimension for the current UI. Re-run with `python3 appstore/frame.py` after replacing raw captures.

| Frame | Selected headline | Alternatives | What it shows |
| --- | --- | --- | --- |
| 01 | Your places, on a map | A city of saved places / See your places together | Barcelona with saved venue pins |
| 02 | Keep that place | Saved for later / From post to place | Ästad Vingård save confirmation |
| 03 | Pick the right place | Choose the place / When a link is unclear | Two Sagrada Família candidates |
| 04 | Save the whole post | Five places, one post / Keep the ones you want | Public Oslo venue carousel with five choices |
| 05 | Find what you saved | Browse by kind / Places for every mood | Barcelona's What filter |
| 06 | Ready when you go | Directions when you need them / Mark places visited | Place card with Directions and Been there controls |

All subjects are public venues. No frame uses a person's name or face as its subject, shows a price or URL, or uses another platform's logo. The framed screens use the current UI, not mockups. `duo-*` and `creative/` assets are optional in the brief and are not included in this draft.

## Before submission

- Sarp: approve every word and image. The place card frame has a deliberately quiet background because it is filtered to one place; decide if that is the preferred look.
- Sarp: add the review contact phone in App Store Connect's separate contact field. No phone number is in the repo, so none was invented here.
- Sarp: confirm `hello@vicolo.space` receives mail, then recheck all five sample links and backend availability on the day of submission.
- Sarp: decide whether to leave the optional Marketing URL empty until the web page no longer describes a small beta. The required Support and Privacy Policy URLs are `https://www.vicolo.space/support` and `https://www.vicolo.space/privacy`.
- The review notes necessarily contain sample URLs because the task brief requires the reviewer to test exact links. The customer-facing metadata and screenshot headlines contain none.
