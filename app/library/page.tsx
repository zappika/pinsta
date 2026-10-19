import { backofficeMetadata } from "@/lib/backoffice";
import BackofficeNav from "../components/BackofficeNav";

export const metadata = backofficeMetadata("Library");

// The library is a static page built from assets/ (scripts/build-library.mjs); framed here so it
// sits under the same tab bar as the other backoffice pages.
export default function Page() {
  return (
    <>
      <iframe
        src="/vicolo-library/index.html"
        title="Vicolo library"
        className="fixed inset-x-0 top-0 h-[calc(100dvh-env(safe-area-inset-bottom)-2.8rem)] w-full border-0"
      />
      <BackofficeNav />
    </>
  );
}
