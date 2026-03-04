export type RemediationFeedbackPayload = {
  action: string;
  scope: string;
  affected: number;
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
  return `${url.pathname}${url.search}`;
}
