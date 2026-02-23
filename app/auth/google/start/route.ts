import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  if (!value) return "/?tab=step-2";
  if (!value.startsWith("/")) return "/?tab=step-2";
  if (value.startsWith("//")) return "/?tab=step-2";
  if (value.startsWith("/auth/")) return "/?tab=step-2";
  if (value.startsWith("/login")) return "/?tab=step-2";
  if (value.startsWith("/register")) return "/?tab=step-2";
  return value;
}

function resolveAppOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredOrigin && process.env.NODE_ENV === "production") {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      // Ignore invalid NEXT_PUBLIC_APP_URL and fall back to request origin.
    }
  }
  return requestUrl.origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = safeNext(requestUrl.searchParams.get("next"));
  const redirectTo = new URL("/auth/callback", resolveAppOrigin(request));
  redirectTo.searchParams.set("next", nextPath);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
    },
  });

  if (error || !data.url) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set("error", error?.message || "Google login failed.");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(data.url);
}
