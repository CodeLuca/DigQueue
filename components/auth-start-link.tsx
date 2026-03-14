import Link from "next/link";
import {
  buildDiscogsOAuthStartPath,
  buildGoogleAuthStartPath,
  buildYoutubeOAuthStartPath,
} from "@/lib/auth-provider-paths";

type AuthStartProvider = "discogs" | "google" | "youtube";

export function AuthStartLink({
  provider,
  nextPath,
  className,
  children,
}: {
  provider: AuthStartProvider;
  nextPath?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const href =
    provider === "discogs"
      ? buildDiscogsOAuthStartPath(nextPath)
      : provider === "youtube"
        ? buildYoutubeOAuthStartPath(nextPath)
        : buildGoogleAuthStartPath(nextPath);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
