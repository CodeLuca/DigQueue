import { NextResponse } from "next/server";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = resolveRequestAppOrigin(request);
  const nextPath = safeNext(requestUrl.searchParams.get("next"));
  const redirectTo = new URL("/auth/callback", appOrigin);
  redirectTo.searchParams.set("next", nextPath);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
    },
  });

  if (error || !data.url) {
    const loginUrl = new URL("/login", appOrigin);
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set("error", error?.message || "Google login failed.");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(data.url);
}
