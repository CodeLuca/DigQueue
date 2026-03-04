import { normalizeNextPath } from "@/lib/next-path";

export function resolveOAuthCallbackNextPath(input: {
  cookieNext?: string | null;
  explicitNext?: string | null;
  fallback?: string;
}) {
  const fallback = input.fallback || "/settings";
  const normalizedExplicit = normalizeNextPath(input.explicitNext || "", { fallback });
  return normalizeNextPath(input.cookieNext || normalizedExplicit, { fallback });
}
