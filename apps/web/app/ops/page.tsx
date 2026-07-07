import {
  HealthStatus,
  InfoCard,
  InfoGrid,
  OpsShell,
  PrimaryLink,
  SecondaryLink,
  SectionBand
} from "../../components/ops-pages";
import { fetchProductionHealth } from "../../lib/ops-health";

export const dynamic = "force-dynamic";

export default async function OperationsHomePage() {
  const health = await fetchProductionHealth();

  return (
    <OpsShell
      activePath="/ops"
      actions={
        <>
          <PrimaryLink href="/ops/user-manual">Open Manual</PrimaryLink>
          <SecondaryLink href="/ops/condition-report">Open Report</SecondaryLink>
        </>
      }
      description="A public operating surface for the Railway-hosted IRBIS HVAC dashboard: health, refresh workflow, user manual, and incident-prevention report."
      eyebrow="Production Operations"
      title="Dashboard Operations Center"
    >
      <div className="grid gap-6">
        <HealthStatus health={health} />

        <SectionBand
          description="Use these pages during daily checks, handoff, and incident triage."
          eyebrow="Quick Access"
          title="Management Pages"
        >
          <InfoGrid>
            <InfoCard label="User Manual" tone="teal" value="How to manage it">
              Open the operating instructions for dashboard navigation, freshness checks,
              manual refresh, goals, Railway deployment, and troubleshooting.
              <div className="mt-4">
                <PrimaryLink href="/ops/user-manual">View Manual</PrimaryLink>
              </div>
            </InfoCard>

            <InfoCard label="Condition Report" tone="orange" value="Why it broke">
              Review the current condition, root causes, fixes already shipped, risks,
              and prevention checklist for future incidents.
              <div className="mt-4">
                <SecondaryLink href="/ops/condition-report">View Report</SecondaryLink>
              </div>
            </InfoCard>

            <InfoCard label="Live Dashboard" tone="green" value="Production board">
              Open the Company-wide dashboard and confirm Today, Yesterday, and the
              freshness badge against the live Railway API.
              <div className="mt-4">
                <PrimaryLink href="/company-wide">Open Dashboard</PrimaryLink>
              </div>
            </InfoCard>
          </InfoGrid>
        </SectionBand>

        <SectionBand eyebrow="Current Production State" title="What is working now">
          <InfoGrid>
            <InfoCard label="Hosting" tone="slate" value="Railway">
              The verified production API is hosted at
              `https://irbisapi-production.up.railway.app`. The web pages must be served
              by the Railway web service or custom domain.
            </InfoCard>
            <InfoCard label="Refresh Job" tone="green" value="Active">
              The `Refresh Snapshots` workflow is enabled. The latest 100 runs were
              audited: 65 green and 35 red, with root causes documented in the report.
            </InfoCard>
            <InfoCard label="Refresh Duration" tone="teal" value="About 29-31 min">
              ServiceTitan calls are serialized and rate-limit aware, so this duration is
              normal. Retryable ServiceTitan 5xx/timeouts are retried before failing the
              run.
            </InfoCard>
          </InfoGrid>
        </SectionBand>
      </div>
    </OpsShell>
  );
}
