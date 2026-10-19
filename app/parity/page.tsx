import type { Metadata } from "next";
import { backofficeMetadata } from "@/lib/backoffice";
import { renderMarkdownFile } from "@/lib/markdown";
import BackofficeNav from "../components/BackofficeNav";

export const metadata: Metadata = { ...backofficeMetadata("Parity"), description: "What the web and iOS apps each have." };

// parity.md as a page (backoffice). Built at deploy time, so it is as current as the file.
export const dynamic = "force-static";

export default function Parity() {
  return (
    <main className="mx-auto max-w-4xl px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+5rem)] text-stone-800 leading-relaxed">
      {renderMarkdownFile("parity.md")}
      <BackofficeNav />
    </main>
  );
}
