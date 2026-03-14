import Link from "next/link";
import { buildDiscogsConnectPath } from "@/lib/auth-provider-paths";

export function DiscogsConnectLink({
  nextPath,
  className,
  children,
}: {
  nextPath?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={buildDiscogsConnectPath(nextPath, { fallback: "/" })} className={className}>
      {children}
    </Link>
  );
}
