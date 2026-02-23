import Link from "next/link";
import { Bookmark, CheckCheck, Disc3, Heart, Inbox, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAppUserId } from "@/lib/app-user";

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

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <section className="marketing-hero reveal">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-5xl">
            Welcome to DigQueue
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-[var(--color-muted)] md:text-base">
            This is your starting page. Use it as a quick guide, then jump into Sources, Listening Station, and Library.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
            Labels give catalog-driven digging. Artist sources let you follow one artist across labels, projects, and aliases.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            {isLoggedIn ? (
              <>
                <Link href="/?tab=step-1"><Button type="button">Open Sources</Button></Link>
                <Link href="/?tab=step-2"><Button type="button" variant="outline">Open Listening Station</Button></Link>
                <Link href="/?tab=library"><Button type="button" variant="outline">Open Library</Button></Link>
                <Link href="/how-to-use"><Button type="button" variant="ghost">Full How-To</Button></Link>
              </>
            ) : (
              <>
                <Link href="/login"><Button type="button">Login</Button></Link>
                <Link href="/login?mode=register"><Button type="button" variant="outline">Register</Button></Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 reveal reveal-delay-1">
        {highlights.map((item) => (
          <article key={item.title} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-low)]">
            <item.icon className="mb-3 h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-base font-medium">{item.title}</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 reveal reveal-delay-2">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><Disc3 className="h-4 w-4 text-[var(--color-accent)]" />Sources First</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>1. Start with 1-3 label or artist sources.</p>
            <p>2. Keep active only the sources you want in your queue.</p>
            <p>3. Run sync in Queue Workbench and resolve source errors quickly.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><Inbox className="h-4 w-4 text-[var(--color-accent)]" />Listening Loop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Use play controls to keep momentum.</p>
            <p><span className="font-medium">Single check:</span> review track.</p>
            <p><span className="font-medium">Double check:</span> review full release.</p>
            <p><span className="font-medium">Save track:</span> keep tracks you want to revisit in Library and recommendations.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><Bookmark className="h-4 w-4 text-[var(--color-accent)]" />Library Views</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">Library:</span> saved tracks + wishlist records.</p>
            <p><span className="font-medium">History:</span> played tracks.</p>
            <p><span className="font-medium">Reviewed:</span> decisions already made.</p>
            <p><span className="font-medium">Needs Review:</span> played but unresolved items.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><CheckCheck className="h-4 w-4 text-[var(--color-accent)]" />First 10 Minutes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isLoggedIn ? (
              <>
                <p>1. Connect Discogs in <Link href="/settings" className="text-[var(--color-accent)] hover:underline">Settings</Link> if needed.</p>
                <p>2. Add sources in Sources tab.</p>
                <p>3. Play from Listening Station and mark tracks/release as you go.</p>
                <p>4. Clear leftovers in Library → Needs Review.</p>
                <div className="pt-1">
                  <Link href="/how-to-use"><Button type="button" size="sm" variant="outline">Open Detailed Guide</Button></Link>
                </div>
              </>
            ) : (
              <>
                <p>1. Create your account.</p>
                <p>2. Log in and return to this page.</p>
                <p>3. Connect Discogs once in Settings.</p>
                <p>4. Start with 1-3 sources.</p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="inline-flex items-center gap-2 text-sm font-medium"><Heart className="h-4 w-4 text-[var(--color-accent)]" />Save Tracks</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Use saves intentionally. They directly shape what shows up again.</p>
        </article>
        <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="inline-flex items-center gap-2 text-sm font-medium"><Settings className="h-4 w-4 text-[var(--color-accent)]" />Integrations</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Discogs powers ingest. YouTube OAuth is optional and only needed for playlist export.</p>
        </article>
        <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="inline-flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-[var(--color-accent)]" />Keep It Focused</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Pause sources that are not useful right now, keep reviewing, and your queue stays clean.</p>
        </article>
      </section>
    </main>
  );
}
