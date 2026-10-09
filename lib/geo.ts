/** The map opens on your town when a saved place is within this many km of you. */
export const NEAR_KM = 50;

export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** The opening screen asks for location only from this many saved places on (Sarp, 2026-10-05). */
export const ASK_AFTER = 3;

/**
 * What the opening screen may do with location: "locate" when the browser already
 * allows it or it hasn't been asked and the list has ASK_AFTER places; "wait" when
 * it hasn't been asked and the list is smaller (no prompt on a new list); "refused".
 */
export async function locationOnOpen(placeCount: number): Promise<"locate" | "wait" | "refused"> {
  const state = await navigator.permissions
    ?.query({ name: "geolocation" })
    .then((p) => p.state)
    .catch(() => "prompt" as const);
  if (state === "granted") return "locate";
  if (state === "denied") return "refused";
  return placeCount >= ASK_AFTER ? "locate" : "wait";
}

export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { maximumAge: 5 * 60_000, timeout: 10_000 },
    );
  });
}
