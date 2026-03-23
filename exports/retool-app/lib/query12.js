// ---- Config ----
const TENANT_ID = 686965608;
const CATEGORY = "business-unit-dashboard";
const REPORT_ID = 228;
const API_BASE = `https://api.servicetitan.io/reporting/v2/tenant/${TENANT_ID}/report-category/${CATEGORY}/reports/${REPORT_ID}/data`;
const RANGE_START = "2025-01-01";
const RANGE_END   = "2025-10-14";
const BUSINESS_UNIT_IDS = [1809, 1810, 1812, 64313020, 64315277, 64326403, 64567559, 64569092, 64569731];
const METRIC = "Revenue";

// If getToken2 hasn't run yet, trigger it
const tokenResp = getToken2.data?.access_token
  ? getToken2
  : await getToken2.trigger();
const TOKEN = tokenResp.data.access_token;

// ---- Helpers ----
function monthBoundsUTC(year, monthIndex0) {
  const from = new Date(Date.UTC(year, monthIndex0, 1));
  const lastDay = new Date(Date.UTC(year, monthIndex0 + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: lastDay.toISOString().slice(0, 10) };
}
function* monthsInRange(startISO, endISO) {
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= end) {
    const { from, to } = monthBoundsUTC(cursor.getUTCFullYear(), cursor.getUTCMonth());
    const clippedTo = new Date(to) > end ? endISO : to;
    yield { from, to: clippedTo, label: from.slice(0, 7) };
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
  }
}
async function fetchMonth(fromISO, toISO) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "ST-App-Key": "ak1.w4l5o1oh0suj888aeb4mkirux", "Authorization": `Bearer ${TOKEN}` },
    body: JSON.stringify({
      parameters: [
        { name: "From", value: fromISO },
        { name: "To", value: toISO },
        { name: "BusinessUnitIds", value: BUSINESS_UNIT_IDS },
        { name: "IncludeInactive", value: "false" }
      ]
    })
  });
  if (!res.ok) throw new Error(`ServiceTitan API ${res.status} ${res.statusText}\n${await res.text().catch(()=> "")}`);
  return res.json();
}
function sumMetric(rows, metricKey) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((acc, row) => {
    const v = row?.[metricKey];
    const n = typeof v === "number" ? v : Number(v);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

// ---- Main ----
const series = [];
for (const { from, to, label } of monthsInRange(RANGE_START, RANGE_END)) {
  const payload = await fetchMonth(from, to);
  const rows = payload?.rows || payload?.data || payload || [];
  const monthTotal = sumMetric(rows, METRIC);
  series.push({ month: label, [METRIC]: monthTotal, count: Array.isArray(rows) ? rows.length : 0 });
}
// Return so Retool can bind it (to a table/chart/etc.)
return { series };
