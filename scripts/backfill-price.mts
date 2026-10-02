/**
 * One-off: fill `price_level` for rows saved before the column existed.
 * One Place Details call per row on Google's Enterprise tier (1,000 free a month).
 */
import { eq, isNull } from "drizzle-orm";
import { getDb } from "../lib/db";
import { places } from "../lib/db/schema";
import { getPlace } from "../lib/google-places";

const db = getDb();
const rows = await db.select().from(places).where(isNull(places.priceLevel));
for (const r of rows) {
  const p = await getPlace(r.placeId, { price: true }).catch(() => null);
  if (!p?.priceLevel) continue;
  await db.update(places).set({ priceLevel: p.priceLevel }).where(eq(places.id, r.id));
  console.log(`${r.name} → ${"$".repeat(p.priceLevel)}`);
}
console.log(`done: ${rows.length} rows checked`);
