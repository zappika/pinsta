/**
 * The web list is Sarp's alone. Friends use the iOS app, which keeps its list
 * on the phone and only ever calls /api/extract.
 *
 * Every /api/places* route and the Google search require the owner key in the
 * `x-pinsta-key` header. The key lives only in env (`PINSTA_OWNER_KEY`, in
 * Vercel and .env.local) — this repo is public. While the env var is unset the
 * lock is off, so deploying this code alone changes nothing.
 */
import { NextResponse } from "next/server";

export function isOwner(req: Request): boolean {
  const key = process.env.PINSTA_OWNER_KEY;
  if (!key) return true;
  return req.headers.get("x-pinsta-key") === key;
}

/** Returns a 401 response to send back, or null when the caller is the owner. */
export function requireOwner(req: Request): NextResponse | null {
  return isOwner(req) ? null : NextResponse.json({ error: "locked" }, { status: 401 });
}
