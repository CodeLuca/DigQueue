export const dynamic = "force-dynamic";

import Link from "next/link";
import { clearApiKeysAction, saveApiKeysAction } from "@/app/settings/actions";
import { ApiKeyTester } from "@/components/api-key-tester";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlaybackModeSettings } from "@/components/playback-mode-settings";
import { Button } from "@/components/ui/button";
import { YoutubeKeyFixAssistant } from "@/components/youtube-key-fix-assistant";
import { getApiKeys, getEffectiveApiKeys, maskSecret } from "@/lib/api-keys";

type MethodTab = "old" | "new";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string }>;
}) {
  const { method } = await searchParams;
  const activeMethod: MethodTab = method === "new" ? "new" : "old";
  const savedKeys = await getApiKeys();
  const effectiveKeys = await getEffectiveApiKeys();
  const methodHref = (next: MethodTab) => `/settings?method=${next}`;
  const tabClass = (tab: MethodTab) =>
    `rounded-md border px-3 py-1.5 text-sm ${
      activeMethod === tab
        ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
        : "border-[var(--color-border)] hover:bg-[var(--color-surface2)]"
    }`;

  return (
    <main className="mx-auto max-w-[900px] px-4 py-6 md:px-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
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
        </div>
      </header>
      <section className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Method</p>
        <div className="flex flex-wrap gap-2">
          <Link href={methodHref("old")} className={tabClass("old")}>1. Old Method</Link>
          <Link href={methodHref("new")} className={tabClass("new")}>2. New Method</Link>
        </div>
      </section>

      {activeMethod === "old" ? (
        <>
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
              <form action={clearApiKeysAction}>
                <Button type="submit" variant="outline">Clear Saved Keys</Button>
              </form>
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
        </>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge>User Settings Preview</Badge>
                <Badge>Supabase Mode</Badge>
              </div>
              <p>Email: <span className="mono">you@example.com</span></p>
              <p>Plan: <span className="mono">Personal</span></p>
              <p>Workspace: <span className="mono">default</span></p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline">Edit Profile</Button>
                <Button type="button" variant="outline">Switch Workspace</Button>
              </div>
            </CardContent>
          </Card>
          <Card className="mb-4">
            <CardHeader><CardTitle>Connections</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md border border-[var(--color-border)] p-3">
                <p className="font-medium">Discogs</p>
                <p className="text-[var(--color-muted)]">
                  Status: {effectiveKeys.discogsToken ? "Connected" : "Not connected"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="outline">Reconnect Discogs</Button>
                  <Button type="button" variant="outline">Disconnect Discogs</Button>
                </div>
              </div>
              <div className="rounded-md border border-[var(--color-border)] p-3">
                <p className="font-medium">YouTube API</p>
                <p className="text-[var(--color-muted)]">Managed globally by your workspace admin in new method.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="mb-4">
            <CardHeader><CardTitle>Security</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Password and sign-in controls for this account.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline">Change Password</Button>
                <Button type="button" variant="outline">Reset Password Email</Button>
                <Button type="button" variant="outline">Sign Out Other Sessions</Button>
              </div>
            </CardContent>
          </Card>
          <Card className="mb-4">
            <CardHeader><CardTitle>Account Conversion</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Convert legacy local setup into a full multi-user cloud account.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button">Convert Account</Button>
                <Button type="button" variant="outline">Link Existing Cloud Account</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Data + Privacy</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Export your personal data, transfer ownership, or close your account.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline">Export My Data</Button>
                <Button type="button" variant="outline">Transfer Data</Button>
                <Button type="button" variant="outline">Delete Account</Button>
              </div>
              <p className="text-[var(--color-muted)]">Need legacy key editing? <Link href={methodHref("old")} className="text-[var(--color-accent)] hover:underline">Open Old Method</Link></p>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
