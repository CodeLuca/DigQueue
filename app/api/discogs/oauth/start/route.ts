import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildDiscogsOAuthCallbackUrl } from "@/lib/discogs-oauth-callback-url";
import { discogsOAuthAuthorizeUrl, fetchDiscogsOAuthRequestToken } from "@/lib/discogs-oauth";
import { DISCOGS_OAUTH_TMP_COOKIE } from "@/lib/oauth-cookie-keys";
import { buildOAuthTempCookieOptions } from "@/lib/oauth-cookie-options";
import { resolveOAuthStartRouteContext } from "@/lib/oauth-route-context";
import { createOAuthState } from "@/lib/oauth-state";
import { buildOAuthErrorRedirectPath } from "@/lib/oauth-redirects";
import { encodeDiscogsOAuthPending } from "@/lib/oauth-temp-cookie";

export async function GET(request: Request) {
  const context = await resolveOAuthStartRouteContext(request, { provider: "discogs" });
  if (context.authRedirect) return context.authRedirect;

  try {
    const state = createOAuthState("discogs");
    const requestToken = await fetchDiscogsOAuthRequestToken(
      buildDiscogsOAuthCallbackUrl(context.appOrigin, context.nextPath, state),
    );
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
    return NextResponse.redirect(new URL(buildOAuthErrorRedirectPath("discogs", message), context.appOrigin));
  }
}
