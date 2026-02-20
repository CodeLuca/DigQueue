import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

export async function isGoogleOAuthAvailable() {
  try {
    const { url, anonKey } = getSupabasePublicConfig();
    const probe = new URL("/auth/v1/authorize", url);
    probe.searchParams.set("provider", "google");
    probe.searchParams.set("redirect_to", "https://example.com/auth/callback");

    const res = await fetch(probe.toString(), {
      method: "GET",
      headers: { apikey: anonKey },
      redirect: "manual",
      cache: "no-store",
    });

    // 3xx means Supabase could initiate OAuth handshake.
    if (res.status >= 300 && res.status < 400) return true;

    // Current Supabase behavior for disabled/misconfigured provider is 400.
    if (res.status >= 400) return false;
  } catch {
    return false;
  }

  return false;
}
