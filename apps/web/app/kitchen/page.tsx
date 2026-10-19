import { KitchenBoard } from "../../components/kitchen-board";
import "./kitchen.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Kitchen TV | IRBIS" };
export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tv = params.tv === "1";
  return (
    <KitchenBoard
      tvMode={tv}
      autoplay={tv && params.rotate !== "0"}
      brandLogoUrl="/kitchen/irbis-logo.png"
    />
  );
}
