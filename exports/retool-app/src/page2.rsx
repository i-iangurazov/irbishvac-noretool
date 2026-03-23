<Screen
  id="page2"
  _customShortcuts={[]}
  _hashParams={[]}
  _order={0}
  _searchParams={[]}
  browserTitle={null}
  title="INSTALLER Dashboard - HVAC INSTALL"
  urlSlug={null}
  uuid="d7c1cf56-dafb-4f36-b3be-8196e4522b32"
>
  <SqlQueryUnified
    id="query4"
    enableTransformer={true}
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/query4.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    showSuccessToaster={false}
    showUpdateSetValueDynamicallyToggle={false}
    transformer={
      "// Transformer: txInstallerReport (array-aware for your raw_json)\n\n// ---------- Helpers ----------\nconst cleanNum = (v) => {\n  if (v == null || v === '') return 0;\n  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;\n  if (typeof v === 'string') {\n    // Strip $, %, commas, spaces\n    const s = v.replace(/[%,$,\\s]/g, '');\n    const n = Number(s);\n    return Number.isNaN(n) ? 0 : n;\n  }\n  const n = Number(v);\n  return Number.isNaN(n) ? 0 : n;\n};\n\nconst num = (v) => cleanNum(v);\n\n/**\n * Ratio parser:\n * - \"12%\" -> 0.12\n * - 80    -> 0.80  (whole-number percent)\n * - 0.8   -> 0.8   (already ratio)\n * - 2.1   -> 2.1   (already ratio; do NOT /100 because your data uses >1 for 200%+)\n * Heuristic: divide by 100 only when numeric value > 10 (likely a whole-number percent)\n */\nconst ratio = (v) => {\n  if (typeof v === 'string' && v.includes('%')) return cleanNum(v) / 100;\n  const n = cleanNum(v);\n  return n > 10 ? n / 100 : n;\n};\n\nconst sumK = (arr, k) => arr.reduce((s, x) => s + num(x[k] || 0), 0);\n\nconst moneyShort = (n) => {\n  const sign = n < 0 ? '-' : '';\n  const a = Math.abs(num(n));\n  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;\n  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;\n  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;\n  return `${sign}$${a.toFixed(2)}`;\n};\n\nconst pct = (v) => `${(num(v) * 100).toFixed(1)}%`;\n\n// ---------- Normalize inputs ----------\nconst hasOriginalShape = Array.isArray(data?.fields) && Array.isArray(data?.data);\n\nconst snapshot_time =\n  (Array.isArray(data?.snapshot_time) ? data.snapshot_time[0] : data?.snapshot_time) ||\n  data?.meta?.snapshot_time ||\n  data?.snapshotTime ||\n  null;\n\nconst raw =\n  (Array.isArray(data?.raw_json) ? data.raw_json[0] : data?.raw_json) || {};\n\nconst rowsRaw =\n  (hasOriginalShape && data.data) ||\n  (Array.isArray(data) ? data : null) ||\n  (Array.isArray(data?.rows) ? data.rows : null) ||\n  (Array.isArray(raw?.data) ? raw.data : null) ||\n  (Array.isArray(raw) ? raw : null) ||\n  [];\n\n// ---------- Field map / indices ----------\nconst fieldsArr =\n  (hasOriginalShape && data.fields) ||\n  (Array.isArray(raw?.fields) && raw.fields) ||\n  [\n    { name: 'Name' },\n    { name: 'TechnicianBusinessUnit' },\n    { name: 'CompletedRevenue' },\n    { name: 'OpportunityJobAverage' },\n    { name: 'TotalSales' },\n    { name: 'SalesOpportunity' },\n    { name: 'ClosedOpportunities' },\n    { name: 'CloseRate' },\n    { name: 'OpportunityAverageSale' },\n    { name: 'ReplacementOpportunity' },\n    { name: 'LeadsSet' },\n    { name: 'ReplacementLeadConversionRate' },\n    { name: 'TotalLeadSales' },\n    { name: 'MembershipOpportunities' },\n    { name: 'MembershipsSold' },\n    { name: 'MembershipConversionRate' },\n    { name: 'CompletedJobs' },\n    { name: 'CallbackRate' },\n    { name: 'PhotoUrl' },\n  ];\n\nconst F = Object.fromEntries((fieldsArr || []).map((f, i) => [f.name, i]));\nconst at = (row, key) => {\n  if (row == null) return undefined;\n  if (!Array.isArray(row)) return row[key]; // object-row\n  const idx = F[key];\n  return typeof idx === 'number' ? row[idx] : undefined; // array-row via field map\n};\n\n// ---------- Build rows ----------\nconst rows = (Array.isArray(rowsRaw) ? rowsRaw : []).map((r) => {\n  const name = at(r, 'Name') ?? at(r, 'TechnicianName') ?? at(r, 'TechName') ?? at(r, 'Tech');\n\n  const installedRevenue = num(\n    at(r, 'CompletedRevenue') ??\n    at(r, 'Revenue') ??\n    at(r, 'InstalledRevenue') ??\n    at(r, 'TotalRevenue')\n  );\n\n  const jobsCompleted = num(\n    at(r, 'CompletedJobs') ??\n    at(r, 'ClosedOpportunities') ??\n    at(r, 'JobsCompleted') ??\n    at(r, 'Jobs')\n  );\n\n  const recallsCaused = num(at(r, 'RecallsCaused') ?? 0);\n\n  const billableEfficiency = ratio(\n    at(r, 'BillableEfficiency') ??\n    at(r, 'CloseRate') ??\n    at(r, 'ClosePct') ??\n    at(r, 'ConversionRate')\n  );\n\n  const averageInstall = num(\n    at(r, 'TotalJobAverage') ??\n    at(r, 'OpportunityJobAverage') ??\n    at(r, 'OpportunityAverageSale') ??\n    at(r, 'AverageInstall') ??\n    at(r, 'AvgTicket')\n  );\n\n  return {\n    name,\n    installedRevenue,\n    jobsCompleted,\n    recallsCaused,\n    billableEfficiency,\n    averageInstall,\n\n    installedRevenueFormatted: moneyShort(installedRevenue),\n    billableEfficiencyFormatted: pct(billableEfficiency),\n    averageInstallFormatted: moneyShort(averageInstall),\n  };\n});\n\nif (!rows.length) {\n  console.warn('txInstallerReport: no rows found; check input shape');\n}\n\n// ---------- Ranking ----------\nconst rows_ranked = rows\n  .slice()\n  .sort(\n    (a, b) =>\n      b.installedRevenue - a.installedRevenue ||\n      String(a.name ?? '').localeCompare(String(b.name ?? ''))\n  )\n  .map((x, i) => ({ ...x, rankByRevenue: i + 1 }));\n\n// ---------- Totals (weighted by jobsCompleted) ----------\nconst totalInstalledRevenue = sumK(rows, 'installedRevenue');\nconst totalJobsCompleted    = sumK(rows, 'jobsCompleted');\nconst totalRecallsCaused    = sumK(rows, 'recallsCaused');\n\nconst effNumer = rows.reduce(\n  (s, x) => s + num(x.billableEfficiency) * num(x.jobsCompleted),\n  0\n);\nconst billableEfficiencyAvg =\n  totalJobsCompleted > 0\n    ? effNumer / totalJobsCompleted\n    : (rows.length ? sumK(rows, 'billableEfficiency') / rows.length : 0);\n\nconst avgInstallNumer = rows.reduce(\n  (s, x) => s + num(x.averageInstall) * num(x.jobsCompleted),\n  0\n);\nconst averageInstallAll =\n  totalJobsCompleted > 0\n    ? avgInstallNumer / totalJobsCompleted\n    : (rows.length ? sumK(rows, 'averageInstall') / rows.length : 0);\n\n// Leader fields\nconst leaderName = rows_ranked[0]?.name ?? null;\nconst leaderRevenue = rows_ranked[0]?.installedRevenue ?? 0;\n\nconst totals = {\n  // keep your keys as requested\n  jobsCompleted: totalJobsCompleted,\n  recallsCaused: totalRecallsCaused,\n  billableEfficiencyAvg: Number(billableEfficiencyAvg.toFixed(3)), // 1.234 = 123.4%\n  averageInstall: Number(averageInstallAll.toFixed(2)),\n\n  // also include installedRevenue aggregate for convenience\n  installedRevenue: totalInstalledRevenue,\n\n  leaderName,\n  leaderRevenue,\n  leaderRevenueFormatted: moneyShort(leaderRevenue),\n};\n\n// ---------- Return ----------\nreturn { rows, rows_ranked, totals, snapshot_time };\n"
    }
    updateSetValueDynamically={true}
    warningCodes={[]}
  />
  <RESTQuery
    id="getInstallerReport"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ date6.value }}" },\n    { "name": "To", "value": "{{ date5.value }}" },\n    { "name": "BusinessUnitIds", "value": [1809, 64313020] },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken3.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    resourceDisplayName="getInstallerReport"
    resourceName="4c8f929d-c471-4c10-b003-70d9ceb15a2a"
    runWhenModelUpdates={false}
    runWhenPageLoads={true}
    runWhenPageLoadsDelay="2000"
    transformer="// Transformer: txInstallerReport
// Input: { fields: [{name,label},...], data: [[...],...], snapshot_time? }

const F = Object.fromEntries((data.fields || []).map((f, i) => [f.name, i]));
const rowsRaw = data.data || [];

// Helpers
const num  = v => (v == null || v === '' || Number.isNaN(Number(v))) ? 0 : Number(v);
const sumK = (arr, k) => arr.reduce((s, x) => s + num(x[k] || 0), 0);
const moneyShort = (n) => {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(num(n));
  if (a >= 1e9) return `${sign}$${(a/1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a/1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a/1e3).toFixed(1)}K`;
  return `${sign}$${a.toFixed(2)}`;
};
const pct = (v) => `${(num(v) * 100).toFixed(1)}%`;

// ----- Rows (one per installer) -----
const rows = rowsRaw.map((r) => {
  const name               = r[F.Name];
  const installedRevenue   = num(r[F.CompletedRevenue]);   // MAIN METRIC
  const jobsCompleted      = num(r[F.CompletedJobs]);      // (#opps)
  const recallsCaused      = num(r[F.RecallsCaused]);
  const billableEfficiency = num(r[F.BillableEfficiency]); // ratio (1.74 = 174%)
  const averageInstall     = num(r[F.TotalJobAverage]);

  return {
    name,
    installedRevenue,
    jobsCompleted,
    recallsCaused,
    billableEfficiency,      // 1.0 = 100%
    averageInstall,

    // handy formatted values for UI
    installedRevenueFormatted:  moneyShort(installedRevenue),
    billableEfficiencyFormatted: pct(billableEfficiency),
    averageInstallFormatted:     moneyShort(averageInstall),
  };
});

// ----- Ranked copy (by Installed Revenue desc) -----
const rows_ranked = rows
  .slice()
  .sort((a, b) => b.installedRevenue - a.installedRevenue || String(a.name).localeCompare(String(b.name)))
  .map((x, i) => ({ ...x, rankByRevenue: i + 1 }));

// ----- Totals (weighted avgs by # jobs) -----
const totalInstalledRevenue = sumK(rows, 'installedRevenue');
const totalJobsCompleted    = sumK(rows, 'jobsCompleted');
const totalRecallsCaused    = sumK(rows, 'recallsCaused');

// Weighted Billable Efficiency by jobs completed
const effNumer = rows.reduce((s, x) => s + num(x.billableEfficiency) * num(x.jobsCompleted), 0);
const effDenom = totalJobsCompleted;
const billableEfficiencyAvg = effDenom > 0
  ? effNumer / effDenom
  : (rows.length ? sumK(rows, 'billableEfficiency') / rows.length : 0);

// Weighted Average Install by jobs completed
const avgInstallNumer = rows.reduce((s, x) => s + num(x.averageInstall) * num(x.jobsCompleted), 0);
const avgInstallDenom = totalJobsCompleted;
const averageInstallAll = avgInstallDenom > 0
  ? avgInstallNumer / avgInstallDenom
  : (rows.length ? sumK(rows, 'averageInstall') / rows.length : 0);

const totals = {
  installedRevenue: totalInstalledRevenue,
  jobsCompleted: totalJobsCompleted,
  recallsCaused: totalRecallsCaused,
  billableEfficiencyAvg: Number(billableEfficiencyAvg.toFixed(3)), // ratio (1.234 = 123.4%)
  averageInstall: Number(averageInstallAll.toFixed(2)),

  // leader snapshot (by Installed Revenue)
  leaderName: rows_ranked[0]?.name ?? null,
  leaderRevenue: rows_ranked[0]?.installedRevenue ?? 0,
  leaderRevenueFormatted: moneyShort(rows_ranked[0]?.installedRevenue ?? 0),
};

// ----- Snapshot time passthrough -----
const snapshot_time =
  data.snapshot_time ||
  (data.meta && data.meta.snapshot_time) ||
  data.snapshotTime ||
  null;

return { rows, rows_ranked, totals, snapshot_time };"
    type="POST"
  />
  <RESTQuery
    id="getToken3"
    body="grant_type=client_credentials&client_id=cid.3uu1y44n3ouhdhhdq2arla286&client_secret=cs5.r0a0u4hnmxj1v4xzqfi87vunrejtq9o4rqkhqt1lc0zca7khww"
    bodyType="raw"
    headers={
      '[{"key":"Content-Type","value":"application/x-www-form-urlencoded"}]'
    }
    notificationDuration={4.5}
    query="?"
    resourceDisplayName="ST getToken"
    resourceName="77937821-032a-4ae6-8043-a86bef4faaa1"
    resourceTypeOverride=""
    runWhenModelUpdates={false}
    runWhenPageLoads={true}
    showSuccessToaster={false}
    type="POST"
  />
  <RetoolStorageQuery
    id="query11"
    enableTransformer={true}
    folderName="technicians_photo"
    resourceDisplayName="retool_storage"
    resourceName="retool_storage"
  />
  <Frame
    id="$main2"
    enableFullBleed={false}
    isHiddenOnDesktop={false}
    isHiddenOnMobile={false}
    padding="8px 12px"
    sticky={null}
    type="main"
  >
    <Image
      id="image6"
      fit="contain"
      heightType="fixed"
      horizontalAlign="center"
      retoolStorageFileId="042f81fb-9652-444f-bbf3-f57312ea76e9"
      src="https://picsum.photos/id/1025/800/600"
      srcType="retoolStorageFileId"
    />
    <Navigation
      id="navigation5"
      data="{{ retoolContext.pages }}"
      highlightByIndex="{{ retoolContext.currentPage === item.id }}"
      labels="{{ item.title || item.id }}"
      overflowMode="autoMenu"
      retoolFileObject={{}}
      style={{ map: { highlightBackground: "rgba(250, 110, 24, 0.2)" } }}
    >
      <Option id="00030" icon="bold/interface-home-3" label="Home" />
      <Option
        id="00031"
        icon="bold/interface-user-multiple"
        label="Customers"
      />
      <Option id="00032" icon="bold/interface-setting-cog" label="Settings" />
      <Event
        id="85a37fbb"
        event="click"
        method="openPage"
        params={{ map: { pageName: "{{ item.id }}" } }}
        pluginId=""
        type="util"
        waitMs="0"
        waitType="debounce"
      />
    </Navigation>
    <Date
      id="date6"
      dateFormat="MMM d, yyyy"
      datePlaceholder="{{ self.dateFormat.toUpperCase() }}"
      iconBefore="bold/interface-calendar"
      label=""
      labelPosition="top"
      value={
        "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('month')\n    .format('MMM D, YYYY')   // e.g. \"Nov 1, 2025\"\n}}"
      }
    />
    <Button
      id="button5"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="YTD"
    >
      <Event
        id="e521f271"
        enabled=""
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken3"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="02884a73"
        enabled="{{ !!getToken3.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getInstallerReport"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
      <Event
        id="9117eebc"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date5"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="d72de43c"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('year')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date6"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
    <Date
      id="date5"
      dateFormat="MMM d, yyyy"
      datePlaceholder="{{ self.dateFormat.toUpperCase() }}"
      iconBefore="bold/interface-calendar"
      label=""
      labelPosition="top"
      value={
        "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('MMM D, YYYY')   // e.g. \"Nov 27, 2025\"\n}}"
      }
    />
    <Button
      id="button6"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="MTD"
    >
      <Event
        id="a3e9122c"
        enabled=""
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken3"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="04ec7576"
        enabled="{{ !!getToken3.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getInstallerReport"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
      <Event
        id="a4b8b1ec"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}",
          },
        }}
        pluginId="date5"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="9a327f58"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('month')\n     \n    .format('YYYY-MM-DD')\n}}",
          },
        }}
        pluginId="date6"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
    <HTML id="html7" html={include("../lib/html7.html", "string")} />
  </Frame>
</Screen>
