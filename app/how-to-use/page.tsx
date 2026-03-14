import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bookmark,
  CheckCheck,
  CheckCircle2,
  CircleHelp,
  Disc3,
  ExternalLink,
  Heart,
  Inbox,
  Lightbulb,
  ListOrdered,
  Play,
  PlayCircle,
  Settings,
  Shuffle,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentAppUserId } from "@/lib/app-user";
import { getEffectiveApiKeys } from "@/lib/api-keys";
import { parseDiscogsStoredAuth } from "@/lib/discogs-auth";
import { buildOnboardingHealth } from "@/lib/onboarding-health";
import { getDashboardData } from "@/lib/queries";
import { getYoutubeOAuthConnectionStatus } from "@/lib/youtube-oauth";

function NativeTooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-2 left-1/2 z-20 hidden w-max max-w-[260px] -translate-x-1/2 -translate-y-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-2 py-1 text-[11px] leading-tight text-[var(--color-text)] shadow-[var(--shadow-low)] group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}

export default async function HowToUsePage() {
  const userId = await getCurrentAppUserId();
  const isLoggedIn = Boolean(userId);
  const onboardingHealth = isLoggedIn
    ? await (async () => {
        const [keys, dashboardData, youtubeOAuth] = await Promise.all([
          getEffectiveApiKeys(),
          getDashboardData({ tab: "step-2" }),
          getYoutubeOAuthConnectionStatus(),
        ]);
        const discogsConnected = parseDiscogsStoredAuth(keys.discogsToken)?.kind === "oauth";
        return buildOnboardingHealth({
          discogsConnected,
          youtubeOAuthConfigured: youtubeOAuth.configured,
          youtubeOAuthConnected: youtubeOAuth.connected,
          sourceCount: dashboardData.labels.length,
          activeSourceCount: dashboardData.labels.filter((label) => label.active).length,
          erroredSourceCount: dashboardData.metrics.labelsErrored,
          queueCount: dashboardData.queueCount,
        });
      })()
    : null;
  const healthToneClass =
    onboardingHealth?.tone === "ready"
      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
      : onboardingHealth?.tone === "blocked"
        ? "border-rose-500/60 bg-rose-500/10 text-rose-200"
        : "border-amber-500/60 bg-amber-500/10 text-amber-200";

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-5 sm:px-4 md:px-8 md:py-8">
      <section className="rounded-xl border border-[var(--color-border)] bg-[linear-gradient(135deg,rgba(245,158,11,0.14),transparent_48%),var(--color-surface2)] p-4 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">How To Use DigQueue</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Learn The Interface Once</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted)]">
          This page uses the same controls you see in the app so you can recognize them quickly during real use.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <NativeTooltip text="Disc icon = source ingestion progress across label and artist sources">
            <Badge><Disc3 className="mr-1 h-3 w-3" />Sources loaded</Badge>
          </NativeTooltip>
          <NativeTooltip text="Play icon = queue playback activity">
            <Badge><PlayCircle className="mr-1 h-3 w-3" />Tracks played</Badge>
          </NativeTooltip>
          <NativeTooltip text="Single check icon = reviewed track">
            <Badge><CheckCircle2 className="mr-1 h-3 w-3" />Reviewed</Badge>
          </NativeTooltip>
          <NativeTooltip text="Heart icon = locally saved track">
            <Badge><Heart className="mr-1 h-3 w-3" />Saved tracks</Badge>
          </NativeTooltip>
        </div>
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Demo page note: sample controls below are disabled and shown for orientation only.
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link className="w-full sm:w-auto" href="/?tab=step-1"><Button className="w-full sm:w-auto" size="sm" variant="outline">Open Sources</Button></Link>
          <Link className="w-full sm:w-auto" href="/?tab=step-2"><Button className="w-full sm:w-auto" size="sm" variant="outline">Open Listening Station</Button></Link>
          <Link className="w-full sm:w-auto" href="/?tab=library"><Button className="w-full sm:w-auto" size="sm" variant="outline">Open Library</Button></Link>
        </div>
      </section>

      {isLoggedIn && onboardingHealth ? (
        <section className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Settings className="h-4 w-4 text-[var(--color-accent)]" />
                Your Current Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${healthToneClass}`}>
                {onboardingHealth.label}
              </span>
              <div>
                <p className="font-medium">{onboardingHealth.title}</p>
                <p className="mt-1 text-[var(--color-muted)]">{onboardingHealth.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
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
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Disc3 className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Sources: Intake</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--color-muted)]">
              This is where queue content starts. One input handles both source types and auto-detects from URL, ID, or name.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <NativeTooltip text="Sources accept both Discogs labels and artists. Use URL, numeric ID, or name.">
                <span className="w-full sm:flex-1">
                  <Input placeholder="Paste Discogs source URL, ID, or name" disabled readOnly />
                </span>
              </NativeTooltip>
              <NativeTooltip text="Adds and queues a source for ingestion (works for both label and artist sources).">
                <span>
                  <Button type="button" disabled>Add Source</Button>
                </span>
              </NativeTooltip>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>All (24)</Badge>
              <Badge className="border-emerald-600/60 text-emerald-300">Active (16)</Badge>
              <Badge>Inactive (8)</Badge>
              <Badge>Any Kind (24)</Badge>
              <NativeTooltip text="Discogs label sources">
                <Badge>Label Sources (14)</Badge>
              </NativeTooltip>
              <NativeTooltip text="Discogs artist sources">
                <Badge>Artists (10)</Badge>
              </NativeTooltip>
            </div>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/55 p-2 text-sm">
              <p className="font-medium">What to do first</p>
              <p className="text-[var(--color-muted)]">Add 1-3 sources (labels or artists), activate them, then go to Listening Station.</p>
              <p className="mt-1 text-[var(--color-muted)]">
                Label sources focus on a label catalog. Artist sources follow one artist across multiple labels and projects.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Listening Station: Work Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--color-muted)]">Use these controls repeatedly while digging.</p>
            <div className="flex flex-wrap gap-2">
              <Badge>All</Badge>
              <Badge>Needs Review</Badge>
              <Badge>Reviewed</Badge>
              <Badge>Played</Badge>
            </div>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/55 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <NativeTooltip text="Play now in mini-player; if queue is empty, DigQueue attempts to load from active sources.">
                  <span>
                    <Button type="button" size="sm" variant="secondary" disabled><Play className="h-3.5 w-3.5" />Play Now</Button>
                  </span>
                </NativeTooltip>
                <NativeTooltip text="Single check icon: mark current track reviewed and advance.">
                  <span>
                    <Button type="button" size="sm" variant="secondary" className="h-9 w-9 rounded-full p-0" disabled><CheckCircle2 className="h-4 w-4" /></Button>
                  </span>
                </NativeTooltip>
                <NativeTooltip text="Double check icon: mark entire release reviewed.">
                  <span>
                    <Button type="button" size="sm" variant="secondary" className="h-9 w-9 rounded-full p-0" disabled><CheckCheck className="h-4 w-4" /></Button>
                  </span>
                </NativeTooltip>
                <NativeTooltip text="Save track locally; does not add to Discogs wantlist.">
                  <span>
                    <Button type="button" size="sm" variant="ghost" disabled><Heart className="h-3.5 w-3.5" />Save Track</Button>
                  </span>
                </NativeTooltip>
              </div>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              <span className="font-medium text-[var(--color-text)]">Single check:</span> review this track.
              {" "}
              <span className="font-medium text-[var(--color-text)]">Double check:</span> review full release.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Library: What Happened</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge>Library</Badge>
              <Badge>History</Badge>
              <Badge>Reviewed</Badge>
              <Badge>Needs Review</Badge>
            </div>
            <p><span className="font-medium">Library:</span> saved tracks and wishlist records.</p>
            <p><span className="font-medium">History:</span> previously played tracks.</p>
            <p><span className="font-medium">Reviewed:</span> tracks you marked reviewed.</p>
            <p><span className="font-medium">Needs Review:</span> played but still not reviewed.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Queue Focus: Keep It Tight</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Keep the queue useful with simple cleanup:</p>
            <p><span className="font-medium">Pause or deactivate</span> sources you do not want in rotation.</p>
            <p><span className="font-medium">Review full releases</span> when you have enough context to decide quickly.</p>
            <p><span className="font-medium">Use retry + error panel</span> to clear blocked sources quickly.</p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Disc3 className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Find New Sources From Tracks You Already Like</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>If you do not know which sources to add yet, start from music you already like.</p>
            <p>1. Open a track/release you like in Listening Station or Library.</p>
            <p>2. Use the release action to <span className="font-medium">Add + activate source</span>.</p>
            <p>3. Go to Sources and run ingestion on that new source.</p>
            <p className="text-[var(--color-muted)]">
              This is the fastest way to grow your source list without guessing random names.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Filters Without Overload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Default flow:</p>
            <p>1. Use <span className="font-medium">View</span> first (All/Needs Review/Reviewed/Played).</p>
            <p>2. Use <span className="font-medium">Exclude</span> to subtract noise.</p>
            <p>3. Open <span className="font-medium">More filters</span> only when needed.</p>
            <div className="flex flex-wrap gap-2">
              <NativeTooltip text="View presets: All, Needs Review, Reviewed, Played.">
                <span>
                  <Button type="button" size="sm" variant="outline" disabled>View</Button>
                </span>
              </NativeTooltip>
              <NativeTooltip text="Exclude filters remove noise from the current list.">
                <span>
                  <Button type="button" size="sm" variant="outline" disabled>Exclude</Button>
                </span>
              </NativeTooltip>
              <NativeTooltip text="List icon: play queue in order.">
                <span>
                  <Button type="button" size="sm" variant="outline" disabled><ListOrdered className="mr-1 h-3.5 w-3.5" />In Order</Button>
                </span>
              </NativeTooltip>
              <NativeTooltip text="Shuffle icon: randomize next queued item.">
                <span>
                  <Button type="button" size="sm" variant="outline" disabled><Shuffle className="mr-1 h-3.5 w-3.5" />Shuffle</Button>
                </span>
              </NativeTooltip>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center gap-2">
            <CircleHelp className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>First 10 Minutes Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoggedIn && onboardingHealth ? (
              <>
                <p>1. Check the setup state above.</p>
                <p>2. Follow the next-step buttons that match your current state.</p>
                <p>3. Once the queue is live, use Listening Station to review tracks.</p>
                <p>4. Clear leftovers in Library → Needs Review.</p>
                <p>5. Return to Sources and keep only the sources worth rotating.</p>
              </>
            ) : (
              <>
                <p>1. Add sources and activate a few.</p>
                <p>2. Open Listening Station and press Play Now on a track.</p>
                <p>3. Use review buttons while listening.</p>
                <p>4. Check Library → Needs Review and clear leftovers.</p>
                <p>5. Return to Sources and add one more source.</p>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/settings">
                <Button size="sm" variant="outline"><Settings className="mr-1 h-3.5 w-3.5" />Settings</Button>
              </Link>
              <Link href="/?tab=step-2">
                <Button size="sm">Start Listening</Button>
              </Link>
              <Link href="/?tab=step-1">
                <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3.5 w-3.5" />Open Sources</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
