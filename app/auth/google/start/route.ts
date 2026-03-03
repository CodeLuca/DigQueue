import { NextResponse } from "next/server";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { normalizeNextPath } from "@/lib/next-path";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = resolveRequestAppOrigin(request);
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"), {
    fallback: "/?tab=step-2",
    blockAuthEntrypoints: true,
  });
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
