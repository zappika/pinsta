import { backofficeMetadata } from "@/lib/backoffice";
import ReviewPage from "../components/ReviewPage";

export const metadata = backofficeMetadata("Review");

export default function Page() {
  return <ReviewPage />;
}
