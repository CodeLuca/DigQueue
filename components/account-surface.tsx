import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AccountSurfaceWidth = "sm" | "md" | "lg";

function getMaxWidthClassName(width: AccountSurfaceWidth) {
  switch (width) {
    case "sm":
      return "max-w-[760px]";
    case "md":
      return "max-w-[900px]";
    default:
      return "max-w-[980px]";
  }
}

export function AccountSurface({
  title,
  description,
  width = "lg",
  accent = true,
  sectionClassName,
  descriptionClassName,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  width?: AccountSurfaceWidth;
  accent?: boolean;
  sectionClassName?: string;
  descriptionClassName?: string;
  children: ReactNode;
}) {
  return (
    <main className={cn("mx-auto min-h-[calc(100dvh-10rem)] px-3 py-6 sm:px-4 md:px-8 md:py-8", getMaxWidthClassName(width))}>
      <section
        className={cn(
          "relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-low)] reveal sm:p-6",
          accent ? "overflow-hidden md:p-8" : "",
          sectionClassName,
        )}
      >
        <h1 className={cn("text-2xl font-semibold tracking-tight sm:text-3xl", accent ? "mt-3 md:text-4xl" : "")}>{title}</h1>
        {description ? (
          <p className={cn("mt-3 max-w-2xl text-sm text-[var(--color-muted)]", accent ? "md:text-base" : "", descriptionClassName)}>
            {description}
          </p>
        ) : null}
        {children}
      </section>
    </main>
  );
}
