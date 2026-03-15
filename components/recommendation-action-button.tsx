"use client";

import type { ReactNode } from "react";
import { PresetActionButton } from "@/components/preset-action-button";

export function RecommendationActionButton({
  children,
  className,
  fullSpan = false,
  ...props
}: Omit<Parameters<typeof PresetActionButton>[0], "className" | "preset" | "size" | "responsiveLayout"> & {
  children: ReactNode;
  className?: string;
  fullSpan?: boolean;
}) {
  return (
    <PresetActionButton
      {...props}
      preset="recommendation"
      size="sm"
      responsiveLayout
      fullSpan={fullSpan}
      className={className}
    >
      {children}
    </PresetActionButton>
  );
}
