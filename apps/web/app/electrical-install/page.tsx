import { InstallerBoardPage } from "../../components/installer-board-page";

type ElectricalInstallPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ElectricalInstallPage({ searchParams }: ElectricalInstallPageProps) {
  return (
    <InstallerBoardPage
      apiPath="electrical-install"
      path="/electrical-install"
      title="Electrical Install Technician Dashboard"
      subtitle="Electrical install leaderboard filtered automatically from ServiceTitan position data."
      searchParams={searchParams}
    />
  );
}
