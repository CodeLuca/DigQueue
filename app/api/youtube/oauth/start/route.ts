import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentAppUserId } from "@/lib/app-user";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { normalizeNextPath } from "@/lib/next-path";
import { encodeYoutubeOAuthPending } from "@/lib/oauth-temp-cookie";
import { buildYoutubeOAuthAuthorizeUrl } from "@/lib/youtube-oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = resolveRequestAppOrigin(request);
  const userId = await getCurrentAppUserId();
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"), { fallback: "/settings" });
  if (!userId) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/settings")}`, appOrigin));
  }

  try {
    const state = randomBytes(18).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set("youtube_oauth_tmp", encodeYoutubeOAuthPending({ state, nextPath }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    const authorizeUrl = buildYoutubeOAuthAuthorizeUrl({ origin: appOrigin, state });
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start YouTube OAuth.";
    return NextResponse.redirect(new URL(`/settings?youtube_error=${encodeURIComponent(message)}`, appOrigin));
  }
}
