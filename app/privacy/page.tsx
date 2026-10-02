import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy · Vicolo",
  description: "What Vicolo does with your data.",
};

// Linked from TestFlight's beta info. Keep it true to what the app does:
// update it whenever data starts going somewhere new (accounts, sync, analytics).
export default function Privacy() {
  return (
    <main className="mx-auto max-w-xl px-5 py-12 text-stone-800 leading-relaxed">
      <h1 className="text-2xl font-semibold text-stone-900">Vicolo privacy</h1>
      <p className="mt-1 text-sm text-stone-500">Last updated 2 October 2026</p>

      <p className="mt-6">
        Vicolo saves places from Instagram, TikTok and Google Maps links to a list on your phone. There is no account, no
        sign-in, no ads and no tracking.
      </p>

      <h2 className="mt-8 font-semibold text-stone-900">What stays on your phone</h2>
      <p className="mt-2">
        Your list of places lives only on your device. We can’t see it. Deleting the app deletes the list.
      </p>

      <h2 className="mt-8 font-semibold text-stone-900">What leaves your phone</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5">
        <li>
          <strong>The link you save.</strong> It goes to Vicolo’s server, which reads the public post (caption, location
          tag, account name and image) so the app can find the place. We use Apify to read Instagram posts. The post’s
          image is copied to our storage so your list keeps a picture if the post disappears. We don’t keep a record of
          who saved which link.
        </li>
        <li>
          <strong>Place searches.</strong> To match a post to a real place, your phone searches Apple Maps.
        </li>
        <li>
          <strong>Price level.</strong> For restaurants, cafes, bars and bakeries, the place’s name and map position
          (not yours) go to Vicolo’s server, which asks Google for its price level ($ to $$).
        </li>
        <li>
          <strong>Directions.</strong> When you ask for directions, Vicolo opens Apple Maps or Google Maps with that
          place, and that app’s own privacy policy applies.
        </li>
      </ul>

      <h2 className="mt-8 font-semibold text-stone-900">Location</h2>
      <p className="mt-2">
        Vicolo opens on <em>Near me</em>, so it asks for your location when you first open it. Your location is used on
        the phone to show saved places within 50 km, and is never stored or sent anywhere. If you say no, the app opens
        on your whole list instead.
      </p>

      <h2 className="mt-8 font-semibold text-stone-900">Questions</h2>
      <p className="mt-2">Use the feedback option in TestFlight, or the email listed there.</p>
    </main>
  );
}
