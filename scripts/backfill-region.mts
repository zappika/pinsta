/** One-off: fill `region` for rows saved before the column existed. */
import { isNull } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { places } from "../lib/db/schema";
import { getPlace } from "../lib/google-places";

const db = getDb();
const rows = await db.select().from(places).where(isNull(places.region));
for (const r of rows) {
  const p = await getPlace(r.placeId);
  await db.update(places).set({ region: p.region }).where(eq(places.id, r.id));
  console.log(`${r.name} → ${r.city ?? "?"}, ${p.region ?? "—"}`);
}
console.log(`done: ${rows.length} rows`);
