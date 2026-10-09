import { NextResponse } from "next/server";
import { ListError, readGoogleList } from "@/lib/google-list";

/**
 * The iOS import's first step: read a shared Google Maps list and hand back its
 * entries (name, note, address, pin). No matching and no paid call: the phone
 * matches every entry with MapKit itself (Sarp, 2026-10-09). Open, like /api/extract.
 */
export async function POST(req: Request) {
  const raw = ((await req.json().catch(() => null)) ?? {}) as { url?: unknown };
  if (typeof raw.url !== "string" || !raw.url.trim()) {
    return NextResponse.json({ error: "Paste the link of a shared list" }, { status: 400 });
  }
  try {
    const list = await readGoogleList(raw.url);
    if (list.entries.length === 0) {
      return NextResponse.json({ error: "That list has no places Vicolo can read" }, { status: 422 });
    }
    return NextResponse.json({ title: list.title, owner: list.owner, entries: list.entries });
  } catch (e) {
    if (e instanceof ListError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error(e);
    return NextResponse.json({ error: "Couldn't read that list" }, { status: 502 });
  }
}
