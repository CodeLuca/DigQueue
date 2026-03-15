"use client";

import type { ReactNode } from "react";
import { PresetActionButton } from "@/components/preset-action-button";

type AccountActionButtonProps = Omit<Parameters<typeof PresetActionButton>[0], "preset" | "className" | "size" | "responsiveLayout"> & {
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
    <PresetActionButton
      {...props}
      preset="account"
      size={size}
      mobileFullWidth={mobileFullWidth}
      className={className}
    >
      {children}
    </PresetActionButton>
  );
}
