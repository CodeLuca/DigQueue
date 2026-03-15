import type { ReactNode } from "react";
import { responsiveActionWidthClassName } from "@/components/responsive-action-button-layout";
import { cn } from "@/lib/utils";

type AppPageHeaderTone = "default" | "compact";

export function AppPageHeader({
  actions,
  className,
  description,
  title,
  titleClassName,
  tone = "default",
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
  titleClassName?: string;
  tone?: AppPageHeaderTone;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between",
        tone === "compact" ? "mb-4 sm:items-center" : "mb-5 sm:items-end",
        className,
      )}
    >
      <div>
        <h1
          className={cn(
            tone === "compact" ? "text-xl font-semibold" : "text-2xl font-semibold tracking-tight",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {description ? <p className="text-sm text-[var(--color-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className={responsiveActionWidthClassName()}>{actions}</div> : null}
    </header>
  );
}
