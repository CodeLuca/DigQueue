export const dynamic = "force-dynamic";

import { Disc3, ExternalLink, ShieldCheck, Youtube } from "lucide-react";
import { clearSessionAction } from "@/app/auth-actions";
import { clearApiKeysAction, disconnectDiscogsAction } from "@/app/settings/actions";
import { ApiKeyTester } from "@/components/api-key-tester";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaybackModeSettings } from "@/components/playback-mode-settings";
import { getApiKeys, getEffectiveApiKeys, maskSecret } from "@/lib/api-keys";
import { parseDiscogsStoredAuth } from "@/lib/discogs-auth";
import { env } from "@/lib/env";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ discogs?: string; discogs_error?: string }>;
}) {
  const params = await searchParams;
  const savedKeys = await getApiKeys();
  const effectiveKeys = await getEffectiveApiKeys();
  const savedYoutubeKey = savedKeys.youtubeApiKey || env.YOUTUBE_API_KEY || null;
  const discogsSavedAuth = parseDiscogsStoredAuth(savedKeys.discogsToken);
  const discogsConnected = discogsSavedAuth?.kind === "oauth";

  return (
    <main className="mx-auto max-w-[980px] px-4 py-6 md:px-8">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            Workspace Controls
          </p>
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
      {params.discogs_error ? (
        <div className="mb-4 rounded-lg border border-rose-500/50 bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(244,63,94,0.06))] p-3 text-sm text-rose-200">
          Discogs connect failed: {params.discogs_error}
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
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
              <p className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <Disc3 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                Discogs
              </p>
              <p className="text-sm">Status: <span className="mono">{discogsConnected ? "Connected" : "Not connected"}</span></p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Connect once to sync wants and wishlist actions with your Discogs account.</p>
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
              <p className="mt-1 text-xs text-[var(--color-muted)]">Managed at backend level for this workspace. No user-level key entry.</p>
              <div className="mt-3">
                <form action={clearApiKeysAction}>
                  <Button type="submit" variant="outline">Clear Local Keys</Button>
                </form>
              </div>
            </section>
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
