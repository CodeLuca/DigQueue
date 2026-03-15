"use client";

import type { ReactNode } from "react";
import { MutationActionButton } from "@/components/mutation-action-button";
import { responsiveActionButtonLayout } from "@/components/responsive-action-button-layout";
import { cn } from "@/lib/utils";

export function PlaybackActionButton({
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
      preset="playback"
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
