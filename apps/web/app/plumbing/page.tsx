import { FieldTechnicianBoardPage } from "../../components/field-technician-board-page";

type PlumbingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlumbingPage({ searchParams }: PlumbingPageProps) {
  return (
    <FieldTechnicianBoardPage
      apiPath="plumbing"
      path="/plumbing"
      title="Plumbing Service Technician Dashboard"
      subtitle="Plumbing service leaderboard filtered automatically from ServiceTitan department data."
      searchParams={searchParams}
    />
  );
}

