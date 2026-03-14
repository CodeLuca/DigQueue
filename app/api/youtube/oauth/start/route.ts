import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { YOUTUBE_OAUTH_TMP_COOKIE } from "@/lib/oauth-cookie-keys";
import { buildOAuthTempCookieOptions } from "@/lib/oauth-cookie-options";
import { buildOAuthErrorRedirectPath } from "@/lib/oauth-redirects";
import { resolveOAuthStartRouteContext } from "@/lib/oauth-route-context";
import { createOAuthState } from "@/lib/oauth-state";
import { encodeYoutubeOAuthPending } from "@/lib/oauth-temp-cookie";
import { buildYoutubeOAuthAuthorizeUrl } from "@/lib/youtube-oauth";

export async function GET(request: Request) {
  const context = await resolveOAuthStartRouteContext(request, { provider: "youtube" });
  if (context.authRedirect) return context.authRedirect;

  try {
    const state = createOAuthState("youtube");
    const cookieStore = await cookies();
    cookieStore.set(
      YOUTUBE_OAUTH_TMP_COOKIE,
      encodeYoutubeOAuthPending({ state, nextPath: context.nextPath }),
      buildOAuthTempCookieOptions(),
    );

    const authorizeUrl = buildYoutubeOAuthAuthorizeUrl({ origin: context.appOrigin, state });
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start YouTube OAuth.";
    return NextResponse.redirect(new URL(buildOAuthErrorRedirectPath("youtube", message), context.appOrigin));
  }
}
