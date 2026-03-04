import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentAppUserId } from "@/lib/app-user";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { buildOAuthCallbackLoginPath } from "@/lib/oauth-callback-routing";
import { resolveOAuthCallbackNextPath } from "@/lib/oauth-callback-next";
import { buildOAuthCallbackSuccessPath } from "@/lib/oauth-callback-success";
import { parseYoutubeOAuthCallbackQuery } from "@/lib/oauth-callback-query";
import { YOUTUBE_OAUTH_TMP_COOKIE } from "@/lib/oauth-cookie-keys";
import { getOAuthCallbackErrorMessage } from "@/lib/oauth-messages";
import { validateYoutubeOAuthCallbackInput } from "@/lib/oauth-callback-validation";
import { buildOAuthErrorRedirectPath } from "@/lib/oauth-redirects";
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

  const cookieStore = await cookies();
  const pending = cookieStore.get(YOUTUBE_OAUTH_TMP_COOKIE)?.value || "";
  cookieStore.delete(YOUTUBE_OAUTH_TMP_COOKIE);
  const parsedPending = decodeYoutubeOAuthPending(pending);
  const expectedState = parsedPending?.state || "";
  const nextPath = resolveOAuthCallbackNextPath({
    cookieNext: parsedPending?.nextPath,
    explicitNext: callbackQuery.nextRaw,
    fallback: "/settings",
  });

  const validation = validateYoutubeOAuthCallbackInput({
    returnedState,
    code,
    expectedState,
  });
  if (!validation.ok) {
    return NextResponse.redirect(new URL(buildOAuthErrorRedirectPath("youtube", getOAuthCallbackErrorMessage("youtube", "invalid_callback")), appOrigin));
  }

  try {
    await completeYoutubeOAuthCallback({
      code,
      origin: appOrigin,
    });

    revalidatePath("/");
    revalidatePath("/settings");

    return NextResponse.redirect(new URL(buildOAuthCallbackSuccessPath(nextPath, "youtube"), appOrigin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish YouTube OAuth.";
    return NextResponse.redirect(new URL(buildOAuthErrorRedirectPath("youtube", message), appOrigin));
  }
}
