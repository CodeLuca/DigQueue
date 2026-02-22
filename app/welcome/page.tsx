import Link from "next/link";
import { redirect } from "next/navigation";
import { Disc3, ListMusic, Sparkles } from "lucide-react";
import { getCurrentAppUserId } from "@/lib/app-user";

const highlights = [
  {
    title: "Process sources end-to-end",
    description: "Paste a Discogs source (label or artist) and DigQueue auto-detects type, then ingests releases, tracks, and queue-ready candidates.",
    icon: Disc3,
  },
  {
    title: "Stay in flow while listening",
    description: "Continuous player, queue controls, keyboard shortcuts, and review tabs in one workspace.",
    icon: ListMusic,
  },
  {
    title: "Own your signal",
    description: "Wishlist and listened states stay structured so recommendations get better over time.",
    icon: Sparkles,
  },
];

export default async function WelcomePage() {
  const userId = await getCurrentAppUserId();
  if (userId) {
    redirect("/");
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <section className="marketing-hero reveal">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-5xl">
            Discover smarter from sources you trust, not random algorithm noise.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-[var(--color-muted)] md:text-base">
            DigQueue turns your source list into a clear processing and listening system: import releases, rank playable tracks, and
            decide what deserves your attention.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
            Labels give you tight catalog-driven digging. Artists let you follow one producer across labels and aliases.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            <Link
              href="/login"
              className="rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2 text-sm font-extrabold text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
            >
              Login
            </Link>
            <Link href="/login?mode=register" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm hover:bg-[var(--color-surface2)]">
              Register
            </Link>
            <Link href="/how-to-use" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm hover:bg-[var(--color-surface2)]">
              How to use
            </Link>
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

      <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-6 reveal reveal-delay-2">
        <div>
          <h2 className="text-xl font-semibold">Quick start</h2>
          <ol className="mt-4 space-y-3 text-sm">
            <li className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
              <p className="font-medium">1. Create your account</p>
              <p className="mt-1 text-[var(--color-muted)]">Use email/password or Google to access your account.</p>
            </li>
            <li className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
              <p className="font-medium">2. Connect Discogs</p>
              <p className="mt-1 text-[var(--color-muted)]">After account auth, connect Discogs once to link your digging identity.</p>
            </li>
            <li className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
              <p className="font-medium">3. Add one label or artist source and process</p>
              <p className="mt-1 text-[var(--color-muted)]">Start with one label for curation depth or one artist for cross-label discovery, then run ingestion.</p>
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}
