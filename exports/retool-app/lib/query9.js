const name = (query2.data?.rows_ranked?.[0]?.name || '').toLowerCase().trim();
const files = query7.data || [];
const f = files.find(x => (x.name || '')
  .toLowerCase()
  .replace(/\.(png|jpe?g|webp)$/,'')
  .trim() === name);

if (!f) return null;

const resp = await fetch(f.url);
if (!resp.ok) throw new Error(`Failed to fetch image (${resp.status})`);
const blob = await resp.blob();
const ab = await blob.arrayBuffer();
const base64Data = btoa(String.fromCharCode(...new Uint8Array(ab)));

return { name: f.name, type: f.type, sizeBytes: f.sizeBytes, base64Data };
