import Link from "next/link";
import { getHighlightActionClassName } from "@/components/highlight-action";
import { buildDiscogsConnectPath } from "@/lib/auth-provider-paths";

export function DiscogsConnectLink({
  nextPath,
  className,
  children,
  highlighted = false,
}: {
  nextPath?: string | null;
  className?: string;
  children: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <Link
      href={buildDiscogsConnectPath(nextPath, { fallback: "/" })}
      className={highlighted ? getHighlightActionClassName({ className }) : className}
    >
      {children}
    </Link>
  );
}
