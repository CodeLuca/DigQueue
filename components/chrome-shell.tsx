"use client";

import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { LabelSyncDaemon } from "@/components/label-sync-daemon";
import { MiniPlayer } from "@/components/mini-player";

const publicRoutes = new Set(["/welcome", "/login", "/register", "/reset-password", "/how-to-use"]);

export function ChromeShell() {
  const pathname = usePathname();
  const isPublicRoute = publicRoutes.has(pathname);

  return (
    <>
      <AppNav />
      {isPublicRoute ? null : (
        <>
          <LabelSyncDaemon />
          <MiniPlayer />
        </>
      )}
    </>
  );
}
