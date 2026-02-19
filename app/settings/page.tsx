export const dynamic = "force-dynamic";

import Link from "next/link";
import { clearSessionAction } from "@/app/auth-actions";
import { clearApiKeysAction, clearDiscogsKeyAction, clearYoutubeKeyAction, saveApiKeysAction } from "@/app/settings/actions";
import { ApiKeyTester } from "@/components/api-key-tester";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlaybackModeSettings } from "@/components/playback-mode-settings";
import { Button } from "@/components/ui/button";
import { YoutubeKeyFixAssistant } from "@/components/youtube-key-fix-assistant";
import { getApiKeys, getEffectiveApiKeys, maskSecret } from "@/lib/api-keys";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string }>;
}) {
  await searchParams;
  const savedKeys = await getApiKeys();
  const effectiveKeys = await getEffectiveApiKeys();

  return (
    <main className="mx-auto max-w-[900px] px-4 py-6 md:px-8">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-[var(--color-muted)]">Control keys, exports, and workspace behavior without breaking your digging flow.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-surface2)]">
            Home
          </Link>
          <Link href="/listen" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-surface2)]">
            To Listen
          </Link>
          <form action={clearSessionAction}>
            <Button type="submit" variant="outline" className="px-3 py-1.5 text-xs">Sign Out</Button>
          </form>
        </div>
      </header>
      <Card className="mb-4">
        <CardHeader><CardTitle>Local API Keys</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge>{effectiveKeys.discogsToken ? "Discogs Active" : "Discogs Missing"}</Badge>
            <Badge>{effectiveKeys.youtubeApiKey ? "YouTube Active" : "YouTube Missing"}</Badge>
          </div>
          <p>Saved Discogs token: <span className="mono">{maskSecret(savedKeys.discogsToken)}</span></p>
          <p>Saved YouTube key: <span className="mono">{maskSecret(savedKeys.youtubeApiKey)}</span></p>
          <p>Active Discogs token: <span className="mono">{maskSecret(effectiveKeys.discogsToken)}</span></p>
          <p>Active YouTube key: <span className="mono">{maskSecret(effectiveKeys.youtubeApiKey)}</span></p>
          <form action={saveApiKeysAction} className="space-y-2 rounded-md border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Set Keys</p>
            <Input name="discogsToken" placeholder="Discogs token or URL containing token=" />
            <Input name="youtubeApiKey" placeholder="YouTube key or URL containing key=" />
            <Button type="submit">Save Keys</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <form action={clearDiscogsKeyAction}>
              <Button type="submit" variant="outline">Clear Discogs Key</Button>
            </form>
            <form action={clearYoutubeKeyAction}>
              <Button type="submit" variant="outline">Clear YouTube Key</Button>
            </form>
            <form action={clearApiKeysAction}>
              <Button type="submit" variant="outline">Clear All Keys</Button>
            </form>
          </div>
          <ApiKeyTester />
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader><CardTitle>Developer Links</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-3">
            <a className="text-[var(--color-accent)] hover:underline" href="https://www.discogs.com/settings/developers" target="_blank" rel="noreferrer">
              Discogs developer settings
            </a>
            <a className="text-[var(--color-accent)] hover:underline" href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
              Enable YouTube Data API v3
            </a>
            <a className="text-[var(--color-accent)] hover:underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
              Google Cloud credentials
            </a>
          </div>
          <YoutubeKeyFixAssistant />
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader><CardTitle>Data Export</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Export queue and metadata snapshots.</p>
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
      <Card>
        <CardHeader><CardTitle>Legal + Playback</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>This app does not download copyrighted audio. It only stores metadata and YouTube playback links.</p>
          <PlaybackModeSettings />
          <p>Keyboard shortcuts: <span className="mono">space</span> play/pause, <span className="mono">n</span> next, <span className="mono">b</span> previous, <span className="mono">l</span> focus label add.</p>
        </CardContent>
      </Card>
    </main>
  );
}
