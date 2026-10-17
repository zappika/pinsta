/**
 * A post written in a Nordic language lifts places in its country: Liebling in Stockholm over the
 * Liebling café in Vienna for a Swedish caption (Sarp, 2026-10-17). English says nothing (Copenhagen
 * posts in English too), so an English post lifts nothing. A tie-break among suggestions, never a
 * filter or an auto-save.
 *
 * Common words only one language uses, counted once each; two of them, and more than any other
 * language, decide; a word in the handle counts twice. Words Danish and Norwegian share lift both.
 * Apple's language detection and trigram libraries (franc) misread short captions (Swedish as Scots),
 * so it's a word list, the same one in PlaceSearch.swift. Change one, change the other.
 */

const WORDS: Record<string, string[]> = {
  sweden: [
    "och", "är", "inte", "från", "också", "eller", "välkommen", "välkomna", "öppet", "öppettider", "ikväll", "idag",
    "här", "kväll", "lördag", "söndag", "fredag", "måndag", "tisdag", "lördagar", "mån", "tis", "lör", "sön", "mycket",
    "hos", "boka", "gott", "även", "mellan", "alla", "dagar", "restaurang", "krog", "fika",
  ],
  denmark: ["åbent", "åben", "åbner", "hvad", "aften", "uge", "ugen", "køkken", "dejlig", "dejligt", "smørrebrød", "vores", "bestil"],
  norway: ["åpent", "åpen", "åpner", "kveld", "ikveld", "etter", "uke", "uken", "hva", "kjøkken", "deilig", "deilige", "nå"],
  // Danish and Norwegian alike.
  dano: ["og", "ikke", "også", "velkommen", "fra", "lørdag", "søndag", "fredag", "mandag", "tirsdag", "frokost", "hyggelig", "spise", "forbi", "kun"],
  finland: [
    "ja", "ei", "että", "tervetuloa", "auki", "ravintola", "kanssa", "myös", "tänään", "huomenna", "nähdään", "kiitos",
    "viikonloppuna", "ruoka", "olemme", "meillä", "kaikki",
  ],
  iceland: ["með", "við", "frá", "ekki", "velkomin", "opið", "kvöld", "matur", "veitingastaður"],
};

const COUNTRY: Record<string, string> = { sweden: "Sweden", denmark: "Denmark", norway: "Norway", finland: "Finland", iceland: "Iceland" };

/** The countries a post's words point to: one, Denmark and Norway together, or none. */
export function languageCountries(caption: string | null | undefined, handleWords?: string | null): string[] {
  const split = (s: string | null | undefined) => new Set((s ?? "").toLowerCase().split(/[^\p{L}]+/u).filter(Boolean));
  const own = split(handleWords);
  const words = new Set([...split(caption), ...own]);
  // A word in the handle is the venue naming itself in its language ("restaurangliebling"): it counts twice.
  const hits = (list: string[]) => list.filter((w) => words.has(w)).length + list.filter((w) => own.has(w)).length;
  const dano = hits(WORDS.dano) + [...words].filter((w) => /[æø]/.test(w) && !WORDS.dano.includes(w) && !WORDS.denmark.includes(w) && !WORDS.norway.includes(w)).length;
  const score: Record<string, number> = {
    sweden: hits(WORDS.sweden),
    denmark: hits(WORDS.denmark) + dano,
    norway: hits(WORDS.norway) + dano,
    finland: hits(WORDS.finland),
    iceland: hits(WORDS.iceland) + [...words].filter((w) => /[ðþ]/.test(w) && !WORDS.iceland.includes(w)).length,
  };
  const best = Math.max(...Object.values(score));
  if (best < 2) return [];
  const top = Object.keys(score).filter((k) => score[k] === best);
  // Only Danish-and-Norwegian words: both. Any other tie says nothing.
  if (top.length === 2 && top.includes("denmark") && top.includes("norway")) return ["Denmark", "Norway"];
  return top.length === 1 ? [COUNTRY[top[0]]] : [];
}

/** Places in those countries first, the order otherwise kept. */
export function lifted<T extends { country?: string | null }>(cs: T[], countries: string[]): T[] {
  if (!countries.length) return cs;
  const here = (c: T) => countries.some((k) => (c.country ?? "").toLowerCase() === k.toLowerCase());
  return [...cs.filter(here), ...cs.filter((c) => !here(c))];
}
