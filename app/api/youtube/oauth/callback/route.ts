import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentAppUserId } from "@/lib/app-user";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { buildOAuthCallbackLoginPath } from "@/lib/oauth-callback-routing";
import { parseYoutubeOAuthCallbackQuery } from "@/lib/oauth-callback-query";
import { YOUTUBE_OAUTH_TMP_COOKIE } from "@/lib/oauth-cookie-keys";
import { getInvalidOAuthCallbackMessage } from "@/lib/oauth-messages";
import { normalizeNextPath } from "@/lib/next-path";
import { validateYoutubeOAuthCallbackInput } from "@/lib/oauth-callback-validation";
import { buildOAuthConnectedRedirectPath, buildOAuthErrorRedirectPath } from "@/lib/oauth-redirects";
import { decodeYoutubeOAuthPending } from "@/lib/oauth-temp-cookie";
import { completeYoutubeOAuthCallback } from "@/lib/youtube-oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = resolveRequestAppOrigin(request);
  const userId = await getCurrentAppUserId();
  if (!userId) {
    return NextResponse.redirect(new URL(buildOAuthCallbackLoginPath("youtube"), appOrigin));
  }

  const callbackQuery = parseYoutubeOAuthCallbackQuery(requestUrl);
  const { returnedState, code } = callbackQuery;
  const explicitNext = normalizeNextPath(callbackQuery.nextRaw, { fallback: "/settings" });

  const cookieStore = await cookies();
  const pending = cookieStore.get(YOUTUBE_OAUTH_TMP_COOKIE)?.value || "";
  cookieStore.delete(YOUTUBE_OAUTH_TMP_COOKIE);
  const parsedPending = decodeYoutubeOAuthPending(pending);
  const expectedState = parsedPending?.state || "";
  const cookieNext = parsedPending?.nextPath || "";
  const nextPath = normalizeNextPath(cookieNext || explicitNext, { fallback: "/settings" });

  const validation = validateYoutubeOAuthCallbackInput({
    returnedState,
    code,
    expectedState,
  });
  if (!validation.ok) {
    return NextResponse.redirect(new URL(buildOAuthErrorRedirectPath("youtube", getInvalidOAuthCallbackMessage("youtube")), appOrigin));
  }

  try {
    await completeYoutubeOAuthCallback({
      code,
      origin: appOrigin,
    });

    revalidatePath("/");
    revalidatePath("/settings");

    return NextResponse.redirect(new URL(buildOAuthConnectedRedirectPath(nextPath, "youtube"), appOrigin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish YouTube OAuth.";
    return NextResponse.redirect(new URL(buildOAuthErrorRedirectPath("youtube", message), appOrigin));
  }
}
