import { FieldTechnicianBoardPage } from "../../components/field-technician-board-page";

type TechniciansPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TechniciansPage({ searchParams }: TechniciansPageProps) {
  return (
    <FieldTechnicianBoardPage
      apiPath="technicians"
      path="/technicians"
      title="HVAC Service Technician Dashboard"
      subtitle="HVAC service technician leaderboard filtered automatically from ServiceTitan department data."
      searchParams={searchParams}
    />
  );
}

