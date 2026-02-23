import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const PUBLIC_PATHS = new Set([
  "/welcome",
  "/login",
  "/register",
  "/connect-discogs",
  "/auth/callback",
  "/auth/confirm",
  "/auth/google/start",
  "/reset-password",
]);
const PUBLIC_API_PREFIXES: string[] = [];

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

function resolveProxyOrigin(request: NextRequest) {
  const configuredOrigin =
    toOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    toOrigin(process.env.APP_URL) ||
    toOrigin(process.env.RAILWAY_PUBLIC_DOMAIN) ||
    toOrigin(process.env.RAILWAY_STATIC_URL) ||
    toOrigin(process.env.RAILWAY_SERVICE_DIGQUEUE_URL);
  if (configuredOrigin) return configuredOrigin;

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || "";
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (host) {
    const proto = forwardedProto || (isLocalHost(host) ? "http" : "https");
    const origin = toOrigin(`${proto}://${host}`);
    if (origin) return origin;
  }
  return request.nextUrl.origin;
}

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  for (const value of PUBLIC_PATHS) {
    if (pathname.startsWith(`${value}/`)) return true;
  }
  return false;
}

function isPublicApiPath(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const appOrigin = resolveProxyOrigin(request);

  // Some OAuth configurations may return the auth code to "/".
  // Always funnel this through our dedicated callback handler.
  if (pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const callbackUrl = new URL("/auth/callback", appOrigin);
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      callbackUrl.searchParams.set(key, value);
    }
    return NextResponse.redirect(callbackUrl);
  }

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public/") ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const { url, anonKey } = getSupabasePublicConfig();
  const response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const hasUser = Boolean(data.user?.id);
  if (hasUser) return response;

  if (pathname.startsWith("/api/")) {
    if (isPublicApiPath(pathname)) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/welcome", appOrigin));
  }

  const loginUrl = new URL("/login", appOrigin);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
