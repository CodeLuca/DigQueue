export const dynamic = "force-dynamic";

import { Disc3, ExternalLink, Youtube } from "lucide-react";
import { clearSessionAction } from "@/app/auth-actions";
import { clearApiKeysAction, disconnectDiscogsAction, disconnectYoutubeAction } from "@/app/settings/actions";
import { ApiKeyTester } from "@/components/api-key-tester";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaybackModeSettings } from "@/components/playback-mode-settings";
import { getApiKeys, getEffectiveApiKeys, maskSecret } from "@/lib/api-keys";
import { parseDiscogsStoredAuth } from "@/lib/discogs-auth";
import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getYoutubeOAuthConnectionStatus } from "@/lib/youtube-oauth";

function sanitizeDiscogsErrorMessage(message: string | undefined) {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (
    lower.includes("failed query:") ||
    lower.includes("params:") ||
    lower.includes("circuit breaker open") ||
    lower.includes("unable to establish connection to upstream database") ||
    lower.includes("getaddrinfo enotfound")
  ) {
    return "Temporary database connectivity issue while saving Discogs connection. Please retry.";
  }
  return message;
}

function sanitizeYoutubeErrorMessage(message: string | undefined) {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (lower.includes("failed query:") || lower.includes("params:") || lower.includes("database")) {
    return "Temporary database issue while saving YouTube connection. Please retry.";
  }
  if (lower.includes("not configured")) {
    return "YouTube OAuth is not configured for this deployment yet.";
  }
  return message;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ discogs?: string; discogs_error?: string; youtube?: string; youtube_error?: string }>;
}) {
  const params = await searchParams;
  const savedKeys = await getApiKeys();
  const effectiveKeys = await getEffectiveApiKeys();
  const youtubeOAuth = await getYoutubeOAuthConnectionStatus();
  const supabase = await getSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const provider = String(authData.user?.app_metadata?.provider || "").toLowerCase();
  const signInMethod = provider === "google" ? "Google" : provider === "email" || !provider ? "Email/Password" : provider;
  const savedYoutubeKey = savedKeys.youtubeApiKey || env.YOUTUBE_API_KEY || null;
  const discogsSavedAuth = parseDiscogsStoredAuth(savedKeys.discogsToken);
  const discogsConnected = discogsSavedAuth?.kind === "oauth" || Boolean(effectiveKeys.discogsToken);
  const discogsMode =
    discogsSavedAuth?.kind === "oauth"
      ? "Personal OAuth"
      : effectiveKeys.discogsToken
        ? "Workspace Token"
        : "Not connected";
  const discogsError = sanitizeDiscogsErrorMessage(params.discogs_error);
  const youtubeError = sanitizeYoutubeErrorMessage(params.youtube_error);

  return (
    <main className="mx-auto max-w-[980px] px-4 py-6 md:px-8">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-[var(--color-muted)]">Control integrations, exports, and playback behavior without breaking your digging flow.</p>
        </div>
        <form action={clearSessionAction}>
          <Button type="submit" variant="outline" className="px-3 py-1.5 text-xs">Sign Out</Button>
        </form>
      </header>

      {params.discogs === "connected" ? (
        <div className="mb-4 rounded-lg border border-emerald-500/50 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(16,185,129,0.08))] p-3 text-sm text-emerald-200">
          Discogs connected successfully. Wishlist pull and sync are now linked to this account.
        </div>
      ) : null}
      {discogsError ? (
        <div className="mb-4 rounded-lg border border-rose-500/50 bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(244,63,94,0.06))] p-3 text-sm text-rose-200">
          Discogs connect failed: {discogsError}
        </div>
      ) : null}
      {params.youtube === "connected" ? (
        <div className="mb-4 rounded-lg border border-emerald-500/50 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(16,185,129,0.08))] p-3 text-sm text-emerald-200">
          YouTube connected successfully. Library saved tracks can now be exported to a playlist.
        </div>
      ) : null}
      {youtubeError ? (
        <div className="mb-4 rounded-lg border border-rose-500/50 bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(244,63,94,0.06))] p-3 text-sm text-rose-200">
          YouTube connect failed: {youtubeError}
        </div>
      ) : null}

      <Card className="mb-4 overflow-hidden">
        <CardHeader className="border-b border-[var(--color-border)] bg-[linear-gradient(120deg,rgba(231,181,102,0.12),rgba(231,181,102,0.02))]">
          <CardTitle className="text-xl">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className={discogsConnected ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200" : "border-amber-600/50 text-amber-300"}>
              {discogsConnected ? "Discogs Connected" : "Discogs Not Connected"}
            </Badge>
            <Badge className={effectiveKeys.youtubeApiKey ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200" : "border-amber-600/50 text-amber-300"}>
              {effectiveKeys.youtubeApiKey ? "YouTube Active" : "YouTube Missing"}
            </Badge>
            <Badge
              className={
                youtubeOAuth.connected
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                  : youtubeOAuth.configured
                    ? "border-amber-600/50 text-amber-300"
                    : "border-zinc-600/50 text-zinc-400"
              }
            >
              {youtubeOAuth.connected ? "YouTube Playlist Export Connected" : youtubeOAuth.configured ? "YouTube Playlist Export Not Connected" : "YouTube Playlist Export Not Configured"}
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
              <p className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <Disc3 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                Discogs
              </p>
              <p className="text-sm">
                Status: <span className="mono">{discogsConnected ? `Connected (${discogsMode})` : "Not connected"}</span>
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Connect once for personal sync. Workspace token mode supports backend ingest/search without user-linked OAuth sync.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {discogsConnected ? (
                  <form action={disconnectDiscogsAction}>
                    <Button type="submit" variant="outline">Disconnect Discogs</Button>
                  </form>
                ) : (
                  <a href="/api/discogs/oauth/start?next=/settings" className="inline-flex items-center rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2 text-sm font-extrabold text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80">
                    Connect Discogs
                  </a>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
              <p className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <Youtube className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                YouTube
              </p>
              <p className="text-sm">Backend API key: <span className="mono">{maskSecret(savedYoutubeKey)}</span></p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Used for match/search during ingestion. Managed at backend level for this workspace.</p>
              <p className="mt-2 text-sm">
                Playlist export:{" "}
                <span className="mono">
                  {youtubeOAuth.connected ? `Connected${youtubeOAuth.channelTitle ? ` (${youtubeOAuth.channelTitle})` : ""}` : "Not connected"}
                </span>
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Separate from sign-in. Export control appears only on the Library page.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {youtubeOAuth.connected ? (
                  <form action={disconnectYoutubeAction}>
                    <Button type="submit" variant="outline">Disconnect YouTube</Button>
                  </form>
                ) : youtubeOAuth.configured ? (
                  <a href="/api/youtube/oauth/start?next=/settings" className="inline-flex items-center rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2 text-sm font-extrabold text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80">
                    Connect YouTube
                  </a>
                ) : (
                  <span className="rounded-md border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">
                    Ask admin to set YOUTUBE_OAUTH_CLIENT_ID / SECRET
                  </span>
                )}
                <form action={clearApiKeysAction}>
                  <Button type="submit" variant="outline">Clear Local Keys</Button>
                </form>
              </div>
            </section>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">Account + YouTube Scenarios</p>
            <div className="space-y-1.5 text-xs text-[var(--color-muted)]">
              <p>Sign-in method: <span className="mono">{signInMethod}</span>.</p>
              <p>If you sign in with Email/Password, YouTube playlist export still works after clicking <span className="mono">Connect YouTube</span>.</p>
              <p>If you sign in with Google, login alone does not grant playlist write permission; <span className="mono">Connect YouTube</span> still asks for explicit consent.</p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">Health Check</p>
            <ApiKeyTester />
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
