"use client";

import { Check, Heart } from "lucide-react";
import { MutationActionButton } from "@/components/mutation-action-button";
import { getTrackSaveActionLabels } from "@/lib/library-action-labels";
import { useReleaseTrackTodoButtonAction } from "@/lib/use-library-actions";

export function ReleaseTrackTodoButton(props: {
  trackId: number;
  field: "listened" | "saved";
  active: boolean;
}) {
  const { pending, error, run } = useReleaseTrackTodoButtonAction();

  const onClick = async () => {
    await run(props.trackId, props.field);
  };

  const isListened = props.field === "listened";
  const trackSaveLabels = getTrackSaveActionLabels(props.active);
  const label = isListened
    ? (props.active ? "Listened" : "Mark listened")
    : trackSaveLabels.ariaLabel;

  return (
    <MutationActionButton
      preset="releaseItem"
      type="button"
      size="sm"
      variant={props.active ? "secondary" : (isListened ? "outline" : "ghost")}
      title={label}
      ariaLabel={label}
      error={error}
      pending={pending}
      onClick={() => void onClick()}
    >
      {isListened ? <Check className="h-3.5 w-3.5" /> : <Heart className="h-3.5 w-3.5" />}
    </MutationActionButton>
  );
}
