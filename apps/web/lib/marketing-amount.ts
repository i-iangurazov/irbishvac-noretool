import { formatCurrency } from "@irbis/utils/src/format";

/** Preserve cents in hover details even when the visible value is abbreviated. */
export const exactCurrency = (value: number) =>
  formatCurrency(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function advertisingReturnDetail(
  result: {
    income: number;
    spend: number;
    returnOnSpend: number | null;
    missing: string[];
  },
  metric: "completedRevenue" | "soldAmount" = "completedRevenue",
) {
  const label = metric === "completedRevenue" ? "ROAS" : "SOAS";
  const incomeLabel =
    metric === "completedRevenue" ? "Completed revenue" : "Sold estimate value";
  const formula =
    result.returnOnSpend == null
      ? `${label} unavailable: no recorded paid media spend.`
      : `${label} = ${exactCurrency(result.income)} ÷ ${exactCurrency(result.spend)} = ${result.returnOnSpend.toFixed(4)}×.`;
  return `${formula}\n${incomeLabel} and media spend use the same paid channels. Commissions are separate.${result.missing.length ? `\nExcluded because spend is missing: ${result.missing.join(", ")}.` : ""}`;
}
