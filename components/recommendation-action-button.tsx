"use client";

import type { ReactNode } from "react";
import { MutationActionButton } from "@/components/mutation-action-button";
import { responsiveActionButtonLayout } from "@/components/responsive-action-button-layout";
import { cn } from "@/lib/utils";

export function RecommendationActionButton({
  children,
  className,
  fullSpan = false,
  ...props
}: Omit<Parameters<typeof MutationActionButton>[0], "className" | "preset" | "size"> & {
  children: ReactNode;
  className?: string;
  fullSpan?: boolean;
}) {
  return (
    <MutationActionButton
      {...props}
      preset="recommendation"
      size="sm"
      className={cn(
        responsiveActionButtonLayout({ fullSpan }),
        className,
      )}
    >
      {children}
    </MutationActionButton>
  );
}
