"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { directions } from "@/lib/directions";
import { sourceKind } from "@/lib/sources";
import { priceLabel } from "@/lib/categories";
import type { Place } from "./types";

type Props = {
  place: Place;
  /** Active filters: what the header already says isn't repeated on the card. */
  hideCategory?: boolean;
  hideCity?: boolean;
  /** Shorter photo — for the PeekCard floating over map or tiles. */
  compact?: boolean;
  /** The pull-up sheet at full height: big photo. */
  expanded?: boolean;
  /** Given in the pull-up sheet: a ⋯ button offers Change place and Remove. */
  onEdit?: () => void;
  onDelete?: () => void;
};

export default function PlaceCard({ place, hideCategory, hideCity, compact, expanded, onEdit, onDelete }: Props) {
  const [showPosts, setShowPosts] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const allUrls = [place.instagramUrl, ...(place.posts ?? []).map((p) => p.instagramUrl)];
  // Google Maps links are the place, not a post: Directions covers them.
  const postUrls = allUrls.filter((u) => sourceKind(u) !== "google");
  const meta = [hideCategory ? null : place.category, priceLabel(place.priceLevel), hideCity ? null : place.city, postUrls.length > 1 ? `${postUrls.length} posts` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {place.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={place.imageUrl} alt="" loading="lazy" decoding="async" draggable={false} className={`${compact ? "h-32" : expanded ? "h-72" : "h-44"} w-full bg-stone-100 object-cover transition-[height] duration-[420ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none`} />
      )}
      {/* Name and type on the left; two round actions on the right. No button row. */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{place.name}</h3>
          {meta && (
            <p className="mt-0.5 truncate text-sm text-stone-500">{meta}</p>
          )}
        </div>
        <RoundAction label="Directions" onClick={() => directions(place)}>
          <path d="M21 3 3 10.5l7.5 3L13.5 21 21 3Z" />
        </RoundAction>
        {/* One post opens straight away; several list their links first. */}
        {postUrls.length > 0 && <RoundAction label={postUrls.length > 1 ? "Posts" : "Post"} active={showPosts} onClick={() => (postUrls.length > 1 ? setShowPosts((s) => !s) : openPost(postUrls[0]))}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
        </RoundAction>}
        {(onEdit || onDelete) && <RoundAction label="Change or remove" active={showMore} onClick={() => setShowMore((s) => !s)}>
          <circle cx="5.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="18.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </RoundAction>}
      </div>

      {showMore && (
        <div className="flex gap-2 px-4 pb-3.5">
          {onEdit && (
            <button type="button" onClick={onEdit} className="flex-1 rounded-xl bg-stone-100 py-2.5 text-sm font-medium text-stone-700 active:bg-stone-200">
              Change place
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} className="flex-1 rounded-xl bg-red-50 py-2.5 text-sm font-medium text-red-600 active:opacity-70">
              Remove
            </button>
          )}
        </div>
      )}

      {showPosts && (
        <div className="flex flex-wrap gap-2 px-4 pb-3.5">
          {postUrls.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="rounded-xl bg-stone-100 px-3.5 py-2.5 text-sm font-medium text-stone-700 active:bg-stone-200">
              Post {i + 1} · {sourceKind(u) === "tiktok" ? "TikTok" : "Instagram"}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function openPost(url: string) {
  window.open(url, "_blank", "noreferrer");
}

function RoundAction({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
        active ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 active:bg-stone-200"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

