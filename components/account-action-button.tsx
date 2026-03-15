"use client";

import type { ReactNode } from "react";
import { MutationActionButton } from "@/components/mutation-action-button";
import { responsiveActionWidthClassName } from "@/components/responsive-action-button-layout";
import { cn } from "@/lib/utils";

type AccountActionButtonProps = Omit<Parameters<typeof MutationActionButton>[0], "preset" | "className" | "size"> & {
  children: ReactNode;
  className?: string;
  mobileFullWidth?: boolean;
  size?: "sm" | "default";
};

export function AccountActionButton({
  children,
  className,
  mobileFullWidth = false,
  size = "sm",
  ...props
}: AccountActionButtonProps) {
  return (
    <MutationActionButton
      {...props}
      preset="account"
      size={size}
      className={cn(mobileFullWidth && responsiveActionWidthClassName(), className)}
    >
      {children}
    </MutationActionButton>
  );
}
