import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  formatBusinessDateLabel,
  formatCurrency,
  formatNumber,
  formatPercent,
  toBusinessDateString
} from "@irbis/utils";
import { PerformanceStaffAvatar } from "../../../components/performance-staff-avatar";
import { PrintReportButton } from "../../../components/print-report-button";
import { getBrandLogoUrl } from "../../../lib/assets";
import {
  buildCoachingFocus,
  buildPerformanceRoster,
  getPerformancePlan,
  type CoachingFocus,
  type PerformancePlan
} from "../../../lib/performance-data";
import {
  loadServiceTechDeliverySnapshot,
  type ServiceTechDeliveryRow
} from "../../../lib/performance-delivery-source";
import {
  getLastCompletedWeek,
  loadPerformanceRoster
} from "../../../lib/performance-source";

type TechnicianReportPageProps = {
  params: Promise<{ technician: string }>;
};

export const dynamic = "force-dynamic";

function valueOrUnavailable(
  value: number | null | undefined,
  formatter: (input: number) => string,
) {
  return value == null ? "Data unavailable" : formatter(value);
}

function dialStatus(actual: number | null | undefined, target: number | null) {
  if (actual == null || target == null || target <= 0) {
    return "neutral";
  }
  if (actual >= target) {
    return "good";
  }
  if (actual >= target * 0.85) {
    return "watch";
  }
  return "risk";
}

function formatDurationMinutes(value: number) {
  const rounded = Math.round(value);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatAuditCalculation(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatRecordingRatio(value: number) {
  return `${value.toFixed(2)}x`;
}

function Metric(props: {
  label: string;
  value: string;
  detail?: string;
  tone?: "good" | "watch" | "risk" | "neutral";
}) {
  return (
    <div className={`coaching-metric coaching-metric--${props.tone ?? "neutral"}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.detail ? <small>{props.detail}</small> : null}
    </div>
  );
}

function BlockTitle(props: { number: number; title: string; subtitle?: string }) {
  return (
    <header className="coaching-block__title">
      <span>{props.number}</span>
      <div>
        <h2>{props.title}</h2>
        {props.subtitle ? <p>{props.subtitle}</p> : null}
      </div>
    </header>
  );
}

function buildDeliveryFocus(
  delivery: ServiceTechDeliveryRow,
  fallback: CoachingFocus,
): CoachingFocus {
  if (!delivery.actualSourceAvailable) {
    return {
      title: "Restore current scorecard coverage",
      reason: "No current ServiceTitan scorecard row is available, so this report makes no MTD performance conclusion.",
      instruction: "Confirm roster status and business-unit assignment before setting a coaching target.",
      target: "Current scorecard row available",
      play: [
        "Confirm active roster and department.",
        "Restore the ServiceTitan scorecard row if active.",
        "Coach only after current actuals are available."
      ],
      impact: null,
      impactFormula: null
    };
  }

  const options = delivery.execution.optionsPerOpportunity;
  if (options != null && options < 3) {
    return {
      title: "Present at least three options on every opportunity",
      reason: `MTD average is ${options.toFixed(2)} options per opportunity; the operating minimum is 3.0.`,
      instruction: "Build Good / Better / Best before presenting price and confirm that all options are saved on the job.",
      target: "3.0+ options per opportunity",
      play: [
        "Complete diagnosis before building estimates.",
        "Create at least three materially different solutions.",
        "Present all options, then document the customer's decision."
      ],
      impact: null,
      impactFormula: null
    };
  }


  const hhrRate = delivery.execution.hhrCompletionRate;
  const hhrEligible = delivery.execution.hhrEligibleJobs ?? 0;
  if (hhrEligible > 0 && hhrRate != null && hhrRate < 1) {
    return {
      title: "Complete the Home Health Card on every eligible diagnostic job",
      reason: `Completion is ${formatPercent(hhrRate, 0)} (${delivery.execution.hhrCompletedJobs ?? 0} of ${hhrEligible}) since the form was enabled.`,
      instruction: "Upload every required page before closing the eligible diagnostic job and confirm the form status is Completed.",
      target: "100% HHR completion",
      play: [
        "Open the triggered form when arriving on the job.",
        "Complete the inspection and upload every required page.",
        "Confirm Completed status before job closeout."
      ],
      impact: null,
      impactFormula: null
    };
  }

  const onTimeRate = delivery.execution.onTimeArrivalRate;
  if (onTimeRate != null && onTimeRate < 0.9) {
    return {
      title: "Arrive within the first half of every arrival window",
      reason: `MTD first-half arrival rate is ${formatPercent(onTimeRate, 0)} across ${delivery.execution.arrivalEligibleAppointments ?? 0} measured appointments.`,
      instruction: "Review the route before dispatch, leave enough travel buffer, and notify dispatch immediately when the first-half threshold is at risk.",
      target: "90%+ first-half arrival rate",
      play: [
        "Check the next appointment window before leaving the current job.",
        "Depart against the first-half cutoff, not the end of the window.",
        "Escalate scheduling conflicts to dispatch before the cutoff."
      ],
      impact: null,
      impactFormula: null
    };
  }

  const coverage = delivery.fieldPro.recordingCoverage;
  if (coverage != null && coverage < 0.8) {
    return {
      title: "Record every eligible customer conversation in Field Pro",
      reason: `MTD recording-to-job ratio is ${formatRecordingRatio(coverage)} across ${delivery.execution.completedJobs} completed jobs.`,
      instruction: "Start Field Pro at the beginning of every eligible visit and verify processing before closing the job.",
      target: "80%+ recording coverage",
      play: [
        "Start the recording before discovery begins.",
        "Keep the recording active through option presentation.",
        "Confirm the recording is uploaded before leaving the job."
      ],
      impact: null,
      impactFormula: null
    };
  }

  return fallback;
}

export async function generateMetadata({ params }: TechnicianReportPageProps): Promise<Metadata> {
  const { technician } = await params;
  const plan = getPerformancePlan(technician);

  return {
    title: plan ? `${plan.technician} · Weekly Coaching Report` : "Weekly Coaching Report"
  };
}

export default async function TechnicianReportPage({ params }: TechnicianReportPageProps) {
  const { technician } = await params;
  const basePlan = getPerformancePlan(technician);

  if (!basePlan) {
    notFound();
  }

  const deliverySnapshot = await loadServiceTechDeliverySnapshot();
  const delivery = deliverySnapshot?.technicians.find((row) => row.slug === basePlan.slug) ?? null;
  const plan: PerformancePlan = delivery?.personalizedTargets
    ? {
        ...basePlan,
        month: deliverySnapshot?.periodFrom.slice(0, 7) ?? basePlan.month,
        approvalStatus: delivery.plan?.approvalStatus ?? basePlan.approvalStatus,
        department: delivery.department,
        sourceKind: basePlan.sourceKind,
        monthlySalesGoal: delivery.plan ? delivery.plan.monthlySalesGoal : basePlan.monthlySalesGoal,
        membershipMonthlyGoal: delivery.plan ? delivery.plan.membershipMonthlyGoal : basePlan.membershipMonthlyGoal,
        reviewMonthlyGoal: delivery.plan ? delivery.plan.reviewMonthlyGoal : basePlan.reviewMonthlyGoal ?? null,
        workingDaysMonthly: delivery.plan ? delivery.plan.workingDaysMonthly : basePlan.workingDaysMonthly ?? null,
        targetOpportunitiesMonthly: delivery.personalizedTargets.targetOpportunitiesMonthly,
        targetRate: delivery.personalizedTargets.targetRate,
        targetRateType: delivery.personalizedTargets.targetRateType,
        targetAverage: delivery.personalizedTargets.targetAverage,
      }
    : basePlan;
  const cutoffDate = deliverySnapshot?.cutoffDate ?? toBusinessDateString(new Date(), "America/Los_Angeles");
  const week = getLastCompletedWeek();
  const mtdRoster = await loadPerformanceRoster(cutoffDate);
  const liveRow = mtdRoster.find((row) => row.slug === plan.slug);
  const deliveryRow = delivery
    ? buildPerformanceRoster(
        [{
          name: delivery.technician,
          sourceKind: plan.sourceKind,
          technicianId: delivery.technicianId,
          businessUnit: delivery.businessUnit,
          ...delivery.actual,
          snapshotTime: deliverySnapshot?.serviceTitanSnapshotTime ?? null
        }],
        cutoffDate,
        [plan],
      ).find((row) => row.slug === plan.slug)
    : null;
  const mtdRow = deliveryRow ?? liveRow;

  if (!mtdRow) {
    notFound();
  }

  const focus = delivery
    ? buildDeliveryFocus(delivery, buildCoachingFocus(mtdRow))
    : buildCoachingFocus(mtdRow);
  const paceTone =
    mtdRow.pace == null
      ? "neutral"
      : mtdRow.pace >= 1
        ? "good"
        : mtdRow.pace >= 0.85
          ? "watch"
          : "risk";
  const rateName = plan.targetRateType === "close" ? "Close rate" : "Conversion rate";
  const fieldPro = delivery
    ? {
        name: delivery.technician,
        email: delivery.email,
        team: null,
        snapshotTime: deliverySnapshot?.serviceTitanSnapshotTime ?? null,
        ...delivery.fieldPro
      }
    : mtdRow.fieldPro;
  const reportFrom = deliverySnapshot?.periodFrom ?? week.from;
  const reportLabel = delivery ? "Month-to-Date Coaching Report" : "Weekly Coaching Report";
  const reportState = deliverySnapshot?.reportVersion ?? (delivery?.personalizedTargets ? "V2" : delivery ? "V1" : "DRAFT");
  const targetBasis = delivery?.personalizedTargets;
  const updatedGoalPending = plan.approvalStatus === "UPDATED_GOAL_PENDING";
  const leadsSetGoal = delivery?.plan?.leadsSetGoal ?? null;
  const installSalesGoal = delivery?.plan?.installSalesGoal ?? null;
  const membershipConversionGoal = delivery?.plan?.membershipConversionGoal ?? null;
  const actualSourceAvailable = delivery?.actualSourceAvailable ?? true;
  const isAdvisor = plan.sourceKind === "advisor";

  return (
    <div className="performance-report-screen">
      <div className="performance-report-toolbar">
        <a href="/performance">Back to coaching queue</a>
        <div>
          <span>{reportState} · Manager review</span>
          <PrintReportButton />
        </div>
      </div>

      <article className="coaching-report" data-coaching-report="true">
        <header className="coaching-report__header">
          <div className="coaching-report__brand">
            {getBrandLogoUrl() ? <img alt="IRBIS HVAC" src={getBrandLogoUrl() ?? ""} /> : <strong>IRBIS</strong>}
          </div>
          <div className="coaching-report__identity">
            <PerformanceStaffAvatar
              imageUrl={null}
              large={true}
              name={plan.technician}
            />
            <div>
              <div className="coaching-report__eyebrow">{plan.department}</div>
              <h1>{plan.technician}</h1>
              <p>{reportLabel} · {formatBusinessDateLabel(reportFrom)}–{formatBusinessDateLabel(cutoffDate)}</p>
            </div>
          </div>
          <div className="coaching-report__state">
            <strong>{reportState}</strong>
            <span>MTD cutoff {formatBusinessDateLabel(cutoffDate)}</span>
          </div>
        </header>

        <section className="coaching-block coaching-block--pace">
          <BlockTitle
            number={1}
            title="Pace to goal"
            subtitle={updatedGoalPending
              ? "Updated trailing-90-day goal was not provided; actual performance remains visible"
              : "Monthly progress through the report cutoff"}
          />
          <div className="coaching-metrics coaching-metrics--four">
            <Metric label="Monthly goal" value={valueOrUnavailable(plan.monthlySalesGoal, formatCurrency)} />
            <Metric label="MTD total sales" value={valueOrUnavailable(actualSourceAvailable ? mtdRow.actual?.revenue : null, formatCurrency)} />
            <Metric label="Expected by date" value={valueOrUnavailable(mtdRow.expectedRevenue, formatCurrency)} />
            <Metric
              label="Pace"
              value={valueOrUnavailable(mtdRow.pace, (value) => formatPercent(value, 0))}
              detail={mtdRow.paceGap == null ? "No matched source" : `${formatCurrency(mtdRow.paceGap)} vs expected`}
              tone={paceTone}
            />
          </div>
          {updatedGoalPending ? (
            <div className="coaching-goal-note">
              <strong>Updated goal pending</strong>
              <span>Vadim did not provide new opportunity, close-rate or revenue-per-opportunity targets for this technician. No target was inferred.</span>
            </div>
          ) : null}
        </section>

        <section className="coaching-block coaching-block--dials">
          <BlockTitle number={2} title="The Three Dials" subtitle={targetBasis ? "MTD actual versus personalized target" : "MTD actual versus monthly target"} />
          <div className="coaching-metrics coaching-metrics--three">
            <Metric
              label="Opportunities"
              value={valueOrUnavailable(actualSourceAvailable ? mtdRow.actual?.opportunities : null, formatNumber)}
              detail={targetBasis
                ? `Target ${valueOrUnavailable(targetBasis.targetOpportunitiesMonthly, formatNumber)}${targetBasis.dailyOpportunityGoal == null ? "" : ` · ${formatNumber(targetBasis.dailyOpportunityGoal)}/day`}`
                : `Target ${valueOrUnavailable(plan.targetOpportunitiesMonthly, formatNumber)}`}
              tone={dialStatus(mtdRow.actual?.opportunities, mtdRow.expectedOpportunities)}
            />
            <Metric
              label={rateName}
              value={valueOrUnavailable(actualSourceAvailable ? mtdRow.actual?.rate : null, (value) => formatPercent(value, 0))}
              detail={targetBasis
                ? `Target ${valueOrUnavailable(plan.targetRate, (value) => formatPercent(value, 0))} · 3-mo ${valueOrUnavailable(targetBasis.baselineRate, (value) => formatPercent(value, 0))}`
                : `Target ${valueOrUnavailable(plan.targetRate, (value) => formatPercent(value, 0))}`}
              tone={dialStatus(mtdRow.actual?.rate, plan.targetRate)}
            />
            <Metric
              label="Revenue / opportunity"
              value={valueOrUnavailable(actualSourceAvailable ? mtdRow.actual?.averageSale : null, formatCurrency)}
              detail={targetBasis
                ? `Target ${valueOrUnavailable(plan.targetAverage, formatCurrency)} · 3-mo ${valueOrUnavailable(targetBasis.baselineAverageSale, formatCurrency)}`
                : `Target ${valueOrUnavailable(plan.targetAverage, formatCurrency)}`}
              tone={dialStatus(mtdRow.actual?.averageSale, plan.targetAverage)}
            />
          </div>
        </section>

        <section className="coaching-block coaching-block--execution">
          <BlockTitle number={3} title={isAdvisor ? "Sales execution" : "Job execution"} subtitle="MTD leading behaviors and Auditor evidence" />
          <div className="coaching-execution-grid">
            <div>
              <span>Options per opportunity</span>
              <strong>{valueOrUnavailable(delivery?.execution.optionsPerOpportunity, (value) => value.toFixed(2))}</strong>
              <small>Operating minimum 3.0</small>
            </div>
            <div>
              <span>On-time arrival</span>
              <strong>{valueOrUnavailable(delivery?.execution.onTimeArrivalRate, (value) => formatPercent(value, 0))}</strong>
              <small>
                {delivery?.execution.arrivalEligibleAppointments == null
                  ? "Timing evidence unavailable"
                  : `${delivery.execution.onTimeFirstHalfAppointments ?? 0}/${delivery.execution.arrivalEligibleAppointments} within first half`}
              </small>
            </div>
            <div>
              <span>Average time on site</span>
              <strong>{valueOrUnavailable(delivery?.execution.averageTimeOnSiteMinutes, formatDurationMinutes)}</strong>
              <small>
                {delivery?.execution.onsiteEligibleAppointments == null
                  ? "Timesheet evidence unavailable"
                  : `${delivery.execution.onsiteEligibleAppointments} measured appointments`}
              </small>
            </div>
            <div>
              <span>{isAdvisor ? "Marketing lead close" : "Home Health Report Card"}</span>
              {isAdvisor ? (
                <>
                  <strong>{valueOrUnavailable(delivery?.actual.closeRateFromMarketingLeads, (value) => formatPercent(value, 0))}</strong>
                  <small>Marketing-attributed opportunities</small>
                </>
              ) : (
                <>
                  <strong>
                    {delivery?.execution.hhrEligibleJobs === 0
                      ? "No eligible jobs"
                      : valueOrUnavailable(delivery?.execution.hhrCompletionRate, (value) => formatPercent(value, 0))}
                  </strong>
                  <small>
                    {delivery?.execution.hhrEligibleJobs == null
                      ? "Form evidence unavailable"
                      : `${delivery.execution.hhrCompletedJobs ?? 0}/${delivery.execution.hhrEligibleJobs} since ${delivery.execution.hhrEffectiveDate ? formatBusinessDateLabel(delivery.execution.hhrEffectiveDate) : "enablement"}`}
                  </small>
                </>
              )}
            </div>
            <div>
              <span>{isAdvisor ? "TGL close" : "Membership conversion"}</span>
              {isAdvisor ? (
                <>
                  <strong>{valueOrUnavailable(delivery?.actual.closeRateFromTgl, (value) => formatPercent(value, 0))}</strong>
                  <small>{delivery?.actual.techLeadJobs ?? 0} technician-generated leads</small>
                </>
              ) : (
                <>
                  <strong>{valueOrUnavailable(actualSourceAvailable ? delivery?.actual.membershipConversionRate : null, (value) => formatPercent(value, 0))}</strong>
                  <small>
                    Target {valueOrUnavailable(membershipConversionGoal, (value) => formatPercent(value, 0))} · {actualSourceAvailable ? `${delivery?.actual.membershipsSold ?? 0}/${delivery?.actual.membershipOpportunities ?? 0} visits` : "current scorecard unavailable"}
                  </small>
                </>
              )}
            </div>
            <div>
              <span>Reviews received</span>
              <strong>{valueOrUnavailable(delivery?.execution.reviewsReceived, formatNumber)}</strong>
              <small>
                {delivery?.execution.reviewsReceived == null
                  ? `Monthly goal ${valueOrUnavailable(plan.reviewMonthlyGoal, formatNumber)} · actual unavailable`
                  : `Monthly goal ${valueOrUnavailable(plan.reviewMonthlyGoal, formatNumber)} · ${delivery.execution.serviceTitanAssignedReviews ?? 0} assigned · ${delivery.execution.textMatchedReviews ?? 0} text-matched`}
              </small>
            </div>
          </div>
          {delivery ? (
            <div className="coaching-growth-grid">
              {isAdvisor ? (
                <>
                  <div>
                    <span>Marketing sales</span>
                    <strong>{valueOrUnavailable(delivery.actual.totalSalesFromMarketingLeads, formatCurrency)}</strong>
                    <small>Sales attributed to marketing leads</small>
                  </div>
                  <div>
                    <span>TGL sales</span>
                    <strong>{valueOrUnavailable(delivery.actual.totalSalesFromTgl, formatCurrency)}</strong>
                    <small>Sales from technician-generated leads</small>
                  </div>
                  <div>
                    <span>Memberships sold</span>
                    <strong>{valueOrUnavailable(delivery.actual.membershipsSold, formatNumber)}</strong>
                    <small>Monthly goal {valueOrUnavailable(plan.membershipMonthlyGoal, formatNumber)}</small>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span>Leads set</span>
                    <strong>{valueOrUnavailable(actualSourceAvailable ? delivery.actual.leadsSet : null, formatNumber)}</strong>
                    <small>{leadsSetGoal == null ? "No updated TGL count target" : `Monthly goal ${formatNumber(leadsSetGoal)}`}</small>
                  </div>
                  <div>
                    <span>TGL conversion</span>
                    <strong>{valueOrUnavailable(actualSourceAvailable ? delivery.actual.replacementLeadConversionRate : null, (value) => formatPercent(value, 0))}</strong>
                    <small>{actualSourceAvailable ? `${delivery.actual.replacementOpportunities} replacement opportunities · separate from sales opportunities` : "Current scorecard unavailable"}</small>
                  </div>
                  <div>
                    <span>Install sales</span>
                    <strong>{valueOrUnavailable(actualSourceAvailable ? delivery.actual.installSales : null, formatCurrency)}</strong>
                    <small>
                      {installSalesGoal == null
                        ? "Updated goal not provided"
                        : `Monthly goal ${formatCurrency(installSalesGoal)} · ${delivery.plan?.installSalesActualSource === "total_sales" ? "direct total sales" : "TGL sales"}`}
                    </small>
                  </div>
                </>
              )}
            </div>
          ) : null}
          {delivery ? (
            <div className={`coaching-audit coaching-audit--${delivery.audit.status}`}>
              <strong>ServiceTitan audit signals</strong>
              <span>
                {delivery.audit.matchedAlerts.length > 0
                  ? `${delivery.audit.matchedAlerts.length} MTD signal(s): ${delivery.audit.matchedAlerts.slice(0, 2).map((alert) => alert.jobId ? `Job ${alert.jobId} · ${alert.title}` : alert.title).join("; ")}`
                  : delivery.audit.coverageNote}
              </span>
              <small>{deliverySnapshot?.auditCycleAt ? `Calculated ${formatAuditCalculation(deliverySnapshot.auditCycleAt)}` : "Calculation time unavailable"}</small>
            </div>
          ) : null}
        </section>

        <section className="coaching-block coaching-block--fieldpro">
          <BlockTitle number={4} title="Field Pro conversation quality" subtitle={delivery ? "MTD recording adoption and evidence" : "Recording adoption and evidence"} />
          {fieldPro ? (
            <div className="coaching-fieldpro-grid">
              <div>
                <span>Recordings / completed job</span>
                <strong>{valueOrUnavailable(fieldPro.recordingCoverage, formatRecordingRatio)}</strong>
                <small>{fieldPro.totalRecordings ?? 0} recordings / {fieldPro.completedJobs} completed jobs</small>
              </div>
              <div>
                <span>Quality recording rate</span>
                <strong>{valueOrUnavailable(fieldPro.qualityRecordingRate, (value) => formatPercent(value, 0))}</strong>
                <small>{fieldPro.qualityRecordings ?? 0} recordings over 10 minutes</small>
              </div>
              <div>
                <span>Average duration</span>
                <strong>{valueOrUnavailable(fieldPro.averageRecordingMinutes, (value) => `${Math.round(value)} min`)}</strong>
                <small>Longest {valueOrUnavailable(fieldPro.longestRecordingMinutes, (value) => `${Math.round(value)} min`)}</small>
              </div>
              <div>
                <span>Score and talk share</span>
                <strong>Data unavailable</strong>
                <small>Not included in the ServiceTitan report export</small>
              </div>
            </div>
          ) : (
            <div className="coaching-source-gap">
              <div><strong>Field Pro identity not matched</strong><span>The report source is connected, but no employee row matched this report.</span></div>
              <span>Review identity</span>
            </div>
          )}
        </section>

        <section className="coaching-block coaching-block--previous">
          <BlockTitle number={5} title="Last week’s focus" />
          <div className="coaching-previous">
            <div className="coaching-previous__summary">
              <div><span>Prior target</span><strong>Not assigned</strong></div>
              <div><span>Result</span><strong>Not measured</strong></div>
              <div><span>Status</span><strong>Baseline week</strong></div>
            </div>
            <p>This is the first report cycle. Progress tracking begins after manager approval.</p>
            <div className="coaching-manager-notes">
              <span>Manager notes</span>
              <i /><i /><i /><i />
            </div>
          </div>
        </section>

        <section className="coaching-block coaching-block--focus">
          <BlockTitle number={6} title="This week’s one focus" subtitle="First-version coaching recommendation" />
          <div className="coaching-focus">
            <div className="coaching-focus__main">
              <span>Primary action</span>
              <h2>{focus.title}</h2>
              <small>{focus.reason}</small>
              <p>{focus.instruction}</p>
            </div>
            <div className="coaching-focus__target">
              <span>Measurable target</span>
              <strong>{focus.target}</strong>
              <small>
                {focus.impact == null
                  ? "Dollar impact pending complete inputs"
                  : `${formatCurrency(focus.impact)} estimated monthly impact`}
              </small>
            </div>
            <div className="coaching-focus__play">
              <span>Exact play</span>
              <ol>
                {focus.play.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
            <div className="coaching-focus__checkin">
              <span>Manager check-in</span>
              <strong>Review at the next weekly coaching meeting</strong>
            </div>
          </div>
          {focus.impactFormula ? <p className="coaching-focus__formula">Impact: {focus.impactFormula}</p> : null}
        </section>

        <footer className="coaching-report__footer">
          <span>Evidence: ServiceTitan reports, appointments, timesheets, forms and reviews</span>
          <span>Plan status: {plan.approvalStatus} · {delivery?.plan?.sourceNote ?? plan.month}</span>
          <span>Manager notes: ____________________</span>
        </footer>
      </article>
    </div>
  );
}
