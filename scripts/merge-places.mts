/**
 * One-off: fold a duplicate card into another. The duplicate's post (and any
 * extra posts) move onto the kept card, then the duplicate row is deleted.
 * Usage: npx tsx scripts/merge-places.mts "<keep name or id>" "<duplicate name or id>"
 */
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { places } from "../lib/db/schema";

const [keepArg, dupArg] = process.argv.slice(2);
if (!keepArg || !dupArg) throw new Error('usage: merge-places.mts "<keep name or id>" "<duplicate name or id>"');
const db = getDb();
const rows = await db.select().from(places);
// An id is exact; a name must name one card, or the wrong one could be deleted.
const pick = (arg: string) => {
  const byId = rows.find((r) => r.id === arg);
  if (byId) return byId;
  const named = rows.filter((r) => r.name === arg);
  if (named.length > 1) throw new Error(`"${arg}" names ${named.length} cards; pass an id: ${named.map((r) => r.id).join(", ")}`);
  if (!named[0]) throw new Error(`not found: ${arg}`);
  return named[0];
};
const keep = pick(keepArg);
const dup = pick(dupArg);
if (keep.id === dup.id) throw new Error(`"${keepArg}" and "${dupArg}" are the same card (${keep.id}); nothing to merge`);

const moved = [
  { instagramUrl: dup.instagramUrl, imageUrl: dup.imageUrl, caption: dup.caption, ownerUsername: dup.ownerUsername, igLocationName: dup.igLocationName, addedAt: dup.createdAt.toISOString() },
  ...dup.posts,
].filter((p) => p.instagramUrl !== keep.instagramUrl && !keep.posts.some((k) => k.instagramUrl === p.instagramUrl));

await db.update(places).set({ posts: [...keep.posts, ...moved] }).where(eq(places.id, keep.id));
await db.delete(places).where(eq(places.id, dup.id));
console.log(`kept "${keep.name}" with ${1 + keep.posts.length + moved.length} posts; removed "${dup.name}"`);
