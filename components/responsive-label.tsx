import type { ReactNode } from "react";

export function ResponsiveLabel({
  compact,
  full,
}: {
  compact: ReactNode;
  full: ReactNode;
}) {
  return (
    <>
      <span className="hidden sm:inline">{full}</span>
      <span className="sm:hidden">{compact}</span>
    </>
  );
}
