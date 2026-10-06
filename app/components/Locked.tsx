"use client";

import { useState } from "react";

/** The web list is private (see lib/owner.ts). One field, remembered in this browser; /usage shows it too. */
export default function Locked({ onKey, rejected }: { onKey: (key: string) => void; rejected: boolean }) {
  const [key, setKey] = useState("");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="text-2xl font-semibold tracking-tight">Vicolo</h1>
      <p className="mt-1 text-sm text-stone-500">This list is private. Enter your key to open it.</p>
      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim()) onKey(key);
        }}
      >
        <input
          type="password"
          autoComplete="current-password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Key"
          className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-base outline-none focus:border-stone-400"
        />
        <button type="submit" className="rounded-xl bg-stone-900 px-4 text-sm font-medium text-white active:bg-stone-800">
          Open
        </button>
      </form>
      {rejected && <p className="mt-2 text-sm text-red-600">That key didn&apos;t open it.</p>}
    </main>
  );
}
