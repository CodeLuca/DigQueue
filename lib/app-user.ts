import { cache } from "react";
import { NextResponse } from "next/server";
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

export async function requireRouteUserId() {
  const userId = await getCurrentAppUserId();
  if (!userId) {
    return {
      userId: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    userId,
    response: null,
  };
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof Error && error.message === "Unauthorized";
}
