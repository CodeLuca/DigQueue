"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ActionRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
