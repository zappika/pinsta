"use client";

/**
 * fetch() for our own API: adds the owner key (kept in this browser's
 * localStorage) and turns a 401 into a "pinsta:locked" event the app shell
 * listens for. See lib/owner.ts for the server side.
 */
const STORAGE = "pinsta-owner-key";
let pageKey: string | null = null;

function ownerKey(): string | null {
  if (pageKey !== null) return pageKey;
  try {
    return localStorage.getItem(STORAGE);
  } catch {
    return null;
  }
}

export function setOwnerKey(key: string) {
  pageKey = key.trim();
  try {
    localStorage.setItem(STORAGE, pageKey);
  } catch {
    /* storage blocked: the key lasts for this page only */
  }
}

export async function api(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const key = ownerKey();
  if (key) headers.set("x-pinsta-key", key);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) window.dispatchEvent(new Event("pinsta:locked"));
  return res;
}
