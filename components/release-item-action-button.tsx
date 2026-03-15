"use client";

import type { ReactNode } from "react";
import { PresetActionButton } from "@/components/preset-action-button";

type ReleaseItemActionButtonProps = Omit<Parameters<typeof PresetActionButton>[0], "preset" | "size" | "responsiveLayout" | "mobileFullWidth" | "fullSpan"> & {
  children: ReactNode;
  size?: "sm" | "default";
};

export function ReleaseItemActionButton({
  children,
  size = "sm",
  ...props
}: ReleaseItemActionButtonProps) {
  return (
    <PresetActionButton
      {...props}
      preset="releaseItem"
      size={size}
    >
      {children}
    </PresetActionButton>
  );
}
