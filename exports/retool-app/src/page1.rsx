<Screen
  id="page1"
  _customShortcuts={[]}
  _hashParams={[]}
  _order={0}
  _searchParams={[]}
  browserTitle=""
  title="Service Technician Dashboard (HVAC - SERVICE)"
  urlSlug=""
  uuid="e607ad4a-492d-4550-afe9-e5918c51d984"
>
  <RESTQuery
    id="getToken"
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
  <RESTQuery
    id="getTechnicianReport"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ date4.value }}" },\n    { "name": "To", "value": "{{ date3.value }}" },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    resourceDisplayName="getTechnicianReport"
    resourceName="41a784a8-fde7-4b5d-8355-d94aaab5f3ee"
    runWhenModelUpdates={false}
    runWhenPageLoads={true}
    runWhenPageLoadsDelay="2000"
    transformer={
      "// Input shape expected:\n// { fields: [{name, label}, ...], data: [ [row...], ... ], snapshot_time?: string }\nconst F = Object.fromEntries((data.fields || []).map((f, i) => [f.name, i]));\n\n// Helpers\nconst num  = (v) => (v == null || v === '' || Number.isNaN(Number(v))) ? 0 : Number(v);\nconst sumK = (arr, k) => arr.reduce((s, x) => s + num(x[k] || 0), 0);\n\n// Optional knobs (global-friendly):\n// - window.techExtrasByName: { \"Tech Name\": { completedJobs, callbackRate, averageTicket, commission, photoUrl } }\n// - window.COMMISSION_RATE: number (e.g., 0.05) — used if no per-tech commission provided\n// - window.HEADSHOTS: { \"Tech Name\": \"https://...\" } — fallback photo map\nconst extrasByName    = (typeof window !== 'undefined' && window.techExtrasByName) || {};\nconst COMMISSION_RATE = (typeof window !== 'undefined' && typeof window.COMMISSION_RATE === 'number') ? window.COMMISSION_RATE : 0;\nconst HEADSHOTS       = (typeof window !== 'undefined' && window.HEADSHOTS) || {};\n\nconst rows = (data.data || []).map((r) => {\n  // Core fields by name (robust to order)\n  const name                    = r[F.Name];\n  const businessUnit            = r[F.TechnicianBusinessUnit];\n  const completedRevenue        = num(r[F.CompletedRevenue]);\n  const opportunityJobAverage   = num(r[F.OpportunityJobAverage]);\n  const totalSales              = num(r[F.TotalSales]);\n  const salesOpportunity        = num(r[F.SalesOpportunity]);\n  const closedOpportunities     = num(r[F.ClosedOpportunities]);\n  const closeRate               = num(r[F.CloseRate]); // 0..1\n  const avgSaleFromOpps         = num(r[F['OpportunityAverageSale']]); // label: \"Average Sale from Opportunities\"\n  const replacementOpportunity  = num(r[F.ReplacementOpportunity]);\n  const leadsSet                = num(r[F.LeadsSet]);\n  const replacementLeadConvRate = num(r[F.ReplacementLeadConversionRate]); // 0..1\n  const techLeadRevenue         = num(r[F.TotalLeadSales]); // label: \"Total Tech Lead Sales\"\n  const membershipOpportunities = num(r[F.MembershipOpportunities]);\n  const membershipsSold         = num(r[F.MembershipsSold]);\n  const techMembershipConvPct   = num(r[F.MembershipConversionRate]); // 0..1\n\n  const totalInfluencedRevenue  = completedRevenue + techLeadRevenue;\n\n  // Optional extras (from another query or globals)\n  const extra = extrasByName[name] || {};\n  const completedJobs  = (extra.completedJobs ?? null) === null ? null : num(extra.completedJobs);\n  const callbackRateEx = (extra.callbackRate ?? null);\n  const callbackRate   = callbackRateEx === null ? null : Number(callbackRateEx); // 0..1 expected\n  const avgTicketEx    = (extra.averageTicket ?? null);\n  const averageTicket  = avgTicketEx === null ? (opportunityJobAverage || avgSaleFromOpps) : Number(avgTicketEx);\n  const commission     = (extra.commission ?? null) !== null\n                           ? Number(extra.commission)\n                           : totalInfluencedRevenue * COMMISSION_RATE;\n  const photoUrl       = (extra.photoUrl ?? null) || HEADSHOTS[name] || null;\n\n  return {\n    name,\n    businessUnit,\n    completedRevenue,\n    opportunityJobAverage,\n    totalSales,\n    salesOpportunity,\n    closedOpportunities,\n    closeRate,                         // 0..1 (per-tech)\n    avgSaleFromOpps,\n    replacementOpportunity,\n    leadsSet,\n    replacementLeadConvRate,           // 0..1\n    totalTechLeadSales: techLeadRevenue,\n    membershipOpportunities,\n    membershipsSold,\n    techMembershipConvPct,             // 0..1\n    totalInfluencedRevenue,\n\n    // --- Added fields for the card UI ---\n    completedJobs,\n    callbackRate,\n    averageTicket,\n    commission,\n    photoUrl\n    // ------------------------------------\n  };\n});\n\n// Ranked copy by totalInfluencedRevenue (descending)\nconst rows_ranked = rows\n  .slice()\n  .sort((a, b) => b.totalInfluencedRevenue - a.totalInfluencedRevenue)\n  .map((x, i) => ({ ...x, rankByRevenue: i + 1 }));\n\n// ---------- Precise, weighted totals ----------\nconst sumSalesOpp   = sumK(rows, 'salesOpportunity');\nconst sumClosedOpp  = sumK(rows, 'closedOpportunities');\nconst sumMemOpp     = sumK(rows, 'membershipOpportunities');\nconst sumMemSold    = sumK(rows, 'membershipsSold');\n\n// Weighted avg sale from opps by closed opps\nconst wAvgSaleNumer = rows.reduce((s, x) => s + num(x.avgSaleFromOpps) * num(x.closedOpportunities), 0);\nconst wAvgSaleDenom = sumClosedOpp;\n\n// Safe guards against zero denominators\nconst avgCloseRate_precise       = sumSalesOpp > 0 ? (sumClosedOpp / sumSalesOpp) : 0;\nconst avgAvgSaleFromOpps_precise = wAvgSaleDenom > 0 ? (wAvgSaleNumer / wAvgSaleDenom) : 0;\nconst avgMembershipConv_precise  = sumMemOpp > 0 ? (sumMemSold / sumMemOpp) : 0;\n\n// Totals in same keys as before (string for rates with 3 d.p.; money-like with 2 d.p.)\nconst totals = {\n  totalInfluencedRevenue: sumK(rows, 'totalInfluencedRevenue'),\n  completedRevenue: sumK(rows, 'completedRevenue'),\n  avgCloseRate: avgCloseRate_precise.toFixed(3),\n  avgAvgSaleFromOpps: Number(avgAvgSaleFromOpps_precise.toFixed(2)),\n  avgMembershipConv: avgMembershipConv_precise.toFixed(3),\n};\n\n// Snapshot time compatibility (pull from common places if present)\nconst snapshot_time =\n  data.snapshot_time ||\n  (data.meta && data.meta.snapshot_time) ||\n  data.snapshotTime ||\n  null;\n\nreturn { rows, rows_ranked, totals, snapshot_time };\n"
    }
    type="POST"
  />
  <SqlQueryUnified
    id="query2"
    enableTransformer={true}
    isMultiplayerEdited={false}
    query={include("../lib/query2.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    resourceTypeOverride=""
    transformer={
      "// Transformer: getTechnicianReport-compatible (preserves original naming)\n\n// --- Additive config (safe to tweak) ---\nvar COMMISSION_RATE = 0.0;   // e.g., 0.05 for 5%\nvar HEADSHOTS = {};          // optional: { \"Tech Name\": \"https://...\" }\n// --------------------------------------\n\n// ---------- Helpers ----------\nfunction cleanNum(v){\n  if (v == null || v === '') return 0;\n  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;\n  if (typeof v === 'string'){\n    var s = v.replace(/[%,$,\\s]/g,'');\n    var n = Number(s);\n    return Number.isNaN(n) ? 0 : n;\n  }\n  var n = Number(v);\n  return Number.isNaN(n) ? 0 : n;\n}\n\n// Accept ratios (0..1), \"12%\", or whole-number percents (80)\nfunction toRatio(v){\n  if (typeof v === 'string' && v.includes('%')) return cleanNum(v)/100;\n  var n = cleanNum(v);\n  return n > 10 ? n/100 : n;\n}\n\nfunction sum(a,k){return a.reduce((s,x)=>s+cleanNum(x[k]||0),0)}\nfunction mean(a,k){return a.length ? sum(a,k)/a.length : 0}\n\n// ---------- Normalize inputs ----------\nvar hasFieldsData = Array.isArray(data?.fields) && Array.isArray(data?.data);\n\n// Snapshot time in common places\nvar snapshot_time =\n  (Array.isArray(data?.snapshot_time) ? data.snapshot_time[0] : data?.snapshot_time) ||\n  data?.meta?.snapshot_time ||\n  data?.snapshotTime ||\n  null;\n\n// raw_json (if present)\nvar raw = (Array.isArray(data?.raw_json) ? data.raw_json[0] : data?.raw_json) || {};\n\n// Prefer, in order: {fields,data}, top-level array, data.rows, raw_json.data, raw array\nvar rowsRaw =\n  (hasFieldsData && data.data) ||\n  (Array.isArray(data) ? data : null) ||\n  (Array.isArray(data?.rows) ? data.rows : null) ||\n  (Array.isArray(raw?.data) ? raw.data : null) ||\n  (Array.isArray(raw) ? raw : null) ||\n  [];\n\n// ---------- Field map / accessor for array-rows ----------\nvar F = Object.fromEntries(((hasFieldsData ? data.fields : raw.fields) || []).map(function(f,i){return [f.name,i]}));\nfunction at(row, key){\n  if (row == null) return undefined;\n  if (!Array.isArray(row)) return row[key]; // object-row\n  var idx = F[key];\n  return (typeof idx === 'number') ? row[idx] : undefined; // array-row via field map\n}\n\n// ---------- Build rows (preserving your original naming) ----------\nvar list = (Array.isArray(rowsRaw) ? rowsRaw : []).map(function(r){\n  // Name & BU\n  var name         = at(r,'Name');\n  var businessUnit = at(r,'TechnicianBusinessUnit');\n\n  // Core numeric fields (source columns from your fields list)\n  var completedRevenue       = cleanNum(at(r,'CompletedRevenue'));\n  var opportunityJobAverage  = cleanNum(at(r,'OpportunityJobAverage'));\n  var totalSales             = cleanNum(at(r,'TotalSales'));\n  var salesOpportunity       = cleanNum(at(r,'SalesOpportunity'));\n  var closedOpportunities    = cleanNum(at(r,'ClosedOpportunities'));\n  var closeRate              = toRatio(at(r,'CloseRate')); // 0..1\n  var avgSaleFromOpps        = cleanNum(at(r,'OpportunityAverageSale'));\n  var replacementOpportunity = cleanNum(at(r,'ReplacementOpportunity'));\n  var leadsSet               = cleanNum(at(r,'LeadsSet'));\n  var replacementLeadConvRate= toRatio(at(r,'ReplacementLeadConversionRate')); // 0..1\n  var totalTechLeadSales     = cleanNum(at(r,'TotalLeadSales'));\n  var membershipOpportunities= cleanNum(at(r,'MembershipOpportunities'));\n  var membershipsSold        = cleanNum(at(r,'MembershipsSold'));\n  var techMembershipConvPct  = toRatio(at(r,'MembershipConversionRate')); // 0..1\n\n  // Optional extras if present in some datasets\n  var completedJobs = cleanNum(at(r,'CompletedJobs'));\n  var callbackRate  = toRatio(at(r,'CallbackRate'));\n  var photoUrl      = HEADSHOTS[String(name)] || at(r,'PhotoUrl') || null;\n\n  // Useful derived fields (names preserved for UI)\n  var averageTicket = opportunityJobAverage || avgSaleFromOpps || 0; // pick the best available\n  var totalInfluencedRevenue = completedRevenue + totalTechLeadSales;\n  var commission = (totalSales + totalTechLeadRevenue) * COMMISSION_RATE; // note: variable below\n\n  // Fix var name (typo guard)\n  var totalTechLeadRevenue = totalTechLeadSales;\n  commission = (totalSales + totalTechLeadRevenue) * COMMISSION_RATE;\n\n  return {\n    // ---- EXACT keys your UI references ----\n    name: name,\n    businessUnit: businessUnit,\n    completedRevenue: completedRevenue,\n    opportunityJobAverage: opportunityJobAverage,\n    totalSales: totalSales,\n    salesOpportunity: salesOpportunity,\n    closedOpportunities: closedOpportunities,\n    closeRate: closeRate,\n    avgSaleFromOpps: avgSaleFromOpps,\n    replacementOpportunity: replacementOpportunity,\n    leadsSet: leadsSet,\n    replacementLeadConvRate: replacementLeadConvRate,\n    totalTechLeadSales: totalTechLeadSales,\n    membershipOpportunities: membershipOpportunities,\n    membershipsSold: membershipsSold,\n    techMembershipConvPct: techMembershipConvPct,\n    totalInfluencedRevenue: totalInfluencedRevenue,\n\n    // ---- Extras you mentioned for the card UI (optional) ----\n    completedJobs: completedJobs,\n    callbackRate: callbackRate,\n    averageTicket: averageTicket,\n    commission: commission,\n    photoUrl: photoUrl\n  };\n});\n\n// ---------- Ranked array (non-breaking convenience) ----------\nvar rows_ranked = list\n  .slice()\n  .sort((a,b)=>b.totalInfluencedRevenue - a.totalInfluencedRevenue)\n  .map((x, i) => ({ ...x, rankByRevenue: i + 1 }));\n\n// ---------- Totals (names preserved) ----------\nvar totals = {\n  totalInfluencedRevenue: sum(list,'totalInfluencedRevenue'),\n  completedRevenue: sum(list,'completedRevenue'),\n  avgCloseRate: mean(list,'closeRate').toFixed(3),\n  avgAvgSaleFromOpps: mean(list,'avgSaleFromOpps'),\n  avgMembershipConv: mean(list,'techMembershipConvPct').toFixed(3)\n};\n\n// ---------- Return ----------\nreturn { rows: list, rows_ranked, totals, snapshot_time };\n"
    }
    warningCodes={[]}
  />
  <JavascriptQuery
    id="holdForOneMinute"
    notificationDuration={4.5}
    query={include("../lib/holdForOneMinute.js", "string")}
    resourceName="JavascriptQuery"
    showSuccessToaster={false}
  />
  <RetoolStorageQuery
    id="query7"
    enableTransformer={true}
    folderName="technicians_photo"
    resourceDisplayName="retool_storage"
    resourceName="retool_storage"
  />
  <connectResource id="query8" _componentId={null} />
  <JavascriptQuery
    id="query9"
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/query9.js", "string")}
    resourceName="JavascriptQuery"
    showSuccessToaster={false}
  />
  <Frame
    id="$main"
    enableFullBleed={false}
    isHiddenOnDesktop={false}
    isHiddenOnMobile={false}
    margin="4px 8px"
    padding="8px 12px"
    style={{}}
    type="main"
  >
    <Image
      id="image3"
      fit="contain"
      heightType="fixed"
      horizontalAlign="center"
      retoolStorageFileId="042f81fb-9652-444f-bbf3-f57312ea76e9"
      src="https://picsum.photos/id/1025/800/600"
      srcType="retoolStorageFileId"
    />
    <Navigation
      id="navigation4"
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
        id="c40a10c2"
        event="click"
        method="openPage"
        params={{
          pageName: "{{ item.id }}",
          options: { map: { passDataWith: "urlParams" } },
        }}
        pluginId=""
        type="util"
        waitMs="0"
        waitType="debounce"
      />
    </Navigation>
    <Date
      id="date4"
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
      id="button3"
      iconBefore="bold/interface-calendar-alternate"
      loading="{{ holdForOneMinute.isFetching }}"
      style={{ map: { background: "#00363e" } }}
      text="YTD"
    >
      <Event
        id="508a6465"
        enabled=""
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="b01cff85"
        enabled="{{ !!getToken.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getTechnicianReport"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
      <Event
        id="38b69c12"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date3"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="0e78a0ca"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('year')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date4"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
    <Date
      id="date3"
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
      id="button4"
      iconBefore="bold/interface-calendar-alternate"
      loading="{{ holdForOneMinute.isFetching }}"
      style={{ map: { background: "#00363e" } }}
      text="MTD"
    >
      <Event
        id="42e4ab46"
        enabled=""
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="ba8cf6dc"
        enabled="{{ !!getToken.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getTechnicianReport"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
      <Event
        id="6229dac0"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}",
          },
        }}
        pluginId="date3"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="b6c66aaf"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('month')\n    .format('YYYY-MM-DD')\n}}",
          },
        }}
        pluginId="date4"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
    <HTML id="html6" html={include("../lib/html6.html", "string")} />
  </Frame>
</Screen>
