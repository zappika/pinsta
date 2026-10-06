/**
 * A shared Google Maps list (Saved → a list → Share), read the way Google Maps'
 * own page reads it: `maps/preview/entitylist/getlist`, no key, no account. Only
 * lists set to "shared" are readable. The answer is protobuf as nested JSON
 * arrays without field names; the positions below were read off real answers
 * (github.com/sotashimozono/gmaplist) and are what Google could change, so every
 * read is defensive and an unreadable answer says so instead of returning junk.
 * Server-side only. Low-tech first: no paid call here.
 */
export type ListEntry = { name: string; note: string | null; address: string | null; lat: number; lng: number };
export type GoogleList = { id: string; title: string | null; entries: ListEntry[] };

export class ListError extends Error {}

/** A short link, a placelists URL, a long Maps URL carrying the list, or the bare id. */
export async function listIdFrom(input: string): Promise<string> {
  let url = input.trim();
  if (/^[\w-]{16,}$/.test(url)) return url;
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(url)) {
    const res = await fetch(url, { redirect: "follow" });
    url = res.url;
    // Through Google's consent page the real URL sits in `continue`.
    const cont = new URL(url).searchParams.get("continue");
    if (cont) url = cont;
  }
  const id =
    url.match(/\/placelists\/list\/([\w-]+)/)?.[1] ??
    // Long form: …/data=!4m3!11m2!2s<id>!3e3
    decodeURIComponent(url).match(/!2s([\w-]{16,})!3e3/)?.[1];
  if (!id) throw new ListError("That link isn't a shared Google Maps list");
  return id;
}

export async function readGoogleList(input: string): Promise<GoogleList> {
  const id = await listIdFrom(input);
  const pb = `!1m4!1s${id}!2e1!3m1!1e1!2e2!3e2!4i500`;
  const res = await fetch(`https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=en&gl=us&pb=${pb}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15" },
    cache: "no-store",
  });
  if (!res.ok) throw new ListError(`Google didn't return the list (${res.status}). Is it shared?`);
  // The answer starts with Google's anti-JSON-hijacking prefix.
  const text = (await res.text()).replace(/^\)\]\}'\s*/, "");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ListError("Google's answer couldn't be read");
  }
  const list = at(data, 0);
  const raw = at(list, 8);
  if (!Array.isArray(raw)) throw new ListError("That list is empty, private, or Google changed how lists are read");

  const entries: ListEntry[] = [];
  for (const e of raw) {
    const name = str(at(e, 2));
    const lat = num(at(e, 1, 5, 2));
    const lng = num(at(e, 1, 5, 3));
    if (!name || lat === null || lng === null) continue; // a removed place, or a shape we don't know
    entries.push({ name, note: str(at(e, 3)), address: str(at(e, 1, 4)), lat, lng });
  }
  return { id, title: str(at(list, 4)), entries };
}

/** data[i][j][k]…, or undefined anywhere along the way. */
function at(v: unknown, ...path: number[]): unknown {
  for (const i of path) {
    if (!Array.isArray(v)) return undefined;
    v = v[i];
  }
  return v;
}
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
