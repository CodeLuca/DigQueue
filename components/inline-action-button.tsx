"use client";

import type { ReactNode } from "react";
import { MutationActionButton } from "@/components/mutation-action-button";
import { responsiveActionWidthClassName } from "@/components/responsive-action-button-layout";
import { cn } from "@/lib/utils";

type InlineActionButtonProps = Omit<Parameters<typeof MutationActionButton>[0], "preset" | "className" | "size"> & {
  children: ReactNode;
  className?: string;
  mobileFullWidth?: boolean;
  size?: "sm" | "default";
};

export function InlineActionButton({
  children,
  className,
  mobileFullWidth = false,
  size = "sm",
  ...props
}: InlineActionButtonProps) {
  return (
    <MutationActionButton
      {...props}
      preset="inline"
      size={size}
      className={cn(mobileFullWidth && responsiveActionWidthClassName(), className)}
    >
      {children}
    </MutationActionButton>
  );
}
