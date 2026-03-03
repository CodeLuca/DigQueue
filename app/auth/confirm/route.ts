import { NextResponse } from "next/server";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { normalizeNextPath } from "@/lib/next-path";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = resolveRequestAppOrigin(request);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const code = requestUrl.searchParams.get("code");
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"), { fallback: "/" });

  const supabase = await getSupabaseServerClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "email" | "recovery" | "invite" | "email_change",
    });
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, appOrigin));
    }
    return NextResponse.redirect(new URL(nextPath, appOrigin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, appOrigin));
    }
    return NextResponse.redirect(new URL(nextPath, appOrigin));
  }

  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Invalid confirmation link.")}`, appOrigin));
}
