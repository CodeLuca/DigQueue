import { headers } from "next/headers";

const HARDCODED_PROD_FALLBACK_ORIGIN = "https://digqueue-production.up.railway.app";

function isLocalHost(hostOrOrigin: string) {
  const value = hostOrOrigin.toLowerCase();
  return value.includes("localhost") || value.includes("127.0.0.1");
}

function toOrigin(value: string | undefined | null, defaultProto = "https") {
  const raw = value?.trim();
  if (!raw) return null;
  const withProto = /^[a-z]+:\/\//i.test(raw) ? raw : `${defaultProto}://${raw}`;
  try {
    return new URL(withProto).origin;
  } catch {
    return null;
  }
}

function readConfiguredOrigin() {
  const explicit =
    toOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    toOrigin(process.env.APP_URL) ||
    toOrigin(process.env.RAILWAY_PUBLIC_DOMAIN) ||
    toOrigin(process.env.RAILWAY_STATIC_URL) ||
    toOrigin(process.env.RAILWAY_SERVICE_DIGQUEUE_URL);
  if (explicit) return explicit;
  return null;
}

function getOriginFromHeaders(headersLike: Pick<Headers, "get">) {
  const forwardedHost = headersLike.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headersLike.get("host") || "";
  if (!host) return null;
  const forwardedProto = headersLike.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (isLocalHost(host) ? "http" : "https");
  return toOrigin(`${proto}://${host}`);
}

export function resolveRequestAppOrigin(request: Request) {
  const configuredOrigin = readConfiguredOrigin();
  if (configuredOrigin) return configuredOrigin;

  const fromHeaders = getOriginFromHeaders(request.headers);
  if (fromHeaders) return fromHeaders;

  const requestUrl = new URL(request.url);
  if (!isLocalHost(requestUrl.origin)) return requestUrl.origin;

  return requestUrl.origin || HARDCODED_PROD_FALLBACK_ORIGIN;
}

export async function resolveHeaderAppOrigin() {
  const configuredOrigin = readConfiguredOrigin();
  if (configuredOrigin) return configuredOrigin;

  const headersStore = await headers();
  const fromHeaders = getOriginFromHeaders(headersStore);
  if (fromHeaders) return fromHeaders;
  return process.env.NODE_ENV === "production" ? HARDCODED_PROD_FALLBACK_ORIGIN : "http://127.0.0.1:3000";
}
