"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  removeExternalRecommendationByReleaseId,
  removeRecommendationTrackById,
  updateRecommendationReleaseWishlistState,
  updateRecommendationSavedState,
} from "@/lib/client-recommendation-state";
import {
  useAddSourceFromReleaseAction,
  useRecommendationDismissAction,
  useReleaseWishlistAction,
  useTrackTodoAction,
} from "@/lib/use-library-actions";
import {
  addedToWishlistNotice,
  labelAddedAndActivatedNotice,
  libraryAddSourceError,
  libraryDismissRecommendationError,
  libraryRecordWishlistError,
  libraryTrackReviewedError,
  libraryTrackSaveError,
  recommendationDismissedNotice,
  reviewedTrackNotice,
  removedFromWishlistNotice,
  trackSavedToggleNotice,
} from "@/lib/library-action-notices";
import { useRecommendationPlaybackButtonActions } from "@/lib/use-playback-button-actions";

type RecommendationTrackItem = {
  id: number;
  releaseId: number;
  saved?: boolean;
};

type RecommendationReleaseItem = {
  releaseId: number;
};

export function useLibraryRecommendationActions<TItem extends RecommendationTrackItem>(
  track: TItem,
  setItems: Dispatch<SetStateAction<TItem[]>>,
) {
  const { feedback: trackTodoMessage, pendingKey: trackTodoTrackId, runTrackTodo } = useTrackTodoAction<number>();
  const { feedback: trackWishlistMessage, pendingKey: trackWishlistTrackId, runReleaseWishlist } = useReleaseWishlistAction<number>();
  const { feedback: dismissMessage, pendingKey: dismissTrackId, runDismiss } = useRecommendationDismissAction<number>();
  const playback = useRecommendationPlaybackButtonActions(track.id);

  const reviewedPending = trackTodoTrackId === track.id;
  const savePending = trackTodoTrackId === track.id;
  const wishlistPending = trackWishlistTrackId === track.id;
  const dismissPending = dismissTrackId === track.id;
  const loading =
    playback.pending ||
    reviewedPending ||
    wishlistPending ||
    dismissPending;

  const onReviewed = async () => {
    await runTrackTodo(
      track.id,
      { trackIds: [track.id], field: "listened", mode: "set", value: true },
      {
        successMessage: reviewedTrackNotice(),
        onSuccess: () => {
          setItems((prev) => removeRecommendationTrackById(prev, track.id));
        },
        mapError: libraryTrackReviewedError,
      },
    );
  };

  const onSave = async () => {
    await runTrackTodo(track.id, { trackIds: [track.id], field: "saved", mode: "toggle" }, {
      onSuccess: (tracks) => {
        const updated = tracks.find((item) => item.trackId === track.id);
        setItems((prev) =>
          updateRecommendationSavedState(
            prev,
            track.id,
            updated ? updated.saved : !Boolean(prev.find((item) => item.id === track.id)?.saved),
          ),
        );
        playback.setFeedback(trackSavedToggleNotice(updated?.saved));
      },
      mapError: libraryTrackSaveError,
    });
  };

  const onAddRecordWishlist = async () => {
    await runReleaseWishlist(track.id, { releaseId: track.releaseId, mode: "toggle" }, {
      onSuccess: (result) => {
        setItems((prev) => updateRecommendationReleaseWishlistState(prev, [track.releaseId], result.wishlist));
        playback.setFeedback(result.wishlist ? addedToWishlistNotice() : removedFromWishlistNotice());
      },
      mapError: libraryRecordWishlistError,
    });
  };

  const onDismissTrack = async () => {
    await runDismiss(track.id, { trackId: track.id, releaseId: track.releaseId }, {
      successMessage: recommendationDismissedNotice(),
      onSuccess: () => {
        setItems((prev) => removeRecommendationTrackById(prev, track.id));
      },
      mapError: libraryDismissRecommendationError,
    });
  };

  return {
    dismissMessage,
    dismissPending,
    loading,
    onAddRecordWishlist,
    onDismissTrack,
    onReviewed,
    onSave,
    playbackDisabled: playback.disabled,
    playbackFeedback: playback.feedback,
    playbackPending: playback.pending,
    playNow: playback.playNow,
    queueNext: playback.queueNext,
    reviewMessage: trackTodoMessage,
    reviewedPending,
    saveMessage: trackTodoMessage,
    savePending,
    wishlistMessage: trackWishlistMessage,
    wishlistPending,
  };
}

export function useExternalRecommendationActions<TItem extends RecommendationReleaseItem>(
  item: TItem,
  setExternalItems: Dispatch<SetStateAction<TItem[]>>,
) {
  const { feedback: addLabelMessage, pendingKey: externalReleaseId, runAddSource } = useAddSourceFromReleaseAction<number>();
  const { feedback: wantMessage, pendingKey: externalWishlistReleaseId, runReleaseWishlist } = useReleaseWishlistAction<number>();
  const { feedback: dismissMessage, pendingKey: externalDismissReleaseId, runDismiss } = useRecommendationDismissAction<number>();

  const addLabelPending = externalReleaseId === item.releaseId;
  const wantPending = externalWishlistReleaseId === item.releaseId;
  const dismissPending = externalDismissReleaseId === item.releaseId;
  const loading =
    addLabelPending ||
    wantPending ||
    dismissPending;

  const removeItem = () => {
    setExternalItems((prev) => removeExternalRecommendationByReleaseId(prev, item.releaseId));
  };

  const onAddLabel = async () => {
    await runAddSource(item.releaseId, item.releaseId, {
      successMessage: labelAddedAndActivatedNotice(),
      onSuccess: removeItem,
      mapError: libraryAddSourceError,
    });
  };

  const onWant = async () => {
    await runReleaseWishlist(item.releaseId, { releaseId: item.releaseId, mode: "set", value: true }, {
      successMessage: addedToWishlistNotice(),
      onSuccess: removeItem,
      mapError: libraryRecordWishlistError,
    });
  };

  const onDismiss = async () => {
    await runDismiss(item.releaseId, { releaseId: item.releaseId }, {
      successMessage: recommendationDismissedNotice(),
      onSuccess: removeItem,
      mapError: libraryDismissRecommendationError,
    });
  };

  return {
    addLabelMessage,
    addLabelPending,
    dismissMessage,
    dismissPending,
    loading,
    onAddLabel,
    onDismiss,
    onWant,
    wantMessage,
    wantPending,
  };
}
