export type RemediationFeedbackPayload = {
  action: string;
  scope: string;
  affected: number;
  failed?: number;
};

export function resolveActionNextPath(rawNext: string | null | undefined, fallback = "/") {
  const normalized = String(rawNext || "").trim();
  if (!normalized || !normalized.startsWith("/")) return fallback;
  return normalized;
}

export function appendRemediationResult(nextPath: string, payload: RemediationFeedbackPayload) {
  const url = new URL(nextPath, "http://localhost");
  url.searchParams.set("remAction", payload.action);
  url.searchParams.set("remScope", payload.scope);
  url.searchParams.set("remAffected", String(Math.max(0, payload.affected)));
  if (typeof payload.failed === "number" && Number.isFinite(payload.failed) && payload.failed > 0) {
    url.searchParams.set("remFailed", String(Math.max(0, payload.failed)));
  } else {
    url.searchParams.delete("remFailed");
  }
  return `${url.pathname}${url.search}`;
}
