import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { Suspense } from "react";
import { ChromeShell } from "@/components/chrome-shell";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ variable: "--font-space", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "DigQueue",
  description: "DigQueue: Discogs queue + YouTube digging workflow",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${plexMono.variable} min-h-screen overflow-x-hidden bg-[var(--color-bg)] text-[var(--color-text)] antialiased`}>
        <Suspense fallback={<div className="h-12 border-b border-[var(--color-border-soft)]" />}>
          <ChromeShell />
        </Suspense>
        <div className="pb-36 md:pb-24">{children}</div>
      </body>
    </html>
  );
}
