import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function GuideCard({
  children,
  className,
  contentClassName,
  title,
  titleIcon,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  title: ReactNode;
  titleIcon?: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex items-center gap-2">
        {titleIcon}
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className={cn("space-y-2 text-sm", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
