/**
 * One-off: fold a duplicate card into another. The duplicate's post (and any
 * extra posts) move onto the kept card, then the duplicate row is deleted.
 * Usage: npx tsx scripts/merge-places.mts "<keep name>" "<duplicate name>"
 */
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { places } from "../lib/db/schema";

const [keepName, dupName] = process.argv.slice(2);
const db = getDb();
const rows = await db.select().from(places);
const keep = rows.find((r) => r.name === keepName);
const dup = rows.find((r) => r.name === dupName);
if (!keep || !dup) throw new Error(`not found: ${!keep ? keepName : dupName}`);

const moved = [
  { instagramUrl: dup.instagramUrl, imageUrl: dup.imageUrl, caption: dup.caption, ownerUsername: dup.ownerUsername, igLocationName: dup.igLocationName, addedAt: dup.createdAt.toISOString() },
  ...dup.posts,
].filter((p) => p.instagramUrl !== keep.instagramUrl && !keep.posts.some((k) => k.instagramUrl === p.instagramUrl));

await db.update(places).set({ posts: [...keep.posts, ...moved] }).where(eq(places.id, keep.id));
await db.delete(places).where(eq(places.id, dup.id));
console.log(`kept "${keep.name}" with ${1 + keep.posts.length + moved.length} posts; removed "${dup.name}"`);
