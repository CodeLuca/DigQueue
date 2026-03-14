type NormalizePositiveIdsOptions = {
  max?: number;
};

export function normalizePositiveIds(
  values: Iterable<number | null | undefined>,
  options?: NormalizePositiveIdsOptions,
) {
  const normalized = [...new Set(
    [...values].filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0),
  )];

  if (typeof options?.max !== "number") return normalized;
  return normalized.slice(0, Math.max(1, Math.floor(options.max)));
}

export function parsePositiveIds(raw: string, max?: number) {
  const parsed = (raw || "")
    .split(",")
    .map((item) => Number(item.trim()));
  return normalizePositiveIds(parsed, typeof max === "number" ? { max } : undefined);
}
