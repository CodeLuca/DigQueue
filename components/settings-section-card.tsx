import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionCardHeader } from "@/components/section-card-header";
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
      <SectionCardHeader
        className={headerClassName}
        description={description}
        title={title}
        titleClassName="text-xl"
      />
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
