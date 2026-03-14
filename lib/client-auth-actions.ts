"use client";

import type { ClientFetcher } from "@/lib/client-fetcher";
import {
  normalizeAuthRedirectResponse,
  normalizePasswordResetNoticeResponse,
  type AuthRedirectResponse,
  type PasswordResetNoticeResponse,
} from "@/lib/auth-mutation-contract";
import { postClientMutation } from "@/lib/client-mutations";

export async function loginWithPasswordClient(
  payload: { email: string; password: string; next?: string | null },
  options?: { fetcher?: ClientFetcher },
) {
  const body = await postClientMutation<
    AuthRedirectResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    "/api/auth/login",
    payload,
    { ...options, errorMessage: "Login failed." },
  );
  return normalizeAuthRedirectResponse(body, payload.next || "/");
}

export async function registerWithPasswordClient(
  payload: { email: string; password: string; confirmPassword: string; next?: string | null },
  options?: { fetcher?: ClientFetcher },
) {
  const body = await postClientMutation<
    AuthRedirectResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    "/api/auth/register",
    payload,
    { ...options, errorMessage: "Registration failed." },
  );
  return normalizeAuthRedirectResponse(body, payload.next || "/");
}

export async function requestPasswordResetClient(
  payload: { email: string },
  options?: { fetcher?: ClientFetcher },
) {
  const body = await postClientMutation<
    PasswordResetNoticeResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    "/api/auth/password-reset/request",
    payload,
    { ...options, errorMessage: "Password reset request failed." },
  );
  return normalizePasswordResetNoticeResponse(
    body,
    "Password reset email sent. Open the link in that email to continue.",
  );
}

export async function completePasswordResetClient(
  payload: { password: string; confirmPassword: string },
  options?: { fetcher?: ClientFetcher },
) {
  const body = await postClientMutation<
    AuthRedirectResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    "/api/auth/password-reset/complete",
    payload,
    { ...options, errorMessage: "Password update failed." },
  );
  return normalizeAuthRedirectResponse(body, "/login");
}
