export function getPausedStatusFromCurrent(status: string) {
  return status === "complete" ? "complete" : "paused";
}
