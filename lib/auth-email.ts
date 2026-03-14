import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveHeaderAppOrigin } from "@/lib/app-origin";
import {
  buildAuthRedirectResponse,
  buildPasswordResetNoticeResponse,
  type AuthRedirectResponse,
  type PasswordResetNoticeResponse,
} from "@/lib/auth-mutation-contract";
import { ensureDefaultSourcesForUser } from "@/lib/default-sources";
import { normalizeNextPath } from "@/lib/next-path";
import { resolvePostAuthRedirect } from "@/lib/post-auth";

export const MIN_PASSWORD_LENGTH = 6;

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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function resolveEmailAuthNextPath(value: unknown) {
  return normalizeNextPath(value, {
    fallback: "/?tab=step-2",
    blockAuthEntrypoints: true,
  });
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
  next?: string | null;
}): Promise<AuthRedirectResponse> {
  const nextPath = resolveEmailAuthNextPath(input.next);
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(friendlyAuthError(error?.message || "", "Login failed."));
  }
  try {
    await ensureDefaultSourcesForUser(data.user.id);
  } catch {
    // Non-blocking: login should still work if bootstrap source insert fails.
  }
  return buildAuthRedirectResponse(await resolvePostAuthRedirect(nextPath));
}

export async function registerWithPassword(input: {
  email: string;
  password: string;
  confirmPassword: string;
  next?: string | null;
}): Promise<AuthRedirectResponse> {
  const nextPath = resolveEmailAuthNextPath(input.next);
  const email = normalizeEmail(input.email);
  const password = input.password;
  const confirmPassword = input.confirmPassword;

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
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
        return buildAuthRedirectResponse(await resolvePostAuthRedirect(nextPath));
      }
      throw new Error("Account already exists. Use the correct password to login.");
    }
    throw new Error(message);
  }

  if (data.session?.user) {
    try {
      await ensureDefaultSourcesForUser(data.session.user.id);
    } catch {
      // Non-blocking: account creation should still complete if source bootstrap fails.
    }
    return buildAuthRedirectResponse(await resolvePostAuthRedirect(nextPath));
  }

  const signInResult = await supabase.auth.signInWithPassword({ email, password });
  if (signInResult.error || !signInResult.data.user) {
    return buildAuthRedirectResponse(
      `/login?notice=${encodeURIComponent("Account created. Login once to continue.")}`,
    );
  }
  try {
    await ensureDefaultSourcesForUser(signInResult.data.user.id);
  } catch {
    // Non-blocking: account creation should still complete if source bootstrap fails.
  }
  return buildAuthRedirectResponse(await resolvePostAuthRedirect(nextPath));
}

export async function requestPasswordReset(input: { email: string }): Promise<PasswordResetNoticeResponse> {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("Email is required for password reset.");
  }

  const supabase = await getSupabaseServerClient();
  const confirmUrl = new URL("/auth/confirm", await resolveHeaderAppOrigin());
  confirmUrl.searchParams.set("next", "/reset-password");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: confirmUrl.toString(),
  });

  if (error) {
    throw new Error(friendlyAuthError(error.message || "", "Password reset request failed."));
  }

  return buildPasswordResetNoticeResponse(
    "Password reset email sent. Open the link in that email to continue.",
  );
}

export async function completePasswordReset(input: {
  password: string;
  confirmPassword: string;
}): Promise<AuthRedirectResponse> {
  const password = input.password;
  const confirmPassword = input.confirmPassword;

  if (!password || !confirmPassword) {
    throw new Error("Both password fields are required.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error || !data.user) {
    throw new Error(friendlyAuthError(error?.message || "", "Password update failed."));
  }

  await supabase.auth.signOut();
  return buildAuthRedirectResponse(
    "/login?notice=Password%20updated.%20Login%20with%20your%20new%20password.",
  );
}

export async function clearCurrentSession(): Promise<AuthRedirectResponse> {
  try {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Keep logout resilient even if Supabase is unavailable.
  }
  return buildAuthRedirectResponse("/login");
}
