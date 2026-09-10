"use client";

import { useEffect, useState } from "react";
import { appleMapsUrl, googleMapsUrl } from "@/lib/maps";
import type { Place } from "./types";

type Props = { place: Place; onDelete: () => void };

export default function PlaceCard({ place, onDelete }: Props) {
  const [showPost, setShowPost] = useState(false);
  const meta = [place.category, place.city].filter(Boolean).join(" · ");

  return (
    <li className="overflow-hidden rounded-2xl bg-white">
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{place.name}</h3>
            {meta && <p className="mt-0.5 text-sm text-stone-500">{meta}</p>}
          </div>
          <button
            type="button"
            aria-label="Remove"
            onClick={() => {
              if (confirm(`Remove ${place.name}?`)) onDelete();
            }}
            className="-mr-2 -mt-1 rounded-full p-2 text-stone-300 active:bg-stone-100 active:text-stone-500"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        {place.formattedAddress && (
          <p className="mt-2 text-sm leading-snug text-stone-600">{place.formattedAddress}</p>
        )}
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
    </li>
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
