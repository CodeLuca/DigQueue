import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentAppUserId } from "@/lib/app-user";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { completeYoutubeOAuthCallback } from "@/lib/youtube-oauth";

function safeNext(value: string | null) {
  if (!value) return "/settings";
  if (!value.startsWith("/")) return "/settings";
  if (value.startsWith("//")) return "/settings";
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = resolveRequestAppOrigin(request);
  const userId = await getCurrentAppUserId();
  if (!userId) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/settings")}`, appOrigin));
  }

  const returnedState = requestUrl.searchParams.get("state") || "";
  const code = requestUrl.searchParams.get("code") || "";
  const explicitNext = safeNext(requestUrl.searchParams.get("next"));

  const cookieStore = await cookies();
  const pending = cookieStore.get("youtube_oauth_tmp")?.value || "";
  cookieStore.delete("youtube_oauth_tmp");
  const [expectedState, cookieNext] = pending.split(":");
  const nextPath = safeNext(cookieNext || explicitNext);

  if (!returnedState || !code || !expectedState || returnedState !== expectedState) {
    return NextResponse.redirect(new URL(`/settings?youtube_error=${encodeURIComponent("Invalid YouTube OAuth callback.")}`, appOrigin));
  }

  try {
    await completeYoutubeOAuthCallback({
      code,
      origin: appOrigin,
    });

    revalidatePath("/");
    revalidatePath("/settings");

    const separator = nextPath.includes("?") ? "&" : "?";
    return NextResponse.redirect(new URL(`${nextPath}${separator}youtube=connected`, appOrigin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish YouTube OAuth.";
    return NextResponse.redirect(new URL(`/settings?youtube_error=${encodeURIComponent(message)}`, appOrigin));
  }
}
