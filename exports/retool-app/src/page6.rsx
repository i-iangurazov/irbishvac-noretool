<Screen
  id="page6"
  _customShortcuts={[]}
  _hashParams={[]}
  _order={0}
  _searchParams={[]}
  browserTitle={null}
  title="Call Center Performance Summary"
  urlSlug="page6"
  uuid="47d691ef-867f-426c-a2ef-3a43c0577cbf"
>
  <SqlQueryUnified
    id="getCSR2"
    enableTransformer={true}
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/getCSR2.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    showSuccessToaster={false}
    showUpdateSetValueDynamicallyToggle={false}
    transformer={
      "// Transformer: callCenterPerfSummary (rank by Lead Calls)\n// Output: { rows, rows_ranked, leader, snapshot_time }\n\nfunction cleanNum(v){\n  if (v == null || v === '') return 0;\n  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;\n  if (typeof v === 'string'){\n    var n = Number(v.replace(/[%,$,\\s]/g,''));\n    return Number.isNaN(n) ? 0 : n;\n  }\n  var n = Number(v);\n  return Number.isNaN(n) ? 0 : n;\n}\n\nfunction parseDeepString(s, maxDepth){\n  var cur = s, depth = 0;\n  while (depth < (maxDepth||5) && typeof cur === 'string'){\n    var t = cur.trim()\n      .replace(/&quot;/g, '\"').replace(/&#34;/g, '\"').replace(/&amp;/g, '&');\n    if ((t.startsWith('\"') && t.endsWith('\"')) || (t.startsWith(\"'\") && t.endsWith(\"'\"))){\n      t = t.slice(1, -1);\n    }\n    try { cur = JSON.parse(t); } catch(e){ break; }\n    depth++;\n  }\n  return cur;\n}\n\n// snapshot_time\nvar snapshot_time =\n  (Array.isArray(data?.snapshot_time) ? data.snapshot_time[0] : data?.snapshot_time) ||\n  (Array.isArray(data?.meta?.snapshot_time) ? data.meta.snapshot_time[0] : data?.meta?.snapshot_time) ||\n  null;\n\n// Parse raw_json\nvar rawStr =\n  (typeof data?.raw_json === 'string' && data.raw_json) ||\n  (Array.isArray(data?.raw_json) && typeof data.raw_json[0] === 'string' && data.raw_json[0]) ||\n  (typeof data?.data?.raw_json === 'string' && data.data.raw_json) ||\n  (Array.isArray(data?.data?.raw_json) && typeof data.data.raw_json[0] === 'string' && data.data.raw_json[0]) ||\n  null;\n\nvar obj = null;\nif (rawStr) obj = parseDeepString(rawStr, 6);\nif (!obj || typeof obj !== 'object'){\n  obj = (Array.isArray(data?.fields) && Array.isArray(data?.data)) ? data : null;\n}\nif (!obj || !Array.isArray(obj.fields) || !Array.isArray(obj.data)){\n  return { rows: [], rows_ranked: [], leader: null, snapshot_time };\n}\n\n// Build field index\nvar F = Object.fromEntries(obj.fields.map((f,i)=>[f.name,i]));\nfunction at(row, key){\n  if (!Array.isArray(row)) return row?.[key];\n  var idx = F[key];\n  return (typeof idx === 'number') ? row[idx] : undefined;\n}\n\n// Build rows with new mapping\nvar rows = obj.data.map(function(r){\n  var leadsReceived     = cleanNum(at(r, 'LeadCalls'));\n  var inboundBooked = cleanNum(at(r, 'InboundCallsBooked'));\n  var manualBooked  = cleanNum(at(r, 'ManualCallsBooked'));\n  var totalJobs     = inboundBooked + manualBooked;\n  var cancelled     = cleanNum(at(r, 'CanceledBeforeDispatch'));\n  var cancelRate    = totalJobs > 0 ? cancelled / totalJobs : 0;\n\n  return {\n    name: String(at(r, 'Name') ?? ''),\n    leadsReceived,                     // целевые звонки\n    inboundCallsBooked: inboundBooked, // работы из целевых звонков\n    callBookingRate: cleanNum(at(r, 'InboundBookingRate')), // Call Booking Rate\n    manualCallsBooked: manualBooked, // работы вручную\n    totalJobsBooked: totalJobs,      // общее количество работ\n    cancelledBeforeDispatch: cancelled, \n    cancellationRate: cancelRate\n  };\n}).filter(x =>\n  x.name ||\n  x.leadsReceived ||\n  x.inboundCallsBooked ||\n  x.manualCallsBooked ||\n  x.totalJobsBooked ||\n  x.cancelledBeforeDispatch\n);\n\n// Ranking by leadsReceived DESC, then totalJobs DESC, then name ASC\nvar rows_ranked = rows\n  .slice()\n  .sort((a,b)=>{\n    if (b.leadsReceived !== a.leadsReceived) return b.leadsReceived - a.leadsReceived;\n    if (b.totalJobsBooked !== a.totalJobsBooked) return b.totalJobsBooked - a.totalJobsBooked;\n    return String(a.name).localeCompare(String(b.name));\n  })\n  .map((x,i)=>({ ...x, rankByLeadCalls: i+1 }));\n\nvar leader = rows_ranked[0] || null;\n\nreturn { rows, rows_ranked, leader, snapshot_time };\n"
    }
    updateSetValueDynamically={true}
    warningCodes={[]}
  />
  <RetoolStorageQuery
    id="query15"
    folderName="technicians_photo"
    resourceDisplayName="retool_storage"
    resourceName="retool_storage"
  />
  <RESTQuery
    id="getToken6"
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
    id="getCSRData2"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ date14.value }}" },\n    { "name": "To", "value": "{{ date13.value }}" },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken6.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    resourceDisplayName="getCSR"
    resourceName="a9aa6ce7-6a6c-4b36-acd0-74a5a7fdcf4b"
    runWhenModelUpdates={false}
    runWhenPageLoads={true}
    runWhenPageLoadsDelay="2000"
    transformer={
      "// Transformer: callCenterPerfSummary (rank by Leads received) — adapted for NEW schema\n// Output: { rows, rows_ranked, leader, snapshot_time }\n\nfunction cleanNum(v){\n  if (v == null || v === '') return 0;\n  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;\n  if (typeof v === 'string'){\n    var n = Number(v.replace(/[%,$,\\s]/g,''));\n    return Number.isNaN(n) ? 0 : n;\n  }\n  var n = Number(v);\n  return Number.isNaN(n) ? 0 : n;\n}\nfunction toRatio(v){\n  if (typeof v === 'string' && v.includes('%')) return cleanNum(v)/100;\n  var n = cleanNum(v);\n  return n > 10 ? n/100 : n;\n}\n\nfunction parseDeepString(s, maxDepth){\n  var cur = s, depth = 0;\n  while (depth < (maxDepth||5) && typeof cur === 'string'){\n    var t = cur.trim()\n      .replace(/&quot;/g, '\"').replace(/&#34;/g, '\"').replace(/&amp;/g, '&');\n    if ((t.startsWith('\"') && t.endsWith('\"')) || (t.startsWith(\"'\") && t.endsWith(\"'\"))){\n      t = t.slice(1, -1);\n    }\n    try { cur = JSON.parse(t); } catch(e){ break; }\n    depth++;\n  }\n  return cur;\n}\n\n// snapshot_time passthrough\nvar snapshot_time =\n  (Array.isArray(data?.snapshot_time) ? data.snapshot_time[0] : data?.snapshot_time) ||\n  (Array.isArray(data?.meta?.snapshot_time) ? data.meta.snapshot_time[0] : data?.meta?.snapshot_time) ||\n  data?.snapshotTime ||\n  null;\n\n// locate payload\nvar obj = null;\nif (Array.isArray(data?.fields) && Array.isArray(data?.data)) {\n  obj = data;\n} else {\n  var rawStr =\n    (typeof data?.raw_json === 'string' && data.raw_json) ||\n    (Array.isArray(data?.raw_json) && typeof data.raw_json[0] === 'string' && data.raw_json[0]) ||\n    (typeof data?.data?.raw_json === 'string' && data.data.raw_json) ||\n    (Array.isArray(data?.data?.raw_json) && typeof data.data.raw_json[0] === 'string' && data.data.raw_json[0]) ||\n    null;\n  if (rawStr){\n    var parsed = parseDeepString(rawStr, 6);\n    if (parsed && Array.isArray(parsed.fields) && Array.isArray(parsed.data)) obj = parsed;\n  }\n}\n\nif (!obj || !Array.isArray(obj.fields) || !Array.isArray(obj.data)){\n  return { rows: [], rows_ranked: [], leader: null, snapshot_time };\n}\n\n// Field index\nvar F = Object.fromEntries(obj.fields.map(function(f,i){ return [f.name, i]; }));\nfunction at(row, key){\n  if (!Array.isArray(row)) return row?.[key];\n  var idx = F[key];\n  return (typeof idx === 'number') ? row[idx] : undefined;\n}\n\n// ---------- UPDATED FIELD MAPPING ----------\nvar rows = obj.data.map(function(r){\n  var name       = String(at(r, 'Name') ?? '');\n\n  // NEW schema fields\n  var leadCalls       = cleanNum(at(r, 'LeadCalls'));                // Lead Calls\n  var inboundBooked   = cleanNum(at(r, 'InboundCallsBooked'));       // From lead calls\n  var manualBooked    = cleanNum(at(r, 'ManualCallsBooked'));        // Manual CSR jobs\n  var bookingRate     = toRatio(at(r, 'InboundBookingRate'));        // Call Booking Rate\n  var cancelled       = cleanNum(at(r, 'CanceledBeforeDispatch'));   // Cancelled before dispatch\n\n  // Derived\n  var totalJobsBooked = inboundBooked + manualBooked;\n  var cancellationPct = totalJobsBooked > 0 ? cancelled / totalJobsBooked : 0;\n\n  // If LeadCalls missing but we know inboundBooked + rate → infer\n  var leadsReceived = leadCalls;\n  if (!leadsReceived && inboundBooked > 0 && bookingRate > 0){\n    leadsReceived = Math.round(inboundBooked / bookingRate);\n  }\n\n  return {\n    name: name,\n    // NEW FIELDS\n    leadsReceived:   leadsReceived,\n    inboundCallsBooked: inboundBooked,\n    manualCallsBooked:  manualBooked,\n    totalJobsBooked:    totalJobsBooked,\n    cancelledBeforeDispatch:      cancelled,\n    callBookingRate:    bookingRate,\n    cancellationRate:   cancellationPct\n  };\n}).filter(function(x){\n  return x.name || x.leadsReceived || x.totalJobsBooked || x.cancelledBeforeDispatch;\n});\n\n// ---------- Ranking (unchanged) ----------\nvar rows_ranked = rows\n  .slice()\n  .sort(function(a,b){\n    if (b.leadsReceived !== a.leadsReceived) return b.leadsReceived - a.leadsReceived;\n    if (b.totalJobsBooked !== a.totalJobsBooked) return b.totalJobsBooked - a.totalJobsBooked;\n    return String(a.name).localeCompare(String(b.name));\n  })\n  .map(function(x,i){ return { ...x, rankByLeadsReceived: i + 1 }; });\n\nvar leader = rows_ranked[0] || null;\n\nreturn { rows, rows_ranked, leader, snapshot_time };\n"
    }
    type="POST"
  />
  <Frame
    id="$main6"
    enableFullBleed={false}
    isHiddenOnDesktop={false}
    isHiddenOnMobile={false}
    padding="8px 12px"
    sticky={null}
    type="main"
  >
    <Image
      id="image15"
      fit="contain"
      heightType="fixed"
      horizontalAlign="center"
      retoolStorageFileId="042f81fb-9652-444f-bbf3-f57312ea76e9"
      src="https://picsum.photos/id/1025/800/600"
      srcType="retoolStorageFileId"
    />
    <Navigation
      id="navigation8"
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
        id="ab2fc77e"
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
      id="date14"
      dateFormat="MMM d, yyyy"
      datePlaceholder="{{ self.dateFormat.toUpperCase() }}"
      iconBefore="bold/interface-calendar"
      label=""
      labelPosition="top"
      value="{{ 
  (() => {
    const now = new Date();
    const calNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const from = new Date(calNow.getFullYear(), calNow.getMonth(), 1);
    return from.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  })() 
}}"
    />
    <Button
      id="button19"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="YTD"
    >
      <Event
        id="a3cf47bc"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date13"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="10d70154"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('year')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date14"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="5b6bf124"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken6"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="9219b1f0"
        enabled="{{ !!getToken6.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getCSRData2"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
    </Button>
    <Date
      id="date13"
      dateFormat="MMM d, yyyy"
      datePlaceholder="{{ self.dateFormat.toUpperCase() }}"
      iconBefore="bold/interface-calendar"
      label=""
      labelPosition="top"
      value="{{ 
  (() => {
    const now = new Date();
    const calNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return calNow.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  })()
}}"
    />
    <Button
      id="button18"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="MTD"
    >
      <Event
        id="3ef80015"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date13"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="d5e9ff3e"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('month')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date14"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="1ac80853"
        enabled=""
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken6"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="21f64a2c"
        enabled="{{ !!getToken6.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getCSRData2"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
    </Button>
    <HTML id="html14" html={include("../lib/html14.html", "string")} />
  </Frame>
</Screen>
