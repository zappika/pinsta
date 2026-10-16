import type { Metadata } from "next";
import SavesPage from "../components/SavesPage";

export const metadata: Metadata = {
  title: "Saves · Vicolo",
};

export default function Page() {
  return <SavesPage />;
}
