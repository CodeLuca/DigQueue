"use client";

import type { ReactNode } from "react";
import { MutationActionButton } from "@/components/mutation-action-button";
import {
  responsiveActionButtonLayout,
  responsiveActionWidthClassName,
} from "@/components/responsive-action-button-layout";
import { cn } from "@/lib/utils";

type MutationActionButtonProps = Parameters<typeof MutationActionButton>[0];

type PresetActionButtonProps = Omit<MutationActionButtonProps, "className"> & {
  children: ReactNode;
  className?: string;
  fullSpan?: boolean;
  mobileFullWidth?: boolean;
  responsiveLayout?: boolean;
};

export function PresetActionButton({
  children,
  className,
  fullSpan = false,
  mobileFullWidth = false,
  responsiveLayout = false,
  ...props
}: PresetActionButtonProps) {
  return (
    <MutationActionButton
      {...props}
      className={cn(
        responsiveLayout && responsiveActionButtonLayout({ fullSpan }),
        mobileFullWidth && responsiveActionWidthClassName(),
        className,
      )}
    >
      {children}
    </MutationActionButton>
  );
}
