/** One-off, free: re-run `categorize` on stored primary types (new buckets, e.g. Culture). Pass --write to save. */
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { places } from "../lib/db/schema";
import { categorize } from "../lib/categories";

const write = process.argv.includes("--write");
const db = getDb();
let n = 0;
for (const r of await db.select().from(places)) {
  const next = categorize(r.primaryType);
  if (!r.primaryType || next === r.category || next === "Other") continue;
  n++;
  console.log(`${r.name}: ${r.category} → ${next} (${r.primaryType})`);
  if (write) await db.update(places).set({ category: next }).where(eq(places.id, r.id));
}
console.log(`${n} rows${write ? " updated" : " would change"}`);
