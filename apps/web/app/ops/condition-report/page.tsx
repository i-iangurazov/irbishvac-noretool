import {
  BulletList,
  CodeBlock,
  HealthStatus,
  InfoCard,
  InfoGrid,
  OpsShell,
  PrimaryLink,
  SecondaryLink,
  SectionBand,
  TextPanel
} from "../../../components/ops-pages";
import { fetchProductionHealth } from "../../../lib/ops-health";

export const dynamic = "force-dynamic";

const rootCauses = [
  {
    title: "ServiceTitan transient 500/timeouts were not retried",
    body:
      "Recent red Actions failed on heavy marketing/campaign YTD reports after ServiceTitan returned upstream 500 timeout responses. The old worker retried 429 rate limits, but not transient 5xx/network failures."
  },
  {
    title: "Scheduled refresh was disabled",
    body:
      "GitHub disabled the scheduled Refresh Snapshots workflow after repository inactivity. Snapshots stopped updating, so the dashboard could show old June data."
  },
  {
    title: "Scoped dates could fall back to stale latest data",
    body:
      "A selected date range could render the latest stored snapshot when the exact scope was missing. That looked populated but could be wrong."
  },
  {
    title: "Today and Yesterday used runtime date in some paths",
    body:
      "Daily ServiceTitan ranges could use the server runtime date instead of the selected dashboard business date."
  },
  {
    title: "Sales display hid the real daily card",
    body:
      "The Company-wide sales card could show MTD behavior where the stakeholder expected Today."
  },
  {
    title: "Derived models used wall-clock time",
    body:
      "Monthly pace and capacity calculations could depend on rebuild time instead of source snapshot business date."
  },
  {
    title: "Validation was too strict for float round trips",
    body:
      "Good refreshes could fail validation because of tiny JavaScript/PostgreSQL JSON numeric representation differences."
  }
];

const fixes = [
  "Re-enabled and verified the scheduled Refresh Snapshots workflow.",
  "Fixed ServiceTitan report date scoping.",
  "Stopped stale latest fallback for explicit date requests.",
  "Fixed Today and Yesterday dashboard behavior.",
  "Stored and used snapshot business date metadata for read-model generation.",
  "Made snapshot validation tolerant of insignificant float noise.",
  "Added retries for retryable ServiceTitan report fetch failures: 408, 425, 5xx, and network errors.",
  "Upgraded workflow helper actions to Node 24-compatible versions.",
  "Added operations pages and Markdown documentation."
];

const prevention = [
  "Monitor /api/health/ready every 5 to 15 minutes.",
  "Treat degraded: true as a data freshness incident.",
  "Review the latest Refresh Snapshots run daily.",
  "Do not reintroduce silent fallback from explicit date ranges to latest snapshots.",
  "Keep numeric tolerance limited to insignificant serialization differences.",
  "Keep retry attempts limited and logged so repeated ServiceTitan outages remain visible.",
  "Keep Railway and GitHub secrets aligned with the same production data stores.",
  "Add failure notifications to an actively monitored IRBIS mailbox or Slack channel.",
  "Add a production web smoke test after the canonical Railway web URL is confirmed."
];

const auditedFailures = [
  {
    title: "Last 100 runs",
    value: "65 green / 35 red",
    body:
      "Only one workflow exists in this repository: Refresh Snapshots. The failures were not random UI failures; they clustered into a few backend refresh/validation categories."
  },
  {
    title: "Historical validation failures",
    value: "Fixed",
    body:
      "Older failures included read-model mismatches such as call center cancellationRate and sales weightedCloseRate. These were caused by scoped-date bugs and insignificant float round trips."
  },
  {
    title: "Recent July failures",
    value: "ServiceTitan 500",
    body:
      "Recent red runs on commit 3213f6f failed on campaigns:ytd and marketing:ytd after ServiceTitan returned timeout/canceled-task 500 responses."
  }
];

export default async function ConditionReportPage() {
  const health = await fetchProductionHealth();

  return (
    <OpsShell
      activePath="/ops/condition-report"
      actions={
        <>
          <PrimaryLink href="/ops/user-manual">User Manual</PrimaryLink>
          <SecondaryLink href="/company-wide">Live Dashboard</SecondaryLink>
        </>
      }
      description="Current condition, root causes, completed fixes, remaining risks, and prevention plan for the Railway-hosted IRBIS HVAC dashboard."
      eyebrow="Condition Report"
      title="Dashboard Health And Incident Review"
    >
      <div className="grid gap-6">
        <HealthStatus health={health} />

        <SectionBand eyebrow="Summary" title="Current Condition">
          <InfoGrid>
            <InfoCard label="Status" tone="green" value="Working">
              The Railway production API is healthy and recent scheduled snapshot refreshes
              completed successfully.
            </InfoCard>
            <InfoCard label="Latest Fixes" tone="teal" value="Ready to ship">
              The current production hardening includes date scoping, Today/Yesterday,
              validation tolerance, workflow action updates, and ServiceTitan transient
              retry handling.
            </InfoCard>
            <InfoCard label="Refresh Evidence" tone="green" value="Green runs">
              The recent `Refresh Snapshots` runs completed successfully, including
              run `28864992723` in about 29 minutes.
            </InfoCard>
          </InfoGrid>
        </SectionBand>

        <SectionBand eyebrow="GitHub Actions Audit" title="What Actually Failed">
          <InfoGrid>
            {auditedFailures.map((item) => (
              <InfoCard label={item.title} tone="orange" value={item.value} key={item.title}>
                {item.body}
              </InfoCard>
            ))}
          </InfoGrid>
        </SectionBand>

        <SectionBand eyebrow="Root Causes" title="Why We Had Multiple Issues">
          <div className="grid gap-4 md:grid-cols-2">
            {rootCauses.map((cause) => (
              <InfoCard label="Cause" tone="orange" value={cause.title} key={cause.title}>
                {cause.body}
              </InfoCard>
            ))}
          </div>
        </SectionBand>

        <SectionBand eyebrow="Corrective Actions" title="Fixes Already Implemented">
          <TextPanel>
            <BulletList items={fixes} />
          </TextPanel>
        </SectionBand>

        <SectionBand eyebrow="Validation Failure Example" title="What The Red Action Meant">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <TextPanel>
              <p className="text-sm font-semibold leading-6 text-slate-700">
                The failed workflow showed read-model mismatches only at floating-point
                paths. The refresh itself had succeeded, but validation was comparing
                insignificant numeric representation differences too strictly.
              </p>
            </TextPanel>
            <CodeBlock>{`callCenterSummary:ytd $.rows[2].cancellationRate
callCenterByCsr:ytd $.rows[2].cancellationRate
salesYesterday:mtd $.totals.weightedCloseRate`}</CodeBlock>
          </div>
        </SectionBand>

        <SectionBand eyebrow="Transient Failure Example" title="What The Later Red Actions Meant">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <TextPanel>
              <p className="text-sm font-semibold leading-6 text-slate-700">
                The later red runs were different from the validation-noise failure. The
                refresh reached ServiceTitan, then ServiceTitan timed out internally on
                campaign/marketing YTD data. The worker now retries retryable report
                fetch errors before marking the whole refresh failed.
              </p>
            </TextPanel>
            <CodeBlock>{`campaigns:ytd -> ServiceTitan 500 timeout
marketing:ytd -> ServiceTitan 500 timeout
new behavior -> retry 408, 425, 5xx, network errors`}</CodeBlock>
          </div>
        </SectionBand>

        <SectionBand eyebrow="Risks" title="Remaining Operational Risks">
          <InfoGrid>
            <InfoCard label="Railway Config" tone="slate" value="Not versioned">
              Railway service settings and domains are operational state, not committed
              infrastructure.
            </InfoCard>
            <InfoCard label="GitHub Schedule" tone="orange" value="Can be disabled">
              GitHub can disable scheduled workflows after prolonged repository inactivity.
            </InfoCard>
            <InfoCard label="ServiceTitan" tone="teal" value="Rate-limited">
              Refreshes are intentionally serialized. About 29 to 31 minutes is normal.
            </InfoCard>
            <InfoCard label="Upstream Outage" tone="orange" value="Still possible">
              If ServiceTitan keeps returning 5xx after all retry attempts, the workflow
              should still fail visibly instead of hiding a real upstream outage.
            </InfoCard>
          </InfoGrid>
        </SectionBand>

        <SectionBand eyebrow="Prevention" title="How To Prevent This Again">
          <TextPanel>
            <BulletList items={prevention} />
          </TextPanel>
        </SectionBand>
      </div>
    </OpsShell>
  );
}
