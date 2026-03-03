"use server";

import { redirect } from "next/navigation";
import { resolveHeaderAppOrigin } from "@/lib/app-origin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureDefaultSourcesForUser } from "@/lib/default-sources";
import { normalizeNextPath } from "@/lib/next-path";
import { resolvePostAuthRedirect } from "@/lib/post-auth";

const MIN_PASSWORD_LENGTH = 6;

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
  if (lower.includes("password should be at least")) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  return message || fallback;
}

export async function loginWithPasswordAction(formData: FormData) {
  const nextPath = normalizeNextPath(formData.get("next"), {
    fallback: "/?tab=step-2",
    blockAuthEntrypoints: true,
  });
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
  try {
    await ensureDefaultSourcesForUser(data.user.id);
  } catch {
    // Non-blocking: login should still work if bootstrap source insert fails.
  }
  const destination = await resolvePostAuthRedirect(nextPath);
  redirect(destination);
}

export async function registerWithPasswordAction(formData: FormData) {
  const nextPath = normalizeNextPath(formData.get("next"), {
    fallback: "/?tab=step-2",
    blockAuthEntrypoints: true,
  });
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!email || !password) {
    redirect(withAuthQuery("/login", { mode: "register", next: nextPath, error: "Email and password are required." }));
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect(withAuthQuery("/login", { mode: "register", next: nextPath, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }));
  }
  if (password !== confirmPassword) {
    redirect(withAuthQuery("/login", { mode: "register", next: nextPath, error: "Passwords do not match." }));
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const message = friendlyAuthError(error.message || "", "Registration failed.");
    if (/already registered|user already exists|already been registered/i.test(message)) {
      const existingSignIn = await supabase.auth.signInWithPassword({ email, password });
      if (!existingSignIn.error && existingSignIn.data.user) {
        try {
          await ensureDefaultSourcesForUser(existingSignIn.data.user.id);
        } catch {
          // Non-blocking: login should still proceed.
        }
        const destination = await resolvePostAuthRedirect(nextPath);
        redirect(destination);
      }
      redirect(withAuthQuery("/login", {
        next: nextPath,
        email,
        error: "Account already exists. Use the correct password to login.",
      }));
    }
    redirect(withAuthQuery("/login", { mode: "register", next: nextPath, email, error: message }));
  }

  if (data.session?.user) {
    try {
      await ensureDefaultSourcesForUser(data.session.user.id);
    } catch {
      // Non-blocking: account creation should still complete if source bootstrap fails.
    }
    const destination = await resolvePostAuthRedirect(nextPath);
    redirect(destination);
  }

  // Fallback: if signUp did not return a session, immediately attempt sign-in so registration logs in by default.
  const signInResult = await supabase.auth.signInWithPassword({ email, password });
  if (signInResult.error || !signInResult.data.user) {
    redirect(withAuthQuery("/login", {
      next: nextPath,
      email,
      notice: "Account created. Login once to continue.",
    }));
  }
  try {
    await ensureDefaultSourcesForUser(signInResult.data.user.id);
  } catch {
    // Non-blocking: account creation should still complete if source bootstrap fails.
  }
  const destination = await resolvePostAuthRedirect(nextPath);
  redirect(destination);
}

export async function loginWithGoogleAction(formData: FormData) {
  const nextPath = normalizeNextPath(formData.get("next"), {
    fallback: "/?tab=step-2",
    blockAuthEntrypoints: true,
  });

  const supabase = await getSupabaseServerClient();
  const redirectTo = new URL("/auth/callback", await resolveHeaderAppOrigin());
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

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!email) {
    redirect(withAuthQuery("/login", { error: "Email is required for password reset." }));
  }

  const supabase = await getSupabaseServerClient();
  const confirmUrl = new URL("/auth/confirm", await resolveHeaderAppOrigin());
  confirmUrl.searchParams.set("next", "/reset-password");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: confirmUrl.toString(),
  });

  if (error) {
    redirect(withAuthQuery("/login", { email, error: friendlyAuthError(error.message || "", "Password reset request failed.") }));
  }

  redirect(withAuthQuery("/login", {
    email,
    notice: "Password reset email sent. Open the link in that email to continue.",
  }));
}

export async function completePasswordResetAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!password || !confirmPassword) {
    redirect(withAuthQuery("/reset-password", { error: "Both password fields are required." }));
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect(withAuthQuery("/reset-password", { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }));
  }
  if (password !== confirmPassword) {
    redirect(withAuthQuery("/reset-password", { error: "Passwords do not match." }));
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error || !data.user) {
    redirect(withAuthQuery("/reset-password", { error: friendlyAuthError(error?.message || "", "Password update failed.") }));
  }

  await supabase.auth.signOut();
  redirect(withAuthQuery("/login", { notice: "Password updated. Login with your new password." }));
}
