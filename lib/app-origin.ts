import { headers } from "next/headers";

function readConfiguredOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredOrigin) return null;
  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return null;
  }
}

export function resolveRequestAppOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const configuredOrigin = readConfiguredOrigin();
  if (configuredOrigin && process.env.NODE_ENV === "production") return configuredOrigin;
  return requestUrl.origin;
}

export async function resolveHeaderAppOrigin() {
  const configuredOrigin = readConfiguredOrigin();
  if (configuredOrigin && process.env.NODE_ENV === "production") return configuredOrigin;

  const headersStore = await headers();
  const rawForwardedHost = headersStore.get("x-forwarded-host");
  const rawHost = rawForwardedHost?.split(",")[0]?.trim() || headersStore.get("host") || "127.0.0.1:3000";
  const rawForwardedProto = headersStore.get("x-forwarded-proto");
  const rawProto = rawForwardedProto?.split(",")[0]?.trim();
  const isLocalHost = rawHost.startsWith("127.0.0.1") || rawHost.startsWith("localhost");
  const proto = rawProto || (isLocalHost ? "http" : "https");
  return `${proto}://${rawHost}`;
}
