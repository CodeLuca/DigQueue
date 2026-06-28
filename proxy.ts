import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const PUBLIC_PATHS = new Set([
  "/welcome",
  "/login",
  "/register",
  "/connect-discogs",
  "/how-to-use",
  "/auth/callback",
  "/auth/confirm",
  "/auth/google/start",
  "/reset-password",
]);
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/discogs/oauth",
  "/api/youtube/oauth",
] as const;

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

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const appOrigin = resolveRequestAppOrigin(request);

  // Some OAuth configurations may return the auth code to "/".
  // Always funnel this through our dedicated callback handler.
  if (pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const callbackUrl = new URL("/auth/callback", appOrigin);
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      callbackUrl.searchParams.set(key, value);
    }
    return withNoStore(NextResponse.redirect(callbackUrl));
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
  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));

  let hasUser = false;
  let authCheckFailed = false;
  if (hasAuthCookie) {
    try {
      const { data, error } = await supabase.auth.getUser();
      hasUser = Boolean(data.user?.id);
      authCheckFailed = Boolean(error);
    } catch {
      authCheckFailed = true;
    }
  }

  if (authCheckFailed && hasAuthCookie) {
    // Avoid random logout redirects when upstream auth validation flakes.
    // Route handlers/pages will still enforce auth as needed.
    return withNoStore(response);
  }

  if (hasUser) return withNoStore(response);

  if (pathname.startsWith("/api/")) {
    if (isPublicApiPath(pathname)) return NextResponse.next();
    return withNoStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  if (isPublicPath(pathname)) return withNoStore(NextResponse.next());

  if (pathname === "/") {
    return withNoStore(NextResponse.redirect(new URL("/welcome", appOrigin)));
  }

  const loginUrl = new URL("/login", appOrigin);
  loginUrl.searchParams.set("next", pathname + search);
  return withNoStore(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
