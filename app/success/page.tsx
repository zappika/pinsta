import type { Metadata } from "next";
import SuccessLab from "../components/SuccessLab";

export const metadata: Metadata = { title: "Success states · Vicolo" };

export default function Page() {
  return <SuccessLab />;
}
