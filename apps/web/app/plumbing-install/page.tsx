import { InstallerBoardPage } from "../../components/installer-board-page";

type PlumbingInstallPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlumbingInstallPage({ searchParams }: PlumbingInstallPageProps) {
  return (
    <InstallerBoardPage
      apiPath="plumbing-install"
      path="/plumbing-install"
      title="Plumbing Install Technician Dashboard"
      subtitle="Plumbing install leaderboard filtered automatically from ServiceTitan position data."
      searchParams={searchParams}
    />
  );
}
