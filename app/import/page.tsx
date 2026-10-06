import type { Metadata } from "next";
import ImportPage from "../components/ImportPage";

export const metadata: Metadata = {
  title: "Import · Vicolo",
};

export default function Page() {
  return <ImportPage />;
}
