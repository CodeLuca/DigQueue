import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentAppUserId } from "@/lib/app-user";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { buildDiscogsOAuthCallbackUrl } from "@/lib/discogs-oauth-callback-url";
import { discogsOAuthAuthorizeUrl, fetchDiscogsOAuthRequestToken } from "@/lib/discogs-oauth";
import { DISCOGS_OAUTH_TMP_COOKIE } from "@/lib/oauth-cookie-keys";
import { buildOAuthTempCookieOptions } from "@/lib/oauth-cookie-options";
import { createOAuthState } from "@/lib/oauth-state";
import { normalizeNextPath } from "@/lib/next-path";
import { buildOAuthErrorRedirectPath } from "@/lib/oauth-redirects";
import { buildOAuthStartLoginPath, parseOAuthStartQuery } from "@/lib/oauth-start-routing";
import { encodeDiscogsOAuthPending } from "@/lib/oauth-temp-cookie";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = resolveRequestAppOrigin(request);
  const startQuery = parseOAuthStartQuery(requestUrl);
  const nextPath = normalizeNextPath(startQuery.nextRaw, { fallback: "/settings" });
  const userId = await getCurrentAppUserId();
  if (!userId) {
    return NextResponse.redirect(new URL(buildOAuthStartLoginPath("discogs"), appOrigin));
  }

  try {
    const state = createOAuthState("discogs");
    const requestToken = await fetchDiscogsOAuthRequestToken(buildDiscogsOAuthCallbackUrl(appOrigin, nextPath, state));
    const cookieStore = await cookies();
    cookieStore.set(DISCOGS_OAUTH_TMP_COOKIE, encodeDiscogsOAuthPending({
      state,
      requestToken: requestToken.token,
      requestTokenSecret: requestToken.tokenSecret,
    }), buildOAuthTempCookieOptions());

    const authorizeUrl = new URL(discogsOAuthAuthorizeUrl);
    authorizeUrl.searchParams.set("oauth_token", requestToken.token);
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Discogs OAuth.";
    return NextResponse.redirect(new URL(buildOAuthErrorRedirectPath("discogs", message), appOrigin));
  }
}
