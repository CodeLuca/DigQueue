import "server-only";

import { env } from "@/lib/env";
import { getApiKeys, setApiKeys } from "@/lib/api-keys";

const YOUTUBE_WRITE_SCOPE = "https://www.googleapis.com/auth/youtube";
const YOUTUBE_IDENTITY_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function requireYoutubeOAuthConfig() {
  const clientId = env.YOUTUBE_OAUTH_CLIENT_ID?.trim() || "";
  const clientSecret = env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) {
    throw new Error("YouTube OAuth is not configured. Set YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET.");
  }
  return { clientId, clientSecret };
}

function getYoutubeOAuthRedirectUri(origin: string) {
  return env.YOUTUBE_OAUTH_REDIRECT_URI?.trim() || `${origin}/api/youtube/oauth/callback`;
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

async function fetchToken(input: {
  grantType: "authorization_code" | "refresh_token";
  code?: string;
  refreshToken?: string;
  redirectUri: string;
}) {
  const { clientId, clientSecret } = requireYoutubeOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: input.grantType,
  });

  if (input.grantType === "authorization_code") {
    body.set("code", input.code || "");
    body.set("redirect_uri", input.redirectUri);
  } else {
    body.set("refresh_token", input.refreshToken || "");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !json.access_token) {
    const reason = json.error_description || json.error || `status ${response.status}`;
    throw new Error(`Google token exchange failed: ${reason}`);
  }

  return {
    accessToken: json.access_token,
    expiresInSeconds: Number.isFinite(json.expires_in) ? Number(json.expires_in) : 3600,
    refreshToken: json.refresh_token || null,
    scope: json.scope || null,
    tokenType: json.token_type || "Bearer",
  };
}

async function fetchYoutubeChannelProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=1", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) return { channelId: null, channelTitle: null };
  const json = (await response.json().catch(() => ({}))) as {
    items?: Array<{ id?: string; snippet?: { title?: string } }>;
  };
  const first = json.items?.[0];
  return {
    channelId: first?.id || null,
    channelTitle: first?.snippet?.title || null,
  };
}

export function isYoutubeOAuthConfigured() {
  return Boolean(env.YOUTUBE_OAUTH_CLIENT_ID?.trim() && env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim());
}

export async function getYoutubeOAuthConnectionStatus() {
  const keys = await getApiKeys();
  return {
    configured: isYoutubeOAuthConfigured(),
    connected: Boolean(keys.youtubeOauthRefreshToken),
    channelId: keys.youtubeOauthChannelId,
    channelTitle: keys.youtubeOauthChannelTitle,
    scope: keys.youtubeOauthScope,
  };
}

export function buildYoutubeOAuthAuthorizeUrl(input: { origin: string; state: string }) {
  const { clientId } = requireYoutubeOAuthConfig();
  const redirectUri = getYoutubeOAuthRedirectUri(input.origin);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", [YOUTUBE_WRITE_SCOPE, ...YOUTUBE_IDENTITY_SCOPES].join(" "));
  return url.toString();
}

export async function completeYoutubeOAuthCallback(input: {
  code: string;
  origin: string;
}) {
  const redirectUri = getYoutubeOAuthRedirectUri(input.origin);
  const token = await fetchToken({
    grantType: "authorization_code",
    code: input.code,
    redirectUri,
  });
  const profile = await fetchYoutubeChannelProfile(token.accessToken);
  const expiresAt = Date.now() + token.expiresInSeconds * 1000;

  const existing = await getApiKeys();
  await setApiKeys({
    discogsToken: existing.discogsToken || "",
    youtubeApiKey: existing.youtubeApiKey || "",
    youtubeOauthRefreshToken: token.refreshToken || existing.youtubeOauthRefreshToken || null,
    youtubeOauthAccessToken: token.accessToken,
    youtubeOauthExpiresAt: expiresAt,
    youtubeOauthScope: token.scope,
    youtubeOauthChannelId: profile.channelId,
    youtubeOauthChannelTitle: profile.channelTitle,
  });

  return {
    channelId: profile.channelId,
    channelTitle: profile.channelTitle,
  };
}

export async function disconnectYoutubeOAuth() {
  const existing = await getApiKeys();
  await setApiKeys({
    discogsToken: existing.discogsToken || "",
    youtubeApiKey: existing.youtubeApiKey || "",
    youtubeOauthRefreshToken: "",
    youtubeOauthAccessToken: "",
    youtubeOauthExpiresAt: null,
    youtubeOauthScope: "",
    youtubeOauthChannelId: "",
    youtubeOauthChannelTitle: "",
  });
}

export async function getYoutubeAccessTokenForPlaylistWrite() {
  const keys = await getApiKeys();
  const refreshToken = keys.youtubeOauthRefreshToken;
  if (!refreshToken) {
    throw new Error("YouTube is not connected. Connect YouTube in Settings first.");
  }

  const now = Date.now();
  const hasFreshAccess = Boolean(keys.youtubeOauthAccessToken && keys.youtubeOauthExpiresAt && keys.youtubeOauthExpiresAt - now > 60_000);
  if (hasFreshAccess && keys.youtubeOauthAccessToken) {
    return keys.youtubeOauthAccessToken;
  }

  const token = await fetchToken({
    grantType: "refresh_token",
    refreshToken,
    redirectUri: "",
  });
  const expiresAt = Date.now() + token.expiresInSeconds * 1000;
  await setApiKeys({
    youtubeOauthAccessToken: token.accessToken,
    youtubeOauthExpiresAt: expiresAt,
    youtubeOauthScope: token.scope || keys.youtubeOauthScope,
  });

  return token.accessToken;
}
