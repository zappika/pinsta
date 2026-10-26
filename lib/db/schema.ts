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
  boolean,
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
  // Saved within ~150 m of where you stood ("Around you", or any save that close): asked
  // "Been there?" on a later day, not a week on (lib/ask-visit.ts, Sarp 2026-10-26).
  savedNearby: boolean("saved_nearby").notNull().default(false),
  // When "Been to any of these?" last showed it, and how often (twice at most).
  askedAt: timestamp("asked_at", { withTimezone: true }),
  askCount: integer("ask_count").notNull().default(0),
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

/**
 * How each save on a phone ended (POST /api/saves, the Saves page on the
 * backoffice): the beta's failures without waiting for someone to report them.
 * One row per save sheet that had a link or a name, sent by the iOS app.
 * Anonymous: `install` is a random id made on the phone, no name, no list.
 * `id` comes from the phone, so a report sent twice is stored once.
 */
export const saves = pgTable("saves", {
  id: uuid("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  install: text("install").notNull(),
  build: integer("build"),
  url: text("url"),
  outcome: text("outcome").notNull(),
  detail: jsonb("detail").$type<SaveDetail>().notNull().default({}),
});

/** What the phone saw on the way (`ios/Pinsta/Services/SaveReport.swift`). */
export type SaveDetail = {
  /** Null when the post was read; the reader's error otherwise. */
  readError?: string | null;
  /** Where the suggestions came from: tag, account, link, search. */
  source?: string | null;
  offered?: number;
  /** 0-based position of the saved suggestion. */
  rank?: number | null;
  /** The saved place came from Google, not Apple. */
  google?: boolean;
  /** A list post: places found, places saved. */
  listed?: number;
  saved?: number;
  /** What the sheet was asking when it closed without a save. */
  step?: string;
  place?: string | null;
  seconds?: number;
  /** In-app sheet or the share sheet. */
  via?: "app" | "share";
};

export type Save = typeof saves.$inferSelect;

/**
 * How the app is used (Sarp, 2026-10-16: "I catch myself using the other views a lot less than
 * the map"). Per install and day, running totals the phone sends (`ios/Pinsta/Services/Uses.swift`):
 * `open`, `pick.<view>` (a tap on the view pill), `sec.<screen>` (seconds on screen: map, list,
 * cards, tiles, tutorial). Anonymous like `saves`: a random install id, no names, no list.
 * The phone resends a day's totals as they grow, so a row takes the larger count, never adds.
 */
export const uses = pgTable(
  "uses",
  {
    day: date("day").notNull(),
    install: text("install").notNull(),
    event: text("event").notNull(),
    count: integer("count").notNull().default(0),
    build: integer("build"),
  },
  (t) => [primaryKey({ columns: [t.day, t.install, t.event] })],
);

export type Use = typeof uses.$inferSelect;

/**
 * Sarp's names for the phones that report (Pulse on the backoffice): an install id is a random
 * string, so this is where "Mert" or "my iPhone" lives. Owner-only, never sent by a phone; the
 * names stay in the database, not the public repo. `me` leaves Sarp's own phones (and the
 * simulator) out of Pulse's numbers.
 */
export const installs = pgTable("installs", {
  install: text("install").primaryKey(),
  label: text("label"),
  me: boolean("me").notNull().default(false),
});

export type Install = typeof installs.$inferSelect;

/**
 * A Google Maps list the iOS app is importing (`lib/import-jobs.ts`, Sarp 2026-10-19): matched
 * here, a chunk at a time, so it finishes with the phone in a pocket; a push says it's ready.
 * `matches` grows in the order of `entries` (`done` of `total` so far; null = not found).
 * `token` is the phone's APNs device token, cleared once the push is sent; no account, no name.
 * `runningUntil` is a lease: a chunk runs only when no other holds the job.
 */
export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  link: text("link").notNull(),
  title: text("title"),
  owner: text("owner"),
  entries: jsonb("entries").$type<ImportEntry[]>().notNull(),
  matches: jsonb("matches").$type<(ImportMatch | null)[]>().notNull().default([]),
  done: integer("done").notNull().default(0),
  total: integer("total").notNull(),
  status: text("status").$type<"matching" | "ready" | "failed">().notNull().default("matching"),
  token: text("token"),
  sandbox: boolean("sandbox").notNull().default(false),
  install: text("install"),
  runningUntil: timestamp("running_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ImportEntry = { name: string; note: string | null; address: string | null; lat: number; lng: number };
export type ImportMatch = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  category: string;
  primaryType: string | null;
};
export type ImportJob = typeof importJobs.$inferSelect;

/**
 * Places sent to a friend (Sarp, 2026-10-26): the first thing that leaves the private list.
 * A copy of what was picked, behind a link nobody can guess (`/w/<id>`, public, no account):
 * never the list itself, and it doesn't change after sending. `walk` = in this order (numbered,
 * a dotted line, minutes on foot); `list` = no order ("my Helsinki restaurant tips").
 * Disposable: it lives in Sent, never on the map; the places in it are saved only if picked.
 */
export const sends = pgTable("sends", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<"walk" | "list">().notNull(),
  title: text("title").notNull(),
  from: text("from"),
  stops: jsonb("stops").$type<SendStop[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SendStop = {
  name: string;
  placeId: string | null;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  category: string | null;
  primaryType: string | null;
  priceLevel: number | null;
  imageUrl: string | null;
  /** The sender's line ("get the Spezial"). */
  note: string | null;
};
export type Send = typeof sends.$inferSelect;
