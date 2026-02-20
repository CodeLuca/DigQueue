import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNext(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Missing OAuth callback code.")}`, requestUrl.origin));
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin));
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(userError.message)}`, requestUrl.origin));
  }
  const user = userData.user;
  if (!user?.id || !user?.email) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Unable to resolve user session.")}`, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
