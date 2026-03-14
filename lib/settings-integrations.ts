import { getApiKeys, setApiKeys } from "@/lib/api-keys";
import { disconnectYoutubeOAuth } from "@/lib/youtube-oauth";

export type SettingsIntegrationProvider = "discogs" | "youtube";

export async function disconnectDiscogsForCurrentUser() {
  const existing = await getApiKeys();
  await setApiKeys({
    discogsToken: "",
    youtubeApiKey: existing.youtubeApiKey || "",
  });
}

export async function disconnectYoutubeForCurrentUser() {
  await disconnectYoutubeOAuth();
}

export async function disconnectIntegrationForCurrentUser(provider: SettingsIntegrationProvider) {
  if (provider === "discogs") {
    await disconnectDiscogsForCurrentUser();
    return provider;
  }

  await disconnectYoutubeForCurrentUser();
  return provider;
}
