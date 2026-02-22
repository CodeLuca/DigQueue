import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentAppUserId } from "@/lib/app-user";
import { buildYoutubeOAuthAuthorizeUrl } from "@/lib/youtube-oauth";

function safeNext(value: string | null) {
  if (!value) return "/settings";
  if (!value.startsWith("/")) return "/settings";
  if (value.startsWith("//")) return "/settings";
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const userId = await getCurrentAppUserId();
  const nextPath = safeNext(requestUrl.searchParams.get("next"));
  if (!userId) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/settings")}`, requestUrl.origin));
  }

  try {
    const state = randomBytes(18).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set("youtube_oauth_tmp", `${state}:${nextPath}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    const authorizeUrl = buildYoutubeOAuthAuthorizeUrl({ origin: requestUrl.origin, state });
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start YouTube OAuth.";
    return NextResponse.redirect(new URL(`/settings?youtube_error=${encodeURIComponent(message)}`, requestUrl.origin));
  }
}
