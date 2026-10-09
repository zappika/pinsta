/**
 * Restaurants get a food icon instead of one icon for all (Sarp, 2026-10-09: "all
 * restaurants are gilda"). The web reads Google's primaryType; the name and caption
 * are the fallback, and the only source on iOS (MapKit has no cuisine). Same table in
 * ios/Pinsta/Models/Food.swift. Icons in public/types/food (GPT-6 set + library objects).
 */
type Food = { icon: string; types: string[]; words: string[] };

// Order matters for words: the first kind whose word appears wins.
const FOODS: Food[] = [
  { icon: "fine-dining", types: ["fine_dining_restaurant"], words: ["fine dining", "tasting menu"] },
  { icon: "ramen", types: ["ramen_restaurant"], words: ["ramen"] },
  { icon: "salmon-nigiri", types: ["japanese_restaurant", "sushi_restaurant"], words: ["sushi", "izakaya", "omakase", "japanese"] },
  { icon: "pizza", types: ["italian_restaurant", "pizza_restaurant"], words: ["pizzeria", "pizza", "trattoria", "osteria", "ristorante", "italian"] },
  { icon: "burger", types: ["hamburger_restaurant"], words: ["burger"] },
  { icon: "steak", types: ["steak_house", "barbecue_restaurant"], words: ["steak", "asador", "grill", "churrasc", "bbq"] },
  { icon: "thai-noodles", types: ["thai_restaurant", "vietnamese_restaurant"], words: ["thai", "pho", "vietnam"] },
  { icon: "indian-curry", types: ["indian_restaurant"], words: ["indian", "curry", "tandoor", "masala"] },
  { icon: "hummus", types: ["middle_eastern_restaurant", "lebanese_restaurant", "turkish_restaurant"], words: ["falafel", "hummus", "meze", "mezze", "lebanese"] },
  { icon: "souvlaki", types: ["greek_restaurant"], words: ["souvlaki", "gyros", "greek"] },
  { icon: "avocado-toast", types: ["brunch_restaurant", "breakfast_restaurant"], words: ["brunch", "breakfast"] },
  { icon: "sardine-tin", types: ["seafood_restaurant"], words: ["seafood", "marisquer", "oyster", "fish"] },
  { icon: "gilda", types: ["spanish_restaurant", "tapas_restaurant"], words: ["tapas", "pintxo", "bodega", "taberna"] },
];

/** The food icon for a restaurant, or null (then the Restaurant type icon). */
export function foodIcon(p: { category?: string | null; primaryType?: string | null; name?: string | null; caption?: string | null }): string | null {
  if (p.category !== "Restaurant") return null;
  const byType = p.primaryType && FOODS.find((f) => f.types.includes(p.primaryType!));
  if (byType) return `/types/food/${byType.icon}.png`;
  const text = `${p.name ?? ""} ${p.caption ?? ""}`.toLowerCase();
  const byWord = FOODS.find((f) => f.words.some((w) => new RegExp(`(^|[^a-z])${w}`).test(text)));
  return byWord ? `/types/food/${byWord.icon}.png` : null;
}
