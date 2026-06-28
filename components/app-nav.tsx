"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, CircleHelp, Disc3, Inbox, Lightbulb, LogIn, Settings, UserPlus } from "lucide-react";
import { ResponsiveLabel } from "@/components/responsive-label";
import { dashboardTabHref, normalizeDashboardTab } from "@/lib/app-tabs";

function itemClass(active: boolean) {
  return active
    ? "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface2)_80%)] px-2 py-1.5 text-center text-xs font-medium leading-tight text-[var(--color-text)] whitespace-nowrap shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_45%,transparent)] sm:px-3 sm:text-sm"
    : "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-2 py-1.5 text-center text-xs leading-tight text-[var(--color-muted)] whitespace-nowrap hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] sm:px-3 sm:text-sm";
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
    pathname === "/connect-discogs" ||
    pathname === "/how-to-use" ||
    pathname === "/reset-password";

  if (isMarketingRoute) {
    return (
      <div className="sticky top-0 z-40 border-b border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-bg)_88%,black_12%)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-2 md:flex-row md:items-center md:justify-between md:gap-4 md:px-8">
          <Link href="/login" className="text-lg font-semibold tracking-tight">DigQueue</Link>
          <nav className="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-nowrap md:justify-end">
            <Link href="/login" className={itemClass(pathname === "/login" && authMode !== "register")} title="Sign in to your account"><LogIn className="h-3.5 w-3.5" />Login</Link>
            <Link href="/register" className={itemClass(pathname === "/register" || (pathname === "/login" && authMode === "register"))} title="Create a new account"><UserPlus className="h-3.5 w-3.5" />Register</Link>
          </nav>
        </div>
      </div>
    );
  }

  const activeTab = normalizeDashboardTab(searchParams.get("tab"));
  const listenHref = dashboardTabHref("listen");
  const sourcesHref = dashboardTabHref("sources");
  const libraryHref = activeTab === "listen" ? "/?tab=library&libraryView=history" : dashboardTabHref("library");
  const discoverHref = dashboardTabHref("discover");
  const prefetchRoute = (href: string) => {
    router.prefetch(href);
  };

  return (
    <div className="sticky top-0 z-40 border-b border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-bg)_88%,black_12%)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-2 md:flex-row md:items-center md:justify-between md:gap-4 md:px-8">
        <Link href="/welcome" className="text-lg font-semibold tracking-tight">DigQueue</Link>
        <nav className="flex w-full items-center gap-1.5 overflow-x-auto rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)]/30 p-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:w-auto md:flex-nowrap md:justify-end" aria-label="Primary tabs">
          <Link href={listenHref} className={itemClass(pathname === "/" && activeTab === "listen")} title="Play tracks and make quick decisions" onMouseEnter={() => prefetchRoute(listenHref)} onFocus={() => prefetchRoute(listenHref)} aria-current={pathname === "/" && activeTab === "listen" ? "page" : undefined}><Inbox className="h-3.5 w-3.5" /><ResponsiveLabel compact="Listen" full="Listen Desk" /></Link>
          <Link href={sourcesHref} className={itemClass(pathname === "/" && activeTab === "sources")} title="Add and scan Discogs sources" onMouseEnter={() => prefetchRoute(sourcesHref)} onFocus={() => prefetchRoute(sourcesHref)} aria-current={pathname === "/" && activeTab === "sources" ? "page" : undefined}><Disc3 className="h-3.5 w-3.5" /><span>Sources</span></Link>
          <Link href={libraryHref} className={itemClass(pathname === "/" && activeTab === "library")} title="Saved tracks, Discogs wishlist, and played/reviewed history" onMouseEnter={() => prefetchRoute(libraryHref)} onFocus={() => prefetchRoute(libraryHref)} aria-current={pathname === "/" && activeTab === "library" ? "page" : undefined}><Bookmark className="h-3.5 w-3.5" />Library</Link>
          <Link href={discoverHref} className={itemClass(pathname === "/" && activeTab === "discover")} title="New finds from your activity" onMouseEnter={() => prefetchRoute(discoverHref)} onFocus={() => prefetchRoute(discoverHref)} aria-current={pathname === "/" && activeTab === "discover" ? "page" : undefined}><Lightbulb className="h-3.5 w-3.5" /><ResponsiveLabel compact="Finds" full="Discover" /></Link>
          <Link href="/how-to-use" className={itemClass(pathname === "/how-to-use")} title="Read a full first-time user guide" onMouseEnter={() => prefetchRoute("/how-to-use")} onFocus={() => prefetchRoute("/how-to-use")} aria-current={pathname === "/how-to-use" ? "page" : undefined}><CircleHelp className="h-3.5 w-3.5" /><ResponsiveLabel compact="Guide" full="How to use" /></Link>
          <Link href="/settings" className={itemClass(pathname === "/settings")} title="Configure API keys and integrations" onMouseEnter={() => prefetchRoute("/settings")} onFocus={() => prefetchRoute("/settings")} aria-current={pathname === "/settings" ? "page" : undefined}><Settings className="h-3.5 w-3.5" />Settings</Link>
        </nav>
      </div>
    </div>
  );
}
