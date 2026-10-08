import type { Metadata } from "next";

const TITLE = "Vicolo";
const PITCH = "Save the places you find on Instagram, TikTok and Google Maps to your own map.";

// Rich link previews (iMessage, WhatsApp) read these; the image is app/opengraph-image.tsx.
export const metadata: Metadata = {
  metadataBase: new URL("https://vicolo.space"),
  title: TITLE,
  description: PITCH,
  openGraph: { title: TITLE, description: PITCH, url: "https://vicolo.space", siteName: TITLE, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: PITCH },
};

// vicolo.space — a placeholder until the real marketing page.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-12 text-stone-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/elephant-resin.png" alt="" width={96} height={96} className="-ml-2" />
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-900">{TITLE}</h1>
      <p className="mt-3 text-lg leading-relaxed text-stone-600">{PITCH}</p>
      <p className="mt-2 text-stone-500">An iPhone app, in a small beta with friends.</p>
      <nav className="mt-10 text-sm text-stone-500">
        <a href="/privacy" className="underline underline-offset-4">Privacy</a>
      </nav>
    </main>
  );
}
