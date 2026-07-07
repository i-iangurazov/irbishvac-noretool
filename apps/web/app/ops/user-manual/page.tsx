import {
  BulletList,
  CodeBlock,
  InfoCard,
  InfoGrid,
  NumberedList,
  OpsShell,
  PrimaryLink,
  SecondaryLink,
  SectionBand,
  TextPanel
} from "../../../components/ops-pages";

const boards = [
  "Company-wide: /company-wide",
  "HVAC Service: /technicians",
  "Plumbing Service: /plumbing",
  "Electrical Service: /electrical",
  "HVAC Install: /installers",
  "Plumbing Install: /plumbing-install",
  "Electrical Install: /electrical-install",
  "Advisors: /advisors",
  "Call Center Summary: /call-center/summary",
  "Call Center By CSR: /call-center/by-csr",
  "Lead Generation: /leads",
  "Campaigns: /campaigns"
];

const dailyChecks = [
  "Open the dashboard and confirm the freshness badge shows a current timestamp.",
  "Open /api/health/ready and confirm database, Redis, and snapshots are OK.",
  "Confirm the latest scheduled GitHub Actions refresh is green.",
  "If the badge is stale, run the Refresh Snapshots workflow manually."
];

const manualRefreshSteps = [
  "Open the GitHub repository.",
  "Go to Actions.",
  "Select Refresh Snapshots.",
  "Click Run workflow on main.",
  "Wait for the run to finish. About 29 to 31 minutes is normal.",
  "Check /api/health/ready and reload /company-wide?preset=mtd."
];

const troubleshooting = [
  "Old dashboard date: check /api/health/ready, then check the newest Refresh Snapshots run.",
  "Red workflow but fresh data: inspect validation output. Tiny float serialization noise is now tolerated.",
  "Blank selected date: explicit date ranges no longer fall back to stale latest data. Wait for the queued refresh or run a manual refresh.",
  "Rate limits: let the workflow finish. Do not start multiple manual refreshes.",
  "ServiceTitan 500/timeouts: check retry logs. Retryable report fetch errors are retried before the run is marked failed.",
  "Railway healthy but web page fails: check the Railway web service logs and API_BASE_URL/NEXT_PUBLIC_API_BASE_URL."
];

export default function UserManualPage() {
  return (
    <OpsShell
      activePath="/ops/user-manual"
      actions={
        <>
          <PrimaryLink href="/company-wide">Open Dashboard</PrimaryLink>
          <SecondaryLink href="/ops/condition-report">Condition Report</SecondaryLink>
        </>
      }
      description="Operator instructions for managing the Railway-hosted IRBIS HVAC dashboard, keeping data fresh, and responding to stale or failed refreshes."
      eyebrow="User Manual"
      title="Manage The Dashboard"
    >
      <div className="grid gap-6">
        <SectionBand eyebrow="Production" title="Where the dashboard runs">
          <InfoGrid>
            <InfoCard label="Production Host" tone="slate" value="Railway">
              Railway owns production runtime, services, database, Redis, and runtime
              secrets.
            </InfoCard>
            <InfoCard label="Verified API" tone="teal" value="irbisapi-production">
              `https://irbisapi-production.up.railway.app` is API-only. The web app needs
              the Railway web service URL or custom domain.
            </InfoCard>
            <InfoCard label="Refresh Owner" tone="green" value="GitHub Actions">
              Scheduled snapshot refreshes run through the `Refresh Snapshots` workflow
              and write to Railway-backed data stores. Retryable ServiceTitan report
              fetch errors are retried before the workflow fails.
            </InfoCard>
          </InfoGrid>
        </SectionBand>

        <SectionBand
          description="Use the dashboard navigation or direct URLs for a specific board."
          eyebrow="Boards"
          title="Available Dashboard Pages"
        >
          <TextPanel>
            <div className="grid gap-3 md:grid-cols-2">
              {boards.map((board) => (
                <div
                  className="rounded-lg border border-[#ece3da] bg-[#fbfaf7] px-4 py-3 text-sm font-black text-[#17313a]"
                  key={board}
                >
                  {board}
                </div>
              ))}
            </div>
          </TextPanel>
        </SectionBand>

        <SectionBand eyebrow="Filters" title="Date And TV Controls">
          <InfoGrid>
            <InfoCard label="MTD" value="Month to date">
              Month-to-date data for the selected business date.
            </InfoCard>
            <InfoCard label="YTD" value="Year to date">
              Year-to-date data for the selected business date.
            </InfoCard>
            <InfoCard label="TV Mode" value="tv=1">
              Use with `kiosk=1` for a cleaner wall-display layout and `rotate=1` for
              field board rotation.
            </InfoCard>
          </InfoGrid>
          <div className="mt-4">
            <CodeBlock>{`/company-wide?preset=mtd
/technicians?preset=ytd&tv=1
/technicians?preset=mtd&tv=1&rotate=1&boards=technicians,plumbing,electrical`}</CodeBlock>
          </div>
        </SectionBand>

        <SectionBand eyebrow="Health" title="Daily Operating Checks">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <TextPanel>
              <h3 className="mb-4 text-xl font-black text-[#14252e]">Daily checklist</h3>
              <BulletList items={dailyChecks} />
            </TextPanel>
            <TextPanel>
              <h3 className="mb-4 text-xl font-black text-[#14252e]">Readiness command</h3>
              <CodeBlock>{`curl -sS https://irbisapi-production.up.railway.app/api/health/ready`}</CodeBlock>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">
                Healthy means `ok: true`, `degraded: false`, database OK, Redis OK, and
                snapshots OK. Treat `degraded: true` as a stale-data incident.
              </p>
            </TextPanel>
          </div>
        </SectionBand>

        <SectionBand eyebrow="Refresh" title="Manual Refresh Procedure">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <TextPanel>
              <NumberedList items={manualRefreshSteps} />
            </TextPanel>
            <TextPanel>
              <h3 className="mb-4 text-xl font-black text-[#14252e]">Developer command</h3>
              <CodeBlock>{`pnpm sync:remote`}</CodeBlock>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">
                Run this only from a configured environment pointed at the intended
                Railway production database, Redis, and ServiceTitan credentials.
              </p>
            </TextPanel>
          </div>
        </SectionBand>

        <SectionBand eyebrow="Goals" title="Monthly Goal Management">
          <InfoGrid>
            <InfoCard label="Confirm Year" tone="slate">
              Verify the selected business date year before changing monthly goals.
            </InfoCard>
            <InfoCard label="Keep All Months" tone="teal">
              Keep all 12 months populated for the active year.
            </InfoCard>
            <InfoCard label="Verify After Save" tone="green">
              Reload `/company-wide?preset=mtd` and `/company-wide?preset=ytd`.
            </InfoCard>
          </InfoGrid>
        </SectionBand>

        <SectionBand eyebrow="Troubleshooting" title="Common Problems">
          <TextPanel>
            <BulletList items={troubleshooting} />
          </TextPanel>
        </SectionBand>
      </div>
    </OpsShell>
  );
}
