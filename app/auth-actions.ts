"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isGoogleOAuthAvailable } from "@/lib/supabase/google-oauth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

function withAuthQuery(path: string, params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function friendlyAuthError(message: string, fallback: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Invalid email or password.";
  if (lower.includes("email rate limit exceeded")) return "Too many requests. Wait a moment and try again.";
  if (lower.includes("unsupported provider")) return "Google login is not available right now.";
  if (lower.includes("missing oauth client id")) return "Google login is not configured yet.";
  if (lower.includes("is invalid")) return "Please enter a valid email address.";
  return message || fallback;
}

export async function loginWithPasswordAction(formData: FormData) {
  const nextPath = safeNext(formData.get("next"));
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect(withAuthQuery("/login", { next: nextPath, error: "Email and password are required." }));
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirect(withAuthQuery("/login", { next: nextPath, email, error: friendlyAuthError(error?.message || "", "Login failed.") }));
  }
  redirect(nextPath);
}

export async function registerWithPasswordAction(formData: FormData) {
  const nextPath = safeNext(formData.get("next"));
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!email || !password) {
    redirect(withAuthQuery("/register", { next: nextPath, error: "Email and password are required." }));
  }
  if (password.length < 8) {
    redirect(withAuthQuery("/register", { next: nextPath, error: "Password must be at least 8 characters." }));
  }
  if (password !== confirmPassword) {
    redirect(withAuthQuery("/register", { next: nextPath, error: "Passwords do not match." }));
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const message = friendlyAuthError(error.message || "", "Registration failed.");
    if (/already registered|user already exists|already been registered/i.test(message)) {
      redirect(withAuthQuery("/login", {
        next: nextPath,
        email,
        notice: "Account already exists. Login instead.",
      }));
    }
    redirect(withAuthQuery("/register", { next: nextPath, email, error: message }));
  }

  if (data.session?.user) {
    redirect(nextPath);
  }

  // When email confirmation is required, Supabase may create a user without an active session.
  redirect(withAuthQuery("/login", {
    next: nextPath,
    email,
    notice: "Account created. Check your email to confirm, then login.",
  }));
}

export async function loginWithGoogleAction(formData: FormData) {
  const nextPath = safeNext(formData.get("next"));
  const googleAvailable = await isGoogleOAuthAvailable();
  if (!googleAvailable) {
    redirect(withAuthQuery("/login", { next: nextPath, error: "Google login is unavailable. Use email/password for now." }));
  }

  const supabase = await getSupabaseServerClient();
  const headersStore = await headers();
  const host = headersStore.get("x-forwarded-host") || headersStore.get("host") || "127.0.0.1:3000";
  const proto = headersStore.get("x-forwarded-proto") || (host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https");
  const redirectTo = new URL("/auth/callback", `${proto}://${host}`);
  redirectTo.searchParams.set("next", nextPath);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
    },
  });

  if (error || !data.url) {
    redirect(withAuthQuery("/login", { next: nextPath, error: friendlyAuthError(error?.message || "", "Google login failed.") }));
  }
  redirect(data.url);
}

export async function clearSessionAction() {
  try {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Keep logout resilient even if Supabase is unavailable.
  }

  redirect("/login");
}
