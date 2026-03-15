"use client";

import type { ReactNode } from "react";
import { PresetActionButton } from "@/components/preset-action-button";

type SourceActionButtonProps = Omit<Parameters<typeof PresetActionButton>[0], "preset" | "size" | "responsiveLayout" | "mobileFullWidth" | "fullSpan"> & {
  children: ReactNode;
  size?: "sm" | "default";
};

export function SourceActionButton({
  children,
  size = "sm",
  ...props
}: SourceActionButtonProps) {
  return (
    <PresetActionButton
      {...props}
      preset="source"
      size={size}
    >
      {children}
    </PresetActionButton>
  );
}
