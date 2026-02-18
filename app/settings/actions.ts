"use server";

import { revalidatePath } from "next/cache";
import { getApiKeys, setApiKeys } from "@/lib/api-keys";

function extractDiscogsToken(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const tokenParam = trimmed.match(/[?&]token=([A-Za-z0-9_-]+)/i);
  if (tokenParam) return tokenParam[1];
  const direct = trimmed.match(/(?:discogs[\s:_-]*token|token)[^A-Za-z0-9_-]*([A-Za-z0-9_-]{20,})/i);
  if (direct) return direct[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function extractYoutubeKey(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const keyParam = trimmed.match(/[?&]key=([A-Za-z0-9_-]+)/i);
  if (keyParam) return keyParam[1];
  const direct = trimmed.match(/(?:youtube[\s:_-]*key|api[\s:_-]*key|key)[^A-Za-z0-9_-]*([A-Za-z0-9_-]{20,})/i);
  if (direct) return direct[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return trimmed;
}

export async function saveApiKeysAction(formData: FormData) {
  const discogsToken = extractDiscogsToken(String(formData.get("discogsToken") || ""));
  const youtubeApiKey = extractYoutubeKey(String(formData.get("youtubeApiKey") || ""));
  const existing = await getApiKeys();

  await setApiKeys({
    discogsToken: discogsToken || existing.discogsToken || "",
    youtubeApiKey: youtubeApiKey || existing.youtubeApiKey || "",
  });

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function clearApiKeysAction() {
  await setApiKeys({ discogsToken: "", youtubeApiKey: "" });
  revalidatePath("/settings");
  revalidatePath("/");
}
