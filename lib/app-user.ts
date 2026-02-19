import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentAppUserId() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function requireCurrentAppUserId() {
  const userId = await getCurrentAppUserId();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}
