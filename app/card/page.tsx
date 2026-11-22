import { backofficeMetadata } from "@/lib/backoffice";
import BackofficeNav from "../components/BackofficeNav";
import CardLab from "../components/CardLab";

export const metadata = backofficeMetadata("Place card");

export default function Page() {
  return (
    <>
      <CardLab />
      <BackofficeNav />
    </>
  );
}
