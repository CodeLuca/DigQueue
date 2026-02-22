"use server";

import { revalidatePath } from "next/cache";
import { getApiKeys, setApiKeys } from "@/lib/api-keys";

export async function disconnectDiscogsAction() {
  const existing = await getApiKeys();
  await setApiKeys({
    discogsToken: "",
    youtubeApiKey: existing.youtubeApiKey || "",
  });
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/connect-discogs");
}

export async function clearApiKeysAction() {
  await setApiKeys({
    discogsToken: "",
    youtubeApiKey: "",
    youtubeOauthRefreshToken: "",
    youtubeOauthAccessToken: "",
    youtubeOauthExpiresAt: null,
    youtubeOauthScope: "",
    youtubeOauthChannelId: "",
    youtubeOauthChannelTitle: "",
  });
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/connect-discogs");
}

export async function disconnectYoutubeAction() {
  const existing = await getApiKeys();
  await setApiKeys({
    discogsToken: existing.discogsToken || "",
    youtubeApiKey: existing.youtubeApiKey || "",
    youtubeOauthRefreshToken: "",
    youtubeOauthAccessToken: "",
    youtubeOauthExpiresAt: null,
    youtubeOauthScope: "",
    youtubeOauthChannelId: "",
    youtubeOauthChannelTitle: "",
  });
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/connect-discogs");
}
