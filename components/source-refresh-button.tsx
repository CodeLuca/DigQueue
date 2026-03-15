"use client";

import { RefreshCcw } from "lucide-react";
import { ResponsiveLabel } from "@/components/responsive-label";
import { SourceActionButton } from "@/components/source-action-button";
import { useSourceRefreshButtonAction } from "@/lib/use-source-single-actions";

export function SourceRefreshButton(props: {
  labelId: number;
  compactLabel?: boolean;
  className?: string;
}) {
  const { pending, error, message, run } = useSourceRefreshButtonAction();

  const onClick = async () => {
    await run(props.labelId);
  };

  return (
    <SourceActionButton
      type="button"
      size="sm"
      variant="ghost"
      className={props.className}
      title="Refresh this source profile, image, and notable releases"
      ariaLabel="Refresh source info"
      error={error}
      message={message}
      pending={pending}
      pendingChildren="Refreshing..."
      onClick={() => void onClick()}
    >
      <RefreshCcw className="mr-1 h-3.5 w-3.5" />
      <ResponsiveLabel compact="Refresh info" full={props.compactLabel ? "Refresh" : "Refresh source info"} />
    </SourceActionButton>
  );
}
