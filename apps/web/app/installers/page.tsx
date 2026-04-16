import { InstallerBoardPage } from "../../components/installer-board-page";

type InstallersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InstallersPage({ searchParams }: InstallersPageProps) {
  return (
    <InstallerBoardPage
      apiPath="installers"
      path="/installers"
      title="HVAC Install Technician Dashboard"
      subtitle="HVAC install leaderboard filtered automatically from ServiceTitan position data."
      searchParams={searchParams}
    />
  );
}
