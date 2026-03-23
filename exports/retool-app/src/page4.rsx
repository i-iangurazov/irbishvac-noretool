<Screen
  id="page4"
  _customShortcuts={[]}
  _hashParams={[]}
  _order={0}
  _searchParams={[]}
  browserTitle={null}
  title="Comfort Advisors Board"
  urlSlug={null}
  uuid="45fe5f64-a92f-4c2e-89e1-b77731871b57"
>
  <SqlQueryUnified
    id="getAdvisors"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/getAdvisors.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    showSuccessToaster={false}
    showUpdateSetValueDynamicallyToggle={false}
    transformer="// Transformer: salesPerfBoard_final (for fields you shared; ranks by Total Sales)

// ---------- Helpers ----------
const cleanNum = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const s = v.replace(/[%,$,\s]/g, '');
    const n = Number(s);
    return Number.isNaN(n) ? 0 : n;
  }
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
const toRatio = (v) => {
  if (typeof v === 'string' && v.includes('%')) return cleanNum(v) / 100;
  const n = cleanNum(v);
  return n > 10 ? n / 100 : n; // accept whole-number percents too
};
const sumK = (arr, k) => arr.reduce((s, x) => s + cleanNum(x[k] || 0), 0);

// ---------- Normalize inputs ----------
const hasTop = Array.isArray(data?.fields) && Array.isArray(data?.data);
const raw = (Array.isArray(data?.raw_json) ? data.raw_json[0] : data?.raw_json) || {};

const rowsRaw =
  (hasTop && data.data) ||
  (Array.isArray(raw?.data) ? raw.data : null) ||
  (Array.isArray(data) ? data : null) ||
  (Array.isArray(raw) ? raw : null) ||
  [];

const fieldsArr = (hasTop ? data.fields : raw.fields) || [];
const F = Object.fromEntries(fieldsArr.map((f, i) => [f.name, i]));

// Accessor for array-rows; falls back to object-row if ever needed
const at = (row, key) => {
  if (!Array.isArray(row)) return row?.[key];
  const idx = F[key];
  return (typeof idx === 'number') ? row[idx] : undefined;
};

// ---------- Build minimal rows ----------
const rows = (rowsRaw || []).map((r) => {
  const name = String(at(r, 'Name') ?? '');
  return {
    // Metrics Needed On a Performance Board:
    name,
    totalSales:             cleanNum(at(r, 'TotalSales')),
    closedAverageSale:      cleanNum(at(r, 'ClosedAverageSale')),
    closeRateRolling:       toRatio(at(r, 'CloseRateRolling')),        // 0..1
    salesOpportunitiesCount:cleanNum(at(r, 'SalesOpportunity')),
  };
}).filter(x =>
  x.name !== '' ||
  x.totalSales || x.closedAverageSale || x.closeRateRolling || x.salesOpportunitiesCount
);

// ---------- Ranked copy (leader = highest Total Sales) ----------
const rows_ranked = rows
  .slice()
  .sort((a, b) => {
    if (b.totalSales !== a.totalSales) return b.totalSales - a.totalSales;
    if (b.closedAverageSale !== a.closedAverageSale) return b.closedAverageSale - a.closedAverageSale;
    return String(a.name).localeCompare(String(b.name));
  })
  .map((x, i) => ({ ...x, rankByTotalSales: i + 1 }));

const leader = rows_ranked[0] || null;

// ---------- Totals ----------
const totals = {
  totalSales: sumK(rows, 'totalSales'),
  avgClosedAverageSale: rows.length ? sumK(rows, 'closedAverageSale') / rows.length : 0,
  avgCloseRateRolling: rows.length ? rows.reduce((s, x) => s + (Number(x.closeRateRolling) || 0), 0) / rows.length : 0,
  sumSalesOpportunities: sumK(rows, 'salesOpportunitiesCount'),
};

// ---------- Snapshot time (if provided elsewhere) ----------
const snapshot_time =
  data?.snapshot_time ||
  data?.meta?.snapshot_time ||
  data?.snapshotTime ||
  raw?.snapshot_time ||
  null;

return { rows, rows_ranked, leader, totals, snapshot_time };"
    updateSetValueDynamically={true}
    warningCodes={[]}
  />
  <RESTQuery
    id="getAdvisorsData"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ date9.value }}" },\n    { "name": "To", "value": "{{ date10.value }}" },\n    { "name": "BusinessUnitIds", "value": [1812, 64326403, 64567559] },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken4.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    resourceDisplayName="getAdvisors"
    resourceName="82be2663-1a60-42b6-a314-f4465537812c"
    runWhenModelUpdates={false}
    runWhenPageLoads={true}
    runWhenPageLoadsDelay="2000"
    transformer="// Transformer: salesPerfBoard_final (for fields you shared; ranks by Total Sales)

// ---------- Helpers ----------
const cleanNum = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const s = v.replace(/[%,$,\s]/g, '');
    const n = Number(s);
    return Number.isNaN(n) ? 0 : n;
  }
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
const toRatio = (v) => {
  if (typeof v === 'string' && v.includes('%')) return cleanNum(v) / 100;
  const n = cleanNum(v);
  return n > 10 ? n / 100 : n; // accept whole-number percents too
};
const sumK = (arr, k) => arr.reduce((s, x) => s + cleanNum(x[k] || 0), 0);

// ---------- Normalize inputs ----------
const hasTop = Array.isArray(data?.fields) && Array.isArray(data?.data);
const raw = (Array.isArray(data?.raw_json) ? data.raw_json[0] : data?.raw_json) || {};

const rowsRaw =
  (hasTop && data.data) ||
  (Array.isArray(raw?.data) ? raw.data : null) ||
  (Array.isArray(data) ? data : null) ||
  (Array.isArray(raw) ? raw : null) ||
  [];

const fieldsArr = (hasTop ? data.fields : raw.fields) || [];
const F = Object.fromEntries(fieldsArr.map((f, i) => [f.name, i]));

// Accessor for array-rows; falls back to object-row if ever needed
const at = (row, key) => {
  if (!Array.isArray(row)) return row?.[key];
  const idx = F[key];
  return (typeof idx === 'number') ? row[idx] : undefined;
};

// ---------- Build minimal rows ----------
const rows = (rowsRaw || []).map((r) => {
  const name = String(at(r, 'Name') ?? '');
  return {
    // Metrics Needed On a Performance Board:
    name,
    totalSales:             cleanNum(at(r, 'TotalSales')),
    closedAverageSale:      cleanNum(at(r, 'ClosedAverageSale')),
    closeRateRolling:       toRatio(at(r, 'CloseRateRolling')),        // 0..1
    salesOpportunitiesCount:cleanNum(at(r, 'SalesOpportunity')),
  };
}).filter(x =>
  x.name !== '' ||
  x.totalSales || x.closedAverageSale || x.closeRateRolling || x.salesOpportunitiesCount
);

// ---------- Ranked copy (leader = highest Total Sales) ----------
const rows_ranked = rows
  .slice()
  .sort((a, b) => {
    if (b.totalSales !== a.totalSales) return b.totalSales - a.totalSales;
    if (b.closedAverageSale !== a.closedAverageSale) return b.closedAverageSale - a.closedAverageSale;
    return String(a.name).localeCompare(String(b.name));
  })
  .map((x, i) => ({ ...x, rankByTotalSales: i + 1 }));

const leader = rows_ranked[0] || null;

// ---------- Totals ----------
const totals = {
  totalSales: sumK(rows, 'totalSales'),
  avgClosedAverageSale: rows.length ? sumK(rows, 'closedAverageSale') / rows.length : 0,
  avgCloseRateRolling: rows.length ? rows.reduce((s, x) => s + (Number(x.closeRateRolling) || 0), 0) / rows.length : 0,
  sumSalesOpportunities: sumK(rows, 'salesOpportunitiesCount'),
};

// ---------- Snapshot time (if provided elsewhere) ----------
const snapshot_time =
  data?.snapshot_time ||
  data?.meta?.snapshot_time ||
  data?.snapshotTime ||
  raw?.snapshot_time ||
  null;

return { rows, rows_ranked, leader, totals, snapshot_time };
"
    type="POST"
  />
  <RESTQuery
    id="getToken4"
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
    id="query13"
    enableTransformer={true}
    folderName="technicians_photo"
    resourceDisplayName="retool_storage"
    resourceName="retool_storage"
  />
  <Frame
    id="$main4"
    enableFullBleed={false}
    isHiddenOnDesktop={false}
    isHiddenOnMobile={false}
    padding="8px 12px"
    sticky={null}
    type="main"
  >
    <Image
      id="image9"
      fit="contain"
      heightType="fixed"
      horizontalAlign="center"
      retoolStorageFileId="042f81fb-9652-444f-bbf3-f57312ea76e9"
      src="https://picsum.photos/id/1025/800/600"
      srcType="retoolStorageFileId"
    />
    <Navigation
      id="navigation6"
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
        id="7919a3ee"
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
      id="date9"
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
}}
"
    />
    <Button
      id="button15"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="YTD"
    >
      <Event
        id="6bedc8d1"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date10"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="5481e149"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('year')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date9"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="e150d5b6"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken4"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="c09db55e"
        enabled="{{ !!getToken4.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getAdvisorsData"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
    </Button>
    <Date
      id="date10"
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
}}
"
    />
    <Button
      id="button14"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="MTD"
    >
      <Event
        id="ce1af450"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date10"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="821b3a2a"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('month')\n    \n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date9"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="2284720c"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken4"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="501dff6b"
        enabled="{{ !!getToken4.data.access_token }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getAdvisorsData"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
    </Button>
    <HTML id="html8" html={include("../lib/html8.html", "string")} />
  </Frame>
</Screen>
