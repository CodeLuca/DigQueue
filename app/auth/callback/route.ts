import { NextResponse } from "next/server";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { ensureDefaultSourcesForUser } from "@/lib/default-sources";
import { resolvePostAuthRedirect } from "@/lib/post-auth";
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
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNext(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Missing OAuth callback code.")}`, appOrigin));
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, appOrigin));
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    const fallbackDestination = await resolvePostAuthRedirect(nextPath);
    return NextResponse.redirect(new URL(fallbackDestination, appOrigin));
  }
  const user = userData.user;
  if (user?.id) {
    try {
      await ensureDefaultSourcesForUser(user.id);
    } catch {
      // Non-blocking: OAuth callback should still complete even if source bootstrap fails.
    }
  }

  const destination = await resolvePostAuthRedirect(nextPath);
  return NextResponse.redirect(new URL(destination, appOrigin));
}
