import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentAppUserId } from "@/lib/app-user";
import { getApiKeys, setApiKeys } from "@/lib/api-keys";
import { serializeDiscogsOAuthAuth } from "@/lib/discogs-auth";
import { fetchDiscogsOAuthAccessToken } from "@/lib/discogs-oauth";

function safeNext(value: string | null) {
  if (!value) return "/settings";
  if (!value.startsWith("/")) return "/settings";
  if (value.startsWith("//")) return "/settings";
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = safeNext(requestUrl.searchParams.get("next"));
  const returnedState = requestUrl.searchParams.get("state") || "";
  const oauthToken = requestUrl.searchParams.get("oauth_token") || "";
  const verifier = requestUrl.searchParams.get("oauth_verifier") || "";

  const userId = await getCurrentAppUserId();
  if (!userId) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/connect-discogs")}`, requestUrl.origin));
  }

  const cookieStore = await cookies();
  const pending = cookieStore.get("discogs_oauth_tmp")?.value || "";
  cookieStore.delete("discogs_oauth_tmp");

  const [expectedState, requestToken, requestTokenSecret] = pending.split(":");
  if (!returnedState || !oauthToken || !verifier || !expectedState || !requestToken || !requestTokenSecret) {
    return NextResponse.redirect(new URL("/settings?discogs_error=Invalid%20Discogs%20OAuth%20callback.", requestUrl.origin));
  }
  if (returnedState !== expectedState || oauthToken !== requestToken) {
    return NextResponse.redirect(new URL("/settings?discogs_error=Discogs%20OAuth%20state%20mismatch.", requestUrl.origin));
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
    return NextResponse.redirect(new URL(`${nextPath}${nextPath.includes("?") ? "&" : "?"}discogs=connected`, requestUrl.origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish Discogs OAuth.";
    return NextResponse.redirect(new URL(`/settings?discogs_error=${encodeURIComponent(message)}`, requestUrl.origin));
  }
}
