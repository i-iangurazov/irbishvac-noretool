function normalizeJsonValue(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return value;
    }

    return Number(value.toPrecision(15));
  }

  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeJsonValue((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

export function stableJson(value: unknown) {
  return JSON.stringify(normalizeJsonValue(value));
}
