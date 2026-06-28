import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type HighlightActionSize = "sm" | "md" | "lg";
type HighlightActionWidth = "auto" | "full";
type HighlightActionWeight = "semibold" | "bold" | "extrabold";

export function getHighlightActionClassName(input?: {
  size?: HighlightActionSize;
  width?: HighlightActionWidth;
  weight?: HighlightActionWeight;
  className?: string;
}) {
  const size = input?.size ?? "md";
  const width = input?.width ?? "auto";
  const weight = input?.weight ?? "semibold";
  const sizeClassName =
    size === "sm"
      ? "px-3 py-1.5 text-xs"
      : size === "lg"
        ? "px-4 py-2.5 text-sm"
        : "px-4 py-2 text-sm";
  const widthClassName = width === "full" ? "w-full" : "";
  const weightClassName =
    weight === "extrabold" ? "font-extrabold" : weight === "bold" ? "font-bold" : "font-semibold";

  return [
    "inline-flex items-center justify-center gap-2 rounded-md border border-[#f2cd8a] bg-[#e7b566] !text-black",
    "shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80",
    widthClassName,
    sizeClassName,
    weightClassName,
    input?.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function HighlightActionLink({
  href,
  children,
  className,
  size,
  weight,
  width,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  size?: HighlightActionSize;
  weight?: HighlightActionWeight;
  width?: HighlightActionWidth;
}) {
  return (
    <Link href={href} className={getHighlightActionClassName({ className, size, weight, width })}>
      {children}
    </Link>
  );
}

export function HighlightActionButton({
  children,
  className,
  size,
  type = "button",
  weight,
  width,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  className?: string;
  size?: HighlightActionSize;
  weight?: HighlightActionWeight;
  width?: HighlightActionWidth;
}) {
  return (
    <button
      type={type}
      {...props}
      className={getHighlightActionClassName({ className, size, weight, width })}
    >
      {children}
    </button>
  );
}
