"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { directions } from "@/lib/directions";
import { sourceKind } from "@/lib/sources";
import { priceLabel } from "@/lib/categories";
import { websiteLabel, whyHere } from "@/lib/why-here";
import type { Place } from "./types";

type Props = {
  place: Place;
  /** Active filters: what the header already says isn't repeated on the card. */
  hideCategory?: boolean;
  hideCity?: boolean;
  /** Shorter photo — for the PeekCard floating over map or tiles. */
  compact?: boolean;
  /** The floating place card: big photo, and the line saying why it's here. */
  expanded?: boolean;
  /** Given in the pull-up sheet: a ⋯ button offers Change place and Remove. */
  onEdit?: () => void;
  onDelete?: () => void;
  /** The floating card: Want to go ↔ Been there, then how it was. */
  onVisit?: (change: VisitChange) => void;
};

export type VisitChange = { visited?: boolean; rating?: number | null };

export default function PlaceCard({ place, hideCategory, hideCity, compact, expanded, onEdit, onDelete, onVisit }: Props) {
  const [showPosts, setShowPosts] = useState(false);
  const [showMore, setShowMore] = useState(false);
  // Been there with a face: the switch folds into that face among the round
  // actions; a tap on it opens the switch again to change it.
  const [visitOpen, setVisitOpen] = useState(false);
  const folded = place.visitedAt != null && place.rating != null && !visitOpen;
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
        {expanded && onVisit && folded && (
          <button
            type="button"
            aria-label={`Been there: ${FACES[place.rating! - 1]}. Change`}
            title={FACES[place.rating! - 1]}
            onClick={() => setVisitOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-800 active:bg-stone-200"
          >
            <Face kind={place.rating!} size={24} />
          </button>
        )}
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

      {expanded && (
        <p className="-mt-1.5 px-4 pb-3.5 text-sm text-stone-500">
          {whyHere(place)}
          {/* The venue's own site from Google: its Instagram as @handle (saves from 2026-10-06 on). */}
          {websiteLabel(place.website) && place.website && (
            <>
              {" · "}
              <a href={place.website} target="_blank" rel="noreferrer" className="font-medium text-stone-700 underline decoration-stone-300 underline-offset-2">
                {websiteLabel(place.website)}
              </a>
            </>
          )}
        </p>
      )}

      {expanded && onVisit && !folded && (
        <Visit
          place={place}
          onVisit={(c) => {
            onVisit(c);
            if (c.rating) setVisitOpen(false);
          }}
        />
      )}

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

/**
 * Two buttons that act as one switch: every place starts as Want to go. Been
 * there brings up how it was (😞 🙂 😃); picking one folds all this into that
 * face (see PlaceCard). The date is kept, not shown. Sarp, 2026-10-06.
 */
function Visit({ place, onVisit }: { place: Place; onVisit: (c: VisitChange) => void }) {
  const been = place.visitedAt != null;
  return (
    <div className="px-4 pb-4">
      <div role="radiogroup" aria-label="Want to go or been there" className="flex gap-2">
        <Choice on={!been} onClick={() => been && onVisit({ visited: false })}>Want to go</Choice>
        <Choice on={been} onClick={() => !been && onVisit({ visited: true })}>Been there</Choice>
      </div>
      {been && (
        <>
          <p className="mt-4 mb-2 text-sm text-stone-500">How was it?</p>
          <div role="radiogroup" aria-label="How was it" className="flex gap-2">
            {FACES.map((label, i) => (
              <Choice key={label} on={place.rating === i + 1} label={label} tall onClick={() => onVisit({ rating: i + 1 })}>
                <Face kind={i + 1} />
              </Choice>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export const FACES = ["Not good", "Good", "Loved it"];

function Choice({ on, onClick, label, tall, children }: { on: boolean; onClick: () => void; label?: string; tall?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center rounded-2xl text-sm font-medium transition-colors ${tall ? "h-16" : "h-12"} ${
        on ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 active:bg-stone-200"
      }`}
    >
      {children}
    </button>
  );
}

/** A filled face with its features cut out, so it reads on light and dark tiles alike. */
export function Face({ kind, size = 30 }: { kind: number; size?: number }) {
  // useId can hold ":" or "«»", which a url(#…) reference may not survive.
  const id = "face" + useId().replace(/[^\w-]/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <mask id={id}>
        <circle cx="12" cy="12" r="11" fill="white" />
        {kind === 3 ? (
          <>
            <path d="M8.5 6.8v3.4M6.8 8.5h3.4M15.5 6.8v3.4M13.8 8.5h3.4" stroke="black" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M6.5 12.5h11a5.5 5.5 0 0 1-11 0Z" fill="black" />
          </>
        ) : (
          <>
            <circle cx="8.5" cy="9.5" r="1.6" fill="black" />
            <circle cx="15.5" cy="9.5" r="1.6" fill="black" />
            <path d={kind === 1 ? "M7.5 17.5q4.5-4.5 9 0" : "M7.5 14q4.5 4.5 9 0"} stroke="black" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </>
        )}
      </mask>
      <circle cx="12" cy="12" r="11" fill="currentColor" mask={`url(#${id})`} />
    </svg>
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

