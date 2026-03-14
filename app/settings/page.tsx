export const dynamic = "force-dynamic";

import Link from "next/link";
import { Disc3, ExternalLink } from "lucide-react";
import { AuthStartLink } from "@/components/auth-start-link";
import { ClientRouteRefreshBridge } from "@/components/client-route-refresh-bridge";
import { DiscogsConnectLink } from "@/components/discogs-connect-link";
import { IntegrationDisconnectButton } from "@/components/integration-disconnect-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaybackModeSettings } from "@/components/playback-mode-settings";
import { SignOutButton } from "@/components/sign-out-button";
import { getApiKeys } from "@/lib/api-keys";
import { sanitizeDiscogsConnectionErrorMessage } from "@/lib/discogs-errors";
import { buildOnboardingHealth } from "@/lib/onboarding-health";
import { parseDiscogsStoredAuth } from "@/lib/discogs-auth";
import { getDashboardData } from "@/lib/queries";
import { getYoutubeOAuthConnectionStatus } from "@/lib/youtube-oauth";

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
  const [dashboardData, youtubeOAuth] = await Promise.all([
    getDashboardData({ tab: "step-2" }),
    getYoutubeOAuthConnectionStatus(),
  ]);
  const sourceCount = dashboardData.labels.length;
  const activeSourceCount = dashboardData.labels.filter((label) => label.active).length;
  const onboardingHealth = buildOnboardingHealth({
    discogsConnected,
    youtubeOAuthConfigured: youtubeOAuth.configured,
    youtubeOAuthConnected: youtubeOAuth.connected,
    sourceCount,
    activeSourceCount,
    erroredSourceCount: dashboardData.metrics.labelsErrored,
    queueCount: dashboardData.queueCount,
  });
  const healthToneClass =
    onboardingHealth.tone === "ready"
      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
      : onboardingHealth.tone === "blocked"
        ? "border-rose-500/60 bg-rose-500/10 text-rose-200"
        : "border-amber-500/60 bg-amber-500/10 text-amber-200";

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
        <div className="mb-4 rounded-lg border border-emerald-500/50 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(16,185,129,0.08))] p-3 text-sm text-emerald-200">
          Discogs personal OAuth connected successfully.
        </div>
      ) : null}
      {discogsError ? (
        <div className="mb-4 rounded-lg border border-rose-500/50 bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(244,63,94,0.06))] p-3 text-sm text-rose-200">
          Discogs connect failed: {discogsError}
        </div>
      ) : null}
      <Card className="mb-4 overflow-hidden">
        <CardHeader className="border-b border-[var(--color-border)] bg-[linear-gradient(120deg,rgba(231,181,102,0.12),rgba(231,181,102,0.02))]">
          <CardTitle className="text-xl">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 md:p-5">
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <Badge className={healthToneClass}>{onboardingHealth.label}</Badge>
                <div>
                  <p className="text-sm font-semibold">{onboardingHealth.title}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{onboardingHealth.summary}</p>
                </div>
              </div>
              <div className="grid min-w-[200px] gap-2 text-xs text-[var(--color-muted)] sm:text-right">
                <p>Discogs: <span className="mono">{discogsConnected ? "connected" : "not connected"}</span></p>
                <p>Sources: <span className="mono">{sourceCount}</span></p>
                <p>Active sources: <span className="mono">{activeSourceCount}</span></p>
                <p>Queue-ready items: <span className="mono">{dashboardData.queueCount}</span></p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {onboardingHealth.nextSteps.map((step) => (
                <Link key={step.href + step.label} href={step.href}>
                  <Button type="button" size="sm" variant="outline">{step.label}</Button>
                </Link>
              ))}
              {onboardingHealth.optionalStep ? (
                <Link href={onboardingHealth.optionalStep.href}>
                  <Button type="button" size="sm" variant="ghost">{onboardingHealth.optionalStep.label}</Button>
                </Link>
              ) : null}
            </div>
          </section>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className={discogsConnected ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200" : "border-amber-600/50 text-amber-300"}>
              {discogsConnected ? "Discogs Personal Connected" : "Discogs Not Connected"}
            </Badge>
            <Badge className={youtubeOAuth.connected ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200" : "border-[var(--color-border)] text-[var(--color-muted)]"}>
              {youtubeOAuth.connected ? "YouTube Export Connected" : youtubeOAuth.configured ? "YouTube Export Optional" : "YouTube OAuth Not Configured"}
            </Badge>
          </div>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
            <p className="text-sm font-semibold">Discogs quick setup</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-[var(--color-muted)]">
              <li>Click Connect Discogs (below or in the guided page).</li>
              <li>Authorize in Discogs and return here automatically.</li>
              <li>Go to Listening Station and run “Retry wishlist sync now” once.</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              {discogsConnected ? (
                <span className="rounded-md border border-emerald-500/50 bg-emerald-500/12 px-3 py-1.5 text-xs text-emerald-200">
                  Discogs is connected. You can start pulling wishlist data now.
                </span>
              ) : (
                <DiscogsConnectLink
                  nextPath="/settings"
                  className="inline-flex items-center rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2 text-sm font-semibold !text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
                >
                  Open guided Discogs connect
                </DiscogsConnectLink>
              )}
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
              <p className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <Disc3 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                Discogs
              </p>
              <p className="text-sm">
                Status: <span className="mono">{discogsConnected ? "Connected (Personal OAuth)" : "Not connected"}</span>
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {discogsConnected
                  ? "Personal OAuth is linked to your account."
                  : "Not connected yet. Connect Discogs to link your personal account."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {discogsConnected ? (
                  <IntegrationDisconnectButton
                    provider="discogs"
                    label="Disconnect Discogs"
                    confirmMessage="Disconnect Discogs personal OAuth from this account?"
                  />
                ) : (
                  <AuthStartLink provider="discogs" nextPath="/settings" className="inline-flex items-center rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2 text-sm font-semibold !text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80">
                    Connect Discogs
                  </AuthStartLink>
                )}
              </div>
            </section>
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
                YouTube playlist export
              </p>
              <p className="text-sm">
                Status: <span className="mono">{youtubeOAuth.connected ? "Connected" : youtubeOAuth.configured ? "Available but not connected" : "Not configured"}</span>
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {youtubeOAuth.connected
                  ? `Connected${youtubeOAuth.channelTitle ? ` as ${youtubeOAuth.channelTitle}` : ""}. Playlist export from Library is ready.`
                  : youtubeOAuth.configured
                    ? "Optional. Connect YouTube only if you want to export a playlist from Library."
                    : "Optional feature. Add YouTube OAuth env vars if you want playlist export support in this deployment."}
              </p>
              {youtubeOAuth.connected ? (
                <div className="mt-3">
                  <IntegrationDisconnectButton
                    provider="youtube"
                    label="Disconnect YouTube"
                    confirmMessage="Disconnect YouTube playlist export from this account?"
                  />
                </div>
              ) : null}
            </section>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 overflow-hidden">
        <CardHeader className="border-b border-[var(--color-border)]">
          <CardTitle>Developer Links</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-5">
          <a
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-surface2)]"
            href="https://www.discogs.com/developers"
            target="_blank"
            rel="noreferrer"
          >
            Discogs developer docs
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>

      <Card className="mb-4 overflow-hidden">
        <CardHeader className="border-b border-[var(--color-border)]">
          <CardTitle>Data Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 md:p-5 text-sm">
          <p className="text-[var(--color-muted)]">Export queue and metadata snapshots.</p>
          <div className="flex flex-wrap gap-2">
            <a href="/api/export/csv" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-surface2)]">
              Export CSV
            </a>
            <a href="/api/export/json" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-surface2)]">
              Export JSON
            </a>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--color-border)]">
          <CardTitle>Legal + Playback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 md:p-5 text-sm">
          <p>This app does not download copyrighted audio. It only stores metadata and YouTube playback links.</p>
          <PlaybackModeSettings />
          <p>Keyboard shortcuts: <span className="mono">space</span> play/pause, <span className="mono">n</span> next, <span className="mono">b</span> previous, <span className="mono">l</span> focus label add.</p>
        </CardContent>
      </Card>
    </main>
  );
}
