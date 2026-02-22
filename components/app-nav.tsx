"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, CircleHelp, Disc3, Inbox, LogIn, Settings, UserPlus } from "lucide-react";

function itemClass(active: boolean) {
  return active
    ? "inline-flex w-full min-h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface2)_80%)] px-3 py-1.5 text-center text-sm font-medium leading-tight text-[var(--color-text)] whitespace-nowrap shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_45%,transparent)] sm:w-auto sm:shrink-0"
    : "inline-flex w-full min-h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-1.5 text-center text-sm leading-tight text-[var(--color-muted)] whitespace-nowrap hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] sm:w-auto sm:shrink-0";
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authMode = searchParams.get("mode");
  const isMarketingRoute =
    pathname === "/welcome" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/reset-password" ||
    pathname === "/connect-discogs";

  if (isMarketingRoute) {
    return (
      <div className="sticky top-0 z-40 border-b border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-bg)_88%,black_12%)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-2 md:flex-row md:items-center md:justify-between md:gap-4 md:px-8">
          <Link href="/welcome" className="text-lg font-semibold tracking-tight">DigQueue</Link>
          <nav className="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-nowrap md:justify-end">
            <Link href="/how-to-use" className={itemClass(false)} title="Read a full first-time user guide"><CircleHelp className="h-3.5 w-3.5" />How to use</Link>
            <Link href="/login" className={itemClass(pathname === "/login" && authMode !== "register")} title="Sign in to your account"><LogIn className="h-3.5 w-3.5" />Login</Link>
            <Link href="/login?mode=register" className={itemClass(pathname === "/login" && authMode === "register")} title="Create a new account"><UserPlus className="h-3.5 w-3.5" />Register</Link>
          </nav>
        </div>
      </div>
    );
  }

  const rawTab = searchParams.get("tab");
  const normalizedTab =
    rawTab === "step-3" ? "step-2" : rawTab === "played-done" || rawTab === "played-reviewed" || rawTab === "wishlist" ? "library" : rawTab;
  const activeTab =
    normalizedTab === "step-2" ||
    normalizedTab === "library" ||
    normalizedTab === "recommendations"
      ? normalizedTab
      : "step-1";
  const libraryHref = activeTab === "step-2" ? "/?tab=library&libraryView=history" : "/?tab=library";
  const prefetchRoute = (href: string) => {
    router.prefetch(href);
  };

  return (
    <div className="sticky top-0 z-40 border-b border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-bg)_88%,black_12%)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-2 md:flex-row md:items-center md:justify-between md:gap-4 md:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight">DigQueue</Link>
        <nav className="grid w-full grid-cols-2 gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)]/30 p-2 sm:flex sm:items-center sm:gap-2 sm:overflow-x-auto sm:pb-2 md:w-auto md:flex-nowrap md:justify-end md:pb-2" aria-label="Primary tabs">
          <Link href="/?tab=step-1" className={itemClass(pathname === "/" && activeTab === "step-1")} title="Manage sources and ingestion" onMouseEnter={() => prefetchRoute("/?tab=step-1")} onFocus={() => prefetchRoute("/?tab=step-1")} aria-current={pathname === "/" && activeTab === "step-1" ? "page" : undefined}><Disc3 className="h-3.5 w-3.5" />Sources</Link>
          <Link href="/?tab=step-2" className={itemClass(pathname === "/" && activeTab === "step-2")} title="Browse and play tracks in your queue" onMouseEnter={() => prefetchRoute("/?tab=step-2")} onFocus={() => prefetchRoute("/?tab=step-2")} aria-current={pathname === "/" && activeTab === "step-2" ? "page" : undefined}><Inbox className="h-3.5 w-3.5" />Listening Station</Link>
          <Link href={libraryHref} className={itemClass(pathname === "/" && activeTab === "library")} title="Saved tracks, Discogs wishlist, and played/reviewed history" onMouseEnter={() => prefetchRoute(libraryHref)} onFocus={() => prefetchRoute(libraryHref)} aria-current={pathname === "/" && activeTab === "library" ? "page" : undefined}><Bookmark className="h-3.5 w-3.5" />Library</Link>
          <Link href="/how-to-use" className={itemClass(pathname === "/how-to-use")} title="Read a full first-time user guide" onMouseEnter={() => prefetchRoute("/how-to-use")} onFocus={() => prefetchRoute("/how-to-use")} aria-current={pathname === "/how-to-use" ? "page" : undefined}><CircleHelp className="h-3.5 w-3.5" />How to use</Link>
          <Link href="/settings" className={itemClass(pathname === "/settings")} title="Configure API keys and integrations" onMouseEnter={() => prefetchRoute("/settings")} onFocus={() => prefetchRoute("/settings")} aria-current={pathname === "/settings" ? "page" : undefined}><Settings className="h-3.5 w-3.5" />Settings</Link>
        </nav>
      </div>
    </div>
  );
}
