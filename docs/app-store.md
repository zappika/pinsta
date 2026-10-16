# Vicolo on the App Store — what a good first submission takes

Researched 2026-10-16 against Apple's own pages (links at the bottom) and checked against the
iOS app at build 1.0 (29). Rules change often; re-check "Upcoming requirements" and Apple's news
page before submitting.

Legend: ✅ done · ⚠️ needs work · ⬜ to do in App Store Connect · 🎨 Sarp's call

---

## 1. Hard gates (the upload or review fails without them)

| Requirement (since) | Vicolo |
|---|---|
| Built with Xcode 26+ / iOS 26 SDK (2026-04-28). From **April 2027**: iOS 27 SDK | ✅ This Mac has Xcode 27.1 |
| Minimum deployment target iOS 13+ (2026-09-09) | ✅ iOS 18.0 |
| Privacy manifest with approved reasons for required-reason APIs (2024-05-01) | ✅ (2026-10-16, after build 29) Both `PrivacyInfo.xcprivacy` declare `UserDefaults` with `CA92.1` (own app) and `1C8F.1` (App Group). They were empty before, which gets an ITMS-91053 warning on upload. No file-timestamp, uptime or disk-space APIs found. |
| Privacy policy link in App Store Connect **and inside the app**, "easily accessible" (5.1.1 i) | ⚠️ None in the app. The buddy menu has Settings, Been there, How to save and What's new. Needs a Privacy link → `vicolo.space/privacy`. 🎨 where it sits |
| Contact info in the app and on the Support URL (1.5) | ⚠️ None in the app, and no support page. Needs a support page (e.g. `vicolo.space/support`: what it is, how to save, FAQ, an email) and a "Contact / Help" in the menu. 🎨 |
| Age rating questionnaire, including the new social media questions (required for submissions since Sept 2026) | ⬜ Answer "no" to social media capabilities: there's no feed of other people's content. Expect **4+**. |
| EU Digital Services Act trader status, declared for new apps | ⬜ Do this **first**. Forum reports from Jul–Oct 2026 describe verification sitting "In Review" for 3–7 weeks with the app blocked in all 27 EU countries meanwhile. A free app with no revenue, ads or VAT registration is normally a non-trader, but even non-traders must declare it. If you declare trader, your address, phone and email are shown on the product page. 🎨 (personal call: privacy vs. consumer trust) |
| Export compliance | ✅ `ITSAppUsesNonExemptEncryption: false` on both targets (HTTPS only) |
| App Privacy ("nutrition label") | ⚠️ `plan.md` says "Product Interaction only". That undersells what leaves the phone. See §4. |
| No placeholder or temporary content (2.1) | ⚠️ The tutorial photo is a stand-in until a tester's photo arrives. That's fine if Sarp owns its rights (2.3.9). The tester-voiced changelog and "Build N" in the menu read as beta. See §5. |
| Backend up during review, with a working demo path (2.1) | ⬜ Review notes (§6). Apify's free plan allows 5 concurrent runs: a reviewer hitting busy reads will see failures. Consider a paid month around review. |

No accounts or login, so the account-deletion rule (5.1.1 v), Sign in with Apple and a demo
account don't apply. No in-app purchases.

## 2. Metadata (App Store Connect → App Information / Version)

| Field | Limit | Notes |
|---|---|---|
| Name | 30 chars | "Vicolo". Check it's free in App Store Connect early: names are unique per store. A subtitle-like suffix ("Vicolo: Saved Places") is allowed but counts toward 30. |
| Subtitle | 30 | What it does, plainly. Don't name other apps (2.3.7): **no "Instagram" or "TikTok"** in the name, subtitle or keywords (4.1 c, 5.2.1 trademarks). |
| Promotional text | 170 | Can change without a new build. |
| Description | 4,000 | You may say it works with links "from Instagram, TikTok and Google Maps" in the body (describes functionality), but don't use their logos. |
| Keywords | 100 | Comma-separated, no spaces after commas, don't repeat words already in the name or subtitle, no competitor or trademark names. |
| What's New | 4,000 | Not shown for 1.0. |
| Support URL | required | Needs to exist (see §1). |
| Marketing URL | optional | `https://vicolo.space` |
| Privacy Policy URL | required | `https://vicolo.space/privacy`, once updated (§4) |
| Category | primary + optional secondary | **Travel** (primary), **Food & Drink** or **Navigation** (secondary). 🎨 |
| Copyright | required | e.g. "2026 Sarper Erel". No © symbol needed. |
| Content rights | required | "Does your app contain, show or access third-party content?" → **Yes** (post images and captions). Be ready to show you have the rights to use it (5.2.2). See §7. |
| Price / availability | — | Free, all territories (or start with a few). Pre-orders are possible but not worth it. |
| Version release | — | Choose **Manually release** so approval doesn't publish at a bad moment. **Phased release** doesn't apply to 1.0. |

## 3. Assets

**App icon** — ✅ light and dark 1024 masters. ⚠️ No **tinted** variant: on iOS 26+ the system
derives one, often badly. Apple's 2026 guidance is to build the icon in **Icon Composer** (a
layered `.icon` file that renders properly in Liquid Glass light, dark, clear and tinted). 🎨
It's worth a pass; the icon is the most-viewed asset.

**Screenshots** (PNG/JPEG, no transparency, 1–10 per size, more than half must show the app in use, 2.3.3):
- **iPhone 6.9" / large Dynamic Island: 1320 × 2868** (also accepted: 1290 × 2796, 1260 × 2736). Required.
- **iPhone 6.3" / medium Dynamic Island: 1206 × 2622** (or 1179 × 2556). Apple's page marks this one required, and also needs a large set. Upload both, made from the 17 Pro Max and 17 Pro simulators.
- **iPhone Duo** (foldable, out Oct 23): optional now, **required from April 2027** for builds made with the iOS 27.1 SDK, which this Mac uses. Outer 1398 × 2034, inner 2007 × 2853. Providing them gets an "optimized for iPhone Duo" badge. See §5 for the app side.
- **iPad**: not needed. The app is iPhone-only (`TARGETED_DEVICE_FAMILY: 1`).
- Must match the current UI, including Dark Mode if shown. Fictional or own data only, no real people's names (2.3.9). Short headline text over real screens is fine, but don't crowd out the UI. Skip prices, URLs, "#1" claims and other platforms' logos.
- Suggested story, 5–6 frames: (1) the map of a city full of saved places, (2) the share from a post → "Saved to Vicolo", (3) "Is this the place?" choosing, (4) a list post → "This post has 6 places", (5) Where / What grouping, (6) a place card → directions / Been there 😃. 🎨

**App preview video** (optional, up to 3, 15–30 s, screen capture of the app only, 2.3.4): the share-to-saved flow is the one thing a still can't show. Muted by default, so it must work silently.

**New in Oct 2026, optional:**
- **Product page header**: 21:9 at 3840 × 1646, or 16:9 at 5244 × 2950. Image or a 5–30 s looping video.
- **Search result asset**: 3:2, 1920 × 1280 to 3840 × 2560.

Both go through Apple's approval in the new **Asset Library**, must suit 4+, and should keep text short and inside the template's safe area (Figma, Photoshop and Pixelmator templates are on the asset best-practices page). Without one, search shows your screenshots. Nice to have, not needed for 1.0.

Use the new **product page preview tool** in App Store Connect (Dark Mode, devices) before submitting.

## 4. Privacy, told truthfully

What leaves the phone (from the code audit):

| Data | Where | Linked to a person? |
|---|---|---|
| The link the user shares/pastes | `/api/extract` (Apify reads it; image copied to Blob), `/api/list` | No |
| Place name + coordinates of a saved place | `/api/price`, `/api/photo`, `/api/search` (queries from the post, a city point, **not** the user's location) | No |
| Save reports: link, saved place name, what was offered, outcome, timings, build, random install id | `/api/saves` | No (random id, no account) |
| Usage counts per day (opens, view picks, seconds per screen), install id, build | `/api/uses` | No |
| The user's location | **never sent** | — |

Suggested App Privacy answers (all "not linked to the user", "not used for tracking"):
- **User Content → Other User Content** (links and saved places): App Functionality, Analytics
- **Usage Data → Product Interaction**: Analytics
- **Diagnostics → Other Diagnostic Data** (read errors in save reports): App Functionality / Analytics
- Location: **not collected**, because it never leaves the device.

Apple asks for data sent off the device even when it's anonymous. Under-declaring is a common
rejection reason and also a trust problem.

Also:
- ✅ Both `PrivacyInfo.xcprivacy` list these three types (2026-10-16). Keep the App Store Connect answers identical.
- **`/privacy` page**: add the Google search fallback, the photo lookup and the Google list import. Replace "Questions → TestFlight feedback" with a real contact. Add how long save reports and usage rows are kept, and how to ask for deletion: by install id, or "delete the app; nothing is tied to you" (5.1.1 i asks for retention and deletion).
- **Consent** (5.1.1 ii: usage data needs consent "even if anonymous"): save reports and usage counts run without asking today. Most apps with anonymous analytics pass with disclosure alone, but a reviewer can cite this. A safe pattern is a "Share anonymous usage to improve Vicolo" switch in Settings, on by default and disclosed. 🎨

**Age assurance** (Texas SB 2420 in force since 2026-06-04; similar laws elsewhere): Apple
collects the age and parental consent for downloads. The developer's part is mainly
"significant changes" (PermissionKit) and handling consent revocation. For a free 4+ app with no
accounts the exposure is low, and Apple's Q&A says review isn't changing. It's still not legal
advice: worth a look before a big update that changes what data is used.

## 5. Quality: what separates it from a half-done app

These aren't required, but they're what Apple's reviewers and editors notice.

**Accessibility.** "Accessibility Nutrition Labels" on the product page are voluntary for now
(Apple says it will become required "over time" with notice). Claim only what passes Apple's
evaluation criteria.
- VoiceOver: 20 `accessibilityLabel`s across ~6,900 lines. Every icon-only button, map pin, photo tile and the + menu needs a label. Run Accessibility Inspector's audit on each screen.
- Dynamic Type: 105 semantic text styles, good. 15 fixed `.font(.system(size:))` don't scale. Use `@ScaledMetric` or text styles; test at the largest size.
- Reduce Motion: honoured in 2 of the files with 27 `withAnimation` calls. The splash fade, success card and sheets should respect it.
- Dark Mode: ✅ throughout. Contrast: check the type tints and grey secondary text.
- Labels then to claim: VoiceOver, Larger Text, Dark Interface, Reduced Motion, Sufficient Contrast. Leave out Captions and Audio Descriptions (not applicable).

**iPhone Duo** (ships 2026-10-23; builds with the iOS 27.1 SDK resize to the inner display).
- The app is portrait-only with `UIRequiresFullScreen`. Test it in Xcode 27.1's iPhone Duo simulator and the resizable simulator in Device Hub.
- Map, cards and tiles should use the extra width. Watch the aspect-fill photos (`PlacePhoto`), which Apple names as a crop risk.
- The only `UIScreen.main` use is a theme read in `SplashView.swift:22`. That's fine, but switch it to the scene's traits.
- Not a gate until April 2027, but launch-week apps that look good on Duo are what Apple features.

**Ship-clean build.**
- ✅ The testing launch arguments are Debug-only (`Views/TestArgs.swift`, 2026-10-16).
- Menu → What's new opens the tester changelog with "Build N". For the store, either a user-facing "What's new" (or none at 1.0) or keep it if Sarp likes it. 🎨
- Crash-free: TestFlight → Crashes, and Xcode Organizer for 1.0 (29). Fix anything there first.
- Launch performance: the 1.2 s splash hold is fine; the app must not hang on a slow network at launch.

**Localization**: English only is fine. Swedish later is cheap, and localized screenshots go per language.

**What Apple's editors like** (for a later featuring nomination in App Store Connect → Featuring):
native Liquid Glass ✅, Dark Mode ✅, a share extension ✅, MapKit ✅, on-device Vision for list
posts ✅ (a good story: "reads the slides on your phone"). Next steps that fit the product: App
Intents / Shortcuts ("Save this link to Vicolo"), a widget ("places near you"), iPhone Duo layout.
Submit the nomination about 3 weeks before a launch date.

## 6. Review notes (App Review Information)

Reviewers often don't have Instagram set up. Make the core flow testable without it:
- One paragraph on what Vicolo does.
- **How to test without Instagram**: tap + → Instagram post → paste a link. Give 3 links that save themselves: Ästad Vingård `https://www.instagram.com/p/DdJIacKIplU/`, a TikTok with a location tag, a Google Maps place link. Plus one list post (Oslo carousel `C_OOWiDS7Gh`) for the multi-place flow, and a Google Maps shared list link for import. Check every one still exists the day you submit.
- **Share extension**: Safari → Share → Vicolo also works.
- **Why location**: to open on the town you're in. It's asked only after 2 saved places, behind a one-button primer with no skip (to match 5.1.1).
- **Third-party content**: the app reads only the single public post the user chose to share, shows its picture as the user's own reminder with a link back to the original post, and doesn't let users download media.
- A contact phone and email for the reviewer. Sign-in: not required.

## 7. The real rejection risks, ranked

1. **5.2.2 / 5.2.1: third-party content.** "If your app uses, accesses… or displays content from a third-party service, ensure that you are specifically permitted to do so under the service's terms." Vicolo reads Instagram posts through Apify (scraping), copies the post image to our Blob storage, and reads Google Maps lists through an unofficial endpoint. Instagram's and Google's terms don't permit scraping. Reviewers don't always probe this, but it is the most likely serious rejection, and it can come later (a complaint from Meta). What lowers the risk:
   - Frame it as user-initiated: one link the user shares, like a read-later app.
   - Always link back to the original post. Show the image as a small thumbnail, not a feed.
   - Never redistribute it.
   - Fall back gracefully (typing the place) when a read fails.
   - Longer term: oEmbed/official APIs where they exist (TikTok oEmbed is already used).

   🎨/CTO call on how far to go before 1.0; at least be ready with the review-note wording above.
2. **5.1.1 / 5.1.2: privacy mismatch.** The App Privacy label, the privacy page, the manifest and the actual traffic must agree (§4). This is cheap to fix and a common rejection.
3. **1.5 / 5.1.1: no privacy or contact link in the app.** A guaranteed rejection today. Cheap.
4. **4.2 minimum functionality / 4.3 spam** (rewritten June 2026: "indistinguishable from what's widely available"). Low risk: native map, share extension, on-device reading and grouping are clearly more than a wrapper. Say so in the review notes.
5. **2.3.10 / trademarks in screenshots and the tutorial.** The tutorial shows Instagram's share sheet. That's acceptable as instructions, but don't put the Instagram logo or name in the icon, name, subtitle or screenshot headlines.
6. **Backend under review load**: Apify's 5 concurrent runs, Vercel firewall challenges, Google's 200-a-day fallback cap. A reviewer's failed save counts as "app doesn't work" (2.1).

## 8. Order of work

1. ⬜ App Store Connect: create the app record (name check), **DSA trader declaration** (slow), age rating, App Privacy.
2. ⚠️ Code, one build (privacy manifests and debug args are done):
   - Privacy + Contact/Help in the menu 🎨
   - accessibility pass
   - Duo check
   - What's new decision 🎨
3. ⚠️ Web:
   - `/privacy` rewrite
   - `/support` page
4. 🎨 Icon Composer icon (tinted), screenshots, optional preview video, optional header asset.
5. ⬜ Metadata, review notes, manual release → submit. Keep TestFlight testers on the same build.
6. After approval: release, then a featuring nomination for the next update (Duo, widget).

## Sources
- Apple, Upcoming requirements: https://developer.apple.com/news/upcoming-requirements/
- Apple, Developer news (iOS 27 submissions, iPhone Duo, creative assets, age rating social media questions, Texas): https://developer.apple.com/news/
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Creative assets specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications
- Asset best practices: https://developer.apple.com/app-store/asset-best-practices/
- Guideline 2.3.3 screenshots: https://developer.apple.com/help/app-review/guideline-reference/2-3-3-screenshots
- iPhone Duo prep: https://developer.apple.com/iphone-duo/prepare/
- Age assurance Q&A: https://developer.apple.com/support/age-assurance
- Accessibility Nutrition Labels: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels
- 2026 guideline changes (secondary): https://www.macobserver.com/news/apple-app-review-guidelines-2026-changes-explained/
- DSA verification delays (forum reports): https://developer.apple.com/forums/thread/843545, https://developer.apple.com/forums/thread/848065
