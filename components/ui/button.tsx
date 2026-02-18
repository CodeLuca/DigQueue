import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-accent)] text-black hover:brightness-105",
        secondary: "bg-[var(--color-surface2)] text-[var(--color-text)] hover:bg-[color-mix(in_oklab,var(--color-surface2)_70%,black_30%)]",
        ghost: "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface2)]/80",
        destructive: "bg-red-700 text-white hover:bg-red-600",
        outline: "border border-[var(--color-border-soft)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]/80",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 px-2.5 text-xs",
        lg: "h-10 px-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
