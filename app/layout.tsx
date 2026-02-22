import type { Metadata } from "next";
import { Suspense } from "react";
import { ChromeShell } from "@/components/chrome-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "DigQueue",
  description: "DigQueue: Discogs queue + YouTube digging workflow",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
        <Suspense fallback={<div className="h-12 border-b border-[var(--color-border-soft)]" />}>
          <ChromeShell />
        </Suspense>
        <div className="pb-36 md:pb-24">{children}</div>
      </body>
    </html>
  );
}
