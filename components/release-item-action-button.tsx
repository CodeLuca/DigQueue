"use client";

import type { ReactNode } from "react";
import { MutationActionButton } from "@/components/mutation-action-button";

type ReleaseItemActionButtonProps = Omit<Parameters<typeof MutationActionButton>[0], "preset" | "size"> & {
  children: ReactNode;
  size?: "sm" | "default";
};

export function ReleaseItemActionButton({
  children,
  size = "sm",
  ...props
}: ReleaseItemActionButtonProps) {
  return (
    <MutationActionButton
      {...props}
      preset="releaseItem"
      size={size}
    >
      {children}
    </MutationActionButton>
  );
}
