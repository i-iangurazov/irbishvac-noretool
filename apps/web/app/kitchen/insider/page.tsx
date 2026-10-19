import { KitchenInsiderUpload } from "../../../components/kitchen-insider-upload";
import { kitchenMonthKey } from "../../../lib/kitchen-layout";
import { getConfig } from "@irbis/config";
import "./upload.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Upload IRBIS Insider" };
export default function InsiderPage() {
  return (
    <KitchenInsiderUpload
      initialMonth={kitchenMonthKey(new Date(), getConfig().app.timezone)}
    />
  );
}
