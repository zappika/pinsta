import type { Metadata } from "next";
import UsagePage from "../components/UsagePage";

export const metadata: Metadata = {
  title: "Usage · Vicolo",
};

export default function Page() {
  return <UsagePage />;
}
