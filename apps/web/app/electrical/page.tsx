import { FieldTechnicianBoardPage } from "../../components/field-technician-board-page";

type ElectricalPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ElectricalPage({ searchParams }: ElectricalPageProps) {
  return (
    <FieldTechnicianBoardPage
      apiPath="electrical"
      path="/electrical"
      title="Electrical Service Technician Dashboard"
      subtitle="Electrical service leaderboard filtered automatically from ServiceTitan department data."
      searchParams={searchParams}
    />
  );
}

