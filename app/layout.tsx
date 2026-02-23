import type { Metadata } from "next";
import { Suspense } from "react";
import { ChromeShell } from "@/components/chrome-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DigQueue",
    template: "%s | DigQueue",
  },
  description: "Discogs queue + YouTube digging workflow for tracking, reviewing, and saving standout tracks.",
  applicationName: "DigQueue",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000"),
  openGraph: {
    type: "website",
    siteName: "DigQueue",
    title: "DigQueue",
    description: "Discogs queue + YouTube digging workflow for tracking, reviewing, and saving standout tracks.",
    images: [{ url: "/icon.svg", width: 512, height: 512, alt: "DigQueue" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DigQueue",
    description: "Discogs queue + YouTube digging workflow for tracking, reviewing, and saving standout tracks.",
    images: ["/icon.svg"],
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: ["/favicon.ico"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
        <Suspense fallback={<div className="h-12 border-b border-[var(--color-border-soft)]" />}>
          <ChromeShell />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
