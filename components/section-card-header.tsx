import type { ReactNode } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionCardHeader({
  actions,
  className,
  description,
  title,
  titleClassName,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
  titleClassName?: string;
}) {
  return (
    <CardHeader className={cn(actions ? "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" : "", className)}>
      <div>
        <CardTitle className={titleClassName}>{title}</CardTitle>
        {description ? <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </CardHeader>
  );
}
