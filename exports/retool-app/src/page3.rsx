<Screen
  id="page3"
  _customShortcuts={[]}
  _hashParams={[]}
  _order={0}
  _searchParams={[]}
  browserTitle={null}
  title="Company-wide Dashboard"
  urlSlug={null}
  uuid="d9d45a4d-8ccf-419c-b199-fcb09d4f58bb"
>
  <connectResource id="query10" _componentId={null} />
  <WorkflowRun
    id="query6"
    notificationDuration={4.5}
    resourceName="WorkflowRun"
    runWhenModelUpdates={true}
    showSuccessToaster={false}
    workflowId="d8b7b5c8-ca40-40a7-835b-f647a070f980"
  />
  <RESTQuery
    id="getToken2"
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
    id="getMarketing"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ date8.value && new Date(date8.value).toISOString().slice(0,10) }}" },\n    { "name": "To", "value": "{{ date7.value && new Date(date7.value).toISOString().slice(0,10) }}" },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken2.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    query="https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/marketing/reports/898/data"
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    queryTimeout="100000"
    resourceDisplayName="getMarketing"
    resourceName="f0fa09d6-cb30-41b0-bfb8-26eeb11ba190"
    resourceTypeOverride=""
    runWhenModelUpdates={false}
    runWhenPageLoads={true}
    runWhenPageLoadsDelay="2000"
    transformer={
      "// txMarketingDonut (labels like \"Label - $481.5K\")\n\nconst fields = data.fields ?? [];\nconst rows   = data.data   ?? [];\nconst F = Object.fromEntries(fields.map((f,i)=>[f.name, i]));\nconst num = v => (v==null || v==='' || Number.isNaN(Number(v))) ? 0 : Number(v);\n\n// ---- Config overrides (optional via window) ----\nconst OVERRIDE_GROUP_BY = (typeof window !== 'undefined' && window.MKTG_GROUP_BY) || null;\nconst METRIC_FIELD = (typeof window !== 'undefined' && window.MKTG_METRIC) || 'CompletedRevenue';\nconst TOP_N = (typeof window !== 'undefined' && window.MKTG_TOP_N) || 5;\n// ------------------------------------------------\n\n// Smart default: use 'category' only if a category column exists\nconst hasCategory = (F.Category != null) || (F['Campaign Category'] != null);\nconst GROUP_BY = OVERRIDE_GROUP_BY || (hasCategory ? 'category' : 'name');\n\n// $ shortener with 1 decimal: K/M/B\nfunction moneyShort(n){\n  const sign = n < 0 ? '-' : '';\n  const a = Math.abs(n);\n  if (a >= 1e9) return `${sign}$${(a/1e9).toFixed(1)}B`;\n  if (a >= 1e6) return `${sign}$${(a/1e6).toFixed(1)}M`;\n  if (a >= 1e3) return `${sign}$${(a/1e3).toFixed(1)}K`;\n  return `${sign}$${a.toFixed(1)}`;\n}\n\nconst metricIdx = F[METRIC_FIELD] != null ? F[METRIC_FIELD] : F.CompletedRevenue;\n\nconst keyFor = (r) => {\n  if (GROUP_BY === 'name') {\n    const name = r[F.Name];\n    return (name != null && String(name).trim() !== '') ? String(name) : 'Unlabeled';\n  }\n  const catIdx = (F.Category != null) ? F.Category : F['Campaign Category'];\n  const cat = catIdx != null ? r[catIdx] : null;\n  return (cat != null && String(cat).trim() !== '') ? String(cat) : 'Uncategorized';\n};\n\n// Sum metric by key\nconst sums = new Map();\nfor (const r of rows) {\n  const k = keyFor(r);\n  const v = num(r[metricIdx]);\n  sums.set(k, (sums.get(k) || 0) + v);\n}\n\n// Sort & take Top N (drop zeros if any positive exists)\nlet sorted = Array.from(sums.entries()).sort((a,b)=>b[1]-a[1]);\nif (sorted.some(([,v]) => v > 0)) sorted = sorted.filter(([,v]) => v > 0);\nsorted = sorted.slice(0, TOP_N);\n\n// Outputs\nconst values = sorted.map(([,v]) => num(v));\nconst labels = sorted.map(([k,v]) => `${k} - ${moneyShort(num(v))}`);\n\nconst totalTop5 = values.reduce((s,x)=>s+x,0);\nconst totalAll  = Array.from(sums.values()).reduce((s,x)=>s+x,0);\n\nreturn {\n  labels,\n  values,\n  totals: {\n    totalTop5,\n    totalAll,\n    totalTop5Formatted: moneyShort(totalTop5),\n    totalAllFormatted:  moneyShort(totalAll)\n  },\n  meta: { groupBy: GROUP_BY, metricField: METRIC_FIELD }\n};\n"
    }
    type="POST"
  />
  <RESTQuery
    id="getCapacity"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ (() => { const t=new Date(); const y=t.getFullYear(); const m=String(t.getMonth()+1).padStart(2,\'0\'); const d=String(t.getDate()).padStart(2,\'0\'); return `${y}-${m}-${d}`; })() }}" },\n    { "name": "To",   "value": "{{ (() => { const t=new Date(); const y=t.getFullYear(); const m=String(t.getMonth()+1).padStart(2,\'0\'); const d=String(t.getDate()).padStart(2,\'0\'); return `${y}-${m}-${d}`; })() }}" },\n    { "name": "BusinessUnitIds", "value": [1809, 1810, 1812, 64313020, 64315277, 64326403, 64567559, 64569092, 64569731] },\n    { "name": "IncludeInactive", "value": false }\n  ]\n}\n'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken2.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    resourceDisplayName="getCapacity"
    resourceName="6b5213e0-698b-403e-b3e6-0e485acd7ea3"
    resourceTypeOverride=""
    runWhenModelUpdates={false}
    runWhenPageLoadsDelay="2000"
    transformer={
      '// Transformer: txCapacityByBU\n// Input: { fields:[{name,label}...], data:[[...], ...] }\n\nconst F = Object.fromEntries((data.fields || []).map((f,i)=>[f.name,i]));\nconst num = v => (v==null || v===\'\' || Number.isNaN(Number(v))) ? 0 : Number(v);\n\n// ---- Config (tweak in a small JS query or window.*) ----\n// Default target per tech (weekly). Typical field ops use 50h (10h × 5d).\nconst DEFAULT_TARGET = (typeof window !== \'undefined\' && typeof window.CAPACITY_DEFAULT_TARGET === \'number\')\n  ? window.CAPACITY_DEFAULT_TARGET : 50;\n\n// Per-BU overrides, e.g.:\n// window.CAPACITY_TARGET_HOURS = {"HVAC - Install":45, "HVAC - Service":49, "HVAC - Sales":56}\nconst TARGET_BY_BU = (typeof window !== \'undefined\' && window.CAPACITY_TARGET_HOURS) || {};\n\n// Optional display order, e.g.:\n// window.CAPACITY_ORDER = ["HVAC - Install","HVAC - Service","HVAC - Sales"];\nconst ORDER = (typeof window !== \'undefined\' && window.CAPACITY_ORDER) || [];\n// --------------------------------------------------------\n\n// Parse "08:00 AM - 05:00 PM" -> hours\nfunction parseRangeToHours(s){\n  if (!s || typeof s !== \'string\') return 0;\n  const parts = s.split(\'-\');\n  if (parts.length !== 2) return 0;\n  const [a,b] = parts.map(x => x.trim());\n  const toMins = t => {\n    const m = t.match(/^(\\d{1,2}):(\\d{2})\\s*(AM|PM)$/i);\n    if (!m) return 0;\n    let h = Number(m[1]) % 12;\n    const min = Number(m[2]);\n    const pm = /PM/i.test(m[3]);\n    if (pm) h += 12;\n    return h*60 + min;\n  };\n  const start = toMins(a), end = toMins(b);\n  if (!start && !end) return 0;\n  let diff = (end - start)/60;\n  if (diff < 0) diff += 24; // overnight safeguard\n  return diff;\n}\n\n// If WeekTotal missing, sum day ranges\nfunction weekHoursFromRow(r){\n  const wt = num(r[F.WeekTotal]);\n  if (wt > 0) return wt;\n  const days = ["Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Monday"]\n    .map(k => r[F[k]]);\n  return days.reduce((s,val)=> s + parseRangeToHours(val), 0);\n}\n\n// Aggregate by Business Unit\nconst byBU = new Map();\nfor (const r of (data.data || [])) {\n  const bu   = String(r[F.TechnicianBusinessUnit] ?? \'Unassigned\');\n  const tech = String(r[F.TechnicianName] ?? \'\');\n  const hrs  = weekHoursFromRow(r);\n\n  if (!byBU.has(bu)) byBU.set(bu, { bu, scheduledHours: 0, techs: new Set() });\n  const bucket = byBU.get(bu);\n  bucket.scheduledHours += hrs;\n  bucket.techs.add(tech);\n}\n\n// Build rows for UI\nlet rows = Array.from(byBU.values()).map(x => {\n  const headcount = x.techs.size;\n  const perTechTarget = (typeof TARGET_BY_BU[x.bu] === \'number\') ? TARGET_BY_BU[x.bu] : DEFAULT_TARGET;\n  const targetHours = headcount * perTechTarget;\n\n  const ratioRaw = targetHours > 0 ? (x.scheduledHours / targetHours) : 0;\n  const ratio = Math.max(0, Math.min(1, ratioRaw));       // clamp 0..1 for display\n  const capacityPct = Math.round(ratio * 100);\n  const blocks = Math.max(0, Math.min(10, Math.round(ratioRaw * 10))); // 0..10 (allows slight >100% to round up)\n\n  return {\n    businessUnit: x.bu,\n    headcount,\n    scheduledHours: Number(x.scheduledHours.toFixed(1)),\n    perTechTarget,\n    targetHours,\n    capacityRatio: ratio,   // 0..1\n    capacityPct,            // 0..100\n    blocks,                 // 0..10\n    blocks10: Array.from({length:10}, (_,i)=> i < blocks) // e.g. [true,true,...]\n  };\n});\n\n// Optional ordering\nif (ORDER.length) {\n  const idx = Object.fromEntries(ORDER.map((k,i)=>[k,i]));\n  rows.sort((a,b)=> (idx[a.businessUnit] ?? 1e9) - (idx[b.businessUnit] ?? 1e9));\n} else {\n  rows.sort((a,b)=> a.businessUnit.localeCompare(b.businessUnit));\n}\n\n// Totals (if you want an overall capacity indicator)\nconst totals = rows.reduce((acc,r)=>{\n  acc.scheduledHours += r.scheduledHours;\n  acc.targetHours += r.targetHours;\n  acc.headcount += r.headcount;\n  return acc;\n}, {scheduledHours:0, targetHours:0, headcount:0});\ntotals.capacityPct = totals.targetHours ? Math.round((totals.scheduledHours / totals.targetHours) * 100) : 0;\n\nreturn { rows, totals };'
    }
    type="POST"
  />
  <RESTQuery
    id="getSalesMonthlyPace"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ new Date(new Date().getFullYear(), new Date().getMonth(), 2).toISOString().slice(0,10) }}" },\n    { "name": "To", "value": "{{ date7.value && new Date(date7.value).toISOString().slice(0,10) }}" },\n    { "name": "BusinessUnitIds", "value": [1809, 1810, 1812, 64313020, 64315277, 64326403, 64567559, 64569092, 64569731] },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken2.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    resourceDisplayName="getSales"
    resourceName="bb251234-d391-440a-8d2c-7a712911492a"
    resourceTypeOverride=""
    runWhenModelUpdates={false}
    runWhenPageLoadsDelay="2000"
    transformer={
      "// === Transformer: Monthly Sales Pace (LA tz) with \"$1.17M\" formatting ===\n\n// -------- helpers --------\nfunction num(v){\n  if (v == null || v === '') return 0;\n  const n = Number(String(v).replace(/[$,%\\s]/g,''));\n  return Number.isFinite(n) ? n : 0;\n}\n\n// Compact money: \"$1.17M\", \"$540K\", \"$932\", \"$2.3B\"\nfunction fmtUSDCompact(n){\n  n = num(n);\n  const abs = Math.abs(n);\n  const sign = n < 0 ? '-' : '';\n  const fmt = (v, s) => `${sign}$${v}${s}`;\n\n  if (abs >= 1_000_000_000) return fmt((abs/1_000_000_000).toFixed(2), 'B');\n  if (abs >= 1_000_000)     return fmt((abs/1_000_000).toFixed(2), 'M');\n  if (abs >= 1_000)         return fmt((abs/1_000).toFixed(2), 'K');\n  return fmt(abs.toFixed(0), '');\n}\n\n// -------- read rows (array-of-arrays with fields) --------\nconst fields = Array.isArray(data?.fields) ? data.fields.map(f => f.name) : [];\nconst ix = Object.fromEntries(fields.map((n,i)=>[n,i]));\nconst rows = Array.isArray(data?.data) ? data.data : [];\nconst col  = (r, name) => (typeof ix[name] === 'number') ? r[ix[name]] : undefined;\n\n// Σ TotalSales across all business units (month-to-date slice from API)\nconst totalSalesToDate = rows.reduce((s, r) => s + num(col(r, 'TotalSales')), 0);\n\n// -------- From / To like your request body --------\n// From: 2nd of current month; To: date7.value (fallback now)\nconst toJS   = (typeof date7 !== 'undefined' && date7?.value) ? new Date(date7.value) : new Date();\nconst nowJS  = new Date();\nconst fromJS = new Date(nowJS.getFullYear(), nowJS.getMonth(), 2); // mirrors body\n\n// LA timezone calendar for \"To\"\nconst LA_TZ = 'America/Los_Angeles';\nconst partsTo = Object.fromEntries(\n  new Intl.DateTimeFormat('en-CA', { timeZone: LA_TZ, year:'numeric', month:'2-digit', day:'2-digit' })\n    .formatToParts(toJS).map(p => [p.type, p.value])\n);\nconst Y = Number(partsTo.year);\nconst M = Number(partsTo.month);   // 1..12\nconst D = Number(partsTo.day);     // 1..31\n\n// Days in month & days past (adjusted for From day)\nconst daysInMonth = new Date(Y, M, 0).getDate();\nconst fromDay     = Math.min(Math.max((fromJS?.getDate() ?? 1), 1), daysInMonth); // typically 2\nconst rawDaysPast = D;\nconst daysPast    = Math.max(1, Math.min(daysInMonth, rawDaysPast - (fromDay - 1))); // if From=2 → subtract 1\n\n// Pace\nconst pace = totalSalesToDate * (daysInMonth / daysPast);\n\n// -------- return --------\nreturn {\n  formatted: {\n    totalSalesToDate,                       // raw number\n    totalSalesToDateCompact: fmtUSDCompact(totalSalesToDate), // \"$1.17M\"\n    daysPast,\n    daysInMonth,\n    fromDay,                                // 2\n    pace,                                   // raw number\n    paceCompact: fmtUSDCompact(pace),       // \"$1.17M\"\n    meta: {\n      timezone: LA_TZ,\n      note: 'PACE = Σ(TotalSales) × (daysInMonth / (day-of-month - (fromDay-1)))',\n      toISO: new Date(Date.UTC(Y, M-1, D)).toISOString().slice(0,10)\n    }\n  }\n};"
    }
    type="POST"
  />
  <RESTQuery
    id="getRevenueMonthlyPace"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ new Date(new Date().getFullYear(), new Date().getMonth(), 2).toISOString().slice(0,10) }}" },\n    { "name": "To", "value": "{{ date7.value && new Date(date7.value).toISOString().slice(0,10) }}" },\n    { "name": "BusinessUnitIds", "value": [1809, 1810, 1812, 64313020, 64315277, 64326403, 64567559, 64569092, 64569731] },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken2.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    query="https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/operations/reports/111413515/data"
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    queryTimeout="100000"
    resourceDisplayName="getMonthlyPace"
    resourceName="18352864-9d03-434e-9809-f496c1b341fc"
    resourceTypeOverride=""
    runWhenModelUpdates={false}
    runWhenPageLoadsDelay="2000"
    transformer="// Transformer: txRevenueMonthlyPace
// Input: { fields:[{name,label}...], data:[[...], ...] }
// Requirement: Use **CurrentMonthlyPace** sum (NOT CompletedRevenue)

// --- setup ---
const F = Object.fromEntries((data.fields || []).map((f,i)=>[f.name, i]));
const rows = Array.isArray(data.data) ? data.data : [];
const num = v => (v==null || v==='' || Number.isNaN(Number(v))) ? 0 : Number(v);

// Money short format with 2 decimals (K/M/B)
function moneyShort(n){
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e9) return `${s}$${(a/1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a/1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a/1e3).toFixed(2)}K`;
  return `${s}$${a.toFixed(2)}`;
}

// --- sum CURRENT MONTHLY PACE (primary) ---
let value = 0;
const paceIdx = F.CurrentMonthlyPace;

// If the column exists, sum it; otherwise return 0 (or fallback if you want)
if (paceIdx != null) {
  for (const r of rows) value += num(r[paceIdx]);
}

// Output
return {
  value,
  formatted: moneyShort(value),
  meta: {
    used: paceIdx != null ? 'CurrentMonthlyPace(sum)' : 'none',
    rows: rows.length
  }
};
"
    type="POST"
  />
  <RESTQuery
    id="getBookingRate"
    body={
      '{\n  "parameters": [\n    { \n      "name": "From",\n      "value": "{{ (()=>{ \n        const tz=\'America/Los_Angeles\'; \n        const now=new Date();\n        return new Intl.DateTimeFormat(\'en-CA\',{\n          timeZone:tz,\n          year:\'numeric\',\n          month:\'2-digit\',\n          day:\'2-digit\'\n        }).format(now);\n      })() }}"\n    },\n    { \n      "name": "To",\n      "value": "{{ (()=>{ \n        const tz=\'America/Los_Angeles\'; \n        const now=new Date();\n        return new Intl.DateTimeFormat(\'en-CA\',{\n          timeZone:tz,\n          year:\'numeric\',\n          month:\'2-digit\',\n          day:\'2-digit\'\n        }).format(now);\n      })() }}"\n    },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken2.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    queryTimeout="100000"
    resourceDisplayName="getBookingRate"
    resourceName="d2c90bab-f47b-45eb-9585-508f5d01e974"
    resourceTypeOverride=""
    runWhenModelUpdates={false}
    runWhenPageLoadsDelay="2000"
    transformer={
      "// Transformer: txBookedVsLeads\n// Input: { fields:[{name,label}...], data:[[...], ...] }\n\nconst F = Object.fromEntries((data.fields || []).map((f,i)=>[f.name, i]));\nconst num = v => (v==null || v==='' || Number.isNaN(Number(v))) ? 0 : Number(v);\n\n// Indices (with safe fallbacks)\nconst LEADS_IDX  = F.LeadCalls ?? F['Lead Calls'];\nconst BOOKED_IDX = F.BookedJobsByCall ?? F['Booked Jobs By Call'];\n\nlet leads = 0, booked = 0;\nfor (const r of (data.data || [])) {\n  leads  += num(r[LEADS_IDX]);\n  booked += num(r[BOOKED_IDX]);\n}\n\nconst unbooked = Math.max(leads - booked, 0);\nconst rate = leads > 0 ? booked / leads : 0; // 0..1\n\nreturn {\n  // For a donut/pie chart\n  pie: {\n    labels: [\"Booked\", \"Unbooked\"],\n    values: [booked, unbooked]\n  },\n\n  // For a progress bar (use %)\n  progress: {\n    value: +(rate * 100).toFixed(1)  // e.g., 85.8\n  },\n\n  // For a center label / KPI chips\n  centerLabel: `${(rate * 100).toFixed(1)}%`,\n  kpis: {\n    leads,           // e.g., 141\n    booked,          // e.g., 121\n    unbooked,        // optional display\n    rate             // 0..1 if you need the raw ratio\n  }\n};"
    }
    type="POST"
  />
  <RESTQuery
    id="getJobCostingSummary"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ new Date(new Date().getFullYear(), new Date().getMonth(), 2).toISOString().slice(0,10) }}" },\n    { "name": "To", "value": "{{ date7.value && new Date(date7.value).toISOString().slice(0,10) }}" },\n    { "name": "DateType", "value": {{ 1 }} },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken2.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    queryTimeout="100000"
    resourceDisplayName="getJobCostingSummary"
    resourceName="25a91f61-1a41-4022-8796-fe680b9a9dab"
    resourceTypeOverride=""
    runWhenModelUpdates={false}
    runWhenPageLoadsDelay="2000"
    transformer="// ===================== CONFIG =====================
const GOAL = 500_000; // monthly break-even goal ($)

// ===================== UTILS ======================
const toNum = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

const isDateLike = (v) => {
  if (v == null || v === '') return false;
  if (v instanceof Date) return !isNaN(v.getTime());
  if (typeof v === 'number') {
    const nowMs = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const minMs = Date.UTC(2000, 0, 1);
    if (v > 1e12) return v >= minMs && v <= (nowMs + oneYearMs); // ms
    const ms = v * 1000;                                         // sec
    return ms >= minMs && ms <= (nowMs + oneYearMs);
  }
  const d = new Date(v);
  if (isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  return y >= 2000 && y <= 2100;
};

const toDate = (v) => {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const ms = v > 1e12 ? v : v * 1000;
    return isDateLike(ms) ? new Date(ms) : null;
  }
  const d = new Date(v);
  return isDateLike(d) ? d : null;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameMonth = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// ===================== INPUT NORMALIZATION ======================
const rowsRaw = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
const fieldDefs = Array.isArray(data?.fields) ? data.fields : [];
const fieldNames = fieldDefs.length
  ? fieldDefs.map((f, i) => (f?.name ?? f?.label ?? String(i)))
  : (rowsRaw[0] ? Object.keys(rowsRaw[0]) : []);

const rows = rowsRaw.map(row => {
  if (Array.isArray(row)) {
    const obj = {};
    for (let i = 0; i < fieldNames.length; i++) obj[fieldNames[i]] = row[i];
    return obj;
  }
  const keys = Object.keys(row || {});
  const looksIndexed = keys.length && keys.every(k => /^\d+$/.test(k));
  if (looksIndexed) {
    const obj = {};
    for (let i = 0; i < fieldNames.length; i++) obj[fieldNames[i]] = row[i] ?? row[String(i)];
    return obj;
  }
  return row || {};
});

const labelToName = {};
for (const f of fieldDefs) {
  if (f?.label && f?.name) labelToName[f.label.toLowerCase()] = f.name;
}
const nameByLabel = (label) => (label && labelToName[label.toLowerCase()]) || null;

// ===================== COLUMN DETECTION ======================
const marginNameCandidates = [
  'GrossMargin','grossMargin','Margin','margin','Gross_Amount','Gross_Profit','GrossProfit'
];
const marginLabelCandidates = [
  'Jobs Gross Margin','Gross Margin','Gross Profit','Jobs Gross Profit'
];
const resolvedMarginNames = [
  ...marginNameCandidates,
  ...marginLabelCandidates.map(nameByLabel).filter(Boolean),
];
const marginKeysTried = Array.from(new Set(resolvedMarginNames.filter(Boolean)));

let chosenMarginKey = null;
let marginKeyNonZeroCount = 0;
if (rows.length) {
  const probeCount = Math.min(200, rows.length);
  for (const k of marginKeysTried) {
    if (!(k in rows[0])) continue;
    let cnt = 0;
    for (let i = 0; i < probeCount; i++) {
      if (toNum(rows[i]?.[k]) !== 0) cnt++;
    }
    if (cnt > marginKeyNonZeroCount) {
      marginKeyNonZeroCount = cnt;
      chosenMarginKey = k;
    }
  }
}

const totalKey = fieldNames.includes('Total') ? 'Total' : (nameByLabel('Jobs Total') || 'Total');
const costKey  = fieldNames.includes('TotalCosts') ? 'TotalCosts' : (nameByLabel('Jobs Total Costs') || 'TotalCosts');
const laborKey = fieldNames.includes('LaborPay') ? 'LaborPay' : (nameByLabel('Labor Pay') || 'LaborPay');

const dateNameCandidates = [
  'Date','date','JobDate','InvoiceDate','StartDate','CompletedDate',
  'CompletionDate','CreatedAt','ReportDate'
];
const dateLabelCandidates = [
  'Date','Job Date','Invoice Date','Completed Date','Completion Date','Report Date','Created At'
];

let dateKey =
  (dateLabelCandidates.map(nameByLabel).find(Boolean)) ||
  (dateNameCandidates.find(k => rows[0] && k in rows[0])) ||
  null;

const dateBlacklist = new Set([
  'Total','TotalCosts','LaborPay','GrossMargin','GrossMarginPercentage',
  'Amount','Price','Cost','Revenue'
]);

if (!dateKey && rows.length) {
  const keys = Object.keys(rows[0] || {}).filter(k => !dateBlacklist.has(k));
  let bestKey = null, bestHit = 0;
  const probeCount = Math.min(100, rows.length);
  for (const k of keys) {
    let hits = 0;
    for (let i = 0; i < probeCount; i++) if (isDateLike(rows[i]?.[k])) hits++;
    if (hits > bestHit) { bestHit = hits; bestKey = k; }
  }
  if (bestHit >= Math.ceil(0.1 * Math.min(100, rows.length))) dateKey = bestKey;
}

if (dateKey) {
  const probeCount = Math.min(100, rows.length);
  let hits = 0;
  for (let i = 0; i < probeCount; i++) if (isDateLike(rows[i]?.[dateKey])) hits++;
  if (hits < Math.ceil(0.1 * probeCount)) dateKey = null;
}

// ===================== AGGREGATION ======================
const now = new Date();
const todayStart = startOfDay(now);
const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
const yesterdayEnd = new Date(todayStart.getTime() - 1);

let totalGross = 0, mtdGross = 0, yGross = 0;
let computedUsed = false;

for (const r of rows) {
  let gm;
  if (chosenMarginKey) {
    gm = toNum(r?.[chosenMarginKey]);
  } else {
    gm = toNum(r?.[totalKey]) - toNum(r?.[costKey]) - toNum(r?.[laborKey]);
    computedUsed = true;
  }

  totalGross += gm;

  const d = dateKey ? toDate(r?.[dateKey]) : null;
  if (d) {
    if (sameMonth(d, now) && d <= now) mtdGross += gm;
    if (d >= yesterdayStart && d <= yesterdayEnd) yGross += gm;
  } else {
    mtdGross += gm; // no per-row date → treat all as MTD
  }
}

// ===================== INPUT ARRAY FOR PROGRESS BARS ======================
const input = [
  {
    id: 'month_goal',
    label: 'Monthly Break-even Goal',
    value: GOAL,
    max: GOAL,
    pct: 1,
    remaining: 0
  },
  {
    id: 'mtd',
    label: 'MTD Gross Margin',
    value: mtdGross,
    max: GOAL,
    pct: GOAL ? (mtdGross / GOAL) : null,
    remaining: Math.max(0, GOAL - mtdGross)
  },
  {
    id: 'yesterday',
    label: 'Yesterday Gross Margin',
    value: yGross,
    max: GOAL,
    pct: GOAL ? (yGross / GOAL) : null,
    remaining: Math.max(0, GOAL - yGross)
  }
];

// ===================== OUTPUT ======================
return {
  goal: GOAL,
  input, // <—— bind your Progress components to items in this array
  summary: {
    totalGross,
    mtd: {
      value: mtdGross,
      remaining: Math.max(0, GOAL - mtdGross),
      pctOfGoal: GOAL ? (mtdGross / GOAL) : null
    },
    yesterday: {
      value: yGross,
      pctOfGoal: GOAL ? (yGross / GOAL) : null
    }
  },
  progressBars: {
    mtd_value: mtdGross,
    mtd_max: GOAL,
    yesterday_value: yGross,
    yesterday_max: GOAL
  },
  meta: {
    normalized: true,
    fieldNames,
    marginKeyUsed: chosenMarginKey || 'COMPUTED_FROM_TOTAL_MINUS_COSTS_MINUS_LABOR',
    marginKeysTried,
    marginKeyNonZeroCount,
    dateKeyUsed: dateKey || null,
    totalKey,
    costKey,
    laborKey,
    rowCount: rows.length,
    sampleMappedRow: rows[0] || null,
    computedMarginFallbackUsed: computedUsed
  }
};
"
    type="POST"
  />
  <JavascriptQuery
    id="query12"
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/query12.js", "string")}
    queryFailureConditions={'[{"condition":"","message":""}]'}
    resourceName="JavascriptQuery"
    showFailureToaster={false}
    showSuccessToaster={false}
  />
  <RESTQuery
    id="getGoalTracker"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ new Date(new Date().getFullYear(), 0, 2).toISOString().slice(0,10) }}" },\n    { "name": "To", "value": "{{ new Date().toISOString().slice(0,10) }}" },\n    { "name": "BusinessUnitIds", "value": [1809, 1810, 1812, 64313020, 64315277, 64326403, 64567559, 64569092, 64569731] },\n    { "name": "DateType", "value": 1 },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken2.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    queryTimeout="100000"
    resourceDisplayName="getGoalTracker"
    resourceName="430cea1f-68db-4534-929a-cdaed4c310d1"
    resourceTypeOverride=""
    runWhenModelUpdates={false}
    runWhenPageLoadsDelay="2000"
    transformer="// ---------- helpers ----------
const toNum = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
const clamp01 = (x) => Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;

// ---------- normalize ----------
const rowsRaw = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
const fields  = Array.isArray(data?.fields) ? data.fields : [];
const fieldNames = fields.map(f => f?.name);

const rows = rowsRaw.map(r => {
  if (Array.isArray(r)) {
    const o = {};
    for (let i = 0; i < fieldNames.length; i++) o[fieldNames[i]] = r[i];
    return o;
  }
  return r || {};
});

// ---------- per-group ----------
const groups = rows.map(r => ({
  name: String(r?.Name ?? ''),
  totalRevenue:   toNum(r?.TotalRevenue),
  totalSales:     toNum(r?.TotalSales),
  goalDaily:      toNum(r?.GoalDaily),        // in your payload: actually monthly company goal per BU row
  goalNoWeekends: toNum(r?.GoalNoWeekends),   // same, “no weekends” variant
  yearlyPace:     toNum(r?.CurrentYearlyPace),
  monthlyPace:    toNum(r?.CurrentMonthlyPace),
  combinedRevenue: toNum(r?.TotalRevenue) + toNum(r?.TotalSales)
}));

// ---------- totals ----------
const sum = (arr, key) => arr.reduce((acc, x) => acc + toNum(x?.[key]), 0);
const totals = {
  totalRevenue:    sum(groups, 'totalRevenue'),
  totalSales:      sum(groups, 'totalSales'),
  combinedRevenue: sum(groups, 'combinedRevenue'),
  yearlyPace:      sum(groups, 'yearlyPace'),
  monthlyPace:     sum(groups, 'monthlyPace'),
  goalDaily_sum:      sum(groups, 'goalDaily'),
  goalNoWeekends_sum: sum(groups, 'goalNoWeekends')
};

// ---------- choose company goal (don’t sum across BUs) ----------
const maxNonZero = (arr, key) => arr.reduce((m, x) => {
  const v = toNum(x?.[key]); return v > m ? v : m;
}, 0);
const companyGoalDaily      = maxNonZero(groups, 'goalDaily');
const companyGoalNoWeekends = maxNonZero(groups, 'goalNoWeekends');

// --------- period decision & goals ---------
// Heuristic: if sum of revenue >> monthly goal, treat revenue as YTD -> use annual gauge.
const monthlyGoal = companyGoalNoWeekends || companyGoalDaily || 0;
const yearlyGoal  = monthlyGoal * 12;

const revenueSum = totals.combinedRevenue;
// if revenueSum is much bigger than one month’s goal, assume YTD data is loaded
const looksYTD = monthlyGoal > 0 && revenueSum > monthlyGoal * 1.5;

// Monthly metrics (useful when you truly load monthly data)
const monthRevenue = totals.combinedRevenue; // what your query returns; may actually be YTD
const pct_month    = monthlyGoal > 0 ? clamp01(monthRevenue / monthlyGoal) : 0;

// Annual metrics
const yeartotalrevenue = totals.combinedRevenue;     // treat as YTD if looksYTD=true
const pct_year         = yearlyGoal > 0 ? clamp01(yeartotalrevenue / yearlyGoal) : 0;

// Forecast: prefer an explicit yearly pace if present; else scale monthly pace * 12.
const forecastedYear = Math.max(toNum(totals.yearlyPace), toNum(totals.monthlyPace) * 12);
const pacingPercent  = yearlyGoal > 0 ? (forecastedYear / yearlyGoal) : 0; // 0..1

// ---- expose a single pct for the gauge (what your HTML expects) ----
const pct = looksYTD ? pct_year : pct_month;

// ---------- input array (for quick binding/debug) ----------
const input = [
  { id: 'looksYTD',    label: 'Looks like YTD?', value: looksYTD },
  { id: 'pct',         label: 'Gauge pct (0..1)', value: pct },
  { id: 'pct_month',   label: 'Monthly pct (0..1)', value: pct_month },
  { id: 'pct_year',    label: 'Yearly pct (0..1)', value: pct_year },
  { id: 'forecasted',  label: 'Forecasted Year', value: forecastedYear },
  { id: 'pacingPct',   label: 'Pacing % (0..1)', value: pacingPercent },
  { id: 'monthlyGoal', label: 'Monthly Goal', value: monthlyGoal },
  { id: 'yearlyGoal',  label: 'Yearly Goal', value: yearlyGoal }
];

// ---------- return ----------
return {
  raw: data,
  groups,
  totals: {
    totalRevenue: totals.totalRevenue,
    totalSales: totals.totalSales,
    combinedRevenue: totals.combinedRevenue,
    yearlyPace: totals.yearlyPace,
    monthlyPace: totals.monthlyPace,
    companyGoalDaily,
    companyGoalNoWeekends,
    monthlyGoal,
    yearlyGoal
  },

  // expose both views
  monthtotalrevenue: monthRevenue,
  monthlygoal: monthlyGoal,
  monthlypace: totals.monthlyPace,
  pct_month,

  yeartotalrevenue,
  yearlygoal: yearlyGoal,
  yearlypace: totals.yearlyPace,
  pct_year,

  // new unified values for the widget
  pct,                       // <= what your HTML uses
  forecastedYear,
  pacingPercent,             // 0..1

  input,
  meta: {
    note: 'Gauge pct auto-switches: if revenue >> monthly goal, treat as YTD and use annual ratio.',
    rows: rows.length
  }
};
"
    type="POST"
  />
  <RESTQuery
    id="query19"
    body={
      '{\n  "parameters": [\n    { "name": "From", "value": "{{ date8.value && new Date(date8.value).toISOString().slice(0,10) }}" },\n    { "name": "To", "value": "{{ date7.value && new Date(date7.value).toISOString().slice(0,10) }}" },\n    { "name": "BusinessUnitIds", "value": [1809, 1810, 1812, 64313020, 64315277, 64326403, 64567559, 64569092, 64569731] },\n    { "name": "Take", "value": 100 },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken2.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    resourceDisplayName="getTrending"
    resourceName="661d2044-9754-4297-8c64-b3717fcd192e"
    runWhenModelUpdates={false}
    showSuccessToaster={false}
    type="POST"
  />
  <connectResource id="query20" _componentId={null} />
  <SqlQueryUnified
    id="getTrending"
    enableTransformer={true}
    isMultiplayerEdited={false}
    query={include("../lib/getTrending.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    resourceTypeOverride=""
    transformer={
      "let root = (() => {\n  if (Array.isArray(data)) return data[0] || {};\n  if (data && typeof data === 'object') return data;\n  return {};\n})();\n\nlet trending = (() => {\n  let t = root.trending;\n  if (Array.isArray(t)) t = t[0];\n  if (typeof t === 'string') { try { t = JSON.parse(t) } catch(e) {} }\n  return t || {};\n})();\n\nlet raw = (() => {\n  let r = trending.raw_json;\n  if (Array.isArray(r)) r = r[0];\n  if (typeof r === 'string') { try { r = JSON.parse(r) } catch(e) {} }\n  return r || {};\n})();\n\nlet goalsArr = (() => {\n  let g = root.goals;\n  if (typeof g === 'string') { try { g = JSON.parse(g) } catch(e) {} }\n  if (Array.isArray(g) && g.length === 1 && Array.isArray(g[0])) g = g[0];\n  if (!Array.isArray(g)) g = [];\n  return g;\n})();\n\nfunction fmtUSD(n){ return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }); }\nfunction num(v){ if (v == null || v === '') return 0; const n = Number(String(v).replace(/[$,%\\s]/g,'')); return Number.isFinite(n) ? n : 0; }\n\n// Month helpers (normalize inbound values to full names)\nconst MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];\nconst SHORT = {January:'Jan',February:'Feb',March:'Mar',April:'Apr',May:'May',June:'Jun',July:'Jul',August:'Aug',September:'Sep',October:'Oct',November:'Nov',December:'Dec'};\nconst SHORT_TO_FULL = {Jan:'January',Feb:'February',Mar:'March',Apr:'April',May:'May',Jun:'June',Jul:'July',Aug:'August',Sep:'September',Sept:'September',Oct:'October',Nov:'November',Dec:'December'};\nfunction normMonth(m){\n  if (!m && m !== 0) return '';\n  const s = String(m).trim();\n  // numeric (1-12 or 01-12)\n  const maybeNum = Number(s);\n  if (Number.isInteger(maybeNum) && maybeNum >= 1 && maybeNum <= 12) return MONTHS[maybeNum - 1];\n  // short forms\n  const cap = s.charAt(0).toUpperCase() + s.slice(1,3).toLowerCase();\n  if (SHORT_TO_FULL[cap]) return SHORT_TO_FULL[cap];\n  // full name fallback (correct casing)\n  const full = MONTHS.find(M => M.toLowerCase() === s.toLowerCase());\n  return full || s; // last resort\n}\n\n// Raw table parsing\nconst fields = Array.isArray(raw.fields) ? raw.fields.map(f => f.name) : [];\nconst idx = Object.fromEntries(fields.map((n,i)=>[n,i]));\nconst rows = Array.isArray(raw.data) ? raw.data : [];\nfunction val(r, k){ return Array.isArray(r) ? r[idx[k]] : r?.[k]; }\n\nconst parsed = rows.map(r => ({\n  year: String(val(r,'Year') ?? ''),\n  month: normMonth(val(r,'Period')),\n  sales: num(val(r,'TotalSales')),\n  revenue: num(val(r,'TotalRevenue')),\n})).filter(r => r.year && MONTHS.includes(r.month));\n\n// Structure by year/month\nconst byYear = {};\nfor (const r of parsed){\n  if (!byYear[r.year]) byYear[r.year] = {};\n  byYear[r.year][r.month] = { sales: r.sales, revenue: r.revenue };\n}\n\n// Goals map\nconst goalByMonth = {};\nfor (const g of goalsArr){\n  const name = normMonth(g?.month_name);\n  const amt  = num(g?.goal_amount);\n  const upd  = g?.updated_at || '';\n  if (MONTHS.includes(name)) goalByMonth[name] = { amount: amt, updated_at: upd };\n}\n\n// Assemble month list with current/past years\nconst list = MONTHS.map(m => ({\n  month: m,\n  short: SHORT[m],\n  y2024: byYear['2024']?.[m] || { sales: 0, revenue: 0 },\n  y2025: byYear['2025']?.[m] || { sales: 0, revenue: 0 },\n  goal:  goalByMonth[m]?.amount || 0,\n  goalUpdatedAt: goalByMonth[m]?.updated_at || ''\n}));\n\n// ---------- SCALING: choose a \"nice\" dynamic chart max ----------\nconst candidateMax = Math.max(\n  1,\n  ...list.flatMap(x => [x.y2024.sales, x.y2024.revenue, x.y2025.sales, x.y2025.revenue, x.goal])\n);\n\n// 1-2-5 nice ceiling utility\nfunction niceCeil(x) {\n  if (x <= 0) return 1;\n  const pow10 = Math.pow(10, Math.floor(Math.log10(x)));\n  const unit = x / pow10;\n  let niceUnit;\n  if (unit <= 1) niceUnit = 1;\n  else if (unit <= 2) niceUnit = 2;\n  else if (unit <= 2.5) niceUnit = 2.5;\n  else if (unit <= 3) niceUnit = 3;\n  else if (unit <= 4) niceUnit = 4;\n  else if (unit <= 5) niceUnit = 5;\n  else niceUnit = 10;\n  return niceUnit * pow10;\n}\n\n\n// Ensure at least 4 ticks have sensible spacing\nconst chartMax = niceCeil(candidateMax);\n\n// Percent helper based on *chartMax* (NOT data max)\nconst pct = v => (Math.max(0, Math.min(1, (v || 0) / chartMax)) * 100).toFixed(2) + '%';\n\n// Build bar HTML blocks (unchanged styles)\nconst monthBlocks = list\n  .map(m => {\n    const b24s = `\n      <div class=\"bar y2024\" data-tip=\"${fmtUSD(m.y2024.sales)}\"   style=\"--h:${pct(m.y2024.sales)};  color:#8B4513\">\n        <span class=\"ink\"></span>\n      </div>`;\n    const b24r = `\n      <div class=\"bar y2024\" data-tip=\"${fmtUSD(m.y2024.revenue)}\" style=\"--h:${pct(m.y2024.revenue)};color:#4a90e2\">\n        <span class=\"ink\"></span>\n      </div>`;\n    const b25s = `\n      <div class=\"bar y2025\" data-tip=\"${fmtUSD(m.y2025.sales)}\"   style=\"--h:${pct(m.y2025.sales)};  color:#ff6b35\">\n        <span class=\"ink\"></span>\n      </div>`;\n    const b25r = `\n      <div class=\"bar y2025\" data-tip=\"${fmtUSD(m.y2025.revenue)}\" style=\"--h:${pct(m.y2025.revenue)};color:#20b2aa\">\n        <span class=\"ink\"></span>\n      </div>`;\n\n    const goalTip = m.goal ? `Goal ${fmtUSD(m.goal)}${m.goalUpdatedAt ? ' • ' + new Date(m.goalUpdatedAt).toLocaleString() : ''}` : '';\n    const goalLine = (m.goal > 0)\n      ? `<div class=\"goal-line\" data-tip=\"${goalTip}\" style=\"--y:${pct(m.goal)};\"></div>`\n      : '';\n\n    return `\n      <div class=\"month\">\n        <div class=\"bars\">\n          ${b24s}${b24r}${b25s}${b25r}${goalLine}\n        </div>\n        <div class=\"x\">${m.short}</div>\n      </div>`;\n  })\n  .join('');\n\n// ---------- Dynamic Y-Axis labels (5 lanes: top, 75%, 50%, 25%, 0) ----------\nfunction fmtAxis(n){\n  if (n >= 1_000_000) return `$${(n/1_000_000).toLocaleString('en-US', {maximumFractionDigits: n % 1_000_000 ? 1 : 0})}M`;\n  if (n >= 1_000)     return `$${(n/1_000).toLocaleString('en-US', {maximumFractionDigits: 0})}k`;\n  return `$${n}`;\n}\nconst ticks = [1, 0.75, 0.5, 0.25, 0].map(t => Math.round(chartMax * t)); // rounded for clean labels\nconst labelsHtml = ticks.map(v => `<span>${fmtAxis(v)}</span>`).join('');\n\n// Expose everything the page needs\nreturn {\n  html: monthBlocks,\n  yLabels: labelsHtml,           // <— inject into the y-axis\n  chartMax,                      // useful for debugging if you want to display it\n  snapshot_time: trending?.snapshot_time || ''\n};\n"
    }
    warningCodes={[]}
  />
  <SqlQueryUnified
    id="goalTrackerDB"
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/goalTrackerDB.sql", "string")}
    queryFailureConditions={'[{"condition":"","message":""}]'}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    runWhenModelUpdates={false}
    showUpdateSetValueDynamicallyToggle={false}
    successMessage={'{{ "Goal is successfully set!" }}'}
    updateSetValueDynamically={true}
    warningCodes={[]}
  />
  <JavascriptQuery
    id="monthMap"
    notificationDuration={4.5}
    query={include("../lib/monthMap.js", "string")}
    resourceName="JavascriptQuery"
    showSuccessToaster={false}
  />
  <SqlQueryUnified
    id="getGoalTrackerDB"
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/getGoalTrackerDB.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    showSuccessToaster={false}
    showUpdateSetValueDynamicallyToggle={false}
    updateSetValueDynamically={true}
    warningCodes={[]}
  />
  <SqlQueryUnified
    id="getSalesDB"
    enableTransformer={true}
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/getSalesDB.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    showSuccessToaster={false}
    showUpdateSetValueDynamicallyToggle={false}
    tableName="st_advisors"
    transformer="// ---------- helpers ----------
const toNum = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

// ---------- normalize rows from positional arrays using fields[] ----------
const rowsRaw = Array.isArray(data?.raw_json[0].data) ? data.raw_json[0].data : Array.isArray(data) ? data : [];
const fields = Array.isArray(data?.raw_json[0].fields) ? data.raw_json[0].fields : [];
const names = fields.map(f => f?.name);

const rows = rowsRaw.map(r => {
  if (Array.isArray(r)) {
    const o = {};
    for (let i = 0; i < names.length; i++) o[names[i]] = r[i];
    return o;
  }
  return r || {};
});

// ---------- map & derive per group ----------
const groups = rows.map(r => {
  const name = String(r?.Name ?? '');
  const totalSales = toNum(r?.TotalSales);
  const closedAvgSale = toNum(r?.ClosedAverageSale);
  const closeRate = toNum(r?.CloseRate); // fraction 0..1
  const opp = toNum(r?.SalesOpportunity);
  const optionsPerOpp = toNum(r?.OptionsPerOpportunity);
  const adjRevenue = toNum(r?.AdjustmentRevenue);
  const totalRevenue = toNum(r?.TotalRevenue);
  const nonJobRevenue = toNum(r?.NonJobRevenue);

  const closedCount = opp * closeRate;                     // inferred
  const expectedRevenue = opp * closeRate * closedAvgSale; // per group expected

  return {
    name,
    totalSales,
    closedAvgSale,
    closeRate,
    opp,
    optionsPerOpp,
    adjRevenue,
    totalRevenue,
    nonJobRevenue,
    closedCount,
    expectedRevenue
  };
});

// ---------- totals, weighted KPIs ----------
const sum = (arr, key) => arr.reduce((a, x) => a + toNum(x?.[key]), 0);

const totals = {
  totalSales: sum(groups, 'totalSales'),
  totalRevenue: sum(groups, 'totalRevenue'),
  nonJobRevenue: sum(groups, 'nonJobRevenue'),
  adjRevenue: sum(groups, 'adjRevenue'),
  opp: sum(groups, 'opp'),
  closedCount: sum(groups, 'closedCount'),
  expectedRevenue: sum(groups, 'expectedRevenue'),
};

// weighted averages
const w = {
  byOpp: totals.opp > 0 ? totals.opp : 1,
  byClosed: totals.closedCount > 0 ? totals.closedCount : 1
};

const weightedCloseRate = totals.opp > 0
  ? groups.reduce((a, g) => a + (g.closeRate * g.opp), 0) / totals.opp
  : 0;

const weightedOptionsPerOpp = totals.opp > 0
  ? groups.reduce((a, g) => a + (g.optionsPerOpp * g.opp), 0) / totals.opp
  : 0;

const weightedClosedAvgSale = totals.closedCount > 0
  ? groups.reduce((a, g) => a + (g.closedAvgSale * g.closedCount), 0) / totals.closedCount
  : 0;

// ---------- gauge values ----------
const value = totals.totalRevenue;           // actual (YTD/period revenue in payload)
const max = Math.max(totals.expectedRevenue, 0); // goal/expected
const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

// ---------- input array for generic binding (optional) ----------
const input = [
  { id: 'revenue', label: 'Total Revenue', value },
  { id: 'expected', label: 'Expected Revenue', value: max },
  { id: 'pct', label: 'Progress %', value: pct },
  { id: 'close_rate', label: 'Close Rate (weighted)', value: weightedCloseRate },
  { id: 'options_per_opp', label: 'Options / Opp (weighted)', value: weightedOptionsPerOpp },
  { id: 'closed_avg_sale', label: 'Closed Avg Sale (weighted)', value: weightedClosedAvgSale },
  { id: 'opportunities', label: 'Opportunities', value: totals.opp },
  { id: 'closed_count', label: 'Closed (inferred)', value: totals.closedCount },
  { id: 'non_job_revenue', label: 'Non-Job Revenue', value: totals.nonJobRevenue },
  { id: 'adjustment_revenue', label: 'Adjustment Revenue', value: totals.adjRevenue }
];

// ---------- return for {{ getGoalTracker.data }} ----------
return {
  raw: data,
  groups,
  totals: {
    ...totals,
    weightedCloseRate,
    weightedOptionsPerOpp,
    weightedClosedAvgSale
  },
  // gauge contract
  value,            // = totalRevenue
  max,              // = expectedRevenue
  pct,              // 0..1
  expectedRevenue: totals.expectedRevenue,
  totalRevenue: totals.totalRevenue,
  input
};"
    updateSetValueDynamically={true}
    warningCodes={[]}
  />
  <SqlQueryUnified
    id="getSalesDB2"
    enableTransformer={true}
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/getSalesDB2.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    showSuccessToaster={false}
    showUpdateSetValueDynamicallyToggle={false}
    tableName="st_advisors"
    transformer="// ---------- helpers ----------
const toNum = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

// ---------- normalize rows from positional arrays using fields[] ----------
const rowsRaw = Array.isArray(data?.raw_json[0].data) ? data.raw_json[0].data : Array.isArray(data) ? data : [];
const fields = Array.isArray(data?.raw_json[0].fields) ? data.raw_json[0].fields : [];
const names = fields.map(f => f?.name);

const rows = rowsRaw.map(r => {
  if (Array.isArray(r)) {
    const o = {};
    for (let i = 0; i < names.length; i++) o[names[i]] = r[i];
    return o;
  }
  return r || {};
});

// ---------- map & derive per group ----------
const groups = rows.map(r => {
  const name = String(r?.Name ?? '');
  const totalSales = toNum(r?.TotalSales);
  const closedAvgSale = toNum(r?.ClosedAverageSale);
  const closeRate = toNum(r?.CloseRate); // fraction 0..1
  const opp = toNum(r?.SalesOpportunity);
  const optionsPerOpp = toNum(r?.OptionsPerOpportunity);
  const adjRevenue = toNum(r?.AdjustmentRevenue);
  const totalRevenue = toNum(r?.TotalRevenue);
  const nonJobRevenue = toNum(r?.NonJobRevenue);

  const closedCount = opp * closeRate;                     // inferred
  const expectedRevenue = opp * closeRate * closedAvgSale; // per group expected

  return {
    name,
    totalSales,
    closedAvgSale,
    closeRate,
    opp,
    optionsPerOpp,
    adjRevenue,
    totalRevenue,
    nonJobRevenue,
    closedCount,
    expectedRevenue
  };
});

// ---------- totals, weighted KPIs ----------
const sum = (arr, key) => arr.reduce((a, x) => a + toNum(x?.[key]), 0);

const totals = {
  totalSales: sum(groups, 'totalSales'),
  totalRevenue: sum(groups, 'totalRevenue'),
  nonJobRevenue: sum(groups, 'nonJobRevenue'),
  adjRevenue: sum(groups, 'adjRevenue'),
  opp: sum(groups, 'opp'),
  closedCount: sum(groups, 'closedCount'),
  expectedRevenue: sum(groups, 'expectedRevenue'),
};

// weighted averages
const w = {
  byOpp: totals.opp > 0 ? totals.opp : 1,
  byClosed: totals.closedCount > 0 ? totals.closedCount : 1
};

const weightedCloseRate = totals.opp > 0
  ? groups.reduce((a, g) => a + (g.closeRate * g.opp), 0) / totals.opp
  : 0;

const weightedOptionsPerOpp = totals.opp > 0
  ? groups.reduce((a, g) => a + (g.optionsPerOpp * g.opp), 0) / totals.opp
  : 0;

const weightedClosedAvgSale = totals.closedCount > 0
  ? groups.reduce((a, g) => a + (g.closedAvgSale * g.closedCount), 0) / totals.closedCount
  : 0;

// ---------- gauge values ----------
const value = totals.totalRevenue;           // actual (YTD/period revenue in payload)
const max = Math.max(totals.expectedRevenue, 0); // goal/expected
const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

// ---------- input array for generic binding (optional) ----------
const input = [
  { id: 'revenue', label: 'Total Revenue', value },
  { id: 'expected', label: 'Expected Revenue', value: max },
  { id: 'pct', label: 'Progress %', value: pct },
  { id: 'close_rate', label: 'Close Rate (weighted)', value: weightedCloseRate },
  { id: 'options_per_opp', label: 'Options / Opp (weighted)', value: weightedOptionsPerOpp },
  { id: 'closed_avg_sale', label: 'Closed Avg Sale (weighted)', value: weightedClosedAvgSale },
  { id: 'opportunities', label: 'Opportunities', value: totals.opp },
  { id: 'closed_count', label: 'Closed (inferred)', value: totals.closedCount },
  { id: 'non_job_revenue', label: 'Non-Job Revenue', value: totals.nonJobRevenue },
  { id: 'adjustment_revenue', label: 'Adjustment Revenue', value: totals.adjRevenue }
];

// ---------- return for {{ getGoalTracker.data }} ----------
return {
  raw: data,
  groups,
  totals: {
    ...totals,
    weightedCloseRate,
    weightedOptionsPerOpp,
    weightedClosedAvgSale
  },
  // gauge contract
  value,            // = totalRevenue
  max,              // = expectedRevenue
  pct,              // 0..1
  expectedRevenue: totals.expectedRevenue,
  totalRevenue: totals.totalRevenue,
  input
};"
    updateSetValueDynamically={true}
    warningCodes={[]}
  />
  <SqlQueryUnified
    id="getJobCostingSummaryDB"
    enableTransformer={true}
    isMultiplayerEdited={false}
    notificationDuration={4.5}
    query={include("../lib/getJobCostingSummaryDB.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    showSuccessToaster={false}
    showUpdateSetValueDynamicallyToggle={false}
    tableName="st_advisors"
    transformer="// ===================== CONFIG =====================
const GOAL = 500_000; // monthly break-even goal ($)

// ===================== UTILS ======================
const toNum = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

const isDateLike = (v) => {
  if (v == null || v === '') return false;
  if (v instanceof Date) return !isNaN(v.getTime());
  if (typeof v === 'number') {
    const nowMs = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const minMs = Date.UTC(2000, 0, 1);
    if (v > 1e12) return v >= minMs && v <= (nowMs + oneYearMs); // ms
    const ms = v * 1000;                                         // sec
    return ms >= minMs && ms <= (nowMs + oneYearMs);
  }
  const d = new Date(v);
  if (isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  return y >= 2000 && y <= 2100;
};

const toDate = (v) => {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const ms = v > 1e12 ? v : v * 1000;
    return isDateLike(ms) ? new Date(ms) : null;
  }
  const d = new Date(v);
  return isDateLike(d) ? d : null;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameMonth = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// ===================== INPUT NORMALIZATION ======================
const rowsRaw = Array.isArray(data?.raw_json[0].data) ? data.raw_json[0].data : Array.isArray(data) ? data : [];
const fieldDefs = Array.isArray(data?.raw_json[0].fields) ? data.raw_json[0].fields : [];
const fieldNames = fieldDefs.length
  ? fieldDefs.map((f, i) => (f?.name ?? f?.label ?? String(i)))
  : (rowsRaw[0] ? Object.keys(rowsRaw[0]) : []);

const rows = rowsRaw.map(row => {
  if (Array.isArray(row)) {
    const obj = {};
    for (let i = 0; i < fieldNames.length; i++) obj[fieldNames[i]] = row[i];
    return obj;
  }
  const keys = Object.keys(row || {});
  const looksIndexed = keys.length && keys.every(k => /^\d+$/.test(k));
  if (looksIndexed) {
    const obj = {};
    for (let i = 0; i < fieldNames.length; i++) obj[fieldNames[i]] = row[i] ?? row[String(i)];
    return obj;
  }
  return row || {};
});

const labelToName = {};
for (const f of fieldDefs) {
  if (f?.label && f?.name) labelToName[f.label.toLowerCase()] = f.name;
}
const nameByLabel = (label) => (label && labelToName[label.toLowerCase()]) || null;

// ===================== COLUMN DETECTION ======================
const marginNameCandidates = [
  'GrossMargin','grossMargin','Margin','margin','Gross_Amount','Gross_Profit','GrossProfit'
];
const marginLabelCandidates = [
  'Jobs Gross Margin','Gross Margin','Gross Profit','Jobs Gross Profit'
];
const resolvedMarginNames = [
  ...marginNameCandidates,
  ...marginLabelCandidates.map(nameByLabel).filter(Boolean),
];
const marginKeysTried = Array.from(new Set(resolvedMarginNames.filter(Boolean)));

let chosenMarginKey = null;
let marginKeyNonZeroCount = 0;
if (rows.length) {
  const probeCount = Math.min(200, rows.length);
  for (const k of marginKeysTried) {
    if (!(k in rows[0])) continue;
    let cnt = 0;
    for (let i = 0; i < probeCount; i++) {
      if (toNum(rows[i]?.[k]) !== 0) cnt++;
    }
    if (cnt > marginKeyNonZeroCount) {
      marginKeyNonZeroCount = cnt;
      chosenMarginKey = k;
    }
  }
}

const totalKey = fieldNames.includes('Total') ? 'Total' : (nameByLabel('Jobs Total') || 'Total');
const costKey  = fieldNames.includes('TotalCosts') ? 'TotalCosts' : (nameByLabel('Jobs Total Costs') || 'TotalCosts');
const laborKey = fieldNames.includes('LaborPay') ? 'LaborPay' : (nameByLabel('Labor Pay') || 'LaborPay');

const dateNameCandidates = [
  'Date','date','JobDate','InvoiceDate','StartDate','CompletedDate',
  'CompletionDate','CreatedAt','ReportDate'
];
const dateLabelCandidates = [
  'Date','Job Date','Invoice Date','Completed Date','Completion Date','Report Date','Created At'
];

let dateKey =
  (dateLabelCandidates.map(nameByLabel).find(Boolean)) ||
  (dateNameCandidates.find(k => rows[0] && k in rows[0])) ||
  null;

const dateBlacklist = new Set([
  'Total','TotalCosts','LaborPay','GrossMargin','GrossMarginPercentage',
  'Amount','Price','Cost','Revenue'
]);

if (!dateKey && rows.length) {
  const keys = Object.keys(rows[0] || {}).filter(k => !dateBlacklist.has(k));
  let bestKey = null, bestHit = 0;
  const probeCount = Math.min(100, rows.length);
  for (const k of keys) {
    let hits = 0;
    for (let i = 0; i < probeCount; i++) if (isDateLike(rows[i]?.[k])) hits++;
    if (hits > bestHit) { bestHit = hits; bestKey = k; }
  }
  if (bestHit >= Math.ceil(0.1 * Math.min(100, rows.length))) dateKey = bestKey;
}

if (dateKey) {
  const probeCount = Math.min(100, rows.length);
  let hits = 0;
  for (let i = 0; i < probeCount; i++) if (isDateLike(rows[i]?.[dateKey])) hits++;
  if (hits < Math.ceil(0.1 * probeCount)) dateKey = null;
}

// ===================== AGGREGATION ======================
const now = new Date();
const todayStart = startOfDay(now);
const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
const yesterdayEnd = new Date(todayStart.getTime() - 1);

let totalGross = 0, mtdGross = 0, yGross = 0;
let computedUsed = false;

for (const r of rows) {
  let gm;
  if (chosenMarginKey) {
    gm = toNum(r?.[chosenMarginKey]);
  } else {
    gm = toNum(r?.[totalKey]) - toNum(r?.[costKey]) - toNum(r?.[laborKey]);
    computedUsed = true;
  }

  totalGross += gm;

  const d = dateKey ? toDate(r?.[dateKey]) : null;
  if (d) {
    if (sameMonth(d, now) && d <= now) mtdGross += gm;
    if (d >= yesterdayStart && d <= yesterdayEnd) yGross += gm;
  } else {
    mtdGross += gm; // no per-row date → treat all as MTD
  }
}

// ===================== INPUT ARRAY FOR PROGRESS BARS ======================
const input = [
  {
    id: 'month_goal',
    label: 'Monthly Break-even Goal',
    value: GOAL,
    max: GOAL,
    pct: 1,
    remaining: 0
  },
  {
    id: 'mtd',
    label: 'MTD Gross Margin',
    value: mtdGross,
    max: GOAL,
    pct: GOAL ? (mtdGross / GOAL) : null,
    remaining: Math.max(0, GOAL - mtdGross)
  },
  {
    id: 'yesterday',
    label: 'Yesterday Gross Margin',
    value: yGross,
    max: GOAL,
    pct: GOAL ? (yGross / GOAL) : null,
    remaining: Math.max(0, GOAL - yGross)
  }
];

// ===================== OUTPUT ======================
return {
  goal: GOAL,
  input, // <—— bind your Progress components to items in this array
  summary: {
    totalGross,
    mtd: {
      value: mtdGross,
      remaining: Math.max(0, GOAL - mtdGross),
      pctOfGoal: GOAL ? (mtdGross / GOAL) : null
    },
    yesterday: {
      value: yGross,
      pctOfGoal: GOAL ? (yGross / GOAL) : null
    }
  },
  progressBars: {
    mtd_value: mtdGross,
    mtd_max: GOAL,
    yesterday_value: yGross,
    yesterday_max: GOAL
  },
  meta: {
    normalized: true,
    fieldNames,
    marginKeyUsed: chosenMarginKey || 'COMPUTED_FROM_TOTAL_MINUS_COSTS_MINUS_LABOR',
    marginKeysTried,
    marginKeyNonZeroCount,
    dateKeyUsed: dateKey || null,
    totalKey,
    costKey,
    laborKey,
    rowCount: rows.length,
    sampleMappedRow: rows[0] || null,
    computedMarginFallbackUsed: computedUsed
  }
};
"
    updateSetValueDynamically={true}
    warningCodes={[]}
  />
  <SqlQueryUnified
    id="getRevenueMonthlyPaceDB"
    enableTransformer={true}
    query={include("../lib/getRevenueMonthlyPaceDB.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    transformer="// Transformer: txRevenueMonthlyPace
// Input: { fields:[{name,label}...], data:[[...], ...] }
// Requirement: Use **CurrentMonthlyPace** sum (NOT CompletedRevenue)

// --- setup ---
const F = Object.fromEntries((data.raw_json[0].fields || []).map((f,i)=>[f.name, i]));
const rows = data.raw_json[0].data;
const num = v => (v==null || v==='' || Number.isNaN(Number(v))) ? 0 : Number(v);

// Money short format with 2 decimals (K/M/B)
function moneyShort(n){
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e9) return `${s}$${(a/1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a/1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a/1e3).toFixed(2)}K`;
  return `${s}$${a.toFixed(2)}`;
}

// --- sum CURRENT MONTHLY PACE (primary) ---
let value = 0;
const paceIdx = F.CurrentMonthlyPace;

// If the column exists, sum it; otherwise return 0 (or fallback if you want)
if (paceIdx != null) {
  for (const r of rows) value += num(r[paceIdx]);
}

// Output
return {
  value,
  formatted: moneyShort(value),
  meta: {
    used: paceIdx != null ? 'CurrentMonthlyPace(sum)' : 'none',
    rows: rows.length
  }
};
"
    warningCodes={[]}
  />
  <SqlQueryUnified
    id="getSalesMonthlyPaceDB"
    enableTransformer={true}
    isMultiplayerEdited={false}
    query={include("../lib/getSalesMonthlyPaceDB.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    transformer={
      "  // ---------- config ----------\n  const LA_TZ = 'America/Los_Angeles';\n  const FROM_DAY = 1;         // start counting on the 2nd (LA)\n  const MIN_DAYS_PAST = 1;    // require at least 3 LA days before projecting\n  const MULTIPLIER_CAP = null; // e.g., 8 to cap at 8×; null = no cap\n\n  // ---------- helpers ----------\n  function num(v){\n    if (v == null || v === '') return 0;\n    const n = Number(String(v).replace(/[$,%\\s]/g,''));\n    return Number.isFinite(n) ? n : 0;\n  }\n\n  function fmtUSDCompact(n){\n    n = num(n);\n    const abs = Math.abs(n);\n    const sign = n < 0 ? '-' : '';\n    const fmt = (v, s) => `${sign}$${v}${s}`;\n    if (abs >= 1_000_000_000) return fmt((abs/1_000_000_000).toFixed(2), 'B');\n    if (abs >= 1_000_000)     return fmt((abs/1_000_000).toFixed(2), 'M');\n    if (abs >= 1_000)         return fmt((abs/1_000).toFixed(2), 'K');\n    return fmt(abs.toFixed(0), '');\n  }\n\n  // ---------- read rows (array-of-arrays with fields) ----------\n  const fields = Array.isArray(data?.raw_json?.[0]?.fields) ? data.raw_json[0].fields.map(f => f.name) : [];\n  const ix = Object.fromEntries(fields.map((n,i)=>[n,i]));\n  const rows = Array.isArray(data?.raw_json?.[0]?.data) ? data.raw_json[0].data : [];\n  const col  = (r, name) => (typeof ix[name] === 'number') ? r[ix[name]] : undefined;\n\n  // Σ TotalSales across all business units (month-to-date slice from API)\n  const totalSalesToDate = rows.reduce((s, r) => s + num(col(r, 'TotalSales')), 0);\n\n  // ---------- California (Los Angeles) timezone ONLY ----------\n  const toSrc = (typeof date7 !== 'undefined' && date7?.value) ? new Date(date7.value) : new Date();\n  const fmtLA = new Intl.DateTimeFormat('en-CA', { timeZone: LA_TZ, year:'numeric', month:'2-digit', day:'2-digit' });\n  const partsTo = Object.fromEntries(fmtLA.formatToParts(toSrc).map(p => [p.type, p.value]));\n  const Y = Number(partsTo.year);      // LA year\n  const M = Number(partsTo.month);     // LA month (1..12)\n  const D = Number(partsTo.day);       // LA day   (1..31)\n\n  // Calendar math using LA-derived Y/M/D\n  const daysInMonth = new Date(Y, M, 0).getDate();\n\n  // Days past since FROM_DAY within the month in LA time\n  // If we're before FROM_DAY, daysPast = 0 (no projection yet).\n  let daysPast = (D < FROM_DAY) ? 0 : (D - (FROM_DAY - 1));\n\n  // Apply minimum-days guard to avoid extreme early projections\n  // (e.g., on LA day 2 with FROM_DAY=2 -> daysPast=1, we suppress until >= 3)\n  const hasEnoughDays = daysPast >= MIN_DAYS_PAST;\n\n  // Compute multiplier with optional cap\n  let multiplier = 0;\n  if (hasEnoughDays) {\n    multiplier = daysInMonth / daysPast;\n    if (Number.isFinite(MULTIPLIER_CAP) && MULTIPLIER_CAP > 0) {\n      multiplier = Math.min(multiplier, MULTIPLIER_CAP);\n    }\n  }\n\n  // PACE\n  const pace = totalSalesToDate * multiplier;\n\n  // ---------- return ----------\n  return {\n    formatted: {\n      totalSalesToDate,                              // raw number\n      totalSalesToDateCompact: fmtUSDCompact(totalSalesToDate), // \"$1.17M\"\n      fromDay: FROM_DAY,\n      daysPast,\n      daysInMonth,\n      minDaysPast: MIN_DAYS_PAST,\n      multiplier,\n      pace,                                          // raw number\n      paceCompact: fmtUSDCompact(pace),              // \"$1.17M\"\n      meta: {\n        timezone: LA_TZ,\n        formula: 'PACE = Sales(MTD) × (daysInMonth / daysPast)',\n        guards: {\n          minDaysPast: MIN_DAYS_PAST,\n          multiplierCap: MULTIPLIER_CAP\n        },\n        laDate: `${Y}-${String(M).padStart(2,'0')}-${String(D).padStart(2,'0')}`,\n        toISO: new Date(Date.UTC(Y, M-1, D)).toISOString().slice(0,10) // YYYY-MM-DD of \"To\" in LA\n      }\n    }\n  };"
    }
    warningCodes={[]}
  />
  <SqlQueryUnified
    id="getCapacityDB"
    enableTransformer={true}
    query={include("../lib/getCapacityDB.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    transformer={
      "// Transformer: txCapacityByBU - DAILY VERSION\n// Input: { fields:[{name,label}...], data:[[...], ...] }\n\nconst F = Object.fromEntries((data.raw_json[0].fields || []).map((f,i)=>[f.name,i]));\nconst num = v => (v==null || v==='' || Number.isNaN(Number(v))) ? 0 : Number(v);\n\n// ---- Config (tweak in a small JS query or window.*) ----\n// Default target per tech (daily). Typical field ops use 8-10h per day.\nconst DEFAULT_TARGET = (typeof window !== 'undefined' && typeof window.CAPACITY_DEFAULT_TARGET === 'number')\n  ? window.CAPACITY_DEFAULT_TARGET : 8;\n\n// Per-BU overrides for DAILY targets\nconst TARGET_BY_BU = (typeof window !== 'undefined' && window.CAPACITY_TARGET_HOURS) || {};\n\n// Optional display order\nconst ORDER = (typeof window !== 'undefined' && window.CAPACITY_ORDER) || [];\n// --------------------------------------------------------\n\n// Parse \"08:00 AM - 05:00 PM\" -> hours\nfunction parseRangeToHours(s){\n  if (!s || typeof s !== 'string') return 0;\n  const parts = s.split('-');\n  if (parts.length !== 2) return 0;\n  const [a,b] = parts.map(x => x.trim());\n  const toMins = t => {\n    const m = t.match(/^(\\d{1,2}):(\\d{2})\\s*(AM|PM)$/i);\n    if (!m) return 0;\n    let h = Number(m[1]) % 12;\n    const min = Number(m[2]);\n    const pm = /PM/i.test(m[3]);\n    if (pm) h += 12;\n    return h*60 + min;\n  };\n  const start = toMins(a), end = toMins(b);\n  if (!start && !end) return 0;\n  let diff = (end - start)/60;\n  if (diff < 0) diff += 24; // overnight safeguard\n  return diff;\n}\n\n// Get today's day name to find the right column\nfunction getTodayDayName() {\n  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];\n  const today = new Date();\n  return days[today.getDay()];\n}\n\nconst todayDayName = getTodayDayName();\nconsole.log(`Today is: ${todayDayName}`);\n\n// Get today's hours for a row\nfunction todayHoursFromRow(r) {\n  const todayField = F[todayDayName];\n  if (todayField === undefined) {\n    console.warn(`No field found for today: ${todayDayName}`);\n    return 0;\n  }\n  \n  const todayValue = r[todayField];\n  return parseRangeToHours(todayValue);\n}\n\n// Aggregate by Business Unit for TODAY only\nconst byBU = new Map();\nfor (const r of (data.raw_json[0].data || [])) {\n  const bu   = String(r[F.TechnicianBusinessUnit] ?? 'Unassigned');\n  const tech = String(r[F.TechnicianName] ?? '');\n  const hrs  = todayHoursFromRow(r);\n\n  // Only include techs who are scheduled today (have hours)\n  if (hrs > 0) {\n    if (!byBU.has(bu)) byBU.set(bu, { bu, scheduledHours: 0, techs: new Set() });\n    const bucket = byBU.get(bu);\n    bucket.scheduledHours += hrs;\n    bucket.techs.add(tech);\n  }\n}\n\n// Build rows for UI - DAILY capacity\nlet rows = Array.from(byBU.values()).map(x => {\n  const headcount = x.techs.size;\n  const perTechTarget = (typeof TARGET_BY_BU[x.bu] === 'number') ? TARGET_BY_BU[x.bu] : DEFAULT_TARGET;\n  const targetHours = headcount * perTechTarget;\n\n  const ratioRaw = targetHours > 0 ? (x.scheduledHours / targetHours) : 0;\n  const ratio = Math.max(0, Math.min(1, ratioRaw));       // clamp 0..1 for display\n  const capacityPct = Math.round(ratio * 100);\n  const blocks = Math.max(0, Math.min(10, Math.round(ratioRaw * 10))); // 0..10\n\n  return {\n    businessUnit: x.bu,\n    headcount,\n    scheduledHours: Number(x.scheduledHours.toFixed(1)),\n    perTechTarget,\n    targetHours,\n    capacityRatio: ratio,   // 0..1\n    capacityPct,            // 0..100\n    blocks,                 // 0..10\n    blocks10: Array.from({length:10}, (_,i)=> i < blocks), // e.g. [true,true,...]\n    todayDay: todayDayName  // Include which day we're showing\n  };\n});\n\n// Optional ordering\nif (ORDER.length) {\n  const idx = Object.fromEntries(ORDER.map((k,i)=>[k,i]));\n  rows.sort((a,b)=> (idx[a.businessUnit] ?? 1e9) - (idx[b.businessUnit] ?? 1e9));\n} else {\n  rows.sort((a,b)=> a.businessUnit.localeCompare(b.businessUnit));\n}\n\n// Totals for today\nconst totals = rows.reduce((acc,r)=>{\n  acc.scheduledHours += r.scheduledHours;\n  acc.targetHours += r.targetHours;\n  acc.headcount += r.headcount;\n  return acc;\n}, {scheduledHours:0, targetHours:0, headcount:0});\ntotals.capacityPct = totals.targetHours ? Math.round((totals.scheduledHours / totals.targetHours) * 100) : 0;\ntotals.todayDay = todayDayName;\n\nreturn { rows, totals };"
    }
    warningCodes={[]}
  />
  <SqlQueryUnified
    id="getBookingRateDB"
    enableTransformer={true}
    isMultiplayerEdited={false}
    query={include("../lib/getBookingRateDB.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    transformer={
      "// Transformer: txBookedVsLeads\n// Input: { fields:[{name,label}...], data:[[...], ...] }\n\nconst F = Object.fromEntries((data.raw_json[0].fields || []).map((f,i)=>[f.name, i]));\nconst num = v => (v==null || v==='' || Number.isNaN(Number(v))) ? 0 : Number(v);\n\n// Indices (with safe fallbacks)\nconst LEADS_IDX  = F.LeadCalls ?? F['Lead Calls'];\nconst BOOKED_IDX = F.BookedJobsByCall ?? F['Booked Jobs By Call'];\n\nlet leads = 0, booked = 0;\nfor (const r of (data.raw_json[0].data || [])) {\n  leads  += num(r[LEADS_IDX]);\n  booked += num(r[BOOKED_IDX]);\n}\n\nconst unbooked = Math.max(leads - booked, 0);\nconst rate = leads > 0 ? booked / leads : 0; // 0..1\n\nreturn {\n  // For a donut/pie chart\n  pie: {\n    labels: [\"Booked\", \"Unbooked\"],\n    values: [booked, unbooked]\n  },\n\n  // For a progress bar (use %)\n  progress: {\n    value: +(rate * 100).toFixed(1)  // e.g., 85.8\n  },\n\n  // For a center label / KPI chips\n  centerLabel: `${(rate * 100).toFixed(1)}%`,\n  kpis: {\n    leads,           // e.g., 141\n    booked,          // e.g., 121\n    unbooked,        // optional display\n    rate             // 0..1 if you need the raw ratio\n  }\n};"
    }
    warningCodes={[]}
  />
  <SqlQueryUnified
    id="getRevenueDB"
    enableTransformer={true}
    isMultiplayerEdited={false}
    query={include("../lib/getRevenueDB.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    transformer="// ---------- helpers ----------
const toNum = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
const clamp01 = (x) => Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;

// ---------- normalize ----------
const rowsRaw = Array.isArray(data?.raw_json[0].data) ? data.raw_json[0].data : (Array.isArray(data) ? data : []);
const fields  = Array.isArray(data?.raw_json[0].fields) ? data.raw_json[0].fields : [];
const fieldNames = fields.map(f => f?.name);

const rows = rowsRaw.map(r => {
  if (Array.isArray(r)) {
    const o = {};
    for (let i = 0; i < fieldNames.length; i++) o[fieldNames[i]] = r[i];
    return o;
  }
  return r || {};
});

// ---------- per-group ----------
const groups = rows.map(r => ({
  name: String(r?.Name ?? ''),
  totalRevenue:   toNum(r?.TotalRevenue),
  totalSales:     toNum(r?.TotalSales),
  goalDaily:      toNum(r?.GoalDaily),        // in your payload: actually monthly company goal per BU row
  goalNoWeekends: toNum(r?.GoalNoWeekends),   // same, “no weekends” variant
  yearlyPace:     toNum(r?.CurrentYearlyPace),
  monthlyPace:    toNum(r?.CurrentMonthlyPace),
  combinedRevenue: toNum(r?.TotalRevenue) + toNum(r?.TotalSales)
}));

// ---------- totals ----------
const sum = (arr, key) => arr.reduce((acc, x) => acc + toNum(x?.[key]), 0);
const totals = {
  totalRevenue:    sum(groups, 'totalRevenue'),
  totalSales:      sum(groups, 'totalSales'),
  combinedRevenue: sum(groups, 'combinedRevenue'),
  yearlyPace:      sum(groups, 'yearlyPace'),
  monthlyPace:     sum(groups, 'monthlyPace'),
  goalDaily_sum:      sum(groups, 'goalDaily'),
  goalNoWeekends_sum: sum(groups, 'goalNoWeekends')
};

// ---------- choose company goal (don’t sum across BUs) ----------
const maxNonZero = (arr, key) => arr.reduce((m, x) => {
  const v = toNum(x?.[key]); return v > m ? v : m;
}, 0);
const companyGoalDaily      = maxNonZero(groups, 'goalDaily');
const companyGoalNoWeekends = maxNonZero(groups, 'goalNoWeekends');

// --------- period decision & goals ---------
// Heuristic: if sum of revenue >> monthly goal, treat revenue as YTD -> use annual gauge.
const monthlyGoal = companyGoalNoWeekends || companyGoalDaily || 0;
const yearlyGoal  = monthlyGoal * 12;

const revenueSum = totals.combinedRevenue;
// if revenueSum is much bigger than one month’s goal, assume YTD data is loaded
const looksYTD = monthlyGoal > 0 && revenueSum > monthlyGoal * 1.5;

// Monthly metrics (useful when you truly load monthly data)
const monthRevenue = totals.combinedRevenue; // what your query returns; may actually be YTD
const pct_month    = monthlyGoal > 0 ? clamp01(monthRevenue / monthlyGoal) : 0;

// Annual metrics
const yeartotalrevenue = totals.totalRevenue;     // treat as YTD if looksYTD=true
const pct_year         = yearlyGoal > 0 ? clamp01(yeartotalrevenue / yearlyGoal) : 0;

// Forecast: prefer an explicit yearly pace if present; else scale monthly pace * 12.
const forecastedYear = Math.max(toNum(totals.yearlyPace), toNum(totals.monthlyPace) * 12);
const pacingPercent  = yearlyGoal > 0 ? (forecastedYear / yearlyGoal) : 0; // 0..1

// ---- expose a single pct for the gauge (what your HTML expects) ----
const pct = looksYTD ? pct_year : pct_month;

// ---------- input array (for quick binding/debug) ----------
const input = [
  { id: 'looksYTD',    label: 'Looks like YTD?', value: looksYTD },
  { id: 'pct',         label: 'Gauge pct (0..1)', value: pct },
  { id: 'pct_month',   label: 'Monthly pct (0..1)', value: pct_month },
  { id: 'pct_year',    label: 'Yearly pct (0..1)', value: pct_year },
  { id: 'forecasted',  label: 'Forecasted Year', value: forecastedYear },
  { id: 'pacingPct',   label: 'Pacing % (0..1)', value: pacingPercent },
  { id: 'monthlyGoal', label: 'Monthly Goal', value: monthlyGoal },
  { id: 'yearlyGoal',  label: 'Yearly Goal', value: yearlyGoal }
];

// ---------- return ----------
return {
  raw: data,
  groups,
  totals: {
    totalRevenue: totals.totalRevenue,
    totalSales: totals.totalSales,
    combinedRevenue: totals.combinedRevenue,
    yearlyPace: totals.yearlyPace,
    monthlyPace: totals.monthlyPace,
    companyGoalDaily,
    companyGoalNoWeekends,
    monthlyGoal,
    yearlyGoal
  },

  // expose both views
  monthtotalrevenue: monthRevenue,
  monthlygoal: monthlyGoal,
  monthlypace: totals.monthlyPace,
  pct_month,

  yeartotalrevenue,
  yearlygoal: yearlyGoal,
  yearlypace: totals.yearlyPace,
  pct_year,

  // new unified values for the widget
  pct,                       // <= what your HTML uses
  forecastedYear,
  pacingPercent,             // 0..1

  input,
  meta: {
    note: 'Gauge pct auto-switches: if revenue >> monthly goal, treat as YTD and use annual ratio.',
    rows: rows.length
  }
};
"
    warningCodes={[]}
  />
  <RESTQuery
    id="getSales2"
    body={
      '{\n  "parameters": [\n    {\n      "name": "From",\n      "value": "{{ moment().tz(\'America/Los_Angeles\').subtract(1, \'day\').format(\'YYYY-MM-DD\') }}"\n    },\n    {\n      "name": "To",\n      "value": "{{ moment().tz(\'America/Los_Angeles\').subtract(1, \'day\').format(\'YYYY-MM-DD\') }}"\n    },\n    { "name": "IncludeInactive", "value": "false" }\n  ]\n}'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken2.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    queryTimeout="50000"
    resourceDisplayName="getSales"
    resourceName="bb251234-d391-440a-8d2c-7a712911492a"
    resourceTypeOverride=""
    runWhenModelUpdates={false}
    runWhenPageLoadsDelay="2000"
    transformer="// ---------- helpers ----------
const toNum = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

// ---------- normalize rows from positional arrays using fields[] ----------
const rowsRaw = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
const fields = Array.isArray(data?.fields) ? data.fields : [];
const names = fields.map(f => f?.name);

const rows = rowsRaw.map(r => {
  if (Array.isArray(r)) {
    const o = {};
    for (let i = 0; i < names.length; i++) o[names[i]] = r[i];
    return o;
  }
  return r || {};
});

// ---------- map & derive per group ----------
const groups = rows.map(r => {
  const name = String(r?.Name ?? '');
  const totalSales = toNum(r?.TotalSales);
  const closedAvgSale = toNum(r?.ClosedAverageSale);
  const closeRate = toNum(r?.CloseRate); // fraction 0..1
  const opp = toNum(r?.SalesOpportunity);
  const optionsPerOpp = toNum(r?.OptionsPerOpportunity);
  const adjRevenue = toNum(r?.AdjustmentRevenue);
  const totalRevenue = toNum(r?.TotalRevenue);
  const nonJobRevenue = toNum(r?.NonJobRevenue);

  const closedCount = opp * closeRate;                     // inferred
  const expectedRevenue = opp * closeRate * closedAvgSale; // per group expected

  return {
    name,
    totalSales,
    closedAvgSale,
    closeRate,
    opp,
    optionsPerOpp,
    adjRevenue,
    totalRevenue,
    nonJobRevenue,
    closedCount,
    expectedRevenue
  };
});

// ---------- totals, weighted KPIs ----------
const sum = (arr, key) => arr.reduce((a, x) => a + toNum(x?.[key]), 0);

const totals = {
  totalSales: sum(groups, 'totalSales'),
  totalRevenue: sum(groups, 'totalRevenue'),
  nonJobRevenue: sum(groups, 'nonJobRevenue'),
  adjRevenue: sum(groups, 'adjRevenue'),
  opp: sum(groups, 'opp'),
  closedCount: sum(groups, 'closedCount'),
  expectedRevenue: sum(groups, 'expectedRevenue'),
};

// weighted averages
const w = {
  byOpp: totals.opp > 0 ? totals.opp : 1,
  byClosed: totals.closedCount > 0 ? totals.closedCount : 1
};

const weightedCloseRate = totals.opp > 0
  ? groups.reduce((a, g) => a + (g.closeRate * g.opp), 0) / totals.opp
  : 0;

const weightedOptionsPerOpp = totals.opp > 0
  ? groups.reduce((a, g) => a + (g.optionsPerOpp * g.opp), 0) / totals.opp
  : 0;

const weightedClosedAvgSale = totals.closedCount > 0
  ? groups.reduce((a, g) => a + (g.closedAvgSale * g.closedCount), 0) / totals.closedCount
  : 0;

// ---------- gauge values ----------
const value = totals.totalRevenue;           // actual (YTD/period revenue in payload)
const max = Math.max(totals.expectedRevenue, 0); // goal/expected
const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

// ---------- input array for generic binding (optional) ----------
const input = [
  { id: 'revenue', label: 'Total Revenue', value },
  { id: 'expected', label: 'Expected Revenue', value: max },
  { id: 'pct', label: 'Progress %', value: pct },
  { id: 'close_rate', label: 'Close Rate (weighted)', value: weightedCloseRate },
  { id: 'options_per_opp', label: 'Options / Opp (weighted)', value: weightedOptionsPerOpp },
  { id: 'closed_avg_sale', label: 'Closed Avg Sale (weighted)', value: weightedClosedAvgSale },
  { id: 'opportunities', label: 'Opportunities', value: totals.opp },
  { id: 'closed_count', label: 'Closed (inferred)', value: totals.closedCount },
  { id: 'non_job_revenue', label: 'Non-Job Revenue', value: totals.nonJobRevenue },
  { id: 'adjustment_revenue', label: 'Adjustment Revenue', value: totals.adjRevenue }
];

// ---------- return for {{ getGoalTracker.data }} ----------
return {
  raw: data,
  groups,
  totals: {
    ...totals,
    weightedCloseRate,
    weightedOptionsPerOpp,
    weightedClosedAvgSale
  },
  // gauge contract
  value,            // = totalRevenue
  max,              // = expectedRevenue
  pct,              // 0..1
  expectedRevenue: totals.expectedRevenue,
  totalRevenue: totals.totalRevenue,
  input
};"
    type="POST"
  />
  <RESTQuery
    id="getSales"
    body={
      '{\n  "parameters": [\n    {\n      "name": "From",\n      "value": "{{ moment(date8.value).tz(\'America/Los_Angeles\').format(\'YYYY-MM-DD\') }}"\n    },\n    {\n      "name": "To",\n      "value": "{{ moment(date7.value).tz(\'America/Los_Angeles\').format(\'YYYY-MM-DD\') }}"\n    },\n    {\n      "name": "IncludeInactive",\n      "value": "false"\n    }\n  ]\n}\n'
    }
    bodyType="raw"
    cacheKeyTtl="86400"
    enableCaching={true}
    enableTransformer={true}
    headers={
      '[{"key":"Content-Type","value":"application/json"},{"key":"ST-App-Key","value":"ak1.w4l5o1oh0suj888aeb4mkirux"},{"key":"Authorization","value":"Bearer {{ getToken2.data.access_token }}"}]'
    }
    isMultiplayerEdited={false}
    queryFailureConditions={
      '[{"condition":"{{ metadata.status === 429 }}","message":"{{ data.title }}"}]'
    }
    queryTimeout="50000"
    resourceDisplayName="getSales"
    resourceName="bb251234-d391-440a-8d2c-7a712911492a"
    resourceTypeOverride=""
    runWhenModelUpdates={false}
    runWhenPageLoadsDelay="2000"
    transformer="// ---------- helpers ----------
const toNum = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

// ---------- normalize rows from positional arrays using fields[] ----------
const rowsRaw = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
const fields = Array.isArray(data?.fields) ? data.fields : [];
const names = fields.map(f => f?.name);

const rows = rowsRaw.map(r => {
  if (Array.isArray(r)) {
    const o = {};
    for (let i = 0; i < names.length; i++) o[names[i]] = r[i];
    return o;
  }
  return r || {};
});

// ---------- map & derive per group ----------
const groups = rows.map(r => {
  const name = String(r?.Name ?? '');
  const totalSales = toNum(r?.TotalSales);
  const closedAvgSale = toNum(r?.ClosedAverageSale);
  const closeRate = toNum(r?.CloseRate); // fraction 0..1
  const opp = toNum(r?.SalesOpportunity);
  const optionsPerOpp = toNum(r?.OptionsPerOpportunity);
  const adjRevenue = toNum(r?.AdjustmentRevenue);
  const totalRevenue = toNum(r?.TotalRevenue);
  const nonJobRevenue = toNum(r?.NonJobRevenue);

  const closedCount = opp * closeRate;                     // inferred
  const expectedRevenue = opp * closeRate * closedAvgSale; // per group expected

  return {
    name,
    totalSales,
    closedAvgSale,
    closeRate,
    opp,
    optionsPerOpp,
    adjRevenue,
    totalRevenue,
    nonJobRevenue,
    closedCount,
    expectedRevenue
  };
});

// ---------- totals, weighted KPIs ----------
const sum = (arr, key) => arr.reduce((a, x) => a + toNum(x?.[key]), 0);

const totals = {
  totalSales: sum(groups, 'totalSales'),
  totalRevenue: sum(groups, 'totalRevenue'),
  nonJobRevenue: sum(groups, 'nonJobRevenue'),
  adjRevenue: sum(groups, 'adjRevenue'),
  opp: sum(groups, 'opp'),
  closedCount: sum(groups, 'closedCount'),
  expectedRevenue: sum(groups, 'expectedRevenue'),
};

// weighted averages
const w = {
  byOpp: totals.opp > 0 ? totals.opp : 1,
  byClosed: totals.closedCount > 0 ? totals.closedCount : 1
};

const weightedCloseRate = totals.opp > 0
  ? groups.reduce((a, g) => a + (g.closeRate * g.opp), 0) / totals.opp
  : 0;

const weightedOptionsPerOpp = totals.opp > 0
  ? groups.reduce((a, g) => a + (g.optionsPerOpp * g.opp), 0) / totals.opp
  : 0;

const weightedClosedAvgSale = totals.closedCount > 0
  ? groups.reduce((a, g) => a + (g.closedAvgSale * g.closedCount), 0) / totals.closedCount
  : 0;

// ---------- gauge values ----------
const value = totals.totalRevenue;           // actual (YTD/period revenue in payload)
const max = Math.max(totals.expectedRevenue, 0); // goal/expected
const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

// ---------- input array for generic binding (optional) ----------
const input = [
  { id: 'revenue', label: 'Total Revenue', value },
  { id: 'expected', label: 'Expected Revenue', value: max },
  { id: 'pct', label: 'Progress %', value: pct },
  { id: 'close_rate', label: 'Close Rate (weighted)', value: weightedCloseRate },
  { id: 'options_per_opp', label: 'Options / Opp (weighted)', value: weightedOptionsPerOpp },
  { id: 'closed_avg_sale', label: 'Closed Avg Sale (weighted)', value: weightedClosedAvgSale },
  { id: 'opportunities', label: 'Opportunities', value: totals.opp },
  { id: 'closed_count', label: 'Closed (inferred)', value: totals.closedCount },
  { id: 'non_job_revenue', label: 'Non-Job Revenue', value: totals.nonJobRevenue },
  { id: 'adjustment_revenue', label: 'Adjustment Revenue', value: totals.adjRevenue }
];

// ---------- return for {{ getGoalTracker.data }} ----------
return {
  raw: data,
  groups,
  totals: {
    ...totals,
    weightedCloseRate,
    weightedOptionsPerOpp,
    weightedClosedAvgSale
  },
  // gauge contract
  value,            // = totalRevenue
  max,              // = expectedRevenue
  pct,              // 0..1
  expectedRevenue: totals.expectedRevenue,
  totalRevenue: totals.totalRevenue,
  input
};"
    type="POST"
  />
  <SqlQueryUnified
    id="getMarketingDB"
    enableTransformer={true}
    isMultiplayerEdited={false}
    query={include("../lib/getMarketingDB.sql", "string")}
    queryRefreshTime="900000"
    resourceDisplayName="retool_db"
    resourceName="dcd1b8c3-e7a7-4563-b172-dba2550e5c39"
    transformer={
      "// txMarketingDonut (labels like \"Label - $481.5K\")\n\nconst fields = data.raw_json[0].fields ?? [];\nconst rows   = data.raw_json[0].data   ?? [];\nconst F = Object.fromEntries(fields.map((f,i)=>[f.name, i]));\nconst num = v => (v==null || v==='' || Number.isNaN(Number(v))) ? 0 : Number(v);\n\n// ---- Config overrides (optional via window) ----\nconst OVERRIDE_GROUP_BY = (typeof window !== 'undefined' && window.MKTG_GROUP_BY) || null;\nconst METRIC_FIELD = (typeof window !== 'undefined' && window.MKTG_METRIC) || 'CompletedRevenue';\nconst TOP_N = (typeof window !== 'undefined' && window.MKTG_TOP_N) || 5;\n// ------------------------------------------------\n\n// Smart default: use 'category' only if a category column exists\nconst hasCategory = (F.Category != null) || (F['Campaign Category'] != null);\nconst GROUP_BY = OVERRIDE_GROUP_BY || (hasCategory ? 'category' : 'name');\n\n// $ shortener with 1 decimal: K/M/B\nfunction moneyShort(n){\n  const sign = n < 0 ? '-' : '';\n  const a = Math.abs(n);\n  if (a >= 1e9) return `${sign}$${(a/1e9).toFixed(1)}B`;\n  if (a >= 1e6) return `${sign}$${(a/1e6).toFixed(1)}M`;\n  if (a >= 1e3) return `${sign}$${(a/1e3).toFixed(1)}K`;\n  return `${sign}$${a.toFixed(1)}`;\n}\n\nconst metricIdx = F[METRIC_FIELD] != null ? F[METRIC_FIELD] : F.CompletedRevenue;\n\nconst keyFor = (r) => {\n  if (GROUP_BY === 'name') {\n    const name = r[F.Name];\n    return (name != null && String(name).trim() !== '') ? String(name) : 'Unlabeled';\n  }\n  const catIdx = (F.Category != null) ? F.Category : F['Campaign Category'];\n  const cat = catIdx != null ? r[catIdx] : null;\n  return (cat != null && String(cat).trim() !== '') ? String(cat) : 'Uncategorized';\n};\n\n// Sum metric by key\nconst sums = new Map();\nfor (const r of rows) {\n  const k = keyFor(r);\n  const v = num(r[metricIdx]);\n  sums.set(k, (sums.get(k) || 0) + v);\n}\n\n// Sort & take Top N (drop zeros if any positive exists)\nlet sorted = Array.from(sums.entries()).sort((a,b)=>b[1]-a[1]);\nif (sorted.some(([,v]) => v > 0)) sorted = sorted.filter(([,v]) => v > 0);\nsorted = sorted.slice(0, TOP_N);\n\n// Outputs\nconst values = sorted.map(([,v]) => num(v));\nconst labels = sorted.map(([k,v]) => `${k} - ${moneyShort(num(v))}`);\n\nconst totalTop5 = values.reduce((s,x)=>s+x,0);\nconst totalAll  = Array.from(sums.values()).reduce((s,x)=>s+x,0);\n\nreturn {\n  labels,\n  values,\n  totals: {\n    totalTop5,\n    totalAll,\n    totalTop5Formatted: moneyShort(totalTop5),\n    totalAllFormatted:  moneyShort(totalAll)\n  },\n  meta: { groupBy: GROUP_BY, metricField: METRIC_FIELD }\n};\n"
    }
    warningCodes={[]}
  />
  <Include src="./drawerFrame1.rsx" />
  <Frame
    id="$main3"
    enableFullBleed={false}
    isHiddenOnDesktop={false}
    isHiddenOnMobile={false}
    padding="8px 12px"
    sticky={null}
    type="main"
  >
    <Image
      id="image4"
      fit="contain"
      heightType="fixed"
      horizontalAlign="center"
      retoolStorageFileId="042f81fb-9652-444f-bbf3-f57312ea76e9"
      src="https://picsum.photos/id/1025/800/600"
      srcType="retoolStorageFileId"
    />
    <Navigation
      id="navigation3"
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
        id="983b3762"
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
      id="date8"
      dateFormat="MMM d, yyyy"
      datePlaceholder="{{ self.dateFormat.toUpperCase() }}"
      iconBefore="bold/interface-calendar"
      label=""
      labelPosition="top"
      value={
        '{{ moment().tz("America/Los_Angeles").startOf("month").toDate() }}\n'
      }
    />
    <Button
      id="button9"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="YTD"
    >
      <Event
        id="9230d759"
        enabled=""
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken2"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="25817c49"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date7"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="0b5fcd08"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('year')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date8"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="9082dad7"
        enabled="{{ !!getToken2.data.access_token }}"
        event="click"
        method="trigger"
        params={{
          map: {
            options: {
              object: {
                onSuccess: null,
                onFailure: null,
                additionalScope: null,
              },
            },
          },
        }}
        pluginId="getMarketing"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
    </Button>
    <Date
      id="date7"
      dateFormat="MMM d, yyyy"
      datePlaceholder="{{ self.dateFormat.toUpperCase() }}"
      iconBefore="bold/interface-calendar"
      label=""
      labelPosition="top"
      value={'{{ moment().tz("America/Los_Angeles").toDate() }}'}
    />
    <Button
      id="button8"
      iconBefore="bold/interface-calendar-alternate"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="MTD"
    >
      <Event
        id="48494322"
        enabled=""
        event="click"
        method="trigger"
        params={{}}
        pluginId="getToken2"
        type="datasource"
        waitMs="500"
        waitType="debounce"
      />
      <Event
        id="64d12654"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date7"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="2b60df7f"
        event="click"
        method="setValue"
        params={{
          map: {
            value:
              "{{\n  moment()\n    .tz('America/Los_Angeles')\n    .startOf('month')\n    .format('YYYY-MM-DD')\n}}\n",
          },
        }}
        pluginId="date8"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
      <Event
        id="2a83fffa"
        enabled="{{ !!getToken2.data.access_token }}"
        event="click"
        method="trigger"
        params={{
          map: {
            options: {
              object: {
                onSuccess: null,
                onFailure: null,
                additionalScope: null,
              },
            },
          },
        }}
        pluginId="getMarketing"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
    </Button>
    <Text id="text31" value="## TRENDING" verticalAlign="center" />
    <Button
      id="button26"
      style={{ map: { background: "#00363e" } }}
      text="Goal Insert"
    >
      <Event
        id="a431a498"
        event="click"
        method="show"
        params={{}}
        pluginId="drawerFrame1"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
    <HTML
      id="html1"
      css={include("../lib/html1.css", "string")}
      html={include("../lib/html1.html", "string")}
    />
    <HTML id="html5" html={include("../lib/html5.html", "string")} />
    <HTML id="html3" html={include("../lib/html3.html", "string")}>
      <Event
        id="9498b123"
        event="click"
        method="toggleHidden"
        params={{}}
        pluginId="drawerFrame1"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
    </HTML>
    <Include src="./container41.rsx" />
    <Container
      id="container38"
      footerPadding="4px 12px"
      headerPadding="4px 12px"
      padding="12px"
      showBody={true}
      showBorder={false}
      style={{
        background: "#ffffff",
        boxShadow: "0 6px 22px rgba(16,24,40,0.08)",
        borderRadius: "12px",
      }}
    >
      <Header>
        <Text
          id="containerTitle20"
          value="#### Container title"
          verticalAlign="center"
        />
      </Header>
      <View id="00030" viewKey="View 1">
        <Text id="text15" value="## MARKETING" verticalAlign="center" />
        <Chart
          id="pieChart1"
          chartType="pie"
          colorArray={[
            "#11B5AE",
            "#4046CA",
            "#F68512",
            "#DE3C82",
            "#7E84FA",
            "#72E06A",
          ]}
          colorArrayDropDown={[
            "#11B5AE",
            "#4046CA",
            "#F68512",
            "#DE3C82",
            "#7E84FA",
            "#72E06A",
          ]}
          colorInputMode="colorArrayDropDown"
          datasource="{{ getMarketing.data }}"
          datasourceMode="source"
          gradientColorArray={[
            ["0.0", "{{ theme.canvas }}"],
            ["1.0", "{{ theme.primary }}"],
          ]}
          hoverTemplate="%{label}<br>%{value}<br>%{percent}<extra></extra>"
          hoverTemplateMode="source"
          labelData="{{   getMarketing.data.labels ||
getMarketingDB.data.labels
}}"
          legendPosition="bottom"
          lineColor="{{ theme.surfacePrimary }}"
          lineWidth=""
          pieDataHole="0.5"
          selectedPoints="[]"
          style={{ componentBackgroundColor: "canvas" }}
          textTemplate="%{percent}"
          textTemplateMode="source"
          title={null}
          valueData="{{ getMarketing.data.values ||
getMarketingDB.data.values
}}"
        />
      </View>
    </Container>
    <Container
      id="container39"
      footerPadding="4px 12px"
      headerPadding="4px 12px"
      padding="12px"
      showBody={true}
      showBorder={false}
      style={{
        background: "#ffffff",
        boxShadow: "0 6px 22px rgba(16,24,40,0.08)",
        borderRadius: "12px",
      }}
    >
      <Header>
        <Text
          id="containerTitle21"
          value="#### Container title"
          verticalAlign="center"
        />
      </Header>
      <View id="00030" viewKey="View 1">
        <Text id="text30" value="## CAPACITY" verticalAlign="center" />
        <ListViewBeta
          id="listView9"
          _primaryKeys=""
          data="{{ 
  getCapacityDB.data.rows 
}}"
          heightType="auto"
          itemWidth="200px"
          margin="0"
          numColumns={3}
          padding="0"
        >
          <Container
            id="container9"
            _direction="vertical"
            _gap="0px"
            footerPadding="4px 12px"
            headerPadding="4px 12px"
            padding="0"
            showBody={true}
            showBorder={false}
            style={{
              background: "rgba(255, 255, 255, 0)",
              footerBackground: "",
              headerBackground: "",
            }}
          >
            <Header>
              <Text id="containerTitle5" verticalAlign="center" />
            </Header>
            <View id="00030" viewKey="View 1">
              <Text
                id="text13"
                value="###### {{ item.businessUnit }}"
                verticalAlign="center"
              />
              <ProgressBar
                id="progressBar1"
                label=""
                style={{
                  fill: "#003646",
                  track: "#f4f4f4",
                  completion: "#003646",
                }}
                value="{{ item.capacityPct }}"
              />
            </View>
          </Container>
        </ListViewBeta>
      </View>
    </Container>
    <HTML id="html4" html={include("../lib/html4.html", "string")} />
    <Include src="./container40.rsx" />
  </Frame>
</Screen>
