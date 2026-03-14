import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { resolveOAuthCallbackRedirectPath } from "@/lib/oauth-callback-route";
import { resolveOAuthCallbackNextPath } from "@/lib/oauth-callback-next";
import { parseYoutubeOAuthCallbackQuery } from "@/lib/oauth-callback-query";
import { YOUTUBE_OAUTH_TMP_COOKIE } from "@/lib/oauth-cookie-keys";
import { resolveOAuthCallbackRouteContext } from "@/lib/oauth-route-context";
import { validateYoutubeOAuthCallbackInput } from "@/lib/oauth-callback-validation";
import { buildOAuthErrorRedirectPath } from "@/lib/oauth-redirects";
import { decodeYoutubeOAuthPending } from "@/lib/oauth-temp-cookie";
import { completeYoutubeOAuthCallback } from "@/lib/youtube-oauth";

export async function GET(request: Request) {
  const context = await resolveOAuthCallbackRouteContext(request, "youtube");
  if (context.authRedirect) return context.authRedirect;
  const callbackQuery = parseYoutubeOAuthCallbackQuery(context.requestUrl);
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
  if (!validation.ok && validation.reason === "invalid_callback") {
    return NextResponse.redirect(new URL(resolveOAuthCallbackRedirectPath({ provider: "youtube", reason: "invalid_callback" }), context.appOrigin));
  }
  if (!validation.ok && validation.reason === "state_mismatch") {
    return NextResponse.redirect(new URL(resolveOAuthCallbackRedirectPath({ provider: "youtube", reason: "state_mismatch" }), context.appOrigin));
  }

  try {
    await completeYoutubeOAuthCallback({
      code,
      origin: context.appOrigin,
    });

    revalidatePath("/");
    revalidatePath("/settings");

    return NextResponse.redirect(new URL(resolveOAuthCallbackRedirectPath({ provider: "youtube", reason: "success", nextPath }), context.appOrigin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish YouTube OAuth.";
    return NextResponse.redirect(new URL(buildOAuthErrorRedirectPath("youtube", message), context.appOrigin));
  }
}
