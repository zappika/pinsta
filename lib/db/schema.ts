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
  note: text("note"),
  // Phase 4: pulled from the post itself at save time
  imageUrl: text("image_url"),
  caption: text("caption"),
  igLocationName: text("ig_location_name"),
  ownerUsername: text("owner_username"),
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
