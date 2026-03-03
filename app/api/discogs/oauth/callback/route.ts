import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentAppUserId } from "@/lib/app-user";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { getApiKeys, setApiKeys } from "@/lib/api-keys";
import { serializeDiscogsOAuthAuth } from "@/lib/discogs-auth";
import { fetchDiscogsOAuthAccessToken } from "@/lib/discogs-oauth";
import { normalizeNextPath } from "@/lib/next-path";

function sanitizeDiscogsErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes("failed query:") ||
    lower.includes("params:") ||
    lower.includes("circuit breaker open") ||
    lower.includes("unable to establish connection to upstream database") ||
    lower.includes("getaddrinfo enotfound")
  ) {
    return "Temporary database connectivity issue while saving Discogs connection. Please retry.";
  }
  return message;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = resolveRequestAppOrigin(request);
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"), { fallback: "/settings" });
  const returnedState = requestUrl.searchParams.get("state") || "";
  const oauthToken = requestUrl.searchParams.get("oauth_token") || "";
  const verifier = requestUrl.searchParams.get("oauth_verifier") || "";

  const userId = await getCurrentAppUserId();
  if (!userId) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/connect-discogs")}`, appOrigin));
  }

  const cookieStore = await cookies();
  const pending = cookieStore.get("discogs_oauth_tmp")?.value || "";
  cookieStore.delete("discogs_oauth_tmp");

  const [expectedState, requestToken, requestTokenSecret] = pending.split(":");
  if (!returnedState || !oauthToken || !verifier || !expectedState || !requestToken || !requestTokenSecret) {
    return NextResponse.redirect(new URL("/settings?discogs_error=Invalid%20Discogs%20OAuth%20callback.", appOrigin));
  }
  if (returnedState !== expectedState || oauthToken !== requestToken) {
    return NextResponse.redirect(new URL("/settings?discogs_error=Discogs%20OAuth%20state%20mismatch.", appOrigin));
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
    return NextResponse.redirect(new URL(`${nextPath}${nextPath.includes("?") ? "&" : "?"}discogs=connected`, appOrigin));
  } catch (error) {
    console.error("[discogs-oauth-callback] failed to persist oauth token", error);
    const message = sanitizeDiscogsErrorMessage(error instanceof Error ? error.message : "Unable to finish Discogs OAuth.");
    return NextResponse.redirect(new URL(`/settings?discogs_error=${encodeURIComponent(message)}`, appOrigin));
  }
}
