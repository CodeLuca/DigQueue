import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-11rem)] max-w-[1100px] grid-cols-1 gap-4 px-4 py-8 md:px-8 lg:grid-cols-[1fr_1.15fr]">
      <aside className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 reveal">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Step 1</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Use email or Google first. After account creation, login with Discogs to start your digging flow.
        </p>
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
          <p className="flex items-start gap-2 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
            Supabase-ready flow: account creation is separate from Discogs login.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <Link href="/login" className="rounded-md border border-[var(--color-border)] px-3 py-2 hover:bg-[var(--color-surface2)]">
            Next: Login with Discogs
          </Link>
          <Link href="/login" className="rounded-md border border-[var(--color-border)] px-3 py-2 hover:bg-[var(--color-surface2)]">
            Already have an account?
          </Link>
        </div>
      </aside>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-low)] reveal reveal-delay-1">
        <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Account Methods</p>
        <form className="space-y-3">
          <Input name="username" placeholder="Username" autoComplete="username" />
          <Input name="email" type="email" placeholder="Email address" autoComplete="email" />
          <Input name="password" type="password" placeholder="Password" autoComplete="new-password" />
          <Input name="confirmPassword" type="password" placeholder="Confirm password" autoComplete="new-password" />
          <Button type="button" className="w-full justify-center">Create Account</Button>
        </form>
        <div className="mt-3">
          <Button type="button" variant="outline" className="w-full justify-center">Continue with Google</Button>
        </div>
        <Link
          href="/login"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2 text-sm font-extrabold text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
        >
          Next: Login with Discogs
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
