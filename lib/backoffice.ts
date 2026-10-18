import type { Metadata } from "next";

/**
 * What lets a backoffice page be added to the iPhone's Home Screen as its own app: a manifest
 * (starts on Pulse, no browser bar) and the dark app icon, so it doesn't look like Vicolo itself.
 * Its storage is separate from Safari's, so the owner key is asked once more there.
 */
export function backofficeMetadata(title: string): Metadata {
  return {
    title: `${title} · Vicolo`,
    manifest: "/backoffice.webmanifest",
    icons: { apple: "/backoffice-icon-180.png" },
    appleWebApp: { capable: true, title: "Backoffice", statusBarStyle: "default" },
  };
}
