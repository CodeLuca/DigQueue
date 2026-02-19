import { env } from "@/lib/env";

export type SupabaseTarget = "local" | "production";

function inferTarget(): SupabaseTarget {
  if (env.SUPABASE_ENV) return env.SUPABASE_ENV;
  return process.env.NODE_ENV === "production" ? "production" : "local";
}

function required(value: string | undefined, name: string, target: SupabaseTarget) {
  if (!value) {
    throw new Error(`Missing ${name} for Supabase target '${target}'.`);
  }
  return value;
}

export function getSupabaseTarget(): SupabaseTarget {
  return inferTarget();
}

export function getSupabasePublicConfig() {
  const target = inferTarget();
  if (target === "local") {
    const localUrl = env.NEXT_PUBLIC_SUPABASE_URL_LOCAL;
    const localAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL;
    return {
      target,
      // Local mode can use local CLI keys or fall back to the default project keys.
      url: required(
        localUrl || env.NEXT_PUBLIC_SUPABASE_URL,
        localUrl ? "NEXT_PUBLIC_SUPABASE_URL_LOCAL" : "NEXT_PUBLIC_SUPABASE_URL",
        target,
      ),
      anonKey: required(
        localAnonKey || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        localAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL" : "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        target,
      ),
    };
  }

  return {
    target,
    url: required(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL", target),
    anonKey: required(env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY", target),
  };
}

export function getSupabaseServiceRoleKey() {
  const target = inferTarget();
  if (target === "local") {
    return required(
      env.SUPABASE_SERVICE_ROLE_KEY_LOCAL || env.SUPABASE_SERVICE_ROLE_KEY,
      env.SUPABASE_SERVICE_ROLE_KEY_LOCAL ? "SUPABASE_SERVICE_ROLE_KEY_LOCAL" : "SUPABASE_SERVICE_ROLE_KEY",
      target,
    );
  }
  return required(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY", target);
}
