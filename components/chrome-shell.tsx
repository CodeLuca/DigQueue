"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { ClientErrorBoundary } from "@/components/client-error-boundary";
import { MiniPlayer } from "@/components/mini-player";

const publicRoutes = new Set(["/welcome", "/login", "/register", "/reset-password", "/connect-discogs", "/how-to-use"]);

function navFallback() {
  return (
    <div className="sticky top-0 z-40 border-b border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-bg)_88%,black_12%)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2 md:px-8">
        <Link href="/welcome" className="text-lg font-semibold tracking-tight">DigQueue</Link>
        <Link
          href="/login"
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-1.5 text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]"
        >
          Login
        </Link>
      </div>
    </div>
  );
}

export function ChromeShell() {
  const pathname = usePathname();
  const isPublicRoute = publicRoutes.has(pathname);

  return (
    <>
      <ClientErrorBoundary name="app-nav" fallback={navFallback()}>
        <AppNav />
      </ClientErrorBoundary>
      {isPublicRoute ? null : (
        <ClientErrorBoundary name="mini-player">
          <MiniPlayer />
        </ClientErrorBoundary>
      )}
    </>
  );
}
