import { NextResponse } from "next/server";
import { getCurrentAppUserId } from "@/lib/app-user";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { resolveOAuthCallbackRedirectPath } from "@/lib/oauth-callback-route";
import { buildOAuthStartLoginPath, parseOAuthStartQuery } from "@/lib/oauth-start-routing";
import type { OAuthProvider } from "@/lib/oauth-provider";
import { normalizeNextPath } from "@/lib/next-path";

export function resolveOAuthRouteBase(request: Request) {
  return {
    requestUrl: new URL(request.url),
    appOrigin: resolveRequestAppOrigin(request),
  };
}

export async function resolveOAuthStartRouteContext(
  request: Request,
  input: { provider: OAuthProvider; fallbackNextPath?: string },
) {
  const { requestUrl, appOrigin } = resolveOAuthRouteBase(request);
  const startQuery = parseOAuthStartQuery(requestUrl);
  const nextPath = normalizeNextPath(startQuery.nextRaw, {
    fallback: input.fallbackNextPath || "/settings",
  });
  const userId = await getCurrentAppUserId();
  return {
    requestUrl,
    appOrigin,
    nextPath,
    userId,
    authRedirect: userId
      ? null
      : NextResponse.redirect(new URL(buildOAuthStartLoginPath(input.provider), appOrigin)),
  };
}

export async function resolveOAuthCallbackRouteContext(
  request: Request,
  provider: OAuthProvider,
) {
  const { requestUrl, appOrigin } = resolveOAuthRouteBase(request);
  const userId = await getCurrentAppUserId();
  return {
    requestUrl,
    appOrigin,
    userId,
    authRedirect: userId
      ? null
      : NextResponse.redirect(
          new URL(resolveOAuthCallbackRedirectPath({ provider, reason: "login" }), appOrigin),
        ),
  };
}
