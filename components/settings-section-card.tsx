import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SettingsSectionCardProps = {
  title: ReactNode;
  description?: ReactNode;
  headerClassName?: string;
  contentClassName?: string;
  className?: string;
  children: ReactNode;
};

export function SettingsSectionCard({
  title,
  description,
  headerClassName,
  contentClassName,
  className,
  children,
}: SettingsSectionCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className={headerClassName}>
        <CardTitle className="text-xl">{title}</CardTitle>
        {description ? <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
