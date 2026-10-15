import { csrIdentity, type CsrSupplement } from "./csr-sources";

// Dialpad's full name verified against the CSR manager in ServiceTitan.
const identity = (name: string) => {
  const key = csrIdentity(name);
  return key === "adele aldyrakhman" ? "adele aldyrakhmanova" : key;
};

/** Dialpad operator misses, not ServiceTitan Abandoned or department entry legs. */
export function buildCsrMissedCalls(
  records: Record<string, string>[],
  users: { id: string; name: string }[],
  from: string,
  to: string,
  updatedAt: string,
): NonNullable<CsrSupplement["missed"]> {
  const names = new Map<string, string>();
  const owners = new Map<string, string>();
  for (const user of users) {
    const name = identity(user.name);
    if (
      !user.id ||
      !name ||
      (names.has(user.id) && names.get(user.id) !== name) ||
      (owners.has(name) && owners.get(name) !== user.id)
    )
      throw new Error("Ambiguous Dialpad CSR identity");
    names.set(user.id, name);
    owners.set(name, user.id);
  }
  const byCsr = Object.fromEntries([...owners.keys()].map((name) => [name, 0]));
  const seen = new Map<string, string>();
  for (const row of records) {
    const targetType = (row.target_type || row.target_kind || "").toLowerCase();
    if (!["user", "userprofile"].includes(targetType)) continue;
    if (
      !row.call_id ||
      !row.target_id ||
      !row.date_started?.match(/^\d{4}-\d{2}-\d{2}[ T]/)
    )
      throw new Error("Incomplete Dialpad call identity or date");
    const day = row.date_started.slice(0, 10);
    if (day < from || day > to) continue;
    if (!["inbound", "outbound"].includes(row.direction ?? ""))
      throw new Error("Unknown Dialpad call direction");
    if (row.direction !== "inbound") continue;
    if (!["true", "false"].includes(row.is_internal?.toLowerCase() ?? ""))
      throw new Error("Missing Dialpad internal-call classification");
    if (row.is_internal!.toLowerCase() === "true") continue;
    if (row.participant_type && row.participant_type !== "operator") continue;
    const categories = new Set(
      (row.categories ?? "")
        .split(",")
        .map((value) => value.trim().toLowerCase()),
    );
    if (!row.categories) throw new Error("Missing Dialpad call categories");
    const fingerprint = JSON.stringify([
      row.target_id,
      row.date_started,
      row.categories,
      row.date_connected,
    ]);
    if (seen.has(row.call_id)) {
      if (seen.get(row.call_id) !== fingerprint)
        throw new Error("Conflicting Dialpad call records");
      continue;
    }
    seen.set(row.call_id, fingerprint);
    if (!categories.has("missed") || categories.has("spam")) continue;
    if (row.date_connected || categories.has("answered"))
      throw new Error("Conflicting Dialpad missed-call outcome");
    const name = names.get(row.target_id);
    if (!name && owners.has(identity(row.name ?? "")))
      throw new Error("Unmatched historical Dialpad CSR identity");
    // Unknown / removed users never become a guessed CSR or a fabricated zero.
    if (name) byCsr[name] = (byCsr[name] ?? 0) + 1;
  }
  return { source: { status: "available", updatedAt }, byCsr };
}
