import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/google-places";
import { requireOwner } from "@/lib/owner";

export async function POST(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const { query } = ((await req.json().catch(() => null)) ?? {}) as { query?: unknown };
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  try {
    const candidates = await searchPlaces(q);
    return NextResponse.json({ candidates });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Place search failed" }, { status: 502 });
  }
}
