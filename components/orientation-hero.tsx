import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type OrientationHeroTone = "default" | "guide";

function getToneClassName(tone: OrientationHeroTone) {
  if (tone === "guide") {
    return "rounded-xl border border-[var(--color-border)] bg-[linear-gradient(135deg,rgba(245,158,11,0.14),transparent_48%),var(--color-surface2)] p-4 md:p-6";
  }

  return "marketing-hero reveal";
}

export function OrientationHero({
  actions,
  badgeRow,
  children,
  className,
  description,
  descriptionClassName,
  eyebrow,
  title,
  tone = "default",
}: {
  actions?: ReactNode;
  badgeRow?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  descriptionClassName?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  tone?: OrientationHeroTone;
}) {
  return (
    <section className={cn(getToneClassName(tone), className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">{eyebrow}</p>
      ) : null}
      <h1 className={cn("font-semibold tracking-tight", tone === "guide" ? "mt-1 text-2xl md:text-3xl" : "text-2xl sm:text-3xl md:text-5xl")}>
        {title}
      </h1>
      {description ? (
        <div className={cn("mt-2 max-w-3xl text-sm text-[var(--color-muted)]", tone === "default" ? "md:text-base" : "", descriptionClassName)}>
          {description}
        </div>
      ) : null}
      {badgeRow ? <div className="mt-3 flex flex-wrap gap-2">{badgeRow}</div> : null}
      {children}
      {actions ? <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">{actions}</div> : null}
    </section>
  );
}
