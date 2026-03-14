import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getApiKeys, setApiKeys } from "@/lib/api-keys";
import { resolveOAuthCallbackRedirectPath } from "@/lib/oauth-callback-route";
import { resolveOAuthCallbackRouteContext } from "@/lib/oauth-route-context";
import { serializeDiscogsOAuthAuth } from "@/lib/discogs-auth";
import { sanitizeDiscogsConnectionErrorMessage } from "@/lib/discogs-errors";
import { fetchDiscogsOAuthAccessToken } from "@/lib/discogs-oauth";
import { DISCOGS_OAUTH_TMP_COOKIE } from "@/lib/oauth-cookie-keys";
import { normalizeNextPath } from "@/lib/next-path";
import { parseDiscogsOAuthCallbackQuery } from "@/lib/oauth-callback-query";
import { validateDiscogsOAuthCallbackInput } from "@/lib/oauth-callback-validation";
import { buildOAuthErrorRedirectPath } from "@/lib/oauth-redirects";
import { decodeDiscogsOAuthPending } from "@/lib/oauth-temp-cookie";

export async function GET(request: Request) {
  const context = await resolveOAuthCallbackRouteContext(request, "discogs");
  if (context.authRedirect) return context.authRedirect;
  const callbackQuery = parseDiscogsOAuthCallbackQuery(context.requestUrl);
  const nextPath = normalizeNextPath(callbackQuery.nextRaw, { fallback: "/settings" });
  const { returnedState, oauthToken, verifier } = callbackQuery;

  const cookieStore = await cookies();
  const pending = cookieStore.get(DISCOGS_OAUTH_TMP_COOKIE)?.value || "";
  cookieStore.delete(DISCOGS_OAUTH_TMP_COOKIE);

  const parsedPending = decodeDiscogsOAuthPending(pending);
  const expectedState = parsedPending?.state || "";
  const requestToken = parsedPending?.requestToken || "";
  const requestTokenSecret = parsedPending?.requestTokenSecret || "";
  const validation = validateDiscogsOAuthCallbackInput({
    returnedState,
    oauthToken,
    verifier,
    expectedState,
    requestToken,
    requestTokenSecret,
  });
  if (!validation.ok && validation.reason === "invalid_callback") {
    return NextResponse.redirect(new URL(resolveOAuthCallbackRedirectPath({ provider: "discogs", reason: "invalid_callback" }), context.appOrigin));
  }
  if (!validation.ok && validation.reason === "state_mismatch") {
    return NextResponse.redirect(new URL(resolveOAuthCallbackRedirectPath({ provider: "discogs", reason: "state_mismatch" }), context.appOrigin));
  }

  try {
    const accessToken = await fetchDiscogsOAuthAccessToken({
      requestToken,
      requestTokenSecret,
      verifier,
    });
    const existing = await getApiKeys();
    await setApiKeys({
      discogsToken: serializeDiscogsOAuthAuth(accessToken.token, accessToken.tokenSecret),
      youtubeApiKey: existing.youtubeApiKey || "",
    });

    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/connect-discogs");
    return NextResponse.redirect(new URL(resolveOAuthCallbackRedirectPath({ provider: "discogs", reason: "success", nextPath }), context.appOrigin));
  } catch (error) {
    console.error("[discogs-oauth-callback] failed to persist oauth token", error);
    const message =
      sanitizeDiscogsConnectionErrorMessage(error instanceof Error ? error.message : "Unable to finish Discogs OAuth.") ||
      "Unable to finish Discogs OAuth.";
    return NextResponse.redirect(new URL(buildOAuthErrorRedirectPath("discogs", message), context.appOrigin));
  }
}
