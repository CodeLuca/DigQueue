import Link from "next/link";
import {
  buildDiscogsOAuthStartPath,
  buildGoogleAuthStartPath,
  buildYoutubeOAuthStartPath,
} from "@/lib/auth-provider-paths";
import { getHighlightActionClassName } from "@/components/highlight-action";

type AuthStartProvider = "discogs" | "google" | "youtube";

export function AuthStartLink({
  provider,
  nextPath,
  className,
  children,
  highlighted = false,
}: {
  provider: AuthStartProvider;
  nextPath?: string | null;
  className?: string;
  children: React.ReactNode;
  highlighted?: boolean;
}) {
  const href =
    provider === "discogs"
      ? buildDiscogsOAuthStartPath(nextPath)
      : provider === "youtube"
        ? buildYoutubeOAuthStartPath(nextPath)
        : buildGoogleAuthStartPath(nextPath);

  return (
    <Link href={href} className={highlighted ? getHighlightActionClassName({ className }) : className}>
      {children}
    </Link>
  );
}
