import Link from "next/link";
import { Bookmark, CheckCheck, Disc3, Heart, Inbox, Settings, Sparkles } from "lucide-react";
import { GuideCard } from "@/components/guide-card";
import { InfoCard } from "@/components/info-card";
import { InstructionList } from "@/components/instruction-list";
import { OnboardingStatusCard } from "@/components/onboarding-status-card";
import { OrientationHero } from "@/components/orientation-hero";
import { Button } from "@/components/ui/button";
import { getCurrentAppUserId } from "@/lib/app-user";
import { getOnboardingSnapshot } from "@/lib/onboarding-snapshot";

const highlights = [
  {
    title: "Process sources end-to-end",
    description: "Paste a Discogs source (label or artist) and DigQueue auto-detects type, then ingests releases, tracks, and queue-ready candidates.",
    icon: Disc3,
  },
  {
    title: "Stay in flow while listening",
    description: "Queue playback, review controls, and lightweight filters help you sort tracks quickly while listening.",
    icon: Inbox,
  },
  {
    title: "Keep your preferences",
    description: "Wishlist and listening actions stay organized so recommendations improve over time.",
    icon: Sparkles,
  },
];

export default async function WelcomePage() {
  const userId = await getCurrentAppUserId();
  const isLoggedIn = Boolean(userId);
  const onboardingSnapshot = isLoggedIn ? await getOnboardingSnapshot() : null;

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-6 sm:px-4 md:px-8 md:py-8">
      <OrientationHero
        actions={
          isLoggedIn ? (
            <>
              <Link className="w-full sm:w-auto" href="/?tab=step-1"><Button className="w-full sm:w-auto" type="button">Open Sources</Button></Link>
              <Link className="w-full sm:w-auto" href="/?tab=step-2"><Button className="w-full sm:w-auto" type="button" variant="outline">Open Listening Station</Button></Link>
              <Link className="w-full sm:w-auto" href="/?tab=library"><Button className="w-full sm:w-auto" type="button" variant="outline">Open Library</Button></Link>
              <Link className="w-full sm:w-auto" href="/how-to-use"><Button className="w-full sm:w-auto" type="button" variant="ghost">Full How-To</Button></Link>
            </>
          ) : (
            <>
              <Link className="w-full sm:w-auto" href="/login"><Button className="w-full sm:w-auto" type="button">Login</Button></Link>
              <Link className="w-full sm:w-auto" href="/login?mode=register"><Button className="w-full sm:w-auto" type="button" variant="outline">Register</Button></Link>
            </>
          )
        }
        description={
          <>
            <p className="mt-2 max-w-2xl">
              This is your starting page. Use it as a quick guide, then jump into Sources, Listening Station, and Library.
            </p>
            <p className="mt-2 max-w-2xl">
              Labels give catalog-driven digging. Artist sources let you follow one artist across labels, projects, and aliases.
            </p>
          </>
        }
        descriptionClassName="mt-4"
        title="Welcome to DigQueue"
      >
      </OrientationHero>

      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 reveal reveal-delay-1">
        {highlights.map((item) => (
          <InfoCard
            key={item.title}
            className="shadow-[var(--shadow-low)]"
            description={item.description}
            icon={item.icon}
            title={item.title}
            variant="stacked"
          />
        ))}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 reveal reveal-delay-2">
        {isLoggedIn && onboardingSnapshot ? (
          <OnboardingStatusCard
            snapshot={onboardingSnapshot}
            title="Current Setup"
            titleIcon={<Settings className="h-4 w-4 text-[var(--color-accent)]" />}
          />
        ) : null}
        <GuideCard
          title="Sources First"
          titleIcon={<Disc3 className="h-4 w-4 text-[var(--color-accent)]" />}
        >
          <InstructionList
            className="text-sm"
            items={[
              "Start with 1-3 label or artist sources.",
              "Keep active only the sources you want in your queue.",
              "Run sync in Queue Workbench and resolve source errors quickly.",
            ]}
          />
        </GuideCard>
        <GuideCard
          title="Listening Loop"
          titleIcon={<Inbox className="h-4 w-4 text-[var(--color-accent)]" />}
        >
          <p>Use play controls to keep momentum.</p>
          <p><span className="font-medium">Single check:</span> review track.</p>
          <p><span className="font-medium">Double check:</span> review full release.</p>
          <p><span className="font-medium">Save track:</span> keep tracks you want to revisit in Library and recommendations.</p>
        </GuideCard>
        <GuideCard
          title="Library Views"
          titleIcon={<Bookmark className="h-4 w-4 text-[var(--color-accent)]" />}
        >
          <p><span className="font-medium">Library:</span> saved tracks + wishlist records.</p>
          <p><span className="font-medium">History:</span> played tracks.</p>
          <p><span className="font-medium">Reviewed:</span> decisions already made.</p>
          <p><span className="font-medium">Needs Review:</span> played but unresolved items.</p>
        </GuideCard>
        <GuideCard
          title="First 10 Minutes"
          titleIcon={<CheckCheck className="h-4 w-4 text-[var(--color-accent)]" />}
          contentClassName="space-y-3 text-sm"
        >
          {isLoggedIn ? (
            <>
              <InstructionList
                className="text-sm"
                items={[
                  "Check your current setup state above.",
                  "Add or resume sources in Sources.",
                  "Run or monitor sync in Listening Station.",
                  "Clear leftovers in Library -> Needs Review.",
                ]}
              />
              <div className="pt-1">
                <Link href="/how-to-use"><Button type="button" size="sm" variant="outline">Open Detailed Guide</Button></Link>
              </div>
            </>
          ) : (
            <InstructionList
              className="text-sm"
              items={[
                "Create your account.",
                "Log in and return to this page.",
                "Connect Discogs once in Settings.",
                "Start with 1-3 sources.",
              ]}
            />
          )}
        </GuideCard>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <InfoCard
          description="Use saves intentionally. They directly shape what shows up again."
          icon={Heart}
          title="Save Tracks"
        />
        <InfoCard
          description="Discogs powers ingest. YouTube OAuth is optional and only needed for playlist export."
          icon={Settings}
          title="Integrations"
        />
        <InfoCard
          description="Pause sources that are not useful right now, keep reviewing, and your queue stays clean."
          icon={Sparkles}
          title="Keep It Focused"
        />
      </section>
    </main>
  );
}
