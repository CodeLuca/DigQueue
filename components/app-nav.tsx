"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, Disc3, History, Inbox, Lightbulb, LogIn, Settings, UserPlus } from "lucide-react";

function itemClass(active: boolean) {
  return active
    ? "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-[var(--color-accent)] bg-[var(--color-surface2)] px-3 py-1.5 text-xs"
    : "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-surface2)]";
}

export function AppNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMarketingRoute =
    pathname === "/welcome" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/connect-discogs";

  if (isMarketingRoute) {
    return (
      <div className="sticky top-0 z-40 border-b border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-bg)_88%,black_12%)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-2 md:flex-row md:items-center md:justify-between md:gap-4 md:px-8">
          <Link href="/welcome" className="text-lg font-semibold tracking-tight">DigQueue</Link>
          <nav className="-mx-1 flex w-full items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0 sm:pb-0 md:w-auto md:flex-nowrap md:justify-end md:pb-0">
            <Link href="/login" className={itemClass(pathname === "/login")} title="Sign in to your account"><LogIn className="h-3.5 w-3.5" />Login</Link>
            <Link href="/register" className={itemClass(pathname === "/register")} title="Create a new account"><UserPlus className="h-3.5 w-3.5" />Register</Link>
          </nav>
        </div>
      </div>
    );
  }

  const rawTab = searchParams.get("tab");
  const normalizedTab = rawTab === "step-3" ? "step-2" : rawTab === "played-done" ? "played-reviewed" : rawTab;
  const activeTab =
    normalizedTab === "step-2" ||
    normalizedTab === "wishlist" ||
    normalizedTab === "played-reviewed" ||
    normalizedTab === "recommendations"
      ? normalizedTab
      : "step-1";

  return (
    <div className="sticky top-0 z-40 border-b border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-bg)_88%,black_12%)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-2 md:flex-row md:items-center md:justify-between md:gap-4 md:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight">DigQueue</Link>
        <nav className="-mx-1 flex w-full items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0 sm:pb-0 md:w-auto md:flex-nowrap md:justify-end md:pb-0">
          <Link href="/?tab=step-1" className={itemClass(pathname === "/" && activeTab === "step-1")} title="Manage label sources and ingestion"><Disc3 className="h-3.5 w-3.5" />Labels</Link>
          <Link href="/?tab=step-2" className={itemClass(pathname === "/" && activeTab === "step-2")} title="Browse and play tracks in your queue"><Inbox className="h-3.5 w-3.5" />Listening Station</Link>
          <Link href="/?tab=wishlist" className={itemClass(pathname === "/" && activeTab === "wishlist")} title="Saved tracks and Discogs wishlist records"><Bookmark className="h-3.5 w-3.5" />Library</Link>
          <Link href="/?tab=played-reviewed" className={itemClass(pathname === "/" && activeTab === "played-reviewed")} title="Review played history and completion"><History className="h-3.5 w-3.5" />Played / Reviewed</Link>
          <Link href="/?tab=recommendations" className={itemClass(pathname === "/" && activeTab === "recommendations")} title="Signal-based recommendations from your activity"><Lightbulb className="h-3.5 w-3.5" />Recommendations</Link>
          <Link href="/settings" className={itemClass(pathname === "/settings")} title="Configure API keys and integrations"><Settings className="h-3.5 w-3.5" />Settings</Link>
        </nav>
      </div>
    </div>
  );
}
