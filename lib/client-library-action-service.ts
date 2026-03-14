"use client";
import { postClientMutation } from "@/lib/client-mutations";
import type { ClientFetcher } from "@/lib/client-fetcher";
import {
  dispatchRecommendationDismissed,
  dispatchReleaseWishlistUpdated,
  dispatchTrackTodoUpdate,
} from "@/lib/client-library-events";
import { dispatchSourceStateMutatedEvent } from "@/lib/client-source-events";
import { dispatchTrackMatchUpdatedEvent } from "@/lib/client-track-match-events";
import {
  normalizeRecommendationDismissResponse,
  normalizeTrackTodoMutationResponse,
  type RecommendationDismissResponse,
  type TrackTodoMutationResponse,
} from "@/lib/library-mutation-contract";
import {
  normalizeReleaseWishlistResponse,
  type ReleaseReviewedResponse,
  type ReleaseWishlistResponse,
} from "@/lib/release-library-contract";
import {
  normalizeSourceIntakeResponse,
  type SourceIntakeResponse,
} from "@/lib/source-intake-contract";
import {
  normalizeTrackMatchSelectionResponse,
  type TrackMatchSelectionResponse,
} from "@/lib/track-match-contract";
import type { TrackTodoUpdate } from "@/lib/track-todo-contract";
import {
  libraryDismissRecommendationError,
  libraryRecordWishlistError,
  libraryReleaseReviewedError,
  libraryTrackUpdateError,
} from "@/lib/library-action-notices";

export type TrackTodoPayload = {
  trackIds: number[];
  field: "listened" | "saved";
  mode?: "set" | "toggle";
  value?: boolean;
};
type TrackTodoApiResponse = {
  ok?: boolean;
  error?: string;
} & Partial<TrackTodoMutationResponse>;

type AddSourceFromReleaseResponse = SourceIntakeResponse & { ok?: boolean; error?: string; labelId?: number };

type ReleaseWishlistApiResponse = ReleaseWishlistResponse & { ok?: boolean; error?: string };

type ReleaseReviewedApiResponse = ReleaseReviewedResponse & { ok?: boolean; error?: string };

type RecommendationFeedbackApiResponse = RecommendationDismissResponse & {
  ok?: boolean;
  error?: string;
};

export function dispatchTrackTodoUpdates(tracks: TrackTodoUpdate[], field: "listened" | "saved") {
  for (const track of tracks) {
    dispatchTrackTodoUpdate({
      trackId: track.trackId,
      field,
      value: field === "saved" ? track.saved : track.listened,
    });
  }
}

export function dispatchReleaseWishlistUpdate(input: {
  releaseId: number;
  releaseIds: number[];
  value: boolean;
}) {
  dispatchReleaseWishlistUpdated({
    releaseId: input.releaseId,
    releaseIds: input.releaseIds,
    value: input.value,
  });
}

export function dispatchRecommendationDismissUpdate(input: {
  trackId?: number | null;
  releaseId?: number | null;
}) {
  dispatchRecommendationDismissed({ trackId: input.trackId, releaseId: input.releaseId });
}

export function dispatchTrackMatchUpdate(input: {
  trackId: number;
  matchId: number;
}) {
  dispatchTrackMatchUpdatedEvent(input);
}

export async function runTrackTodoMutation(
  payload: TrackTodoPayload,
  options?: { fetcher?: ClientFetcher; unauthorizedMessage?: string },
) {
  const body = await postClientMutation<TrackTodoApiResponse>(
    "/api/tracks/todo",
    payload,
    {
      ...options,
      errorMessage: libraryTrackUpdateError(null),
    },
  );
  return normalizeTrackTodoMutationResponse(body).tracks;
}

export async function runTrackTodoMutationAndDispatch(
  payload: TrackTodoPayload,
  options?: { fetcher?: ClientFetcher; unauthorizedMessage?: string },
) {
  const tracks = await runTrackTodoMutation(payload, options);
  dispatchTrackTodoUpdates(tracks, payload.field);
  return tracks;
}

export async function runAddSourceFromReleaseMutation(
  releaseId: number,
  options?: { fetcher?: ClientFetcher },
) {
  const body = await postClientMutation<Partial<AddSourceFromReleaseResponse>>(
    "/api/labels/from-release",
    { releaseId },
    { ...options, errorMessage: "Unable to add label from release." },
  );
  return normalizeSourceIntakeResponse(body, { source: `Source ${releaseId}` });
}

export async function runAddSourceFromReleaseMutationAndDispatch(
  releaseId: number,
  options?: { fetcher?: ClientFetcher },
) {
  const result = await runAddSourceFromReleaseMutation(releaseId, options);
  if (typeof result.sourceId === "number") {
    dispatchAddedSource(result.sourceId);
  }
  return result;
}

export async function runReleaseWishlistMutation(
  payload: { releaseId: number; mode?: "toggle" | "set"; value?: boolean },
  options?: { fetcher?: ClientFetcher },
) {
  const body = await postClientMutation<ReleaseWishlistApiResponse>(
    "/api/releases/wishlist",
    payload,
    { ...options, errorMessage: libraryRecordWishlistError(null) },
  );
  return normalizeReleaseWishlistResponse(body, payload.releaseId);
}

export async function runReleaseWishlistMutationAndDispatch(
  payload: { releaseId: number; mode?: "toggle" | "set"; value?: boolean },
  options?: { fetcher?: ClientFetcher },
) {
  const result = await runReleaseWishlistMutation(payload, options);
  dispatchReleaseWishlistUpdate({
    releaseId: payload.releaseId,
    releaseIds: result.affectedReleaseIds,
    value: result.wishlist,
  });
  return result;
}

export async function runReleaseReviewedMutation(
  releaseId: number,
  options?: { fetcher?: ClientFetcher },
) {
  const body = await postClientMutation<ReleaseReviewedApiResponse>(
    "/api/releases/reviewed",
    { releaseId },
    { ...options, errorMessage: libraryReleaseReviewedError(null) },
  );
  return body.tracks ?? [];
}

export async function runReleaseReviewedMutationAndDispatch(
  releaseId: number,
  options?: { fetcher?: ClientFetcher },
) {
  const tracks = await runReleaseReviewedMutation(releaseId, options);
  dispatchTrackTodoUpdates(tracks, "listened");
  return tracks;
}

export async function runRecommendationDismissMutation(
  payload: { trackId?: number; releaseId?: number },
  options?: { fetcher?: ClientFetcher },
) {
  const body = await postClientMutation<RecommendationFeedbackApiResponse>(
    "/api/recommendations/feedback",
    { eventType: "dismiss", ...payload },
    { ...options, errorMessage: libraryDismissRecommendationError(null) },
  );
  return normalizeRecommendationDismissResponse(body, payload);
}

export async function runRecommendationDismissMutationAndDispatch(
  payload: { trackId?: number; releaseId?: number },
  options?: { fetcher?: ClientFetcher },
) {
  const result = await runRecommendationDismissMutation(payload, options);
  dispatchRecommendationDismissUpdate(result);
  return result;
}

export async function runTrackMatchSelectionMutation(
  payload: { trackId: number; matchId: number },
  options?: { fetcher?: ClientFetcher },
) {
  const body = await postClientMutation<
    TrackMatchSelectionResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    "/api/tracks/match",
    payload,
    { ...options, errorMessage: "Unable to choose track match." },
  );
  return normalizeTrackMatchSelectionResponse(body, payload);
}

export async function runTrackMatchSelectionMutationAndDispatch(
  payload: { trackId: number; matchId: number },
  options?: { fetcher?: ClientFetcher },
) {
  const result = await runTrackMatchSelectionMutation(payload, options);
  dispatchTrackMatchUpdate(result);
  return result;
}

export function dispatchAddedSource(sourceId: number) {
  dispatchSourceStateMutatedEvent({
    reason: "add",
    sourceId,
    active: true,
    status: "queued",
  });
}
