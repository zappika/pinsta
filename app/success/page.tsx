import { backofficeMetadata } from "@/lib/backoffice";
import BackofficeNav from "../components/BackofficeNav";
import SuccessLab from "../components/SuccessLab";

export const metadata = backofficeMetadata("Save flow");

export default function Page() {
  return (
    <>
      <SuccessLab />
      <BackofficeNav />
    </>
  );
}
