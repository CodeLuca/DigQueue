import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const getCurrentAppUserId = cache(async function getCurrentAppUserId() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    // Missing Supabase config should not crash public pages at build/prerender time.
    return null;
  }
});

export async function requireCurrentAppUserId() {
  const userId = await getCurrentAppUserId();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}
