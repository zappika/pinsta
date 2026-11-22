"use client";

// Design sandbox for the floating place card (Sarp, 2026-11-22: "why is this on my list?"). Every
// way a place gets onto the list, side by side, on the real PlaceCard with made-up rows. Nothing
// is read or saved; Want to go / Been there and the faces work on the page only. Visits (check-ins
// with notes and photos) exist only on iOS so far: this is where their look is settled first.

import { useState } from "react";
import PlaceCard, { type CardVisit, type VisitChange } from "./PlaceCard";
import type { Place } from "./types";

const PHOTO = "/lab/post.jpg";
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

function row(p: Partial<Place>): Place {
  return {
    id: crypto.randomUUID(),
    instagramUrl: "https://www.instagram.com/p/DEMO/",
    name: "Casual Bakery",
    placeId: "demo",
    lat: 55.6,
    lng: 13.0,
    formattedAddress: null,
    country: "Sweden",
    city: "Malmö",
    region: null,
    primaryType: "bakery",
    category: "Bakery",
    priceLevel: 2,
    website: null,
    note: null,
    imageUrl: PHOTO,
    caption: null,
    igLocationName: null,
    ownerUsername: null,
    fromList: null,
    visitedAt: null,
    rating: null,
    savedNearby: false,
    askedAt: null,
    askCount: 0,
    posts: [],
    createdAt: daysAgo(40),
    ...p,
  } as Place;
}

type Case = { title: string; place: Place; visits?: CardVisit[] };

const CASES: Case[] = [
  {
    title: "Post by the venue",
    place: row({
      ownerUsername: "_casualbakery_",
      caption: "sixers the first of many. Pastrami, pickles, crispy onions 🥪 #malmö #bakery",
      website: "https://www.instagram.com/_casualbakery_/",
    }),
  },
  {
    title: "Post by someone else",
    place: row({
      name: "The Blue Moon", category: "Bar", primaryType: "bar", city: "Paris", country: "France",
      ownerUsername: "ulyssezachary",
      caption: "📍 @thebluemoonparis\nJazz every night from 10pm, the best little bar in the 11th 🎷🎺 #paris #jazz",
      website: "https://www.instagram.com/thebluemoonparis/",
    }),
  },
  {
    title: "TikTok",
    place: row({
      name: "Bar Pimentel", category: "Bar", primaryType: "bar", city: "Barcelona", country: "Spain",
      instagramUrl: "https://www.tiktok.com/@eatwithmar/video/123",
      ownerUsername: "eatwithmar",
      caption: "The vermouth spot locals don't want you to know about 🍸 Get the anchovies. #barcelona",
    }),
  },
  {
    title: "Two posts",
    place: row({
      name: "Casa Bonay", category: "Hotel", primaryType: "hotel", city: "Barcelona", country: "Spain", priceLevel: null,
      ownerUsername: "casabonay",
      caption: "Slow mornings on Gran Via ☕️ Our rooms are open for the winter season. #barcelona",
      website: "https://casabonay.com",
      posts: [{ instagramUrl: "https://www.instagram.com/p/DEMO2/", imageUrl: PHOTO, caption: "Rooftop season", ownerUsername: "barcelonafoodie", igLocationName: null, addedAt: daysAgo(3).toISOString() }],
    }),
  },
  {
    title: "From a friend's list",
    place: row({
      name: "Fugaz", category: "Bar", primaryType: "bar", city: "Barcelona", country: "Spain", imageUrl: null,
      instagramUrl: "https://www.google.com/maps/search/?api=1&query=Fugaz",
      fromList: { title: "Barcelona", owner: "Alexi Laiho" },
    }),
  },
  {
    title: "Typed its name",
    place: row({
      name: "Miss Misi", category: "Cafe", primaryType: "cafe", city: "Barcelona", country: "Spain", imageUrl: null,
      instagramUrl: "https://www.google.com/maps/search/?api=1&query=Miss+Misi&query_place_id=demo",
    }),
  },
  {
    title: "Saved when you were here (Check in)",
    place: row({
      name: "Café Charbon", category: "Restaurant", primaryType: "restaurant", city: "Paris", country: "France", imageUrl: PHOTO,
      instagramUrl: "https://www.google.com/maps/search/?api=1&query=Caf%C3%A9+Charbon&query_place_id=demo",
      savedNearby: true, createdAt: daysAgo(6), visitedAt: daysAgo(6), rating: 2,
      website: "https://lecafecharbon.fr",
    }),
    visits: [{ at: daysAgo(6).toISOString(), rating: 2, note: "Ask for the table by the window", photos: [PHOTO] }],
  },
  {
    title: "Been there, no date",
    place: row({ ownerUsername: "_casualbakery_", caption: "Cardamom buns out of the oven every morning at 8.", visitedAt: daysAgo(2), rating: 3 }),
  },
  {
    title: "Been 3 times",
    place: row({
      name: "The Blue Moon", category: "Bar", primaryType: "bar", city: "Paris", country: "France",
      ownerUsername: "ulyssezachary", caption: "Jazz every night from 10pm, the best little bar in the 11th 🎷",
      visitedAt: daysAgo(90), rating: 3,
    }),
    visits: [
      { at: null, rating: 3 },
      { at: daysAgo(40).toISOString(), rating: 3, photos: [PHOTO] },
      { at: daysAgo(2).toISOString(), rating: 3, note: "Jazz from 10pm, sit near the band", photos: [PHOTO, PHOTO] },
    ],
  },
];

export default function CardLab() {
  return (
    <main className="min-h-dvh bg-stone-200 px-4 pt-6 pb-28">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-lg font-semibold">Place card</h1>
        <p className="mt-1 max-w-xl text-sm text-stone-600">
          Why a place is on your list, in every way it can get there. Made-up rows on the real card;
          Want to go / Been there works here only.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map((c) => <Sample key={c.title} {...c} />)}
        </div>
      </div>
    </main>
  );
}

function Sample({ title, place: start, visits }: Case) {
  const [place, setPlace] = useState(start);
  const visit = (c: VisitChange) =>
    setPlace((p) => ({
      ...p,
      ...(c.visited !== undefined ? { visitedAt: c.visited ? new Date() : null } : {}),
      ...(c.rating !== undefined ? { rating: c.rating } : {}),
    }));
  return (
    <section>
      <p className="mb-2 text-xs font-medium tracking-wide text-stone-500 uppercase">{title}</p>
      <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-3xl bg-white shadow-lg">
        <PlaceCard place={place} expanded onVisit={visit} onEdit={() => {}} onDelete={() => {}} visits={place.visitedAt ? visits : []} />
      </div>
    </section>
  );
}
