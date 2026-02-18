"use client";

import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { MiniPlayer } from "@/components/mini-player";

const publicRoutes = new Set(["/welcome", "/login", "/register", "/connect-discogs"]);

export function ChromeShell() {
  const pathname = usePathname();
  const isPublicRoute = publicRoutes.has(pathname);

  return (
    <>
      <AppNav />
      {isPublicRoute ? null : <MiniPlayer />}
    </>
  );
}
