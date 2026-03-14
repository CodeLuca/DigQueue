import { getCurrentAppUserId } from "@/lib/app-user";
import { getEffectiveApiKeys } from "@/lib/api-keys";
import { parseDiscogsStoredAuth } from "@/lib/discogs-auth";
import { buildOnboardingHealth, type OnboardingHealth } from "@/lib/onboarding-health";
import { getDashboardData } from "@/lib/queries";
import { getYoutubeOAuthConnectionStatus } from "@/lib/youtube-oauth";

export type OnboardingSnapshot = {
  health: OnboardingHealth;
  discogsConnected: boolean;
  youtubeOAuthConfigured: boolean;
  youtubeOAuthConnected: boolean;
  youtubeChannelTitle: string | null;
  sourceCount: number;
  activeSourceCount: number;
  erroredSourceCount: number;
  queueCount: number;
};

export async function getOnboardingSnapshot(): Promise<OnboardingSnapshot | null> {
  const userId = await getCurrentAppUserId();
  if (!userId) return null;

  const [keys, dashboardData, youtubeOAuth] = await Promise.all([
    getEffectiveApiKeys(),
    getDashboardData({ tab: "step-2" }),
    getYoutubeOAuthConnectionStatus(),
  ]);
  const discogsConnected = parseDiscogsStoredAuth(keys.discogsToken)?.kind === "oauth";
  const sourceCount = dashboardData.labels.length;
  const activeSourceCount = dashboardData.labels.filter((label) => label.active).length;
  const erroredSourceCount = dashboardData.metrics.labelsErrored;
  const queueCount = dashboardData.queueCount;

  return {
    health: buildOnboardingHealth({
      discogsConnected,
      youtubeOAuthConfigured: youtubeOAuth.configured,
      youtubeOAuthConnected: youtubeOAuth.connected,
      sourceCount,
      activeSourceCount,
      erroredSourceCount,
      queueCount,
    }),
    discogsConnected,
    youtubeOAuthConfigured: youtubeOAuth.configured,
    youtubeOAuthConnected: youtubeOAuth.connected,
    youtubeChannelTitle: youtubeOAuth.channelTitle ?? null,
    sourceCount,
    activeSourceCount,
    erroredSourceCount,
    queueCount,
  };
}

export function getOnboardingToneClass(tone: OnboardingHealth["tone"]) {
  return tone === "ready"
    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
    : tone === "blocked"
      ? "border-rose-500/60 bg-rose-500/10 text-rose-200"
      : "border-amber-500/60 bg-amber-500/10 text-amber-200";
}
