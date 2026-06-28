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
import { ButtonLink } from "@/components/button-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeedbackBanner } from "@/components/feedback-banner";
import { GuideCard } from "@/components/guide-card";
import { HoverTooltip, getHoverTooltipClassName } from "@/components/hover-tooltip";
import { Input } from "@/components/ui/input";
import { InsetPanel } from "@/components/inset-panel";
import { InstructionList } from "@/components/instruction-list";
import { OnboardingStatusCard } from "@/components/onboarding-status-card";
import { OrientationHero } from "@/components/orientation-hero";
import { getCurrentAppUserId } from "@/lib/app-user";
import { getOnboardingSnapshot } from "@/lib/onboarding-snapshot";

function NativeTooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <HoverTooltip content={text} tooltipClassName={getHoverTooltipClassName()}>
      {children}
    </HoverTooltip>
  );
}

export default async function HowToUsePage() {
  const userId = await getCurrentAppUserId();
  const isLoggedIn = Boolean(userId);
  const onboardingSnapshot = isLoggedIn ? await getOnboardingSnapshot() : null;

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-5 sm:px-4 md:px-8 md:py-8">
      <OrientationHero
        actions={
          isLoggedIn ? (
            <>
              <ButtonLink mobileFullWidth href="/?tab=sources" size="sm" variant="outline">Open Sources</ButtonLink>
              <ButtonLink mobileFullWidth href="/" size="sm" variant="outline">Open Listen Desk</ButtonLink>
              <ButtonLink mobileFullWidth href="/?tab=library" size="sm" variant="outline">Open Library</ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink mobileFullWidth href="/login" size="sm" variant="outline">Login</ButtonLink>
              <ButtonLink mobileFullWidth href="/register" size="sm" variant="outline">Register</ButtonLink>
              <ButtonLink mobileFullWidth href="/welcome" size="sm" variant="ghost">Welcome</ButtonLink>
            </>
          )
        }
        badgeRow={
          <>
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
          </>
        }
        description="This page uses the same controls you see in the app so you can recognize them quickly during real use."
        eyebrow="How To Use DigQueue"
        title="Learn The Interface Once"
        tone="guide"
      >
        <FeedbackBanner tone="warning" className="mt-3 text-xs">
          Demo page note: sample controls below are disabled and shown for orientation only.
        </FeedbackBanner>
      </OrientationHero>

      {isLoggedIn && onboardingSnapshot ? (
        <section className="mt-4">
          <OnboardingStatusCard
            snapshot={onboardingSnapshot}
            title="Your Current Setup"
            titleIcon={<Settings className="h-4 w-4 text-[var(--color-accent)]" />}
          />
        </section>
      ) : null}

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <GuideCard
          title="Sources: Intake"
          titleIcon={<Disc3 className="h-4 w-4 text-[var(--color-accent)]" />}
          contentClassName="space-y-3"
        >
            <p className="text-sm text-[var(--color-muted)]">
              This is where queue content starts. One input handles both source types and auto-detects from URL, ID, or name.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <NativeTooltip text="Sources accept both Discogs labels and artists. Use URL, numeric ID, or name.">
                <span className="w-full sm:flex-1">
                  <Input aria-label="Sample Discogs source input" placeholder="Paste Discogs source URL, ID, or name" disabled readOnly />
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
            <InsetPanel tone="muted" className="text-sm">
              <p className="font-medium">What to do first</p>
              <p className="text-[var(--color-muted)]">Add 1-3 sources (labels or artists), activate them, then go to Listen Desk.</p>
              <p className="mt-1 text-[var(--color-muted)]">
                Label sources focus on a label catalog. Artist sources follow one artist across multiple labels and projects.
              </p>
            </InsetPanel>
        </GuideCard>

        <GuideCard
          title="Listen Desk: Work Queue"
          titleIcon={<Inbox className="h-4 w-4 text-[var(--color-accent)]" />}
          contentClassName="space-y-3"
        >
            <p className="text-sm text-[var(--color-muted)]">Use these controls repeatedly while digging.</p>
            <div className="flex flex-wrap gap-2">
              <Badge>All</Badge>
              <Badge>Needs Review</Badge>
              <Badge>Reviewed</Badge>
              <Badge>Played</Badge>
            </div>
            <InsetPanel tone="muted">
              <div className="flex flex-wrap items-center gap-2">
                <NativeTooltip text="Play now in mini-player; if queue is empty, DigQueue attempts to load from active sources.">
                  <span>
                    <Button type="button" size="sm" variant="secondary" disabled><Play className="h-3.5 w-3.5" />Play Now</Button>
                  </span>
                </NativeTooltip>
                <NativeTooltip text="Single check icon: mark current track reviewed and advance.">
                  <span>
                    <Button type="button" size="sm" variant="secondary" className="h-9 w-9 rounded-full p-0" aria-label="Review track example" disabled><CheckCircle2 className="h-4 w-4" /></Button>
                  </span>
                </NativeTooltip>
                <NativeTooltip text="Double check icon: mark entire release reviewed.">
                  <span>
                    <Button type="button" size="sm" variant="secondary" className="h-9 w-9 rounded-full p-0" aria-label="Review release example" disabled><CheckCheck className="h-4 w-4" /></Button>
                  </span>
                </NativeTooltip>
                <NativeTooltip text="Save track locally; does not add to Discogs wantlist.">
                  <span>
                    <Button type="button" size="sm" variant="ghost" disabled><Heart className="h-3.5 w-3.5" />Save Track</Button>
                  </span>
                </NativeTooltip>
              </div>
            </InsetPanel>
            <p className="text-sm text-[var(--color-muted)]">
              <span className="font-medium text-[var(--color-text)]">Single check:</span> review this track.
              {" "}
              <span className="font-medium text-[var(--color-text)]">Double check:</span> review full release.
            </p>
        </GuideCard>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <GuideCard
          title="Library: What Happened"
          titleIcon={<Bookmark className="h-4 w-4 text-[var(--color-accent)]" />}
        >
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
        </GuideCard>
        <GuideCard
          title="Queue Focus: Keep It Tight"
          titleIcon={<Lightbulb className="h-4 w-4 text-[var(--color-accent)]" />}
        >
            <p>Keep the queue useful with simple cleanup:</p>
            <p><span className="font-medium">Pause or deactivate</span> sources you do not want in rotation.</p>
            <p><span className="font-medium">Review full releases</span> when you have enough context to decide quickly.</p>
            <p><span className="font-medium">Use retry + error panel</span> to clear blocked sources quickly.</p>
        </GuideCard>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <GuideCard
          title="Find New Sources From Tracks You Already Like"
          titleIcon={<Disc3 className="h-4 w-4 text-[var(--color-accent)]" />}
        >
            <p>If you do not know which sources to add yet, start from music you already like.</p>
            <InstructionList
              className="text-sm"
              items={[
                "Open a track or release you like in Listen Desk or Library.",
                <>Use the release action to <span className="font-medium text-[var(--color-text)]">Add + activate source</span>.</>,
                "Go to Sources and run ingestion on that new source.",
              ]}
            />
            <p className="text-[var(--color-muted)]">
              This is the fastest way to grow your source list without guessing random names.
            </p>
        </GuideCard>
        <GuideCard
          title="Filters Without Overload"
          titleIcon={<SlidersHorizontal className="h-4 w-4 text-[var(--color-accent)]" />}
        >
            <p>Default flow:</p>
            <InstructionList
              className="text-sm"
              items={[
                <>Use <span className="font-medium text-[var(--color-text)]">View</span> first (All/Needs Review/Reviewed/Played).</>,
                <>Use <span className="font-medium text-[var(--color-text)]">Exclude</span> to subtract noise.</>,
                <>Open <span className="font-medium text-[var(--color-text)]">More filters</span> only when needed.</>,
              ]}
            />
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
        </GuideCard>
        <GuideCard
          title="First 10 Minutes Checklist"
          titleIcon={<CircleHelp className="h-4 w-4 text-[var(--color-accent)]" />}
          contentClassName="space-y-3 text-sm"
        >
            {isLoggedIn && onboardingSnapshot ? (
              <InstructionList
                className="text-sm"
                items={[
                  "Check the setup state above.",
                  "Follow the next-step buttons that match your current state.",
                  "Once the queue is live, use Listen Desk to review tracks.",
                  "Clear leftovers in Library -> Needs Review.",
                  "Return to Sources and keep only the sources worth rotating.",
                ]}
              />
            ) : (
              <InstructionList
                className="text-sm"
                items={[
                  "Add sources and activate a few.",
                  "Open Listen Desk and press Play Now on a track.",
                  "Use review buttons while listening.",
                  "Check Library -> Needs Review and clear leftovers.",
                  "Return to Sources and add one more source.",
                ]}
              />
            )}
            <div className="flex flex-wrap gap-2">
              {isLoggedIn ? (
                <>
                  <ButtonLink href="/settings" size="sm" variant="outline">
                    <Settings className="mr-1 h-3.5 w-3.5" />
                    Settings
                  </ButtonLink>
                  <ButtonLink href="/" size="sm">
                    Start Listening
                  </ButtonLink>
                  <ButtonLink href="/?tab=sources" size="sm" variant="outline">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Open Sources
                  </ButtonLink>
                </>
              ) : (
                <>
                  <ButtonLink href="/register" size="sm">
                    Create Account
                  </ButtonLink>
                  <ButtonLink href="/login" size="sm" variant="outline">
                    Login
                  </ButtonLink>
                </>
              )}
            </div>
        </GuideCard>
      </section>
    </main>
  );
}
