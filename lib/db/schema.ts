import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  integer,
  jsonb,
  timestamp,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * A saved place, sourced from an Instagram post.
 *
 * `country` / `city` / `category` are populated at save time from the Google
 * Places response so the list can be navigated by location and category.
 */
export const places = pgTable("places", {
  id: uuid("id").primaryKey().defaultRandom(),
  instagramUrl: text("instagram_url").notNull(),
  name: text("name").notNull(),
  placeId: text("place_id").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  formattedAddress: text("formatted_address"),
  country: text("country"),
  city: text("city"),
  // State / county / län. Used to group places whose town is too small to stand alone.
  region: text("region"),
  primaryType: text("primary_type"),
  category: text("category"),
  // 1–4 ($ to $$) from Google's priceLevel; null when Google doesn't know.
  priceLevel: integer("price_level"),
  // The venue's website from Google, from 2026-10-06 on (no backfill). Often its Instagram.
  website: text("website"),
  note: text("note"),
  // Phase 4: pulled from the post itself at save time
  imageUrl: text("image_url"),
  caption: text("caption"),
  igLocationName: text("ig_location_name"),
  ownerUsername: text("owner_username"),
  // Imported from a shared Google Maps list: which one and whose, for the card's
  // "why it's here" line. Only imports from 2026-10-06 on have it.
  fromList: jsonb("from_list").$type<{ title: string | null; owner: string | null }>(),
  // Been there: when it was marked (not shown yet; "Want to go" is null). Going back
  // to Want to go clears it but keeps the rating, so a slip loses nothing.
  visitedAt: timestamp("visited_at", { withTimezone: true }),
  // How it was, after Been there: 1 😞 2 🙂 3 😃. Null = not said.
  rating: integer("rating"),
  // More posts of the same place, saved later. The first post stays in the columns above.
  posts: jsonb("posts").$type<ExtraPost[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ExtraPost = {
  instagramUrl: string;
  imageUrl: string | null;
  caption: string | null;
  ownerUsername: string | null;
  igLocationName: string | null;
  addedAt: string;
};

export type Place = typeof places.$inferSelect;

/**
 * Paid API calls per day and service (lib/usage.ts), for the Usage sheet:
 * Google bills per call with a free monthly allowance, so a count is enough
 * to estimate the bill. One row per day and service, bumped +1 per call.
 */
export const usage = pgTable(
  "usage",
  {
    day: date("day").notNull(),
    service: text("service").notNull(),
    calls: integer("calls").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.service] })],
);

/**
 * The Google import's memory (app/api/import/google): which Google place a list
 * entry turned out to be, keyed by the entry's name and pin. Reading a list is
 * free; the search per entry isn't, so re-reading a list, or a second list with
 * the same places, asks Google only about entries it hasn't seen. `match` null =
 * Google had nothing within reach. Kept 30 days (MATCH_DAYS there), Google's
 * limit for keeping its coordinates.
 */
export const listMatches = pgTable("list_matches", {
  key: text("key").primaryKey(),
  match: jsonb("match").$type<{ placeId: string; name: string; city: string | null; category: string } | null>(),
  matchedAt: timestamp("matched_at", { withTimezone: true }).notNull().defaultNow(),
});
