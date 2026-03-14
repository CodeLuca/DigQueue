"use client";

import { useCallback } from "react";
import { createActionRunResult } from "@/lib/action-run-result";
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
import {
  libraryAddSourceError,
  libraryDismissRecommendationError,
  libraryRecordWishlistError,
  libraryReleaseReviewedError,
  libraryTrackUpdateError,
} from "@/lib/library-action-notices";
import { useKeyedAsyncAction } from "@/lib/use-keyed-async-action";

type Key = string | number;
const BUTTON_KEY = "button";

type LibraryMutationOptions = {
  fetcher?: ClientFetcher;
  unauthorizedMessage?: string;
};

export function useTrackTodoAction<TKey extends Key>(requestOptions?: LibraryMutationOptions) {
  const action = useKeyedAsyncAction<TKey>();

  const runTrackTodo = useCallback(
    async (
      key: TKey,
      payload: TrackTodoPayload,
      options?: {
        successMessage?: string | null;
        onSuccess?: (tracks: Awaited<ReturnType<typeof runTrackTodoMutationAndDispatch>>) => void | Promise<void>;
        onError?: (error: unknown) => void | Promise<void>;
        mapError?: (error: unknown) => string | null;
      },
    ) =>
      action.runAction(key, () => runTrackTodoMutationAndDispatch(payload, requestOptions), {
        successMessage: options?.successMessage,
        onSuccess: options?.onSuccess,
        onError: options?.onError,
        mapError: options?.mapError ?? libraryTrackUpdateError,
      }),
    [action, requestOptions],
  );

  return {
    ...action,
    runTrackTodo,
  };
}

export function useReleaseWishlistAction<TKey extends Key>(requestOptions?: LibraryMutationOptions) {
  const action = useKeyedAsyncAction<TKey>();

  const runReleaseWishlist = useCallback(
    async (
      key: TKey,
      payload: { releaseId: number; mode?: "toggle" | "set"; value?: boolean },
      options?: {
        successMessage?: string | null;
        onSuccess?: (result: Awaited<ReturnType<typeof runReleaseWishlistMutationAndDispatch>>) => void | Promise<void>;
        onError?: (error: unknown) => void | Promise<void>;
        mapError?: (error: unknown) => string | null;
      },
    ) =>
      action.runAction(key, () => runReleaseWishlistMutationAndDispatch(payload, requestOptions), {
        successMessage: options?.successMessage,
        onSuccess: options?.onSuccess,
        onError: options?.onError,
        mapError: options?.mapError ?? libraryRecordWishlistError,
      }),
    [action, requestOptions],
  );

  return {
    ...action,
    runReleaseWishlist,
  };
}

export function useReleaseReviewedAction<TKey extends Key>(requestOptions?: LibraryMutationOptions) {
  const action = useKeyedAsyncAction<TKey>();

  const runReleaseReviewed = useCallback(
    async (
      key: TKey,
      releaseId: number,
      options?: {
        successMessage?: string | null;
        onSuccess?: (tracks: Awaited<ReturnType<typeof runReleaseReviewedMutationAndDispatch>>) => void | Promise<void>;
        onError?: (error: unknown) => void | Promise<void>;
        mapError?: (error: unknown) => string | null;
      },
    ) =>
      action.runAction(key, () => runReleaseReviewedMutationAndDispatch(releaseId, requestOptions), {
        successMessage: options?.successMessage,
        onSuccess: options?.onSuccess,
        onError: options?.onError,
        mapError: options?.mapError ?? libraryReleaseReviewedError,
      }),
    [action, requestOptions],
  );

  return {
    ...action,
    runReleaseReviewed,
  };
}

export function useRecommendationDismissAction<TKey extends Key>(requestOptions?: LibraryMutationOptions) {
  const action = useKeyedAsyncAction<TKey>();

  const runDismiss = useCallback(
    async (
      key: TKey,
      payload: { trackId?: number; releaseId?: number },
      options?: {
        successMessage?: string | null;
        onSuccess?: () => void | Promise<void>;
        onError?: (error: unknown) => void | Promise<void>;
        mapError?: (error: unknown) => string | null;
      },
    ) =>
      action.runAction(key, () => runRecommendationDismissMutationAndDispatch(payload, requestOptions), {
        successMessage: options?.successMessage,
        onSuccess: options?.onSuccess,
        onError: options?.onError,
        mapError: options?.mapError ?? libraryDismissRecommendationError,
      }),
    [action, requestOptions],
  );

  return {
    ...action,
    runDismiss,
  };
}

export function useAddSourceFromReleaseAction<TKey extends Key>(requestOptions?: LibraryMutationOptions) {
  const action = useKeyedAsyncAction<TKey>();

  const runAddSource = useCallback(
    async (
      key: TKey,
      releaseId: number,
      options?: {
        successMessage?: string | null;
        onSuccess?: () => void | Promise<void>;
        onError?: (error: unknown) => void | Promise<void>;
        mapError?: (error: unknown) => string | null;
      },
    ) =>
      action.runAction(key, () => runAddSourceFromReleaseMutationAndDispatch(releaseId, requestOptions), {
        successMessage: options?.successMessage,
        onSuccess: options?.onSuccess,
        onError: options?.onError,
        mapError: options?.mapError ?? libraryAddSourceError,
      }),
    [action, requestOptions],
  );

  return {
    ...action,
    runAddSource,
  };
}

export function useTrackMatchSelectionAction<TKey extends Key>(requestOptions?: LibraryMutationOptions) {
  const action = useKeyedAsyncAction<TKey>();

  const runMatchSelection = useCallback(
    async (
      key: TKey,
      payload: { trackId: number; matchId: number },
      options?: {
        successMessage?: string | null;
        onSuccess?: () => void | Promise<void>;
        onError?: (error: unknown) => void | Promise<void>;
        mapError?: (error: unknown) => string | null;
      },
    ) =>
      action.runAction(key, () => runTrackMatchSelectionMutationAndDispatch(payload, requestOptions), {
        successMessage: options?.successMessage,
        onSuccess: options?.onSuccess,
        onError: options?.onError,
        mapError: options?.mapError ?? ((error) => error instanceof Error ? error.message : "Unable to choose track match."),
      }),
    [action, requestOptions],
  );

  return {
    ...action,
    runMatchSelection,
  };
}

export function useReleaseWishlistButtonAction() {
  const action = useReleaseWishlistAction<typeof BUTTON_KEY>();
  const run = useCallback(
    async (releaseId: number) =>
      action.runReleaseWishlist(BUTTON_KEY, {
        releaseId,
        mode: "toggle",
      }),
    [action],
  );

  return createActionRunResult(action.pendingKey !== null, run, { error: action.feedback });
}

export function useReleaseTrackTodoButtonAction() {
  const action = useTrackTodoAction<typeof BUTTON_KEY>();
  const run = useCallback(
    async (trackId: number, field: "listened" | "saved") =>
      action.runTrackTodo(BUTTON_KEY, {
        trackIds: [trackId],
        field,
        mode: "toggle",
      }),
    [action],
  );

  return createActionRunResult(action.pendingKey !== null, run, { error: action.feedback });
}

export function useChooseMatchButtonAction() {
  const action = useTrackMatchSelectionAction<typeof BUTTON_KEY>();
  const run = useCallback(
    async (trackId: number, matchId: number) =>
      action.runMatchSelection(BUTTON_KEY, {
        trackId,
        matchId,
      }),
    [action],
  );

  return createActionRunResult(action.pendingKey !== null, run, { error: action.feedback });
}
