import { backofficeMetadata } from "@/lib/backoffice";
import SavesPage from "../components/SavesPage";

export const metadata = backofficeMetadata("Saves");

export default function Page() {
  return <SavesPage />;
}
