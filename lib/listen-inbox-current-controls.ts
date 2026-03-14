import {
  getTrackSaveActionLabels,
} from "@/lib/library-action-labels";
import type { ListenRow } from "@/lib/listen-inbox-types";

export type ListenInboxCurrentRow = Pick<
  ListenRow,
  "labelName" | "position" | "releaseDiscogsUrl" | "releaseId" | "saved" | "trackId" | "trackTitle"
>;

export function getListenInboxCurrentTrackSaveProps(saved: boolean) {
  const labels = getTrackSaveActionLabels(saved);
  return {
    saveAriaLabel: labels.ariaLabel,
    saveTitle: labels.title,
  };
}
