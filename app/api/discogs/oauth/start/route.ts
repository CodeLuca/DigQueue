import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentAppUserId } from "@/lib/app-user";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { discogsOAuthAuthorizeUrl, fetchDiscogsOAuthRequestToken } from "@/lib/discogs-oauth";
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
    const state = randomBytes(12).toString("hex");
    const callbackUrl = new URL("/api/discogs/oauth/callback", appOrigin);
    callbackUrl.searchParams.set("next", nextPath);
    callbackUrl.searchParams.set("state", state);

    const requestToken = await fetchDiscogsOAuthRequestToken(callbackUrl.toString());
    const cookieStore = await cookies();
    cookieStore.set("discogs_oauth_tmp", encodeDiscogsOAuthPending({
      state,
      requestToken: requestToken.token,
      requestTokenSecret: requestToken.tokenSecret,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    const authorizeUrl = new URL(discogsOAuthAuthorizeUrl);
    authorizeUrl.searchParams.set("oauth_token", requestToken.token);
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Discogs OAuth.";
    return NextResponse.redirect(new URL(buildOAuthErrorRedirectPath("discogs", message), appOrigin));
  }
}
