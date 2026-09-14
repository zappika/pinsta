/** One-off: find a photo for rows saved before images were copied to Blob. */
import { eq, isNull } from "drizzle-orm";
import { getDb } from "../lib/db";
import { places } from "../lib/db/schema";
import { findPhoto } from "../lib/photo";

const db = getDb();
const rows = await db.select().from(places).where(isNull(places.imageUrl));
for (const r of rows) {
  const url = await findPhoto(r.instagramUrl, r.placeId);
  if (url) await db.update(places).set({ imageUrl: url }).where(eq(places.id, r.id));
  console.log(`${r.name} → ${url ?? "still nothing"}`);
}
console.log(`done: ${rows.length} rows`);
