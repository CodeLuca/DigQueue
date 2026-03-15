"use client";

import type { ReactNode } from "react";
import { MutationActionButton } from "@/components/mutation-action-button";

type SourceActionButtonProps = Omit<Parameters<typeof MutationActionButton>[0], "preset" | "size"> & {
  children: ReactNode;
  size?: "sm" | "default";
};

export function SourceActionButton({
  children,
  size = "sm",
  ...props
}: SourceActionButtonProps) {
  return (
    <MutationActionButton
      {...props}
      preset="source"
      size={size}
    >
      {children}
    </MutationActionButton>
  );
}
