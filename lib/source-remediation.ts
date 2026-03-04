import { getPausedStatusFromCurrent } from "@/lib/source-status-transitions";

export function shouldClearErrorOnCooldown(status: string) {
  return status === "error";
}

export function buildPauseSourceUpdate(status: string, updatedAt: Date) {
  return {
    active: false,
    status: getPausedStatusFromCurrent(status),
    updatedAt,
  };
}

export function buildPauseAndCooldownSourceUpdate(status: string, updatedAt: Date) {
  const base = buildPauseSourceUpdate(status, updatedAt);
  if (!shouldClearErrorOnCooldown(status)) return base;
  return {
    ...base,
    lastError: null as string | null,
    retryCount: 0,
  };
}
