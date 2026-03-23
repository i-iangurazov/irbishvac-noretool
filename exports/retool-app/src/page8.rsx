<Screen
  id="page8"
  _customShortcuts={[]}
  _hashParams={[]}
  _order={0}
  _searchParams={[]}
  browserTitle={null}
  title="Lead Generation"
  urlSlug="page8"
  uuid="86ad6439-27a8-4a33-b6ad-e3c148f7cc6f"
>
  <SqlQueryUnified
    id="getCSR4"
    enableTransformer={true}
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/getCSR4.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    showSuccessToaster={false}
    showUpdateSetValueDynamicallyToggle={false}
    transformer={
      "// Transformer: leadGenSummaryByTeam (robust)\n// Returns: { rows, rows_ranked, leader, snapshot_time, meta }\n\nfunction num(v){\n  if (v == null || v === '') return 0;\n  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;\n  if (typeof v === 'string'){\n    const n = Number(v.replace(/[%,$,\\s]/g,''));\n    return Number.isNaN(n) ? 0 : n;\n  }\n  const n = Number(v);\n  return Number.isNaN(n) ? 0 : n;\n}\n\nfunction deepParse(x, maxDepth){\n  let cur = x, d = 0;\n  while (d < (maxDepth||6) && typeof cur === 'string'){\n    let s = cur.trim()\n      .replace(/&quot;/g,'\"').replace(/&#34;/g,'\"').replace(/&amp;/g,'&');\n    // strip wrapping quotes (common when JSON is stringified again)\n    if ((s.startsWith('\"') && s.endsWith('\"')) || (s.startsWith(\"'\") && s.endsWith(\"'\"))) {\n      s = s.slice(1, -1);\n    }\n    try { cur = JSON.parse(s); } catch { break; }\n    d++;\n  }\n  return cur;\n}\n\nfunction getSnapshot(data){\n  return (Array.isArray(data?.snapshot_time) ? data.snapshot_time[0] : data?.snapshot_time) ||\n         data?.meta?.snapshot_time || data?.snapshotTime || null;\n}\n\n// ------- locate payload: prefer {fields:[…], data:[…]} -------\nfunction pickObj(root){\n  if (!root) return null;\n  if (Array.isArray(root?.fields) && Array.isArray(root?.data)) return root;\n  if (Array.isArray(root?.rows)) return { fields: root.fields || [], data: root.rows };\n  return null;\n}\n\nlet sourceTag = 'none';\nlet obj =\n  pickObj(data) ||\n  pickObj(data?.data) ||\n  (Array.isArray(data?.raw_json) ? deepParse(data.raw_json[0]) : (typeof data?.raw_json === 'string' ? deepParse(data.raw_json) : null)) ||\n  (Array.isArray(data?.data?.raw_json) ? deepParse(data.data.raw_json[0]) : (typeof data?.data?.raw_json === 'string' ? deepParse(data.data.raw_json) : null)) ||\n  null;\n\nif (!obj || !Array.isArray(obj.fields) || !Array.isArray(obj.data)) {\n  // last resort: try deep-parse entire data\n  const parsed = deepParse(data);\n  if (pickObj(parsed)) obj = pickObj(parsed);\n}\n\n// Guards\nconst fields = Array.isArray(obj?.fields) ? obj.fields : [];\nconst rowsRaw = Array.isArray(obj?.data) ? obj.data : [];\nif (!fields.length || !rowsRaw.length){\n  return {\n    rows: [],\n    rows_ranked: [],\n    leader: null,\n    snapshot_time: getSnapshot(data),\n    meta: {\n      note: 'No rows found after parsing',\n      typeof_data: typeof data,\n      preview: (typeof data === 'string') ? data.slice(0,300) : JSON.stringify(data)?.slice(0,300)\n    }\n  };\n}\n\n// ------- field index & accessor (positional rows) -------\nconst F = Object.fromEntries(fields.map((f,i)=>[f.name, i]));\nconst at = (row, key) => Array.isArray(row) ? row[F[key]] : row?.[key];\n\n// ------- map to required metrics -------\n// Mapping from your schema:\n// Leads Generated           = LeadGenerationOpportunity + ReplacementOpportunity\n// How many good leads       = LeadsSet + ReplacementLeadsSet\n// How many booked leads     = goodLeads (your sample shows LeadsSet is the booked count)\n// Booking rate (0..1)       = goodLeads / leadsGenerated (guard for /0)\nconst rows = rowsRaw.map(r => {\n  const name = String(at(r,'Name') ?? '');\n\n  const leadOpp      = num(at(r,'LeadGenerationOpportunity'));\n  const leadsSet     = num(at(r,'LeadsSet'));\n  const replOpp      = num(at(r,'ReplacementOpportunity'));\n  const replLeadsSet = num(at(r,'ReplacementLeadsSet'));\n\n  const leadsGenerated = leadOpp + replOpp;\n  const goodLeads      = leadsSet + replLeadsSet;\n  const bookedLeads    = goodLeads;\n  const bookingRate    = leadsGenerated > 0 ? (goodLeads / leadsGenerated) : 0;\n\n  return {\n    name,\n    leadsGenerated,\n    goodLeads,\n    bookedLeads,\n    bookingRate\n  };\n}).filter(x => x.name);\n\n// ------- ranking: by Leads Generated desc; tie-breakers: booked desc, name asc -------\nconst rows_ranked = rows\n  .slice()\n  .sort((a,b)=>{\n    if (b.leadsGenerated !== a.leadsGenerated) return b.leadsGenerated - a.leadsGenerated;\n    if (b.bookedLeads   !== a.bookedLeads)    return b.bookedLeads    - a.bookedLeads;\n    return String(a.name).localeCompare(String(b.name));\n  })\n  .map((x,i)=>({ ...x, rankByLeadsGenerated: i + 1 }));\n\nconst leader = rows_ranked[0] || null;\n\nreturn {\n  rows,\n  rows_ranked,\n  leader,\n  snapshot_time: getSnapshot(data),\n  meta: { field_count: fields.length, row_count: rowsRaw.length }\n};\n"
    }
    updateSetValueDynamically={true}
    warningCodes={[]}
  />
  <RetoolStorageQuery
    id="query17"
    enableTransformer={true}
    folderName="technicians_photo"
    resourceDisplayName="retool_storage"
    resourceName="retool_storage"
  />
  <RESTQuery
    id="getToken8"
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
    id="getCSRData4"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ date18.value }}" },\n    { "name": "To", "value": "{{ date17.value }}" },\n{ "name": "BusinessUnitIds", "value": [1809, 1810, 1812, 64313020, 64315277, 64326403, 64567559, 64569092, 64569731] },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken8.data.access_token }}"}]'
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
    transformer="// Transformer: leadGenSummaryByTeam (robust + aliases)
// Returns: { rows, rows_ranked, leader, snapshot_time, meta }

function num(v){
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string'){ const n = Number(v.replace(/[%,$,\s]/g,'')); return Number.isNaN(n) ? 0 : n; }
  const n = Number(v); return Number.isNaN(n) ? 0 : n;
}
function toRatio(v){
  if (typeof v === 'string' && v.includes('%')) return num(v)/100;
  const n = num(v); return n > 10 ? n/100 : n; // accept whole-number percents
}
function snapshot(d){
  return (Array.isArray(d?.snapshot_time) ? d.snapshot_time[0] : d?.snapshot_time) ||
         d?.meta?.snapshot_time || d?.snapshotTime || null;
}

// ------ hydrate {fields,data} ------
const fields = Array.isArray(data?.fields) ? data.fields : [];
const rowsRaw = Array.isArray(data?.data) ? data.data : [];

// If there are no rows at all, return clean/empty with context.
if (!fields.length || !rowsRaw.length){
  return {
    rows: [],
    rows_ranked: [],
    leader: null,
    snapshot_time: snapshot(data),
    meta: {
      note: (!fields.length ? 'No fields' : 'Zero rows in payload'),
      field_count: fields.length || 0,
      row_count: rowsRaw.length || 0
    }
  };
}

// ------ index & accessor (supports positional rows) ------
const F = Object.fromEntries(fields.map((f,i)=>[f.name, i]));
const at = (row, key) => Array.isArray(row) ? row[F[key]] : row?.[key];

// ------ alias catalogs so we work across both schemas ------
const ALIAS = {
  name: ['Name','Team','BusinessUnit','Department'],

  // inflow
  leadsGenerated: [
    'LeadGenerationOpportunity',  // lead-gen schema
    'ReplacementOpportunity',
    'LeadCalls',                  // CSR-style inflow (inbound)
    'CallsTaken',                 // looser proxy if nothing else
    'SalesOpportunity'            // sometimes used as inflow
  ],

  // “good”/qualified leads
  goodLeadsParts: [
    'LeadsSet',                   // lead-gen schema
    'ReplacementLeadsSet',
    'OpportunitiesBooked'         // CSR-style “opportunities booked”
  ],

  // booked leads
  bookedLeads: [
    'TotalJobsBooked'             // CSR-style definitive booked
  ],

  // rates
  bookingRate: [
    'LeadConversionRate',               // lead-gen schema
    'ReplacementLeadConversionRate',
    'InboundBookingRate',               // CSR-style
    'TotalJobsBookedConversionRate',
    'TotalConversionRate'
  ]
};

function pickFirstNum(row, keys){
  for (const k of keys){
    const v = at(row, k);
    if (v != null && v !== '') return num(v);
  }
  return 0;
}
function pickFirstRatio(row, keys){
  for (const k of keys){
    const v = at(row, k);
    if (v != null && v !== '') return toRatio(v);
  }
  return 0;
}

// Build rows
const rows = rowsRaw.map(r => {
  const name = String(ALIAS.name.map(k => at(r,k)).find(v => v != null && v !== '') ?? '');

  // Leads generated:
  // Prefer explicit sum of (LeadGenerationOpportunity + ReplacementOpportunity).
  // If those not present, use LeadCalls; failing that, CallsTaken; else SalesOpportunity.
  const lgo = num(at(r, 'LeadGenerationOpportunity'));
  const rpo = num(at(r, 'ReplacementOpportunity'));
  let leadsGenerated = 0;
  if (lgo || rpo){
    leadsGenerated = lgo + rpo;
  } else {
    leadsGenerated = pickFirstNum(r, ['LeadCalls', 'CallsTaken', 'SalesOpportunity']);
  }

  // Good leads = (LeadsSet + ReplacementLeadsSet) + OpportunitiesBooked (if present)
  const leadsSet = num(at(r, 'LeadsSet')) + num(at(r, 'ReplacementLeadsSet'));
  const oppBooked = num(at(r, 'OpportunitiesBooked'));
  const goodLeads = leadsSet + oppBooked;

  // Booked leads = prefer TotalJobsBooked; else use goodLeads
  const bookedPref = num(at(r, 'TotalJobsBooked'));
  const bookedLeads = bookedPref || goodLeads;

  // Booking rate:
  // Prefer field rate; else compute booked / leadsGenerated if possible.
  let bookingRate = pickFirstRatio(r, ALIAS.bookingRate);
  if (!bookingRate && leadsGenerated > 0 && bookedLeads >= 0){
    bookingRate = bookedLeads / leadsGenerated;
  }

  return {
    name,
    leadsGenerated,
    goodLeads,
    bookedLeads,
    bookingRate
  };
}).filter(x => x.name);

// Rank by leadsGenerated desc; tie-breakers: booked desc; name asc
const rows_ranked = rows
  .slice()
  .sort((a,b)=>{
    if (b.leadsGenerated !== a.leadsGenerated) return b.leadsGenerated - a.leadsGenerated;
    if (b.bookedLeads   !== a.bookedLeads)    return b.bookedLeads    - a.bookedLeads;
    return String(a.name).localeCompare(String(b.name));
  })
  .map((x,i)=>({ ...x, rankByLeadsGenerated: i + 1 }));

const leader = rows_ranked[0] || null;

return {
  rows,
  rows_ranked,
  leader,
  snapshot_time: snapshot(data),
  meta: {
    field_count: fields.length,
    row_count: rowsRaw.length
  }
};
"
    type="POST"
  />
  <Frame
    id="$main8"
    enableFullBleed={false}
    isHiddenOnDesktop={false}
    isHiddenOnMobile={false}
    padding="8px 12px"
    sticky={null}
    type="main"
  >
    <Image
      id="image23"
      fit="contain"
      heightType="fixed"
      horizontalAlign="center"
      retoolStorageFileId="d3ee14eb-c149-42b6-a2ab-ae0352c3d104"
      src="https://picsum.photos/id/1025/800/600"
      srcType="retoolStorageFileId"
    />
    <Navigation
      id="navigation10"
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
        id="a2afbb8a"
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
      id="date18"
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
      id="button23"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="YTD"
    >
      <Event
        id="cfa081bd"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date17"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="89c72311"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('year')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date18"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="eb94d539"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken8"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="e566e71b"
        enabled="{{ !!getToken8.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getCSRData4"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
    </Button>
    <Date
      id="date17"
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
      id="button22"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="MTD"
    >
      <Event
        id="27db35a0"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date17"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="dc927204"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('month')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date18"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="d8effb7f"
        enabled=""
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken8"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="325bbbf4"
        enabled="{{ !!getToken8.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getCSRData4"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
    </Button>
    <HTML id="html12" html={include("../lib/html12.html", "string")} />
  </Frame>
</Screen>
