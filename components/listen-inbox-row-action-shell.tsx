"use client";

import { DiscogsLink } from "@/components/discogs-link";
import {
  ListenInboxAddLabelAction,
  ListenInboxPlayAction,
  ListenInboxReleaseReviewAction,
  ListenInboxSaveTrackAction,
  ListenInboxTrackReviewAction,
} from "@/components/listen-inbox-row-actions";
import { releaseDiscogsLinkTitle } from "@/lib/library-action-labels";

export function ListenInboxRowActionShell({
  adding,
  added,
  canPlay,
  disabledReason,
  discogsUrl,
  hint,
  iconReviewLoading,
  labelIsActive,
  loading,
  releaseReviewLoading,
  saved,
  saveAriaLabel,
  saveTitle,
  showMobileQuickRail,
  showQueueFilters,
  onAdd,
  onPlay,
  onReviewRelease,
  onReviewTrack,
  onToggleSaved,
}: {
  adding: boolean;
  added: boolean;
  canPlay: boolean;
  disabledReason: string | null;
  discogsUrl: string;
  hint: string | null;
  iconReviewLoading: boolean;
  labelIsActive: boolean;
  loading: boolean;
  releaseReviewLoading: boolean;
  saved: boolean;
  saveAriaLabel: string;
  saveTitle: string;
  showMobileQuickRail: boolean;
  showQueueFilters: boolean;
  onAdd: () => void;
  onPlay: () => void;
  onReviewRelease: () => void;
  onReviewTrack: () => void;
  onToggleSaved: () => void;
}) {
  return (
    <>
      {showQueueFilters && !showMobileQuickRail ? (
        <div className="grid w-full grid-cols-2 gap-2 sm:hidden">
          <DiscogsLink
            className="inline-flex h-10 w-full items-center justify-center"
            discogsUrl={discogsUrl}
            title={releaseDiscogsLinkTitle()}
          />
          <ListenInboxPlayAction
            canPlay={canPlay}
            disabledReason={disabledReason}
            loading={loading}
            onPlay={onPlay}
            hint={hint}
            className="h-10 w-full"
          />
          <ListenInboxTrackReviewAction onReview={onReviewTrack} />
          <ListenInboxReleaseReviewAction
            loading={releaseReviewLoading}
            onReview={onReviewRelease}
          />
          <ListenInboxSaveTrackAction
            saved={saved}
            title={saveTitle}
            ariaLabel={saveAriaLabel}
            onToggle={onToggleSaved}
            className="col-span-2 h-10"
          />
        </div>
      ) : null}

      <div
        className={
          showQueueFilters
            ? "hidden w-full grid-cols-[auto_minmax(0,1fr)] gap-2 sm:ml-auto sm:grid sm:w-[31rem] sm:self-center sm:grid-cols-[2.25rem_8.5rem_2.25rem_2.25rem_8.5rem] sm:items-center sm:justify-end"
            : "flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:self-center sm:flex-nowrap sm:justify-end"
        }
      >
        <DiscogsLink
          className="inline-flex h-9 w-9 items-center justify-center"
          discogsUrl={discogsUrl}
          title={releaseDiscogsLinkTitle()}
        />
        <ListenInboxPlayAction
          canPlay={canPlay}
          disabledReason={disabledReason}
          loading={loading}
          onPlay={onPlay}
          hint={hint}
          className="w-full sm:w-[8.5rem]"
        />
        {showQueueFilters ? (
          <>
            <ListenInboxTrackReviewAction onReview={onReviewTrack} iconOnly />
            <ListenInboxReleaseReviewAction
              loading={iconReviewLoading}
              onReview={onReviewRelease}
              iconOnly
            />
          </>
        ) : (
          <ListenInboxAddLabelAction
            added={added}
            adding={adding}
            labelIsActive={labelIsActive}
            onAdd={onAdd}
          />
        )}
        <ListenInboxSaveTrackAction
          saved={saved}
          title={saveTitle}
          ariaLabel={saveAriaLabel}
          onToggle={onToggleSaved}
          className={`sm:w-[8.5rem] ${showQueueFilters ? "col-span-2 sm:col-auto" : ""}`}
        />
      </div>
    </>
  );
}
