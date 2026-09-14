"use client";

import { useEffect, useState } from "react";
import { appleMapsUrl, googleMapsUrl } from "@/lib/maps";
import type { Place } from "./types";

type Props = {
  place: Place;
  /** Active filters: what the header already says isn't repeated on the card. */
  hideCategory?: boolean;
  hideCity?: boolean;
  /** Shorter photo — for the PeekCard floating over map or tiles. */
  compact?: boolean;
};

export default function PlaceCard({ place, hideCategory, hideCity, compact }: Props) {
  const [showPost, setShowPost] = useState(false);
  const meta = [hideCategory ? null : place.category, hideCity ? null : place.city]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {place.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={place.imageUrl} alt="" draggable={false} className={`${compact ? "h-32" : "h-44"} w-full bg-stone-100 object-cover`} />
      )}
      <div className="px-4 pt-4">
        <h3 className="truncate text-base font-semibold">{place.name}</h3>
        {meta && <p className="mt-0.5 text-sm text-stone-500">{meta}</p>}
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-stone-100 border-t border-stone-100 text-sm font-medium">
        <a
          href={googleMapsUrl(place.name, place.placeId)}
          target="_blank"
          rel="noreferrer"
          className="py-3 text-center text-stone-800 active:bg-stone-50"
        >
          Google Maps
        </a>
        <a
          href={appleMapsUrl(place.name, place.lat, place.lng)}
          target="_blank"
          rel="noreferrer"
          className="py-3 text-center text-stone-800 active:bg-stone-50"
        >
          Apple Maps
        </a>
        <button
          type="button"
          onClick={() => setShowPost((s) => !s)}
          className="py-3 text-center text-stone-800 active:bg-stone-50"
        >
          {showPost ? "Hide post" : "Post"}
        </button>
      </div>

      {showPost && <InstagramEmbed url={place.instagramUrl} />}
    </>
  );
}

/**
 * Instagram's public embed.js — no token needed. It scans for
 * `.instagram-media` blockquotes and swaps them for iframes.
 */
function InstagramEmbed({ url }: { url: string }) {
  useEffect(() => {
    const w = window as Window & { instgrm?: { Embeds: { process: () => void } } };
    if (w.instgrm) {
      w.instgrm.Embeds.process();
      return;
    }
    if (document.querySelector('script[src*="instagram.com/embed.js"]')) return;
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    document.body.appendChild(s);
  }, [url]);

  return (
    <div className="border-t border-stone-100 bg-stone-50 p-2">
      <blockquote
        className="instagram-media !m-0 !min-w-0 !max-w-full !rounded-xl !border-0 !shadow-none"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
      >
        <a href={url} target="_blank" rel="noreferrer" className="block p-3 text-sm text-stone-500">
          Open on Instagram
        </a>
      </blockquote>
    </div>
  );
}
