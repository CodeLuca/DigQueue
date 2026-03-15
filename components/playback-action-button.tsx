"use client";

import type { ReactNode } from "react";
import { MutationActionButton } from "@/components/mutation-action-button";
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
        fullSpan
          ? "col-span-2 w-full justify-center sm:col-auto sm:w-auto sm:justify-start"
          : "w-full justify-center sm:w-auto sm:justify-start",
        className,
      )}
    >
      {children}
    </MutationActionButton>
  );
}
