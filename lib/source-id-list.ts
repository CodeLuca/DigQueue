import { parsePositiveIds } from "@/lib/positive-id-list";

export function parsePositiveSourceIds(raw: string, max = 30) {
  return parsePositiveIds(raw, max);
}
