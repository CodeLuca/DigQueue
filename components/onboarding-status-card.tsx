import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOnboardingToneClass, type OnboardingSnapshot } from "@/lib/onboarding-snapshot";

type OnboardingStatusCardProps = {
  snapshot: OnboardingSnapshot;
  title: string;
  className?: string;
  titleIcon?: ReactNode;
  actionVariant?: "default" | "outline";
  actionSize?: "default" | "sm" | "lg";
  optionalActionVariant?: "ghost" | "outline";
  summaryClassName?: string;
  statsClassName?: string;
  showConnectionBadges?: boolean;
  extraActions?: ReactNode;
};

export function OnboardingStatusCard({
  snapshot,
  title,
  className,
  titleIcon,
  actionVariant = "outline",
  actionSize = "sm",
  optionalActionVariant = "ghost",
  summaryClassName = "text-[var(--color-muted)]",
  statsClassName = "grid min-w-[200px] gap-2 text-xs text-[var(--color-muted)] sm:text-right",
  showConnectionBadges = false,
  extraActions,
}: OnboardingStatusCardProps) {
  const toneClass = getOnboardingToneClass(snapshot.health.tone);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          {titleIcon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
              {snapshot.health.label}
            </span>
            <div className="mt-2">
              <p className="font-medium">{snapshot.health.title}</p>
              <p className={`mt-1 ${summaryClassName}`}>{snapshot.health.summary}</p>
            </div>
          </div>
          <div className={statsClassName}>
            <p>Discogs: <span className="mono">{snapshot.discogsConnected ? "connected" : "not connected"}</span></p>
            <p>Sources: <span className="mono">{snapshot.sourceCount}</span></p>
            <p>Active sources: <span className="mono">{snapshot.activeSourceCount}</span></p>
            <p>Queue-ready items: <span className="mono">{snapshot.queueCount}</span></p>
          </div>
        </div>

        {showConnectionBadges ? (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className={snapshot.discogsConnected ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200" : "border-amber-600/50 text-amber-300"}>
              {snapshot.discogsConnected ? "Discogs Personal Connected" : "Discogs Not Connected"}
            </Badge>
            <Badge className={snapshot.youtubeOAuthConnected ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200" : "border-[var(--color-border)] text-[var(--color-muted)]"}>
              {snapshot.youtubeOAuthConnected ? "YouTube Export Connected" : snapshot.youtubeOAuthConfigured ? "YouTube Export Optional" : "YouTube OAuth Not Configured"}
            </Badge>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {snapshot.health.nextSteps.map((step, index) => (
            <Link key={step.href + step.label} href={step.href}>
              <Button type="button" size={actionSize} variant={index === 0 ? actionVariant : "outline"}>{step.label}</Button>
            </Link>
          ))}
          {extraActions}
          {snapshot.health.optionalStep ? (
            <Link href={snapshot.health.optionalStep.href}>
              <Button type="button" size={actionSize} variant={optionalActionVariant}>{snapshot.health.optionalStep.label}</Button>
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
