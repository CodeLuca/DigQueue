"use client";

import { useCallback } from "react";
import type { ClientFetcher } from "@/lib/client-fetcher";
import {
  runAddSourceFromReleaseMutationAndDispatch,
  runRecommendationDismissMutationAndDispatch,
  runReleaseReviewedMutationAndDispatch,
  runReleaseWishlistMutationAndDispatch,
  runTrackMatchSelectionMutationAndDispatch,
  runTrackTodoMutationAndDispatch,
  type TrackTodoPayload,
} from "@/lib/client-library-action-service";

type LibraryMutationOptions = {
  fetcher?: ClientFetcher;
  unauthorizedMessage?: string;
};

export function useTrackTodoClientAction(requestOptions?: LibraryMutationOptions) {
  return useCallback(
    (payload: TrackTodoPayload) => runTrackTodoMutationAndDispatch(payload, requestOptions),
    [requestOptions],
  );
}

export function useReleaseWishlistClientAction(requestOptions?: LibraryMutationOptions) {
  return useCallback(
    (payload: { releaseId: number; mode?: "toggle" | "set"; value?: boolean }) =>
      runReleaseWishlistMutationAndDispatch(payload, requestOptions),
    [requestOptions],
  );
}

export function useReleaseReviewedClientAction(requestOptions?: LibraryMutationOptions) {
  return useCallback(
    (releaseId: number) => runReleaseReviewedMutationAndDispatch(releaseId, requestOptions),
    [requestOptions],
  );
}

export function useAddSourceFromReleaseClientAction(requestOptions?: LibraryMutationOptions) {
  return useCallback(
    (releaseId: number) => runAddSourceFromReleaseMutationAndDispatch(releaseId, requestOptions),
    [requestOptions],
  );
}

export function useRecommendationDismissClientAction(requestOptions?: LibraryMutationOptions) {
  return useCallback(
    (payload: { trackId?: number; releaseId?: number }) =>
      runRecommendationDismissMutationAndDispatch(payload, requestOptions),
    [requestOptions],
  );
}

export function useTrackMatchSelectionClientAction(requestOptions?: LibraryMutationOptions) {
  return useCallback(
    (payload: { trackId: number; matchId: number }) =>
      runTrackMatchSelectionMutationAndDispatch(payload, requestOptions),
    [requestOptions],
  );
}
