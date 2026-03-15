"use client";

import type { ReactNode } from "react";
import { PresetActionButton } from "@/components/preset-action-button";

type InlineActionButtonProps = Omit<Parameters<typeof PresetActionButton>[0], "preset" | "className" | "size" | "responsiveLayout"> & {
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
    <PresetActionButton
      {...props}
      preset="inline"
      size={size}
      mobileFullWidth={mobileFullWidth}
      className={className}
    >
      {children}
    </PresetActionButton>
  );
}
