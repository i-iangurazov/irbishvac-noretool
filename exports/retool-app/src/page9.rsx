<Screen
  id="page9"
  _customShortcuts={[]}
  _hashParams={[]}
  _order={0}
  _searchParams={[]}
  browserTitle={null}
  title="Campaign Summary Report"
  urlSlug="page9"
  uuid="f9029ddb-e105-4b3c-84d5-764232c92a7d"
>
  <SqlQueryUnified
    id="getCSR5"
    enableTransformer={true}
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/getCSR5.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    showSuccessToaster={false}
    showUpdateSetValueDynamicallyToggle={false}
    transformer={
      "// Transformer: campaignSummaryReport_v2 (explicit fields for your report)\n// Sort primary: Lead Calls (desc)\n// Output: { rows, rows_ranked, leader, snapshot_time, meta }\n\nfunction num(v){\n  if (v == null || v === '') return 0;\n  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;\n  if (typeof v === 'string'){\n    const n = Number(v.replace(/[%,$,\\s]/g,''));\n    return Number.isNaN(n) ? 0 : n;\n  }\n  const n = Number(v);\n  return Number.isNaN(n) ? 0 : n;\n}\n\nfunction toRatio(v){\n  // Accept 0..1 ratios or \"82%\" or whole-number percents\n  if (typeof v === 'string' && v.includes('%')) return num(v) / 100;\n  const n = num(v);\n  return n > 10 ? n / 100 : n;\n}\n\n// --- hydrate {fields,data} or from raw_json ---\nlet fields = Array.isArray(data?.fields) ? data.fields : [];\nlet rowsRaw = Array.isArray(data?.data) ? data.data : [];\n\nif ((!fields.length || !rowsRaw.length) && data?.raw_json){\n  const rawStr = Array.isArray(data.raw_json) ? data.raw_json[0] : data.raw_json;\n  try {\n    const obj = typeof rawStr === 'string' ? JSON.parse(rawStr) : rawStr;\n    if (Array.isArray(obj?.fields) && Array.isArray(obj?.data)){\n      fields = obj.fields;\n      rowsRaw = obj.data;\n    }\n  } catch(_) {}\n}\n\n// Accessors (positional or object rows)\nconst F = Object.fromEntries((fields || []).map((f,i)=>[f.name, i]));\nconst at = (row, key) => Array.isArray(row) ? row[F[key]] : row?.[key];\n\nfunction pick(row, keys){\n  for (const k of keys){\n    const v = at(row, k);\n    if (v != null && v !== '') return v;\n  }\n  return null;\n}\nfunction pickNum(row, keys){ return num(pick(row, keys)); }\nfunction pickRatio(row, keys){\n  const v = pick(row, keys);\n  return v == null || v === '' ? null : toRatio(v);\n}\n\n// Aliases (kept flexible, but aligned to your dataset labels)\nconst ALIAS = {\n  name: ['Name','Campaign Name','Campaign','Source','Channel'],\n\n  leadCalls: ['LeadCalls','Lead Calls','Calls'],\n  bookedJobsByCall: ['BookedJobsByCall','Booked Jobs By Call'],\n  inboundBookingRate: ['InboundBookingRate','Inbound Booking Rate','BookingRate'],\n\n  campaignLeads: ['Leads','CampaignLeads','Campaign Leads'],\n  totalJobsBooked: ['TotalJobsBooked','Total Jobs Booked'],\n  bookedJobsCanceled: ['BookedJobsCanceled','Booked Jobs Canceled','Booked Jobs Cancelled'],\n\n  campaignCost: ['Cost','Campaign Cost','Spend','AdSpend','MarketingSpend'],\n  completedRevenue: ['CompletedRevenue','Completed Revenue','Revenue'],\n  roiRate: ['RoiRate','ROI','ROI %','Roi','ROIPercent']\n};\n\nconst rows = (rowsRaw || []).map(r => {\n  const name = String(pick(r, ALIAS.name) ?? '').trim();\n\n  const leadCalls = pickNum(r, ALIAS.leadCalls);\n  const bookedJobsByCall = pickNum(r, ALIAS.bookedJobsByCall);\n\n  // Booking Rate is your \"Inbound Booking Rate\"\n  const bookingRate = pickRatio(r, ALIAS.inboundBookingRate); // keep as 0..1 (or null)\n\n  const campaignLeads = pickNum(r, ALIAS.campaignLeads);\n  const totalJobsBooked = pickNum(r, ALIAS.totalJobsBooked);\n  const bookedJobsCancelled = pickNum(r, ALIAS.bookedJobsCanceled);\n\n  const campaignCost = pickNum(r, ALIAS.campaignCost);\n  const completedRevenue = pickNum(r, ALIAS.completedRevenue);\n\n  // ROI: your dataset appears to store ROI % (sometimes null, sometimes -1). Keep as number (percent).\n  // If ROI field is missing/null but we have cost+revenue, derive ROI% = ((rev - cost) / cost) * 100.\n  let roi = pick(r, ALIAS.roiRate);\n  let roiPct = (roi == null || roi === '') ? null : num(roi);\n\n  if (roiPct == null && campaignCost > 0 && completedRevenue > 0){\n    roiPct = ((completedRevenue - campaignCost) / campaignCost) * 100;\n  }\n\n  return {\n    name,\n    leadCalls,\n    bookedJobsByCall,\n    bookingRate,            // 0..1 (null if not provided)\n    campaignLeads,\n    totalJobsBooked,\n    bookedJobsCancelled,    // normalized spelling\n    campaignCost,\n    completedRevenue,\n    roi: roiPct             // ROI percent (null if unknown)\n  };\n}).filter(x => x.name);\n\n// Ranking: Lead Calls desc (primary), tie-breakers: Completed Revenue desc, then name asc\nconst rows_ranked = rows\n  .slice()\n  .sort((a,b)=>{\n    if (b.leadCalls !== a.leadCalls) return b.leadCalls - a.leadCalls;\n    if (b.completedRevenue !== a.completedRevenue) return b.completedRevenue - a.completedRevenue;\n    return String(a.name).localeCompare(String(b.name));\n  })\n  .map((x,i)=>({ ...x, rankByLeadCalls: i + 1 }));\n\nconst leader = rows_ranked[0] || null;\n\n// Optional snapshot passthrough if present\nconst snapshot_time =\n  (Array.isArray(data?.snapshot_time) ? data.snapshot_time[0] : data?.snapshot_time) ||\n  data?.meta?.snapshot_time || data?.snapshotTime || null;\n\nreturn {\n  rows,\n  rows_ranked,\n  leader,\n  snapshot_time,\n  meta: {\n    row_count: rowsRaw.length,\n    fields_seen: (fields || []).map(f=>f.name),\n    sort_primary: \"leadCalls_desc\"\n  }\n};"
    }
    updateSetValueDynamically={true}
    warningCodes={[]}
  />
  <RetoolStorageQuery
    id="query18"
    enableTransformer={true}
    folderName="logos"
    resourceDisplayName="retool_storage"
    resourceName="retool_storage"
  />
  <RESTQuery
    id="getToken9"
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
    id="getCSRData5"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ date20.value }}" },\n    { "name": "To", "value": "{{ date19.value }}" },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken9.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    resourceDisplayName="getCampaign"
    resourceName="bceb081e-b9b7-4ced-bcf0-706ca8aaef12"
    runWhenModelUpdates={false}
    runWhenPageLoads={true}
    runWhenPageLoadsDelay="2000"
    transformer={
      "// Transformer: campaignSummaryReport_v2 (explicit fields for your report)\n// Sort primary: Lead Calls (desc)\n// Output: { rows, rows_ranked, leader, snapshot_time, meta }\n\nfunction num(v){\n  if (v == null || v === '') return 0;\n  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;\n  if (typeof v === 'string'){\n    const n = Number(v.replace(/[%,$,\\s]/g,''));\n    return Number.isNaN(n) ? 0 : n;\n  }\n  const n = Number(v);\n  return Number.isNaN(n) ? 0 : n;\n}\n\nfunction toRatio(v){\n  // Accept 0..1 ratios or \"82%\" or whole-number percents\n  if (typeof v === 'string' && v.includes('%')) return num(v) / 100;\n  const n = num(v);\n  return n > 10 ? n / 100 : n;\n}\n\n// --- hydrate {fields,data} or from raw_json ---\nlet fields = Array.isArray(data?.fields) ? data.fields : [];\nlet rowsRaw = Array.isArray(data?.data) ? data.data : [];\n\nif ((!fields.length || !rowsRaw.length) && data?.raw_json){\n  const rawStr = Array.isArray(data.raw_json) ? data.raw_json[0] : data.raw_json;\n  try {\n    const obj = typeof rawStr === 'string' ? JSON.parse(rawStr) : rawStr;\n    if (Array.isArray(obj?.fields) && Array.isArray(obj?.data)){\n      fields = obj.fields;\n      rowsRaw = obj.data;\n    }\n  } catch(_) {}\n}\n\n// Accessors (positional or object rows)\nconst F = Object.fromEntries((fields || []).map((f,i)=>[f.name, i]));\nconst at = (row, key) => Array.isArray(row) ? row[F[key]] : row?.[key];\n\nfunction pick(row, keys){\n  for (const k of keys){\n    const v = at(row, k);\n    if (v != null && v !== '') return v;\n  }\n  return null;\n}\nfunction pickNum(row, keys){ return num(pick(row, keys)); }\nfunction pickRatio(row, keys){\n  const v = pick(row, keys);\n  return v == null || v === '' ? null : toRatio(v);\n}\n\n// Aliases (kept flexible, but aligned to your dataset labels)\nconst ALIAS = {\n  name: ['Name','Campaign Name','Campaign','Source','Channel'],\n\n  leadCalls: ['LeadCalls','Lead Calls','Calls'],\n  bookedJobsByCall: ['BookedJobsByCall','Booked Jobs By Call'],\n  inboundBookingRate: ['InboundBookingRate','Inbound Booking Rate','BookingRate'],\n\n  campaignLeads: ['Leads','CampaignLeads','Campaign Leads'],\n  totalJobsBooked: ['TotalJobsBooked','Total Jobs Booked'],\n  bookedJobsCanceled: ['BookedJobsCanceled','Booked Jobs Canceled','Booked Jobs Cancelled'],\n\n  campaignCost: ['Cost','Campaign Cost','Spend','AdSpend','MarketingSpend'],\n  completedRevenue: ['CompletedRevenue','Completed Revenue','Revenue'],\n  roiRate: ['RoiRate','ROI','ROI %','Roi','ROIPercent']\n};\n\nconst rows = (rowsRaw || []).map(r => {\n  const name = String(pick(r, ALIAS.name) ?? '').trim();\n\n  const leadCalls = pickNum(r, ALIAS.leadCalls);\n  const bookedJobsByCall = pickNum(r, ALIAS.bookedJobsByCall);\n\n  // Booking Rate is your \"Inbound Booking Rate\"\n  const bookingRate = pickRatio(r, ALIAS.inboundBookingRate); // keep as 0..1 (or null)\n\n  const campaignLeads = pickNum(r, ALIAS.campaignLeads);\n  const totalJobsBooked = pickNum(r, ALIAS.totalJobsBooked);\n  const bookedJobsCancelled = pickNum(r, ALIAS.bookedJobsCanceled);\n\n  const campaignCost = pickNum(r, ALIAS.campaignCost);\n  const completedRevenue = pickNum(r, ALIAS.completedRevenue);\n\n  // ROI: your dataset appears to store ROI % (sometimes null, sometimes -1). Keep as number (percent).\n  // If ROI field is missing/null but we have cost+revenue, derive ROI% = ((rev - cost) / cost) * 100.\n  let roi = pick(r, ALIAS.roiRate);\n  let roiPct = (roi == null || roi === '') ? null : num(roi);\n\n  if (roiPct == null && campaignCost > 0 && completedRevenue > 0){\n    roiPct = ((completedRevenue - campaignCost) / campaignCost) * 100;\n  }\n\n  return {\n    name,\n    leadCalls,\n    bookedJobsByCall,\n    bookingRate,            // 0..1 (null if not provided)\n    campaignLeads,\n    totalJobsBooked,\n    bookedJobsCancelled,    // normalized spelling\n    campaignCost,\n    completedRevenue,\n    roi: roiPct             // ROI percent (null if unknown)\n  };\n}).filter(x => x.name);\n\n// Ranking: Lead Calls desc (primary), tie-breakers: Completed Revenue desc, then name asc\nconst rows_ranked = rows\n  .slice()\n  .sort((a,b)=>{\n    if (b.leadCalls !== a.leadCalls) return b.leadCalls - a.leadCalls;\n    if (b.completedRevenue !== a.completedRevenue) return b.completedRevenue - a.completedRevenue;\n    return String(a.name).localeCompare(String(b.name));\n  })\n  .map((x,i)=>({ ...x, rankByLeadCalls: i + 1 }));\n\nconst leader = rows_ranked[0] || null;\n\n// Optional snapshot passthrough if present\nconst snapshot_time =\n  (Array.isArray(data?.snapshot_time) ? data.snapshot_time[0] : data?.snapshot_time) ||\n  data?.meta?.snapshot_time || data?.snapshotTime || null;\n\nreturn {\n  rows,\n  rows_ranked,\n  leader,\n  snapshot_time,\n  meta: {\n    row_count: rowsRaw.length,\n    fields_seen: (fields || []).map(f=>f.name),\n    sort_primary: \"leadCalls_desc\"\n  }\n};"
    }
    type="POST"
  />
  <Frame
    id="$main9"
    enableFullBleed={false}
    isHiddenOnDesktop={false}
    isHiddenOnMobile={false}
    padding="8px 12px"
    sticky={null}
    type="main"
  >
    <Image
      id="image26"
      fit="contain"
      heightType="fixed"
      horizontalAlign="center"
      retoolStorageFileId="042f81fb-9652-444f-bbf3-f57312ea76e9"
      src="https://picsum.photos/id/1025/800/600"
      srcType="retoolStorageFileId"
    />
    <Navigation
      id="navigation11"
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
        id="234020d0"
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
      id="date20"
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
      id="button25"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="YTD"
    >
      <Event
        id="12bbab40"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date19"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="04cb0a73"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('year')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date20"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="b51c726b"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken9"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="b8baf67c"
        enabled="{{ !!getToken9.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getCSRData5"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
    </Button>
    <Date
      id="date19"
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
      id="button24"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="MTD"
    >
      <Event
        id="3917d4b6"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date19"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="8286c762"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('month')\n       .subtract(1, 'day')\n    .format('YYYY-MM-DD')\n}}",
          },
        }}
        pluginId="date20"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="6fbced7c"
        enabled=""
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken9"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="b186e7bf"
        enabled="{{ !!getToken9.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getCSRData5"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
    </Button>
    <HTML id="html13" html={include("../lib/html13.html", "string")} />
  </Frame>
</Screen>
