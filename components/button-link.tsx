import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import type { VariantProps } from "class-variance-authority";
import { responsiveActionWidthClassName } from "@/components/responsive-action-button-layout";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "className"> &
  VariantProps<typeof buttonVariants> & {
    className?: string;
    mobileFullWidth?: boolean;
  };

export function ButtonLink({
  className,
  href,
  mobileFullWidth = false,
  size,
  variant,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size }), mobileFullWidth && responsiveActionWidthClassName(), className)}
      {...props}
    />
  );
}
