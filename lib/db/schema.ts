import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  timestamp,
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
  note: text("note"),
  // Phase 4: pulled from the post itself at save time
  imageUrl: text("image_url"),
  caption: text("caption"),
  igLocationName: text("ig_location_name"),
  ownerUsername: text("owner_username"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
