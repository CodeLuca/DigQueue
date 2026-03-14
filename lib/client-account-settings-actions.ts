"use client";

import type { ClientFetcher } from "@/lib/client-fetcher";
import {
  buildIntegrationDisconnectResponse,
  normalizeAuthRedirectResponse,
  normalizeIntegrationDisconnectResponse,
  type AuthRedirectResponse,
  type IntegrationDisconnectResponse,
  type IntegrationProvider,
} from "@/lib/auth-mutation-contract";
import { fetchRequiredClientJson } from "@/lib/client-json";
import { postClientMutation } from "@/lib/client-mutations";

export type ApiKeyTestResult = {
  discogs: { ok: boolean; message: string };
  youtube: { ok: boolean; message: string };
};

export type YoutubePlaylistExportResult = {
  ok?: boolean;
  error?: string;
  playlistUrl?: string;
  added?: number;
  attempted?: number;
  totalEligible?: number;
  skippedByLimit?: number;
};

export async function clearSessionClient(options?: { fetcher?: ClientFetcher }) {
  const body = await postClientMutation<
    AuthRedirectResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    "/api/auth/logout",
    undefined,
    { ...options, errorMessage: "Sign out failed." },
  );
  return normalizeAuthRedirectResponse(body, "/login");
}

export async function testApiKeysClient(options?: { fetcher?: ClientFetcher }) {
  return fetchRequiredClientJson<ApiKeyTestResult>(
    "/api/settings/keys/test",
    undefined,
    { ...options, errorMessage: "Key test failed." },
  );
}

export async function exportYoutubePlaylistClient(
  payload: { title: string; visibility: "private" | "unlisted" | "public" },
  options?: { fetcher?: ClientFetcher },
) {
  return postClientMutation<YoutubePlaylistExportResult>(
    "/api/youtube/playlist/export",
    payload,
    { ...options, errorMessage: "Playlist export failed." },
  );
}

export async function disconnectIntegrationClient(
  provider: IntegrationProvider,
  options?: { fetcher?: ClientFetcher },
) {
  const body = await postClientMutation<
    IntegrationDisconnectResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    "/api/settings/integrations",
    buildIntegrationDisconnectResponse(provider),
    { ...options, errorMessage: `Failed to disconnect ${provider}.` },
  );
  return normalizeIntegrationDisconnectResponse(body, provider).provider;
}
