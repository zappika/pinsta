import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Help · Vicolo",
  description: "How to save places with Vicolo, and how to reach us.",
};

// The App Store's support URL, and the app's menu → Help. Keep the steps true to the app
// (the tutorial in ios/Pinsta/Views/EmptyTutorial.swift says the same in pictures).
export default function Support() {
  return (
    <main className="mx-auto max-w-xl px-5 py-12 text-stone-800 leading-relaxed">
      <h1 className="text-2xl font-semibold text-stone-900">Vicolo help</h1>
      <p className="mt-6">
        Vicolo saves the places you find on Instagram, TikTok and Google Maps to one list on your phone, on a map, with
        directions a tap away.
      </p>

      <h2 className="mt-8 font-semibold text-stone-900">Save a place from Instagram</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>On the post, tap Share (the paper plane).</li>
        <li>
          Tap <strong>Share to…</strong> at the end of the row of apps.
        </li>
        <li>Pick Vicolo. If it isn’t there, see below.</li>
      </ol>
      <p className="mt-2">
        Vicolo reads the post and finds the place. When it isn’t sure, it shows a few places to pick from. TikTok and
        Google Maps work the same way from their Share buttons.
      </p>

      <h2 className="mt-8 font-semibold text-stone-900">Other ways to save</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Copy a link, open Vicolo, tap + and Paste.</li>
        <li>Tap + and type a place’s name or an @handle.</li>
        <li>Tap + → Google Maps and paste a shared Google Maps list to bring in all of it.</li>
      </ul>

      <h2 className="mt-8 font-semibold text-stone-900">Common questions</h2>
      <dl className="mt-2 space-y-4">
        <div>
          <dt className="font-medium text-stone-900">Vicolo isn’t in the share sheet</dt>
          <dd className="mt-1">
            In the phone’s share sheet, scroll the row of apps to the end and tap More, then Edit. Add Vicolo to
            Favorites so it is always near the front.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-stone-900">It says it couldn’t read the post</dt>
          <dd className="mt-1">
            Private and deleted posts can’t be read, and sometimes Instagram is slow to answer. Try again in a minute, or
            type the place’s name instead.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-stone-900">It saved the wrong place</dt>
          <dd className="mt-1">Open the place, tap ⋯, then Change place.</dd>
        </div>
        <div>
          <dt className="font-medium text-stone-900">How do I remove a place?</dt>
          <dd className="mt-1">Open it, tap ⋯, then Remove. In Cards you can also swipe it to the left.</dd>
        </div>
        <div>
          <dt className="font-medium text-stone-900">Is my list backed up?</dt>
          <dd className="mt-1">
            Not yet. The list lives only on your phone, so deleting the app deletes it.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-stone-900">Why does it ask for my location?</dt>
          <dd className="mt-1">
            To open on the town you are in. Your location never leaves the phone. Without it, Vicolo opens on your whole
            list.
          </dd>
        </div>
      </dl>

      <h2 className="mt-8 font-semibold text-stone-900">Contact</h2>
      <p className="mt-2">
        Something not working, a post it gets wrong, or an idea? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        . A link to the post helps a lot.
      </p>
      <p className="mt-6 text-sm text-stone-500">
        <a href="/privacy" className="underline underline-offset-4">
          Privacy
        </a>
      </p>
    </main>
  );
}
