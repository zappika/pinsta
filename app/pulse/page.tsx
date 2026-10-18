import { backofficeMetadata } from "@/lib/backoffice";
import PulsePage from "../components/PulsePage";

export const metadata = backofficeMetadata("Pulse");

export default function Page() {
  return <PulsePage />;
}
