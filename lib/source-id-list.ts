export function parsePositiveSourceIds(raw: string, max = 30) {
  return [...new Set(
    (raw || "")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item > 0),
  )].slice(0, Math.max(1, Math.floor(max)));
}
