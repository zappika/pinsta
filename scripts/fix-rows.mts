/** One-off: recategorize vineyards; swap the mis-saved Âmago to the guesthouse the post is about. */
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../lib/db";
import { places } from "../lib/db/schema";
import { searchPlaces } from "../lib/google-places";

const db = getDb();
const v = await db.update(places).set({ category: "Vineyard" }).where(inArray(places.primaryType, ["vineyard", "winery", "wine_tasting_room"])).returning({ name: places.name });
console.log("vineyards:", v.map((r) => r.name).join(", ") || "none");

const [wrong] = await db.select().from(places).where(eq(places.instagramUrl, "https://www.instagram.com/p/DdLZlByCDvc/"));
const right = (await searchPlaces("Âmago Guesthouse")).find((c) => c.name === "Âmago Guesthouse");
if (wrong && right) {
  await db.update(places).set({
    name: right.name, placeId: right.placeId, lat: right.lat, lng: right.lng, formattedAddress: right.formattedAddress,
    country: right.country, city: right.city, region: right.region, primaryType: right.primaryType, category: right.category,
  }).where(eq(places.id, wrong.id));
  console.log(`Âmago: ${wrong.name} (${wrong.city}) → ${right.name} (${right.city}, ${right.category})`);
}
