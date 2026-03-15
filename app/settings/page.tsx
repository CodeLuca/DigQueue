export const dynamic = "force-dynamic";

import { Disc3, ExternalLink } from "lucide-react";
import { ActionLink } from "@/components/action-link";
import { ApiKeyTester } from "@/components/api-key-tester";
import { AuthStartLink } from "@/components/auth-start-link";
import { ClientRouteRefreshBridge } from "@/components/client-route-refresh-bridge";
import { DiscogsConnectLink } from "@/components/discogs-connect-link";
import { FeedbackBanner } from "@/components/feedback-banner";
import { InstructionList } from "@/components/instruction-list";
import { IntegrationDisconnectButton } from "@/components/integration-disconnect-button";
import { OnboardingStatusCard } from "@/components/onboarding-status-card";
import { PlaybackModeSettings } from "@/components/playback-mode-settings";
import { SettingsSectionCard } from "@/components/settings-section-card";
import { SignOutButton } from "@/components/sign-out-button";
import { SupportPanel } from "@/components/support-panel";
import { YoutubeKeyFixAssistant } from "@/components/youtube-key-fix-assistant";
import { getApiKeys } from "@/lib/api-keys";
import { sanitizeDiscogsConnectionErrorMessage } from "@/lib/discogs-errors";
import { getOnboardingSnapshot } from "@/lib/onboarding-snapshot";
import { parseDiscogsStoredAuth } from "@/lib/discogs-auth";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ discogs?: string; discogs_error?: string }>;
}) {
  const params = await searchParams;
  const savedKeys = await getApiKeys();
  const discogsSavedAuth = parseDiscogsStoredAuth(savedKeys.discogsToken);
  const discogsConnected = discogsSavedAuth?.kind === "oauth";
  const discogsError = sanitizeDiscogsConnectionErrorMessage(params.discogs_error);
  const onboardingSnapshot = await getOnboardingSnapshot();
  const youtubeOAuthConfigured = onboardingSnapshot?.youtubeOAuthConfigured ?? false;
  const youtubeOAuthConnected = onboardingSnapshot?.youtubeOAuthConnected ?? false;
  const youtubeChannelTitle = onboardingSnapshot?.youtubeChannelTitle ?? null;

  return (
    <main className="pb-player-safe mx-auto max-w-[980px] px-3 py-5 sm:px-4 md:px-8 md:py-6">
      <ClientRouteRefreshBridge />
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-[var(--color-muted)]">Control integrations, exports, and playback behavior without breaking your digging flow.</p>
        </div>
        <div className="w-full sm:w-auto">
          <SignOutButton />
        </div>
      </header>

      {params.discogs === "connected" ? (
        <FeedbackBanner tone="success" emphasis="gradient" className="mb-4 rounded-lg py-3">
          Discogs personal OAuth connected successfully.
        </FeedbackBanner>
      ) : null}
      {discogsError ? (
        <FeedbackBanner tone="error" emphasis="gradient" className="mb-4 rounded-lg py-3">
          Discogs connect failed: {discogsError}
        </FeedbackBanner>
      ) : null}
      <SettingsSectionCard
        title="Integrations"
        className="mb-4"
        headerClassName="border-b border-[var(--color-border)] bg-[linear-gradient(120deg,rgba(231,181,102,0.12),rgba(231,181,102,0.02))]"
        contentClassName="space-y-4 p-4 md:p-5"
      >
        {onboardingSnapshot ? (
          <OnboardingStatusCard
            snapshot={onboardingSnapshot}
            title="Current Setup"
            className="border-[var(--color-border)] bg-[var(--color-surface2)]"
            showConnectionBadges
            summaryClassName="text-xs text-[var(--color-muted)]"
            statsClassName="grid min-w-[200px] gap-2 text-xs text-[var(--color-muted)] sm:text-right"
          />
        ) : null}

        <SupportPanel
          title="Discogs quick setup"
          actions={
            discogsConnected ? (
              <span className="rounded-md border border-emerald-500/50 bg-emerald-500/12 px-3 py-1.5 text-xs text-emerald-200">
                Discogs is connected. You can start pulling wishlist data now.
              </span>
            ) : (
              <DiscogsConnectLink
                nextPath="/settings"
                highlighted
              >
                Open guided Discogs connect
              </DiscogsConnectLink>
            )
          }
        >
          <InstructionList
            items={[
              "Click Connect Discogs below or open the guided page.",
              "Authorize in Discogs and return here automatically.",
              "Go to Listening Station and run Retry wishlist sync now once.",
            ]}
          />
        </SupportPanel>

        <div className="grid gap-3 md:grid-cols-2">
          <SupportPanel
            eyebrow={
              <>
                <Disc3 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                Discogs
              </>
            }
            status={<>Status: <span className="mono">{discogsConnected ? "Connected (Personal OAuth)" : "Not connected"}</span></>}
            description={
              discogsConnected
                ? "Personal OAuth is linked to your account."
                : "Not connected yet. Connect Discogs to link your personal account."
            }
            actions={
              discogsConnected ? (
                <IntegrationDisconnectButton
                  provider="discogs"
                  label="Disconnect Discogs"
                  confirmMessage="Disconnect Discogs personal OAuth from this account?"
                />
              ) : (
                <AuthStartLink provider="discogs" nextPath="/settings" highlighted>
                  Connect Discogs
                </AuthStartLink>
              )
            }
          />
          <SupportPanel
            eyebrow="YouTube playlist export"
            status={<>Status: <span className="mono">{youtubeOAuthConnected ? "Connected" : youtubeOAuthConfigured ? "Available but not connected" : "Not configured"}</span></>}
            description={
              youtubeOAuthConnected
                ? `Connected${youtubeChannelTitle ? ` as ${youtubeChannelTitle}` : ""}. Playlist export from Library is ready.`
                : youtubeOAuthConfigured
                  ? "Optional. Connect YouTube only if you want to export a playlist from Library."
                  : "Optional feature. Add YouTube OAuth env vars if you want playlist export support in this deployment."
            }
            actions={
              youtubeOAuthConnected ? (
                <IntegrationDisconnectButton
                  provider="youtube"
                  label="Disconnect YouTube"
                  confirmMessage="Disconnect YouTube playlist export from this account?"
                />
              ) : null
            }
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Diagnostics"
        description="Verify the current deployment wiring and resolve YouTube API restrictions without leaving the setup flow."
        className="mb-4"
        contentClassName="space-y-4 p-4 md:p-5"
      >
        <SupportPanel
          title="Connection diagnostics"
          description="Runs live checks against the current deployment so you can confirm Discogs and YouTube configuration before debugging anything else."
          actions={<ApiKeyTester />}
        />
        <YoutubeKeyFixAssistant />
      </SettingsSectionCard>

      <SettingsSectionCard title="Developer Links" className="mb-4" contentClassName="p-4 md:p-5">
        <ActionLink
          href="https://www.discogs.com/developers"
          target="_blank"
          rel="noreferrer"
          className="gap-2 px-3 py-2"
        >
          Discogs developer docs
          <ExternalLink className="h-3.5 w-3.5" />
        </ActionLink>
      </SettingsSectionCard>

      <SettingsSectionCard title="Data Export" className="mb-4" contentClassName="space-y-3 p-4 md:p-5 text-sm">
        <p className="text-[var(--color-muted)]">Export queue and metadata snapshots.</p>
        <div className="flex flex-wrap gap-2">
          <ActionLink href="/api/export/csv" className="px-3 py-1.5 text-xs">
            Export CSV
          </ActionLink>
          <ActionLink href="/api/export/json" className="px-3 py-1.5 text-xs">
            Export JSON
          </ActionLink>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="Legal + Playback" contentClassName="space-y-2 p-4 md:p-5 text-sm">
        <p>This app does not download copyrighted audio. It only stores metadata and YouTube playback links.</p>
        <PlaybackModeSettings />
        <p>Keyboard shortcuts: <span className="mono">space</span> play/pause, <span className="mono">n</span> next, <span className="mono">b</span> previous, <span className="mono">l</span> focus label add.</p>
      </SettingsSectionCard>
    </main>
  );
}
