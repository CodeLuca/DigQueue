import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentAppUserId } from "@/lib/app-user";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { normalizeNextPath } from "@/lib/next-path";
import { YOUTUBE_OAUTH_TMP_COOKIE } from "@/lib/oauth-cookie-keys";
import { buildOAuthTempCookieOptions } from "@/lib/oauth-cookie-options";
import { buildOAuthErrorRedirectPath } from "@/lib/oauth-redirects";
import { buildOAuthStartLoginPath, parseOAuthStartQuery } from "@/lib/oauth-start-routing";
import { encodeYoutubeOAuthPending } from "@/lib/oauth-temp-cookie";
import { buildYoutubeOAuthAuthorizeUrl } from "@/lib/youtube-oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = resolveRequestAppOrigin(request);
  const userId = await getCurrentAppUserId();
  const startQuery = parseOAuthStartQuery(requestUrl);
  const nextPath = normalizeNextPath(startQuery.nextRaw, { fallback: "/settings" });
  if (!userId) {
    return NextResponse.redirect(new URL(buildOAuthStartLoginPath("youtube"), appOrigin));
  }

  try {
    const state = randomBytes(18).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(YOUTUBE_OAUTH_TMP_COOKIE, encodeYoutubeOAuthPending({ state, nextPath }), buildOAuthTempCookieOptions());

    const authorizeUrl = buildYoutubeOAuthAuthorizeUrl({ origin: appOrigin, state });
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start YouTube OAuth.";
    return NextResponse.redirect(new URL(buildOAuthErrorRedirectPath("youtube", message), appOrigin));
  }
}
