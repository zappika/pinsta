import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/google-places";

export async function POST(req: Request) {
  const { query } = (await req.json().catch(() => ({}))) as { query?: string };
  const q = query?.trim();
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
