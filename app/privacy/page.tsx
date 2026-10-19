import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Privacy · Vicolo",
  description: "What Vicolo does with your data.",
};

// The App Store's privacy policy URL, and the app's menu → Privacy. Keep it true to what the app does:
// update it whenever data starts going somewhere new (accounts, sync, analytics). The App Store
// Connect "App Privacy" answers and both ios/*/PrivacyInfo.xcprivacy must say the same
// (docs/app-store.md §4).
export default function Privacy() {
  return (
    <main className="mx-auto max-w-xl px-5 py-12 text-stone-800 leading-relaxed">
      <h1 className="text-2xl font-semibold text-stone-900">Vicolo privacy</h1>
      <p className="mt-1 text-sm text-stone-500">Last updated 16 October 2026</p>

      <p className="mt-6">
        Vicolo is an iPhone app that saves places from Instagram, TikTok and Google Maps links to a list on your phone.
        There is no account, no sign-in, no ads and no tracking. Vicolo doesn’t sell or share your data for advertising,
        and doesn’t use it to build a profile of you.
      </p>
      <p className="mt-3">Vicolo is made by Sarper Erel, who is responsible for the data described here.</p>

      <h2 className="mt-8 font-semibold text-stone-900">What stays on your phone</h2>
      <p className="mt-2">
        Your list of places, your Been there marks and your settings live only on your device. We can’t see them.
        Deleting the app deletes them.
      </p>

      <h2 className="mt-8 font-semibold text-stone-900">What leaves your phone</h2>
      <p className="mt-2">None of this carries your name, an account or your location.</p>
      <ul className="mt-2 list-disc space-y-2 pl-5">
        <li>
          <strong>The link you save.</strong> It goes to Vicolo’s server, which reads the public post (caption, location
          tag, account name and pictures) so the app can find the place. We use Apify to read Instagram posts; TikTok
          and Google Maps links are read directly. The post’s picture is copied to our storage so your list keeps a
          picture if the post disappears. We don’t keep a record of who saved which link.
        </li>
        <li>
          <strong>Place searches.</strong> To match a post or a name you type to a real place, your phone searches
          Apple Maps. When Apple Maps finds nothing, or you tap “None of these”, a few words from the post (or what you
          typed) and the post’s town go to Vicolo’s server, which asks Google for places.
        </li>
        <li>
          <strong>Google Maps lists.</strong> When you import a shared Google Maps list, its link goes to Vicolo’s
          server, which reads the list and asks Google for each of its places; the list and what was found are kept
          there for two weeks so the import can finish while the app is closed. If you allow notifications, the app
          also sends a notification token, used once to say the import is ready and then deleted. For imported places
          without a picture, the place’s name and map position go to
          our server, which asks Google for a photo of it.
        </li>
        <li>
          <strong>Price level.</strong> For restaurants, cafes, bars and bakeries, the place’s name and map position
          (not yours) go to Vicolo’s server, which asks Google for its price level ($ to $$$$).
        </li>
        <li>
          <strong>How a save went.</strong> After each save, the app tells Vicolo’s server how it ended: the link, the
          place it saved (or that you gave up), what it suggested, any error reading the post, how long it took, and
          the app’s version. It carries a random number made on your phone, so several saves can be seen as one phone,
          but no name, account or list. It is used only to find the posts Vicolo gets wrong.
        </li>
        <li>
          <strong>How the app is used.</strong> A few counts per day: how often the app was opened, which views (map,
          list, cards, tiles) you picked and how long each screen was open. They carry the same random number, never
          places, links, names or where you are. They are used only to decide what to improve.
        </li>
        <li>
          <strong>Turning those two off.</strong> In Vicolo’s Settings, switch off “Help improve Vicolo”: save reports
          and usage counts stop, and any not yet sent are deleted from your phone.
        </li>
        <li>
          <strong>Directions.</strong> When you ask for directions, Vicolo opens Apple Maps or Google Maps with that
          place, and that app’s own privacy policy applies.
        </li>
      </ul>

      <h2 className="mt-8 font-semibold text-stone-900">Location</h2>
      <p className="mt-2">
        Once you have saved two places, Vicolo asks for your location so it can open on the town you are in and show
        where you are on the map. Your location is used only on the phone and is never stored or sent anywhere. If you
        say no, the app opens on your whole list instead. You can change this any time in the iPhone’s Settings →
        Vicolo → Location.
      </p>

      <h2 className="mt-8 font-semibold text-stone-900">Who handles it</h2>
      <p className="mt-2">
        Vicolo’s server runs on Vercel, with its database at Neon and pictures in Vercel Blob storage. Apify reads
        Instagram posts; Google answers place, photo and price questions; Apple Maps answers searches on the phone.
        They process this data only to provide those services to Vicolo.
      </p>

      <h2 className="mt-8 font-semibold text-stone-900">How long, and how to remove it</h2>
      <p className="mt-2">
        Save reports and usage counts are kept as long as they help improve Vicolo. Because they aren’t tied to a name
        or account, we can’t look yours up by who you are; deleting the app stops anything more being sent. If you want
        a link or picture you saved removed from our server, or have a question about your data, email us with the
        link and we’ll delete it. You can also ask what we hold and complain to your data protection authority.
      </p>

      <h2 className="mt-8 font-semibold text-stone-900">Children</h2>
      <p className="mt-2">Vicolo isn’t made for children and doesn’t knowingly collect anything about them.</p>

      <h2 className="mt-8 font-semibold text-stone-900">Changes</h2>
      <p className="mt-2">If what Vicolo does with data changes, this page changes first, with a new date at the top.</p>

      <h2 className="mt-8 font-semibold text-stone-900">Questions</h2>
      <p className="mt-2">
        Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        . More help is on the{" "}
        <a href="/support" className="underline underline-offset-4">
          support page
        </a>
        .
      </p>
    </main>
  );
}
