/**
 * Collapse Google Places `primaryType` values into a handful of buckets the
 * list can be filtered by. Order matters: more specific checks come first
 * (e.g. `coffee_shop` is a Cafe, not a Shop).
 */
export const CATEGORIES = [
  "Restaurant",
  "Cafe",
  "Bar",
  "Vineyard",
  "Bakery",
  "Hotel",
  "Shop",
  "Attraction",
  "Museum",
  "Nature",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

const EXACT: Record<string, Category> = {
  restaurant: "Restaurant",
  meal_takeaway: "Restaurant",
  meal_delivery: "Restaurant",
  food_court: "Restaurant",
  diner: "Restaurant",
  cafe: "Cafe",
  coffee_shop: "Cafe",
  tea_house: "Cafe",
  ice_cream_shop: "Cafe",
  dessert_shop: "Cafe",
  bar: "Bar",
  pub: "Bar",
  wine_bar: "Bar",
  night_club: "Bar",
  cocktail_bar: "Bar",
  vineyard: "Vineyard",
  winery: "Vineyard",
  wine_tasting_room: "Vineyard",
  bakery: "Bakery",
  bagel_shop: "Bakery",
  donut_shop: "Bakery",
  hotel: "Hotel",
  lodging: "Hotel",
  resort_hotel: "Hotel",
  bed_and_breakfast: "Hotel",
  hostel: "Hotel",
  guest_house: "Hotel",
  inn: "Hotel",
  motel: "Hotel",
  store: "Shop",
  shopping_mall: "Shop",
  market: "Shop",
  tourist_attraction: "Attraction",
  historical_landmark: "Attraction",
  monument: "Attraction",
  church: "Attraction",
  place_of_worship: "Attraction",
  amusement_park: "Attraction",
  observation_deck: "Attraction",
  plaza: "Attraction",
  museum: "Museum",
  art_gallery: "Museum",
  cultural_center: "Museum",
  park: "Nature",
  national_park: "Nature",
  state_park: "Nature",
  beach: "Nature",
  natural_feature: "Nature",
  hiking_area: "Nature",
  garden: "Nature",
  botanical_garden: "Nature",
  campground: "Nature",
};

export function categorize(primaryType: string | null | undefined): Category {
  if (!primaryType) return "Other";
  const t = primaryType.toLowerCase();
  if (EXACT[t]) return EXACT[t];
  if (t.endsWith("_restaurant")) return "Restaurant";
  if (t.endsWith("_bar")) return "Bar";
  if (t.endsWith("_store") || t.endsWith("_shop")) return "Shop";
  if (t.endsWith("_hotel")) return "Hotel";
  if (t.endsWith("_museum")) return "Museum";
  if (t.endsWith("_park")) return "Nature";
  return "Other";
}
