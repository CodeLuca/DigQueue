import { createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

type OAuthHeaderInput = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
  callback?: string;
  verifier?: string;
};

type OAuthTokenPair = {
  token: string;
  tokenSecret: string;
};

const DISCOGS_USER_AGENT = "DigQueue/0.1 (+https://digqueue.app)";
const DISCOGS_OAUTH_REQUEST_TOKEN_URL = "https://api.discogs.com/oauth/request_token";
const DISCOGS_OAUTH_AUTHORIZE_URL = "https://www.discogs.com/oauth/authorize";
const DISCOGS_OAUTH_ACCESS_TOKEN_URL = "https://api.discogs.com/oauth/access_token";
const DISCOGS_CONSUMER_KEY_FALLBACK = "lMJnjNojOSFeijKuQPVR";
const DISCOGS_CONSUMER_SECRET_FALLBACK = "mdEPXnOugVrlrFvdENPDmjpuFUDMaPZU";

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

function parseQueryParams(url: URL) {
  const pairs: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    pairs.push([key, value]);
  });
  return pairs;
}

function buildAuthorizationHeader(input: OAuthHeaderInput) {
  const nonce = randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const oauthParams: Array<[string, string]> = [
    ["oauth_consumer_key", input.consumerKey],
    ["oauth_nonce", nonce],
    ["oauth_signature_method", "HMAC-SHA1"],
    ["oauth_timestamp", timestamp],
    ["oauth_version", "1.0"],
  ];

  if (input.token) oauthParams.push(["oauth_token", input.token]);
  if (input.callback) oauthParams.push(["oauth_callback", input.callback]);
  if (input.verifier) oauthParams.push(["oauth_verifier", input.verifier]);

  const parsedUrl = new URL(input.url);
  const queryParams = parseQueryParams(parsedUrl);
  const allParams = [...oauthParams, ...queryParams]
    .map(([key, value]) => [percentEncode(key), percentEncode(value)] as const)
    .sort(([aKey, aVal], [bKey, bVal]) => (aKey === bKey ? aVal.localeCompare(bVal) : aKey.localeCompare(bKey)));

  const normalized = allParams.map(([key, value]) => `${key}=${value}`).join("&");
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
  const signatureBaseString = [input.method, percentEncode(baseUrl), percentEncode(normalized)].join("&");
  const signingKey = `${percentEncode(input.consumerSecret)}&${percentEncode(input.tokenSecret || "")}`;
  const signature = createHmac("sha1", signingKey).update(signatureBaseString).digest("base64");

  const authParams = [...oauthParams, ["oauth_signature", signature] as [string, string]]
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(", ");

  return `OAuth ${authParams}`;
}

function requireDiscogsOAuthConsumer() {
  return {
    consumerKey: env.DISCOGS_CONSUMER_KEY || DISCOGS_CONSUMER_KEY_FALLBACK,
    consumerSecret: env.DISCOGS_CONSUMER_SECRET || DISCOGS_CONSUMER_SECRET_FALLBACK,
  };
}

function parseOAuthTokenPair(body: string): OAuthTokenPair {
  const params = new URLSearchParams(body);
  const token = params.get("oauth_token")?.trim() || "";
  const tokenSecret = params.get("oauth_token_secret")?.trim() || "";
  if (!token || !tokenSecret) {
    throw new Error("Discogs OAuth response did not include token credentials.");
  }
  return { token, tokenSecret };
}

export function buildDiscogsOAuthApiAuthorizationHeader(input: {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  token: string;
  tokenSecret: string;
}) {
  const { consumerKey, consumerSecret } = requireDiscogsOAuthConsumer();
  return buildAuthorizationHeader({
    method: input.method,
    url: input.url,
    consumerKey,
    consumerSecret,
    token: input.token,
    tokenSecret: input.tokenSecret,
  });
}

export async function fetchDiscogsOAuthRequestToken(callbackUrl: string) {
  const { consumerKey, consumerSecret } = requireDiscogsOAuthConsumer();
  const url = DISCOGS_OAUTH_REQUEST_TOKEN_URL;
  const authorization = buildAuthorizationHeader({
    method: "POST",
    url,
    consumerKey,
    consumerSecret,
    callback: callbackUrl,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "User-Agent": DISCOGS_USER_AGENT,
    },
    cache: "no-store",
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Discogs request token failed (${response.status}): ${body || "empty response"}`);
  }

  return parseOAuthTokenPair(body);
}

export async function fetchDiscogsOAuthAccessToken(input: {
  requestToken: string;
  requestTokenSecret: string;
  verifier: string;
}) {
  const { consumerKey, consumerSecret } = requireDiscogsOAuthConsumer();
  const url = DISCOGS_OAUTH_ACCESS_TOKEN_URL;
  const authorization = buildAuthorizationHeader({
    method: "POST",
    url,
    consumerKey,
    consumerSecret,
    token: input.requestToken,
    tokenSecret: input.requestTokenSecret,
    verifier: input.verifier,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "User-Agent": DISCOGS_USER_AGENT,
    },
    cache: "no-store",
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Discogs access token failed (${response.status}): ${body || "empty response"}`);
  }

  return parseOAuthTokenPair(body);
}

export const discogsUserAgent = DISCOGS_USER_AGENT;
export const discogsOAuthAuthorizeUrl = DISCOGS_OAUTH_AUTHORIZE_URL;
