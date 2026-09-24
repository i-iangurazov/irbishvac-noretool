import { DashboardShell } from "@irbis/ui";
import { navItems } from "../../lib/api";
import { getBrandLogoUrl } from "../../lib/assets";
import { KitchenBoard } from "../../components/kitchen-board";
import "./kitchen.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "People & Company News | IRBIS" };

export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tv = params.tv === "1";
  const kiosk = tv && params.kiosk === "1";
  const seconds = Math.min(120, Math.max(10, Number(params.seconds) || 20));
  return (
    <DashboardShell
      title="People & Company News"
      activePath="/kitchen"
      navItems={navItems}
      brandLogoUrl={getBrandLogoUrl()}
      tvMode={tv}
      kioskMode={kiosk}
      contentClassName="kitchen-shell"
      headerContent={
        <a
          className="kitchen-launch"
          href={tv ? "/kitchen" : "/kitchen?tv=1&kiosk=1&rotate=1"}
        >
          {tv ? "Desktop view" : "Launch kitchen TV ↗"}
        </a>
      }
    >
      <KitchenBoard
        tvMode={tv}
        autoplay={tv && params.rotate !== "0"}
        intervalSeconds={seconds}
      />
    </DashboardShell>
  );
}
