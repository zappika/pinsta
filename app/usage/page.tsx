import { backofficeMetadata } from "@/lib/backoffice";
import UsagePage from "../components/UsagePage";

export const metadata = backofficeMetadata("Usage");

export default function Page() {
  return <UsagePage />;
}
