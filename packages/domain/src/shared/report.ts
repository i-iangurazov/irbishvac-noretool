export type ServiceTitanField = {
  name: string;
  label?: string;
};

export type ServiceTitanTabularInput = {
  fields?: ServiceTitanField[];
  data?: unknown[];
  rows?: unknown[];
  raw_json?: unknown;
  snapshot_time?: string | string[] | null;
  snapshotTime?: string | null;
  meta?: {
    snapshot_time?: string | null;
  };
};

export type NormalizedRow = Record<string, unknown>;

export type NormalizedTabularReport = {
  fields: ServiceTitanField[];
  rows: NormalizedRow[];
  snapshotTime: string | null;
};

function deepParse(value: unknown): unknown {
  let current = value;

  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "string") {
      return current;
    }

    try {
      current = JSON.parse(current);
    } catch {
      return current;
    }
  }

  return current;
}

function getSnapshotTime(input: unknown): string | null {
  const source = (input ?? {}) as ServiceTitanTabularInput;

  const candidate =
    (Array.isArray(source.snapshot_time) ? source.snapshot_time[0] : source.snapshot_time) ??
    source.snapshotTime ??
    source.meta?.snapshot_time ??
    null;

  return typeof candidate === "string" ? candidate : null;
}

function toFields(value: unknown): ServiceTitanField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const field = item as ServiceTitanField;
      return typeof field.name === "string" ? field : null;
    })
    .filter((item): item is ServiceTitanField => item !== null);
}

function toRows(fields: ServiceTitanField[], rawRows: unknown): NormalizedRow[] {
  if (!Array.isArray(rawRows)) {
    return [];
  }

  const fieldNames = fields.map((field) => field.name);

  return rawRows.map((row) => {
    if (Array.isArray(row)) {
      return Object.fromEntries(
        fieldNames.map((fieldName, index) => [fieldName, row[index]]),
      );
    }

    if (row && typeof row === "object") {
      return row as NormalizedRow;
    }

    return {};
  });
}

function tryExtractTabular(value: unknown): NormalizedTabularReport | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as ServiceTitanTabularInput;
  const directFields = toFields(source.fields);
  const directRows = source.data ?? source.rows;

  if (directFields.length > 0 && Array.isArray(directRows)) {
    return {
      fields: directFields,
      rows: toRows(directFields, directRows),
      snapshotTime: getSnapshotTime(source)
    };
  }

  if (Array.isArray(value) && value.every((item) => item && typeof item === "object")) {
    const rows = value as NormalizedRow[];
    const keys = Object.keys(rows[0] ?? {});

    return {
      fields: keys.map((key) => ({ name: key })),
      rows,
      snapshotTime: null
    };
  }

  return null;
}

export function resolveTabularReport(input: unknown): NormalizedTabularReport {
  const parsedInput = deepParse(input);
  const candidateObjects: unknown[] = [parsedInput];

  if (parsedInput && typeof parsedInput === "object") {
    const source = parsedInput as ServiceTitanTabularInput;

    if (Array.isArray(source.raw_json)) {
      candidateObjects.push(...source.raw_json.map(deepParse));
    } else if (source.raw_json != null) {
      candidateObjects.push(deepParse(source.raw_json));
    }
  }

  for (const candidate of candidateObjects) {
    const extracted = tryExtractTabular(candidate);
    if (extracted) {
      return extracted;
    }
  }

  return {
    fields: [],
    rows: [],
    snapshotTime: null
  };
}

export function toNumber(value: unknown): number {
  if (value == null || value === "") {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
}

export function toRatio(value: unknown): number {
  if (typeof value === "string" && value.includes("%")) {
    return toNumber(value) / 100;
  }

  const numeric = toNumber(value);
  return numeric > 10 ? numeric / 100 : numeric;
}

export function pickFirst(row: NormalizedRow, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value != null && value !== "") {
      return value;
    }
  }

  return null;
}

export function sumBy<T>(items: T[], getValue: (item: T) => number): number {
  return items.reduce((total, item) => total + getValue(item), 0);
}

export function weightedAverage<T>(
  items: T[],
  getValue: (item: T) => number,
  getWeight: (item: T) => number,
): number {
  const totalWeight = sumBy(items, getWeight);
  if (totalWeight <= 0) {
    return 0;
  }

  return items.reduce((total, item) => total + getValue(item) * getWeight(item), 0) / totalWeight;
}
