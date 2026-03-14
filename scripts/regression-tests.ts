import assert from "node:assert/strict";
import { toExternalDiscogsId, toStoredDiscogsId, toStoredSourceId } from "../lib/discogs-id";
import { parseDiscogsReleaseIdFromUrl } from "../lib/discogs-release-id";
import { toDiscogsWebUrl } from "../lib/discogs-links";
import { shouldCollapseExternalDismiss } from "../lib/feedback-dismiss-identity";
import { matchesExternalDiscogsReleaseId } from "../lib/release-identity";
import { canonicalizeFeedbackTargets } from "../lib/feedback-targets";
import { normalizeRequestedExternalDiscogsReleaseId, resolveUserReleaseRowsByExternalId } from "../lib/user-release-identity";
import { normalizeYoutubeMatchCandidates } from "../lib/youtube-match-identity";
import { shouldAllowRequestedYoutubeMatch } from "../lib/youtube-match-selection";
import { buildDismissedReleaseSets, buildDismissedTrackSet, isReleaseDismissed } from "../lib/recommendation-dismissals";
import { mergeReleaseImportSource, shouldReplaceReleaseOwner } from "../lib/release-upsert-policy";
import { buildReleaseListenedUpdatePlan } from "../lib/release-listened-plan";
import { shouldLogReleaseQueuedFeedback } from "../lib/release-queue-feedback";
import {
  resolveReleaseWishlistFeedbackEvent,
  selectConfirmedReleaseWishlistFeedbackTargets,
  shouldLogReleaseWishlistFeedback,
} from "../lib/release-wishlist-feedback";
import { buildLocalReleaseWishlistSetPlan, buildLocalReleaseWishlistSyncPlan } from "../lib/release-wishlist-local-sync";
import { applyLocalReleaseWishlistSyncPlanForUser, setLocalReleaseWishlistForUser } from "../lib/release-wishlist-local-state";
import {
  buildReleaseWishlistSyncTargetsForLocalReleaseIds,
  buildSavedWishlistSyncTargets,
} from "../lib/release-wishlist-sync";
import { buildMissingWantTrackSeedPlan } from "../lib/discogs-wants-import";
import { buildUserReleaseIdsByExternalDiscogsId, resolveUserReleaseExternalDiscogsId } from "../lib/user-release-external-identity";
import { mergeSourceReleaseMappingState } from "../lib/source-release-mapping";
import { planTrackTodoMutation, planTrackTodoMutations } from "../lib/track-todo-mutations";
import { detectDiscogsSourceKindFromInput, parseArtistIdFromInput, parseLabelIdFromInput } from "../lib/discogs-input";
import { buildDiscogsOAuthCallbackUrl } from "../lib/discogs-oauth-callback-url";
import { sanitizeDiscogsConnectionErrorMessage } from "../lib/discogs-errors";
import { buildOAuthCallbackLoginPath } from "../lib/oauth-callback-routing";
import { resolveOAuthCallbackRedirectPath } from "../lib/oauth-callback-route";
import { resolveOAuthCallbackNextPath } from "../lib/oauth-callback-next";
import { buildOAuthCallbackSuccessPath } from "../lib/oauth-callback-success";
import { DISCOGS_OAUTH_TMP_COOKIE, YOUTUBE_OAUTH_TMP_COOKIE } from "../lib/oauth-cookie-keys";
import { getInvalidOAuthCallbackMessage, getOAuthCallbackErrorMessage, getOAuthStateMismatchMessage } from "../lib/oauth-messages";
import { getOAuthErrorQueryKey, getOAuthProviderLoginNextPath, getOAuthTempCookieKey } from "../lib/oauth-provider";
import { parseDiscogsOAuthCallbackQuery, parseYoutubeOAuthCallbackQuery } from "../lib/oauth-callback-query";
import { buildOAuthTempCookieOptions } from "../lib/oauth-cookie-options";
import { normalizeNextPath } from "../lib/next-path";
import { buildOnboardingHealth } from "../lib/onboarding-health";
import { appendQueryParam, buildOAuthConnectedRedirectPath, buildOAuthErrorRedirectPath } from "../lib/oauth-redirects";
import { resolveRecommendationReleaseTargets, resolveRecommendationReleaseTargetsForIdentity } from "../lib/recommendation-feedback";
import { resolveNumericSourceIdentity } from "../lib/source-identity";
import { isIdempotentFeedbackEvent } from "../lib/feedback-event-policy";
import { mergeSourceType, shouldActivateSource, shouldQueueSourceAfterUpsert } from "../lib/source-upsert-policy";
import { normalizeTrackPosition, normalizeTrackTitle } from "../lib/track-identity";
import { planDiscogsWantSourceAssignment } from "../lib/discogs-wants-source-assignment";
import { findPendingQueueDuplicateIds, planChosenYoutubeMatchNormalization, planChosenYoutubeMatchSelection } from "../lib/queue-duplicates";
import { appendRemediationResult, resolveActionNextPath } from "../lib/remediation-feedback";
import {
  buildRemediationTargetSummary,
  extendRemediationPayload,
  getRemediationSourceDisplayName,
} from "../lib/remediation-actions";
import { createOAuthState, getOAuthStateByteLength } from "../lib/oauth-state";
import { buildOAuthStartLoginPath, parseOAuthStartQuery } from "../lib/oauth-start-routing";
import { readJsonBodyOrNull } from "../lib/request-json";
import {
  decodeDiscogsOAuthPending,
  decodeYoutubeOAuthPending,
  encodeDiscogsOAuthPending,
  encodeYoutubeOAuthPending,
} from "../lib/oauth-temp-cookie";
import { validateDiscogsOAuthCallbackInput, validateYoutubeOAuthCallbackInput } from "../lib/oauth-callback-validation";
import { buildYouTubeHandoffTargets, isIOSLikeDevice } from "../lib/playback-mobile";
import {
  normalizeCurrentQueueItemIdFromPost,
  resolveQueueModeFromPost,
  resolveQueueOrderFromPost,
  shouldMarkCurrentQueueItemPlayed,
  shouldMarkCurrentTrackListened,
} from "../lib/queue-next-actions";
import {
  buildQueueFeedbackPayload,
  buildQueueFeedbackPayloadFromItem,
  parseQueueNextMutationInput,
  shouldApplyListenedMutation,
  shouldApplyPlayedOnlyMutation,
  shouldRefreshReleaseListened,
} from "../lib/queue-next-mutation";
import { buildQueueNextEffectPlan } from "../lib/queue-next-effects";
import { parseQueueNextPostBody } from "../lib/queue-next-post";
import { isShuffleQueueOrder, selectNextQueueItem } from "../lib/queue-next-selection";
import { parseQueueNextGetParams } from "../lib/queue-next-request";
import { getQueueTransitionPlan } from "../lib/queue-transition-plan";
import { deriveReleaseListenedFromTracks } from "../lib/release-listened";
import { buildSyncHealthAlerts } from "../lib/sync-health";
import { parsePositiveSourceIds } from "../lib/source-id-list";
import {
  createProcessingAttempt,
  getProcessingAttemptSourceMeta,
  markProcessingAttemptError,
  markProcessingAttemptLockBusy,
  markProcessingAttemptStarted,
  markProcessingAttemptSuccess,
  selectNextSourceId,
} from "../lib/source-next-processing";
import {
  planStartSyncSourceUpdate,
  shouldQueueActiveSourceBatch,
  shouldResumePausedSource,
  shouldRetrySourceStatus,
} from "../lib/source-action-plans";
import { buildSourceStatusCounts, planSourceNextRecovery } from "../lib/source-next-state";
import { resolveSourceNextBlocker } from "../lib/source-next-blocker";
import { toSourceKind } from "../lib/source-kind";
import { buildPauseAndCooldownSourceUpdate, buildPauseSourceUpdate, shouldClearErrorOnCooldown } from "../lib/source-remediation";
import { getPausedStatusFromCurrent } from "../lib/source-status-transitions";
import { createEmptySourceNextResponse } from "../lib/source-next-response";
import {
  classifySourceFailure,
  getFailureCategoryMeta,
  groupSourceFailuresByCategory,
  inferFailureProvider,
  summarizeFailureProviders,
  summarizeFailureSourceKinds,
} from "../lib/source-failures";
import { getTimelineBarStyle, getTimelineMaxRuns, groupTimelineBuckets } from "../lib/sync-timeline";
import { buildLastSuccessBySource, buildSyncRunBreakdown, buildSyncRunStats, buildSyncWindowComparison } from "../lib/sync-run-stats";
import { createZeroSyncThroughput } from "../lib/sync-throughput";
import { collectUniquePlayableVideoIds, normalizePlaylistExportInput } from "../lib/youtube-playlist-export";
import { resolveNextReleaseWishlistValue } from "../lib/release-wishlist-plan";

async function run() {
  // Auth redirect safety coverage.
  assert.equal(
    normalizeNextPath("/?tab=step-2", { fallback: "/?tab=step-2", blockAuthEntrypoints: true }),
    "/?tab=step-2",
  );
  assert.equal(
    normalizeNextPath("https://evil.example/steal", { fallback: "/?tab=step-2", blockAuthEntrypoints: true }),
    "/?tab=step-2",
  );
  assert.equal(
    normalizeNextPath("//evil.example/steal", { fallback: "/?tab=step-2", blockAuthEntrypoints: true }),
    "/?tab=step-2",
  );
  assert.equal(
    normalizeNextPath("/login?next=/", { fallback: "/?tab=step-2", blockAuthEntrypoints: true }),
    "/?tab=step-2",
  );
  assert.equal(
    normalizeNextPath("/auth/callback?code=abc", { fallback: "/?tab=step-2", blockAuthEntrypoints: true }),
    "/?tab=step-2",
  );
  assert.equal(
    normalizeNextPath("/auth", { fallback: "/?tab=step-2", blockAuthEntrypoints: true }),
    "/?tab=step-2",
  );
  assert.equal(
    normalizeNextPath("/register?mode=invite", { fallback: "/?tab=step-2", blockAuthEntrypoints: true }),
    "/?tab=step-2",
  );
  assert.equal(
    normalizeNextPath("/settings", { fallback: "/settings" }),
    "/settings",
  );
  const discogsQuery = parseDiscogsOAuthCallbackQuery(new URL("https://digqueue.local/api/discogs/oauth/callback?state=s1&oauth_token=t1&oauth_verifier=v1&next=%2Fsettings"));
  assert.equal(discogsQuery.returnedState, "s1");
  assert.equal(discogsQuery.oauthToken, "t1");
  assert.equal(discogsQuery.verifier, "v1");
  assert.equal(discogsQuery.nextRaw, "/settings");
  assert.equal(buildOAuthCallbackLoginPath("discogs"), "/login?next=%2Fconnect-discogs");
  assert.equal(buildOAuthCallbackLoginPath("youtube"), "/login?next=%2Fsettings");
  assert.equal(
    resolveOAuthCallbackRedirectPath({ provider: "discogs", reason: "login" }),
    "/login?next=%2Fconnect-discogs",
  );
  assert.equal(
    resolveOAuthCallbackRedirectPath({ provider: "youtube", reason: "invalid_callback" }),
    "/settings?youtube_error=Invalid%20YouTube%20OAuth%20callback.",
  );
  assert.equal(
    resolveOAuthCallbackRedirectPath({ provider: "youtube", reason: "state_mismatch" }),
    "/settings?youtube_error=YouTube%20OAuth%20state%20mismatch.",
  );
  assert.equal(
    resolveOAuthCallbackRedirectPath({ provider: "discogs", reason: "success", nextPath: "/settings?tab=step-2" }),
    "/settings?tab=step-2&discogs=connected",
  );
  assert.equal(DISCOGS_OAUTH_TMP_COOKIE, "discogs_oauth_tmp");
  assert.equal(YOUTUBE_OAUTH_TMP_COOKIE, "youtube_oauth_tmp");
  const youtubeQuery = parseYoutubeOAuthCallbackQuery(new URL("https://digqueue.local/api/youtube/oauth/callback?state=s2&code=c2&next=%2F"));
  assert.equal(youtubeQuery.returnedState, "s2");
  assert.equal(youtubeQuery.code, "c2");
  assert.equal(youtubeQuery.nextRaw, "/");
  assert.equal(parseOAuthStartQuery(new URL("https://digqueue.local/api/discogs/oauth/start?next=%2Fsettings")).nextRaw, "/settings");
  assert.equal(getOAuthProviderLoginNextPath("discogs"), "/connect-discogs");
  assert.equal(getOAuthProviderLoginNextPath("youtube"), "/settings");
  assert.equal(getOAuthErrorQueryKey("discogs"), "discogs_error");
  assert.equal(getOAuthErrorQueryKey("youtube"), "youtube_error");
  assert.equal(getOAuthTempCookieKey("discogs"), "discogs_oauth_tmp");
  assert.equal(getOAuthTempCookieKey("youtube"), "youtube_oauth_tmp");
  assert.equal(getOAuthStateByteLength("discogs"), 12);
  assert.equal(getOAuthStateByteLength("youtube"), 18);
  const discogsState = createOAuthState("discogs");
  const youtubeState = createOAuthState("youtube");
  assert.equal(discogsState.length, 24);
  assert.equal(youtubeState.length, 36);
  assert.match(discogsState, /^[a-f0-9]+$/);
  assert.match(youtubeState, /^[a-f0-9]+$/);
  assert.equal(
    buildDiscogsOAuthCallbackUrl("https://digqueue.local", "/settings?tab=step-2", "abc"),
    "https://digqueue.local/api/discogs/oauth/callback?next=%2Fsettings%3Ftab%3Dstep-2&state=abc",
  );
  assert.equal(getInvalidOAuthCallbackMessage("discogs"), "Invalid Discogs OAuth callback.");
  assert.equal(getInvalidOAuthCallbackMessage("youtube"), "Invalid YouTube OAuth callback.");
  assert.equal(getOAuthStateMismatchMessage("discogs"), "Discogs OAuth state mismatch.");
  assert.equal(getOAuthStateMismatchMessage("youtube"), "YouTube OAuth state mismatch.");
  assert.equal(buildOAuthCallbackSuccessPath("/settings?tab=step-1", "discogs"), "/settings?tab=step-1&discogs=connected");
  assert.equal(buildOAuthCallbackSuccessPath("/settings?tab=library", "youtube"), "/settings?tab=library&youtube=connected");
  assert.equal(getOAuthCallbackErrorMessage("discogs", "invalid_callback"), "Invalid Discogs OAuth callback.");
  assert.equal(getOAuthCallbackErrorMessage("discogs", "state_mismatch"), "Discogs OAuth state mismatch.");
  assert.equal(getOAuthCallbackErrorMessage("youtube", "state_mismatch"), "YouTube OAuth state mismatch.");
  assert.equal(
    resolveOAuthCallbackNextPath({ cookieNext: "/?tab=library", explicitNext: "/settings", fallback: "/settings" }),
    "/?tab=library",
  );
  assert.equal(
    resolveOAuthCallbackNextPath({ cookieNext: "", explicitNext: "/settings?tab=library", fallback: "/settings" }),
    "/settings?tab=library",
  );
  assert.equal(
    resolveOAuthCallbackNextPath({ cookieNext: "https://evil.example", explicitNext: "https://evil.example", fallback: "/settings" }),
    "/settings",
  );
  assert.equal(buildOAuthStartLoginPath("discogs"), "/login?next=%2Fconnect-discogs");
  assert.equal(buildOAuthStartLoginPath("youtube"), "/login?next=%2Fsettings");
  const cookieOptions = buildOAuthTempCookieOptions();
  assert.equal(cookieOptions.httpOnly, true);
  assert.equal(cookieOptions.sameSite, "lax");
  assert.equal(cookieOptions.path, "/");
  assert.equal(cookieOptions.maxAge, 600);
  assert.equal(appendQueryParam("/settings", "discogs_error", "bad state"), "/settings?discogs_error=bad%20state");
  assert.equal(buildOAuthConnectedRedirectPath("/settings?tab=library", "youtube"), "/settings?tab=library&youtube=connected");
  assert.equal(buildOAuthErrorRedirectPath("discogs", "Invalid callback"), "/settings?discogs_error=Invalid%20callback");
  assert.equal(
    sanitizeDiscogsConnectionErrorMessage("failed query: timeout"),
    "Temporary database connectivity issue while saving Discogs connection. Please retry.",
  );
  assert.equal(
    sanitizeDiscogsConnectionErrorMessage("Discogs OAuth state mismatch."),
    "Discogs OAuth state mismatch.",
  );
  assert.equal(
    sanitizeDiscogsConnectionErrorMessage(""),
    null,
  );
  assert.equal(resolveActionNextPath("/?tab=step-2", "/"), "/?tab=step-2");
  assert.equal(resolveActionNextPath("https://evil.example/path", "/?tab=step-2"), "/?tab=step-2");
  assert.equal(getRemediationSourceDisplayName({ id: 9, name: "  " }), "Source 9");
  assert.deepEqual(
    buildRemediationTargetSummary([
      { id: 1, name: "Alpha" },
      { id: 2, name: "Beta" },
      { id: 3, name: "Gamma" },
      { id: 4, name: "Delta" },
    ]),
    { sourceCount: 4, sourcePreview: "Alpha, Beta, Gamma, +1 more" },
  );
  assert.deepEqual(
    extendRemediationPayload(
      { action: "retry", scope: "group", affected: 2, category: "provider" },
      [
        { id: 1, name: "Alpha" },
        { id: 2, name: "" },
      ],
    ),
    {
      action: "retry",
      scope: "group",
      affected: 2,
      category: "provider",
      sourceCount: 2,
      sourcePreview: "Alpha, Source 2",
    },
  );
  assert.equal(
    appendRemediationResult("/?tab=step-2", { action: "retry", scope: "group", affected: 4 }),
    "/?tab=step-2&remAction=retry&remScope=group&remAffected=4",
  );
  assert.equal(
    appendRemediationResult("/?tab=step-2", { action: "refresh metadata", scope: "group", affected: 2, failed: 1 }),
    "/?tab=step-2&remAction=refresh+metadata&remScope=group&remAffected=2&remFailed=1",
  );
  assert.equal(
    appendRemediationResult("/?tab=step-2", {
      action: "pause",
      scope: "provider group",
      affected: 3,
      category: "provider",
      sourceCount: 4,
      sourcePreview: "Alpha, Beta, +2 more",
    }),
    "/?tab=step-2&remAction=pause&remScope=provider+group&remAffected=3&remCategory=provider&remSourceCount=4&remSourcePreview=Alpha%2C+Beta%2C+%2B2+more",
  );
  assert.equal(
    appendRemediationResult("/?tab=step-2", { action: "retry", scope: "single source", affected: 1, failed: 0 }),
    "/?tab=step-2&remAction=retry&remScope=single+source&remAffected=1",
  );
  assert.deepEqual(
    buildOnboardingHealth({
      discogsConnected: false,
      youtubeOAuthConfigured: true,
      youtubeOAuthConnected: false,
      sourceCount: 0,
      activeSourceCount: 0,
      erroredSourceCount: 0,
      queueCount: 0,
    }),
    {
      tone: "blocked",
      label: "Blocked",
      title: "Connect Discogs first",
      summary: "DigQueue cannot ingest sources or sync wishlist data until Discogs personal OAuth is connected.",
      nextSteps: [
        { href: "/settings", label: "Open Settings" },
        { href: "/connect-discogs?next=%2Fsettings", label: "Start Discogs connect" },
      ],
      optionalStep: { href: "/settings", label: "Connect YouTube for playlist export" },
    },
  );
  assert.equal(
    buildOnboardingHealth({
      discogsConnected: true,
      youtubeOAuthConfigured: true,
      youtubeOAuthConnected: true,
      sourceCount: 2,
      activeSourceCount: 0,
      erroredSourceCount: 0,
      queueCount: 0,
    }).title,
    "All sources are paused",
  );
  assert.equal(
    buildOnboardingHealth({
      discogsConnected: true,
      youtubeOAuthConfigured: false,
      youtubeOAuthConnected: false,
      sourceCount: 2,
      activeSourceCount: 2,
      erroredSourceCount: 1,
      queueCount: 3,
    }).title,
    "1 source needs attention",
  );
  assert.equal(
    buildOnboardingHealth({
      discogsConnected: true,
      youtubeOAuthConfigured: false,
      youtubeOAuthConnected: false,
      sourceCount: 2,
      activeSourceCount: 2,
      erroredSourceCount: 0,
      queueCount: 4,
    }).tone,
    "ready",
  );
  assert.deepEqual(
    resolveNumericSourceIdentity([{ entityKind: "label", name: "Mood Hut" }]),
    { entityKind: "label", name: "Mood Hut" },
  );
  assert.deepEqual(
    resolveNumericSourceIdentity([{ entityKind: "artist", name: "Command D" }]),
    { entityKind: "artist", name: "Command D" },
  );
  assert.equal(
    resolveNumericSourceIdentity([
      { entityKind: "label", name: "Same Id Label" },
      { entityKind: "artist", name: "Same Id Artist" },
    ]),
    "ambiguous",
  );
  assert.equal(resolveNumericSourceIdentity([]), null);
  const storedLabelSourceId = toStoredSourceId("user-1", 12345, "label");
  const storedArtistSourceId = toStoredSourceId("user-1", 12345, "artist");
  assert.notEqual(storedLabelSourceId, storedArtistSourceId);
  assert.equal(toExternalDiscogsId(storedLabelSourceId), 12345);
  assert.equal(toExternalDiscogsId(storedArtistSourceId), 12345);
  assert.equal(parseDiscogsReleaseIdFromUrl("https://www.discogs.com/release/55-Example"), 55);
  assert.equal(parseDiscogsReleaseIdFromUrl("https://www.discogs.com/releases/55-Example"), 55);
  assert.equal(parseDiscogsReleaseIdFromUrl(undefined), null);
  assert.equal(matchesExternalDiscogsReleaseId("https://www.discogs.com/release/55-Example", 55), true);
  assert.equal(matchesExternalDiscogsReleaseId("https://www.discogs.com/releases/55-Example", 55), true);
  assert.equal(matchesExternalDiscogsReleaseId("https://www.discogs.com/release/56-Example", 55), false);
  assert.equal(normalizeRequestedExternalDiscogsReleaseId(55), 55);
  assert.equal(normalizeRequestedExternalDiscogsReleaseId(toStoredSourceId("user-1", 55, "label")), 55);
  assert.deepEqual(
    resolveUserReleaseRowsByExternalId([
      { id: 1, discogsUrl: "https://www.discogs.com/release/55-Example", labelId: 10, wishlist: false },
      { id: 2, discogsUrl: "https://www.discogs.com/releases/55-Other", labelId: 11, wishlist: true },
      { id: 3, discogsUrl: "https://www.discogs.com/release/56-Nope", labelId: 12, wishlist: false },
    ], 55).map((row) => row.id),
    [1, 2],
  );
  assert.deepEqual(
    normalizeYoutubeMatchCandidates([
      { videoId: "abc", title: " First ", channelTitle: "One", score: 0.4, embeddable: true, chosen: false },
      { videoId: "abc", title: "Second", channelTitle: "Two", score: 0.9, embeddable: true, chosen: true },
      { videoId: "def", title: "Third", channelTitle: "Three", score: 0.2, embeddable: false, chosen: false },
    ]),
    [
      { videoId: "abc", title: "Second", channelTitle: "Two", score: 0.9, embeddable: true, chosen: true },
      { videoId: "def", title: "Third", channelTitle: "Three", score: 0.2, embeddable: false, chosen: false },
    ],
  );
  assert.equal(
    shouldAllowRequestedYoutubeMatch([
      { id: 1, embeddable: false },
      { id: 2, embeddable: true },
    ], 1, { embeddableOnly: true }),
    false,
  );
  assert.equal(
    shouldAllowRequestedYoutubeMatch([
      { id: 1, embeddable: false },
      { id: 2, embeddable: true },
    ], 2, { embeddableOnly: true }),
    true,
  );
  assert.equal(
    shouldAllowRequestedYoutubeMatch([
      { id: 1, embeddable: false },
    ], 1),
    true,
  );
  assert.deepEqual(
    planTrackTodoMutation({ id: 7, releaseId: 8, listened: false, saved: false }, "listened", "set", true),
    {
      trackId: 7,
      releaseId: 8,
      field: "listened",
      changed: true,
      nextValue: true,
      listened: true,
      saved: false,
      markPendingPlayed: true,
      feedbackEventType: "listened",
    },
  );
  assert.deepEqual(
    planTrackTodoMutation({ id: 7, releaseId: 8, listened: true, saved: false }, "listened", "set", true),
    {
      trackId: 7,
      releaseId: 8,
      field: "listened",
      changed: false,
      nextValue: true,
      listened: true,
      saved: false,
      markPendingPlayed: false,
      feedbackEventType: null,
    },
  );
  assert.deepEqual(
    planTrackTodoMutations(
      [
        { id: 1, releaseId: 10, listened: false, saved: false },
        { id: 2, releaseId: 10, listened: true, saved: false },
      ],
      "saved",
      "set",
      true,
    ).map((item) => ({ trackId: item.trackId, changed: item.changed, feedbackEventType: item.feedbackEventType })),
    [
      { trackId: 1, changed: true, feedbackEventType: "saved_add" },
      { trackId: 2, changed: true, feedbackEventType: "saved_add" },
    ],
  );
  const dismissedTracks = buildDismissedTrackSet([
    { eventType: "dismiss", trackId: 7 },
    { eventType: "played", trackId: 8 },
  ]);
  assert.equal(dismissedTracks.has(7), true);
  assert.equal(dismissedTracks.has(8), false);
  const dismissedReleases = buildDismissedReleaseSets([
    { eventType: "dismiss", releaseId: 11, externalDiscogsReleaseId: 55 },
    { eventType: "dismiss", externalDiscogsReleaseId: 66 },
    { eventType: "played", releaseId: 12, externalDiscogsReleaseId: 77 },
  ]);
  assert.equal(dismissedReleases.localReleaseIds.has(11), true);
  assert.equal(dismissedReleases.localReleaseIds.has(12), false);
  assert.equal(dismissedReleases.externalDiscogsReleaseIds.has(55), true);
  assert.equal(dismissedReleases.externalDiscogsReleaseIds.has(66), true);
  assert.equal(
    isReleaseDismissed({
      releaseId: 11,
      discogsUrl: "https://www.discogs.com/release/55-Example",
      dismissedLocalReleaseIds: dismissedReleases.localReleaseIds,
      dismissedExternalDiscogsReleaseIds: dismissedReleases.externalDiscogsReleaseIds,
    }),
    true,
  );
  assert.equal(
    isReleaseDismissed({
      releaseId: 99,
      discogsUrl: "https://www.discogs.com/release/66-Example",
      dismissedLocalReleaseIds: dismissedReleases.localReleaseIds,
      dismissedExternalDiscogsReleaseIds: dismissedReleases.externalDiscogsReleaseIds,
    }),
    true,
  );
  assert.equal(
    isReleaseDismissed({
      releaseId: 99,
      discogsUrl: "https://www.discogs.com/release/88-Example",
      dismissedLocalReleaseIds: dismissedReleases.localReleaseIds,
      dismissedExternalDiscogsReleaseIds: dismissedReleases.externalDiscogsReleaseIds,
    }),
    false,
  );
  assert.deepEqual(
    canonicalizeFeedbackTargets({
      track: { id: 7, releaseId: 8 },
      release: { id: 8, labelId: 13, discogsUrl: "https://www.discogs.com/release/55-Example" },
      requestedTrackId: 7,
      requestedReleaseId: 99,
      requestedExternalDiscogsReleaseId: 999,
      requestedLabelId: 77,
      labelIsValid: true,
    }),
    {
      trackId: 7,
      releaseId: 8,
      labelId: 13,
      externalDiscogsReleaseId: 55,
    },
  );
  assert.deepEqual(
    canonicalizeFeedbackTargets({
      track: null,
      release: null,
      requestedTrackId: null,
      requestedReleaseId: 99,
      requestedExternalDiscogsReleaseId: 55,
      requestedLabelId: 77,
      labelIsValid: false,
    }),
    {
      trackId: null,
      releaseId: null,
      labelId: null,
      externalDiscogsReleaseId: 55,
    },
  );
  assert.equal(normalizeTrackPosition(""), "__");
  assert.equal(normalizeTrackPosition(" A1 "), "A1");
  assert.equal(normalizeTrackTitle("  Example Track  "), "example track");
  assert.equal(shouldCollapseExternalDismiss({ eventType: "dismiss", releaseId: 55, externalDiscogsReleaseId: 55 }), true);
  assert.equal(shouldCollapseExternalDismiss({ eventType: "dismiss", releaseId: null, externalDiscogsReleaseId: 55 }), false);
  assert.equal(shouldCollapseExternalDismiss({ eventType: "played", releaseId: 55, externalDiscogsReleaseId: 55 }), false);
  assert.equal(mergeSourceType("workspace", "derived_want"), "workspace");
  assert.equal(mergeSourceType("derived_want", "workspace"), "workspace");
  assert.equal(mergeSourceType("derived_want", "derived_want"), "derived_want");
  assert.equal(mergeSourceType(null, undefined), "workspace");
  assert.equal(shouldReplaceReleaseOwner("discogs_want", "label"), true);
  assert.equal(shouldReplaceReleaseOwner("label", "discogs_want"), false);
  assert.equal(mergeReleaseImportSource("discogs_want", "label"), "label");
  assert.equal(mergeReleaseImportSource("label", "discogs_want"), "label");
  assert.equal(mergeReleaseImportSource(undefined, "discogs_want"), "discogs_want");
  assert.equal(isIdempotentFeedbackEvent("dismiss"), true);
  assert.equal(isIdempotentFeedbackEvent("played"), false);
  assert.deepEqual(
    resolveRecommendationReleaseTargets({ requestedReleaseId: 55, matchedLocalReleaseId: 55 }),
    { releaseId: 55, externalDiscogsReleaseId: null },
  );
  assert.deepEqual(
    resolveRecommendationReleaseTargets({ requestedReleaseId: 55, matchedLocalReleaseId: null }),
    { releaseId: null, externalDiscogsReleaseId: 55 },
  );
  assert.deepEqual(
    resolveRecommendationReleaseTargets({ requestedReleaseId: null, matchedLocalReleaseId: null }),
    { releaseId: null, externalDiscogsReleaseId: null },
  );
  assert.deepEqual(
    resolveRecommendationReleaseTargetsForIdentity({ externalDiscogsReleaseId: 55, primaryLocalReleaseId: 101 }, 55),
    { releaseId: 101, externalDiscogsReleaseId: null },
  );
  assert.deepEqual(
    resolveRecommendationReleaseTargetsForIdentity({ externalDiscogsReleaseId: 55, primaryLocalReleaseId: null }, 55),
    { releaseId: null, externalDiscogsReleaseId: 55 },
  );
  assert.deepEqual(
    resolveRecommendationReleaseTargetsForIdentity(null, null),
    { releaseId: null, externalDiscogsReleaseId: null },
  );
  assert.equal(resolveNextReleaseWishlistValue(false, "toggle"), true);
  assert.equal(resolveNextReleaseWishlistValue(true, "toggle"), false);
  assert.equal(resolveNextReleaseWishlistValue(false, "set", true), true);
  assert.equal(resolveNextReleaseWishlistValue(true, "set", false), false);
  assert.equal(shouldActivateSource(true, false), true);
  assert.equal(shouldActivateSource(false, true), true);
  assert.equal(shouldActivateSource(false, false), false);
  assert.equal(shouldQueueSourceAfterUpsert({ sourceType: "derived_want", active: false }), false);
  assert.equal(shouldQueueSourceAfterUpsert({ sourceType: "workspace", active: false }), true);
  assert.equal(shouldQueueSourceAfterUpsert({ sourceType: "derived_want", active: true }), true);
  assert.deepEqual(
    planDiscogsWantSourceAssignment([
      { releaseId: 1, labelId: 100, wishlist: false, importSource: "label" },
      { releaseId: 2, labelId: 200, wishlist: true, importSource: "label" },
      { releaseId: 3, labelId: 300, wishlist: false, importSource: "discogs_want" },
      { releaseId: 4, labelId: 400, wishlist: false, importSource: "label" },
    ], new Set([100, 400])),
    {
      eligibleReleaseIds: [1, 2, 3, 4],
      relabelReleaseIds: [2, 3],
    },
  );
  const validJson = await readJsonBodyOrNull(new Request("https://digqueue.local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true }),
  }));
  assert.deepEqual(validJson, { ok: true });
  const invalidJson = await readJsonBodyOrNull(new Request("https://digqueue.local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid",
  }));
  assert.equal(invalidJson, null);

  // Discogs URL canonicalization coverage.
  assert.equal(
    toDiscogsWebUrl("https://www.discogs.com/releases/2060", ""),
    "https://www.discogs.com/release/2060",
  );
  assert.equal(
    toDiscogsWebUrl("https://www.discogs.com/releases/2060-Geometry", ""),
    "https://www.discogs.com/release/2060-Geometry",
  );
  assert.equal(
    toDiscogsWebUrl("https://api.discogs.com/releases/24761", ""),
    "https://www.discogs.com/release/24761",
  );
  assert.equal(
    toDiscogsWebUrl("https://www.discogs.com/labels/1120990-Kalahari-Oyster-Cult", ""),
    "https://www.discogs.com/label/1120990-Kalahari-Oyster-Cult",
  );
  assert.equal(
    toDiscogsWebUrl("www.discogs.com/labels/123", ""),
    "https://www.discogs.com/label/123",
  );
  assert.equal(
    toDiscogsWebUrl("/release/11100295", ""),
    "https://www.discogs.com/release/11100295",
  );
  assert.equal(
    toDiscogsWebUrl("/releases/11100295-Special-Release?ev=rb#tracklist", ""),
    "https://www.discogs.com/release/11100295-Special-Release?ev=rb#tracklist",
  );
  assert.equal(
    toDiscogsWebUrl("", ""),
    "https://www.discogs.com",
  );
  assert.equal(parseLabelIdFromInput("https://www.discogs.com/labels/1120990-Kalahari-Oyster-Cult"), 1120990);
  assert.equal(parseArtistIdFromInput("https://api.discogs.com/artists/12345"), 12345);
  assert.equal(detectDiscogsSourceKindFromInput("https://www.discogs.com/artist/42-Jane-Doe"), "artist");
  assert.equal(detectDiscogsSourceKindFromInput("https://www.discogs.com/labels/77-Sample-Label"), "label");
  assert.equal(detectDiscogsSourceKindFromInput("some free text input"), null);

  // Playlist export normalization + dedupe coverage.
  const exportInput = normalizePlaylistExportInput({
    title: "  My Playlist  ",
    visibility: "public",
  });
  assert.equal(exportInput.title, "My Playlist");
  assert.equal(exportInput.visibility, "public");
  assert.equal(
    normalizePlaylistExportInput({ title: "", visibility: "wat" }).visibility,
    "private",
  );
  const ids = collectUniquePlayableVideoIds(
    [
      { saved: true, youtubeVideoId: "abc" },
      { saved: true, youtubeVideoId: "abc" },
      { saved: false, youtubeVideoId: "zzz" },
      { saved: true, youtubeVideoId: "def" },
    ],
    1,
  );
  assert.deepEqual(ids.all, ["abc", "def"]);
  assert.deepEqual(ids.selected, ["abc"]);
  assert.equal(ids.skippedByLimit, 1);

  // Mobile playback behavior coverage.
  assert.equal(
    isIOSLikeDevice({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      platform: "iPhone",
      maxTouchPoints: 5,
    }),
    true,
  );
  assert.equal(
    isIOSLikeDevice({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      maxTouchPoints: 2,
    }),
    true,
  );
  assert.equal(
    isIOSLikeDevice({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
      platform: "Linux x86_64",
      maxTouchPoints: 0,
    }),
    false,
  );
  const iosHandoff = buildYouTubeHandoffTargets("abc123", true);
  assert.equal(iosHandoff?.primaryUrl, "youtube://www.youtube.com/watch?v=abc123");
  assert.equal(iosHandoff?.fallbackUrl, "https://www.youtube.com/watch?v=abc123");
  assert.equal(iosHandoff?.needsDeepLinkFallback, true);
  const webHandoff = buildYouTubeHandoffTargets("abc123", false);
  assert.equal(webHandoff?.primaryUrl, "https://www.youtube.com/watch?v=abc123");
  assert.equal(webHandoff?.fallbackUrl, null);
  assert.equal(webHandoff?.needsDeepLinkFallback, false);
  assert.equal(buildYouTubeHandoffTargets("", true), null);

  // Failure center grouping coverage.
  assert.equal(classifySourceFailure("OAuth token expired"), "auth");
  assert.equal(classifySourceFailure("Discogs error 429"), "rate_limit");
  assert.equal(inferFailureProvider("Discogs error 500"), "discogs");
  assert.equal(inferFailureProvider("YouTube quota exceeded"), "youtube");
  assert.equal(inferFailureProvider("unknown failure"), "unknown");
  assert.deepEqual(
    summarizeFailureProviders(
      [{ error: "Discogs error 500" }, { error: "YouTube timeout" }, { error: "" }],
      (row) => row.error,
    ),
    { discogs: 1, youtube: 1, unknown: 1 },
  );
  assert.deepEqual(
    summarizeFailureSourceKinds(
      [{ kind: "label" }, { kind: "artist" }, { kind: "label" }],
      (row) => row.kind as "label" | "artist",
    ),
    { label: 2, artist: 1 },
  );
  assert.equal(classifySourceFailure("failed query: relation missing"), "database");
  assert.equal(classifySourceFailure("YouTube provider timeout"), "provider");
  assert.equal(classifySourceFailure("Invalid tracklist payload"), "data");
  assert.equal(classifySourceFailure("totally unknown"), "unknown");
  assert.equal(getFailureCategoryMeta("auth").href, "/api/discogs/oauth/start?next=%2F%3Ftab%3Dstep-2");
  assert.equal(getFailureCategoryMeta("rate_limit").label, "Rate Limit");
  assert.match(getFailureCategoryMeta("rate_limit").hint, /pause all active sources/i);
  assert.equal(getFailureCategoryMeta("rate_limit").href, null);
  assert.match(getFailureCategoryMeta("database").hint, /stale locks/i);
  assert.equal(getFailureCategoryMeta("unknown").label, "Unknown");
  assert.equal(shouldQueueActiveSourceBatch("queued"), true);
  assert.equal(shouldQueueActiveSourceBatch("processing"), false);
  assert.equal(shouldQueueActiveSourceBatch("complete"), false);
  assert.equal(shouldRetrySourceStatus("error"), true);
  assert.equal(shouldRetrySourceStatus("paused"), false);
  assert.equal(shouldResumePausedSource({ active: false, status: "paused" }), true);
  assert.equal(shouldResumePausedSource({ active: true, status: "paused" }), false);
  assert.deepEqual(planStartSyncSourceUpdate({ active: false, status: "paused" }), {
    active: true,
    status: "queued",
    clearLastError: true,
  });
  assert.deepEqual(planStartSyncSourceUpdate({ active: true, status: "error" }), {
    active: true,
    status: "queued",
    clearLastError: true,
  });
  assert.equal(planStartSyncSourceUpdate({ active: true, status: "processing" }), null);
  assert.equal(planStartSyncSourceUpdate({ active: false, status: "complete" }), null);
  assert.deepEqual(parsePositiveSourceIds("1,2,2, x, -1, 4"), [1, 2, 4]);
  assert.deepEqual(parsePositiveSourceIds("10,11,12", 2), [10, 11]);
  assert.deepEqual(buildSourceStatusCounts(["queued", "processing", "error", "paused", "complete", "weird"]), {
    queued: 1,
    processing: 1,
    error: 1,
    paused: 1,
    complete: 1,
    other: 1,
  });
  assert.equal(
    selectNextSourceId([
      { id: 1, status: "paused" },
      { id: 2, status: "queued" },
      { id: 3, status: "processing" },
    ]),
    3,
  );
  assert.equal(
    selectNextSourceId([
      { id: 1, status: "paused" },
      { id: 2, status: "queued" },
    ]),
    2,
  );
  assert.equal(selectNextSourceId([{ id: 1, status: "complete" }]), null);
  assert.deepEqual(createProcessingAttempt(7), {
    attempted: false,
    sourceId: 7,
    lockAcquired: false,
    outcome: "skipped",
  });
  assert.deepEqual(markProcessingAttemptStarted(createProcessingAttempt(7)), {
    attempted: true,
    sourceId: 7,
    lockAcquired: false,
    outcome: "skipped",
  });
  assert.deepEqual(markProcessingAttemptLockBusy(createProcessingAttempt(7)), {
    attempted: true,
    sourceId: 7,
    lockAcquired: false,
    outcome: "skipped",
    message: "Worker lock busy",
    error: undefined,
  });
  assert.deepEqual(markProcessingAttemptSuccess(createProcessingAttempt(7), ""), {
    attempted: true,
    sourceId: 7,
    lockAcquired: true,
    outcome: "ok",
    message: "Processed one source step.",
    error: undefined,
  });
  assert.deepEqual(markProcessingAttemptError(createProcessingAttempt(7), "boom"), {
    attempted: true,
    sourceId: 7,
    lockAcquired: true,
    outcome: "error",
    error: "boom",
    message: undefined,
  });
  assert.deepEqual(
    getProcessingAttemptSourceMeta(
      [
        { id: 4, name: "Artist A", entityKind: "artist", status: "queued" },
        { id: 5, name: "", entityKind: null, status: "queued" },
      ],
      4,
    ),
    { sourceName: "Artist A", entityKind: "artist" },
  );
  assert.deepEqual(
    getProcessingAttemptSourceMeta(
      [
        { id: 4, name: "Artist A", entityKind: "artist", status: "queued" },
        { id: 5, name: "", entityKind: null, status: "queued" },
      ],
      5,
    ),
    { sourceName: "Source 5", entityKind: "label" },
  );
  assert.deepEqual(
    planSourceNextRecovery({
      status: "processing",
      transientError: false,
      hasPendingReleases: false,
      paginationFinished: true,
      hasStartedPagination: true,
      staleForMs: 1_000,
      hasActiveLock: false,
    }),
    { action: "mark_complete" },
  );
  assert.deepEqual(
    planSourceNextRecovery({
      status: "processing",
      transientError: false,
      hasPendingReleases: true,
      paginationFinished: false,
      hasStartedPagination: true,
      staleForMs: 30_000,
      hasActiveLock: false,
    }),
    { action: "recover", nextStatus: "queued", clearLastError: true },
  );
  assert.deepEqual(
    planSourceNextRecovery({
      status: "error",
      transientError: true,
      hasPendingReleases: false,
      paginationFinished: true,
      hasStartedPagination: true,
      staleForMs: 11_000,
      hasActiveLock: false,
    }),
    { action: "mark_complete" },
  );
  assert.deepEqual(
    planSourceNextRecovery({
      status: "error",
      transientError: true,
      hasPendingReleases: true,
      paginationFinished: false,
      hasStartedPagination: true,
      staleForMs: 11_000,
      hasActiveLock: true,
    }),
    { action: "none" },
  );
  assert.equal(resolveSourceNextBlocker({ nextSourceId: 1, errorCount: 5, activeCount: 10 }), null);
  assert.equal(
    resolveSourceNextBlocker({ nextSourceId: null, errorCount: 1, activeCount: 3 }),
    "Only errored sources remain. Retry or clear errors to continue.",
  );
  assert.equal(resolveSourceNextBlocker({ nextSourceId: null, errorCount: 0, activeCount: 0 }), "No active sources.");
  assert.equal(resolveSourceNextBlocker({ nextSourceId: null, errorCount: 0, activeCount: 2 }), "No queued/processing sources.");
  assert.equal(toSourceKind("artist"), "artist");
  assert.equal(toSourceKind("label"), "label");
  assert.equal(toSourceKind("anything"), "label");
  assert.equal(getPausedStatusFromCurrent("complete"), "complete");
  assert.equal(getPausedStatusFromCurrent("processing"), "paused");
  assert.equal(getPausedStatusFromCurrent("error"), "paused");
  assert.equal(shouldClearErrorOnCooldown("error"), true);
  assert.equal(shouldClearErrorOnCooldown("processing"), false);
  const fixedNow = new Date("2026-03-04T00:00:00.000Z");
  assert.deepEqual(buildPauseSourceUpdate("processing", fixedNow), {
    active: false,
    status: "paused",
    updatedAt: fixedNow,
  });
  assert.deepEqual(buildPauseAndCooldownSourceUpdate("error", fixedNow), {
    active: false,
    status: "paused",
    updatedAt: fixedNow,
    lastError: null,
    retryCount: 0,
  });
  assert.deepEqual(buildPauseAndCooldownSourceUpdate("complete", fixedNow), {
    active: false,
    status: "complete",
    updatedAt: fixedNow,
  });
  const groupedFailures = groupSourceFailuresByCategory(
    [
      { id: 1, lastError: "OAuth token expired" },
      { id: 2, lastError: "Discogs error 429" },
      { id: 3, lastError: "Discogs error 429" },
      { id: 4, lastError: "" },
    ],
    (row) => row.lastError,
  );
  assert.equal(groupedFailures[0]?.category, "rate_limit");
  assert.equal(groupedFailures[0]?.items.length, 2);
  assert.equal(groupedFailures[1]?.category, "auth");
  assert.equal(groupedFailures[2]?.category, "unknown");
  const groupedTie = groupSourceFailuresByCategory(
    [
      { id: 1, lastError: "Discogs error 429" },
      { id: 2, lastError: "OAuth token expired" },
    ],
    (row) => row.lastError,
  );
  assert.equal(groupedTie[0]?.category, "auth");
  assert.equal(groupedTie[1]?.category, "rate_limit");
  const syncBreakdown = buildSyncRunBreakdown(
    [
      { sourceId: 1, sourceName: "Label A", sourceKind: "label", outcome: "ok", lockAcquired: true, durationMs: 1200, createdAt: Date.now() },
      { sourceId: 2, sourceName: "Artist B", sourceKind: "artist", outcome: "error", error: "YouTube quota exceeded", lockAcquired: true, durationMs: 1800, createdAt: Date.now() },
      { sourceId: 3, sourceName: "Label C", sourceKind: "label", outcome: "error", error: "OAuth token expired", lockAcquired: true, durationMs: 900, createdAt: Date.now() },
    ],
    60,
  );
  assert.deepEqual(syncBreakdown.sourceKinds, { label: 2, artist: 1, unknown: 0 });
  assert.deepEqual(syncBreakdown.failureProviders, { discogs: 0, youtube: 1, unknown: 1 });
  assert.equal(syncBreakdown.failureCategories.auth, 1);
  assert.equal(syncBreakdown.failureCategories.rate_limit, 1);
  const now = Date.now();
  assert.deepEqual(
    buildSyncHealthAlerts({
      now,
      counts: { processing: 1, error: 2 },
      syncTelemetry: {
        sourceId: 1,
        sourceName: "Source A",
        sourceKind: "label",
        phase: "processing_release",
        updatedAt: now - 91_000,
      },
      throughputLong: { failedRuns: 5, successfulRuns: 2, lastSuccessAt: now - 5_000 },
      throughputBreakdown: {
        failureCategories: { auth: 2 },
      },
    }),
    [
      { kind: "stalled_processing", severity: "critical", summary: "Processing looks stalled. No sync update for over 90s." },
      { kind: "failure_burst", severity: "warning", summary: "Failures are dominating the last hour (5 failed, 2 ok)." },
      { kind: "auth_failures", severity: "warning", summary: "Auth failures are recurring (2 in the last hour)." },
    ],
  );
  assert.deepEqual(
    buildSyncHealthAlerts({
      now,
      counts: { processing: 0, error: 0 },
      syncTelemetry: null,
      throughputLong: { failedRuns: 1, successfulRuns: 4, lastSuccessAt: now - 5_000 },
      throughputBreakdown: {
        failureCategories: { auth: 0 },
      },
    }),
    [],
  );
  const failureSpike = buildSyncWindowComparison(
    [
      { sourceId: 1, sourceName: "A", outcome: "error", error: "OAuth token expired", lockAcquired: true, durationMs: 1000, createdAt: now - 60_000 },
      { sourceId: 2, sourceName: "B", outcome: "error", error: "YouTube timeout", lockAcquired: true, durationMs: 1000, createdAt: now - 120_000 },
      { sourceId: 3, sourceName: "C", outcome: "error", error: "Discogs error 429", lockAcquired: true, durationMs: 1000, createdAt: now - 180_000 },
      { sourceId: 4, sourceName: "D", outcome: "ok", lockAcquired: true, durationMs: 900, createdAt: now - 11 * 60_000 },
    ],
    10,
  );
  assert.equal(failureSpike.anomaly, "failures_spike");
  const throughputDrop = buildSyncWindowComparison(
    [
      { sourceId: 1, sourceName: "A", outcome: "ok", lockAcquired: true, durationMs: 800, createdAt: now - 60_000 },
      { sourceId: 2, sourceName: "B", outcome: "ok", lockAcquired: true, durationMs: 800, createdAt: now - 11 * 60_000 },
      { sourceId: 3, sourceName: "C", outcome: "ok", lockAcquired: true, durationMs: 800, createdAt: now - 12 * 60_000 },
      { sourceId: 4, sourceName: "D", outcome: "ok", lockAcquired: true, durationMs: 800, createdAt: now - 13 * 60_000 },
    ],
    10,
  );
  assert.equal(throughputDrop.anomaly, "throughput_drop");
  const latencySpike = buildSyncWindowComparison(
    [
      { sourceId: 1, sourceName: "A", outcome: "ok", lockAcquired: true, durationMs: 4000, createdAt: now - 60_000 },
      { sourceId: 2, sourceName: "B", outcome: "ok", lockAcquired: true, durationMs: 4200, createdAt: now - 120_000 },
      { sourceId: 3, sourceName: "C", outcome: "ok", lockAcquired: true, durationMs: 1500, createdAt: now - 11 * 60_000 },
      { sourceId: 4, sourceName: "D", outcome: "ok", lockAcquired: true, durationMs: 1200, createdAt: now - 12 * 60_000 },
    ],
    10,
  );
  assert.equal(latencySpike.anomaly, "latency_spike");

  // OAuth temp cookie parsing coverage.
  const encodedDiscogs = encodeDiscogsOAuthPending({
    state: "s",
    requestToken: "t",
    requestTokenSecret: "sec",
  });
  assert.deepEqual(decodeDiscogsOAuthPending(encodedDiscogs), {
    state: "s",
    requestToken: "t",
    requestTokenSecret: "sec",
  });
  assert.deepEqual(decodeDiscogsOAuthPending("s:t:sec"), {
    state: "s",
    requestToken: "t",
    requestTokenSecret: "sec",
  });
  assert.equal(decodeDiscogsOAuthPending("bad"), null);

  const encodedYoutube = encodeYoutubeOAuthPending({
    state: "abc",
    nextPath: "/settings?tab=library:focus",
  });
  assert.deepEqual(decodeYoutubeOAuthPending(encodedYoutube), {
    state: "abc",
    nextPath: "/settings?tab=library:focus",
  });
  assert.deepEqual(decodeYoutubeOAuthPending("abc:/settings?tab=library:focus"), {
    state: "abc",
    nextPath: "/settings?tab=library:focus",
  });
  assert.equal(decodeYoutubeOAuthPending("bad"), null);

  // Queue next request normalization coverage.
  const queueParams = parseQueueNextGetParams(new URL("https://digqueue.local/api/queue/next?currentId=42&mode=release&order=shuffle"));
  assert.equal(queueParams.currentId, 42);
  assert.equal(queueParams.mode, "release");
  assert.equal(queueParams.order, "shuffle");
  const queueFallback = parseQueueNextGetParams(new URL("https://digqueue.local/api/queue/next?currentId=NaN&mode=bad&order=bad"));
  assert.equal(queueFallback.currentId, undefined);
  assert.equal(queueFallback.mode, "hybrid");
  assert.equal(queueFallback.order, "in_order");

  // OAuth callback validation branch coverage.
  assert.deepEqual(
    validateDiscogsOAuthCallbackInput({
      returnedState: "a",
      oauthToken: "t",
      verifier: "v",
      expectedState: "a",
      requestToken: "t",
      requestTokenSecret: "s",
    }),
    { ok: true },
  );
  assert.deepEqual(
    validateDiscogsOAuthCallbackInput({
      returnedState: "",
      oauthToken: "t",
      verifier: "v",
      expectedState: "a",
      requestToken: "t",
      requestTokenSecret: "s",
    }),
    { ok: false, reason: "invalid_callback" },
  );
  assert.deepEqual(
    validateDiscogsOAuthCallbackInput({
      returnedState: "a",
      oauthToken: "x",
      verifier: "v",
      expectedState: "a",
      requestToken: "t",
      requestTokenSecret: "s",
    }),
    { ok: false, reason: "state_mismatch" },
  );
  assert.deepEqual(
    validateYoutubeOAuthCallbackInput({ returnedState: "a", code: "c", expectedState: "a" }),
    { ok: true },
  );
  assert.deepEqual(
    validateYoutubeOAuthCallbackInput({ returnedState: "a", code: "c", expectedState: "b" }),
    { ok: false, reason: "state_mismatch" },
  );
  assert.deepEqual(
    validateYoutubeOAuthCallbackInput({ returnedState: "a", code: "", expectedState: "a" }),
    { ok: false, reason: "invalid_callback" },
  );

  // Queue transition action semantics coverage.
  assert.equal(shouldMarkCurrentQueueItemPlayed("played"), true);
  assert.equal(shouldMarkCurrentQueueItemPlayed("listened"), true);
  assert.equal(shouldMarkCurrentQueueItemPlayed("next"), false);
  assert.equal(shouldMarkCurrentTrackListened("listened"), true);
  assert.equal(shouldMarkCurrentTrackListened("played"), false);
  assert.equal(normalizeCurrentQueueItemIdFromPost(undefined), undefined);
  assert.equal(normalizeCurrentQueueItemIdFromPost(0), undefined);
  assert.equal(normalizeCurrentQueueItemIdFromPost(-1), undefined);
  assert.equal(normalizeCurrentQueueItemIdFromPost(2.5), undefined);
  assert.equal(normalizeCurrentQueueItemIdFromPost(7), 7);
  assert.equal(resolveQueueModeFromPost(undefined), "hybrid");
  assert.equal(resolveQueueModeFromPost("release"), "release");
  assert.equal(resolveQueueOrderFromPost(undefined), "in_order");
  assert.equal(resolveQueueOrderFromPost("shuffle"), "shuffle");
  assert.deepEqual(getQueueTransitionPlan("next"), {
    markQueueItemPlayed: false,
    markTrackListened: false,
    feedbackEventType: null,
  });
  assert.deepEqual(getQueueTransitionPlan("played"), {
    markQueueItemPlayed: true,
    markTrackListened: false,
    feedbackEventType: "played",
  });
  assert.deepEqual(getQueueTransitionPlan("listened"), {
    markQueueItemPlayed: true,
    markTrackListened: true,
    feedbackEventType: "listened",
  });
  const mutation = parseQueueNextMutationInput({ currentId: 7, action: "played", mode: undefined, order: undefined });
  assert.equal(mutation.currentId, 7);
  assert.equal(mutation.mode, "hybrid");
  assert.equal(mutation.order, "in_order");
  assert.equal(shouldApplyPlayedOnlyMutation(mutation), true);
  assert.equal(shouldApplyListenedMutation(mutation), false);
  const listenedMutation = parseQueueNextMutationInput({ currentId: 9, action: "listened", mode: "track", order: "shuffle" });
  assert.equal(shouldApplyPlayedOnlyMutation(listenedMutation), false);
  assert.equal(shouldApplyListenedMutation(listenedMutation), true);
  assert.equal(shouldRefreshReleaseListened(12), true);
  assert.equal(shouldRefreshReleaseListened(0), false);
  assert.equal(shouldRefreshReleaseListened(undefined), false);
  assert.deepEqual(
    buildQueueNextEffectPlan({
      currentId: 7,
      transitionPlan: getQueueTransitionPlan("played"),
      item: { trackId: 11, releaseId: 22 },
    }),
    {
      markQueueItemPlayed: true,
      markTrackListened: false,
      markPendingTrackQueueItemsPlayed: false,
      refreshReleaseListened: false,
      shouldLogFeedback: true,
      feedbackEventType: "played",
    },
  );
  assert.deepEqual(
    buildQueueNextEffectPlan({
      currentId: 9,
      transitionPlan: getQueueTransitionPlan("listened"),
      item: { trackId: 12, releaseId: 24 },
      track: { listened: false },
    }),
    {
      markQueueItemPlayed: true,
      markTrackListened: true,
      markPendingTrackQueueItemsPlayed: true,
      refreshReleaseListened: true,
      shouldLogFeedback: true,
      feedbackEventType: "listened",
    },
  );
  assert.deepEqual(
    buildQueueNextEffectPlan({
      currentId: 9,
      transitionPlan: getQueueTransitionPlan("listened"),
      item: { trackId: null, releaseId: 24 },
    }),
    {
      markQueueItemPlayed: true,
      markTrackListened: false,
      markPendingTrackQueueItemsPlayed: false,
      refreshReleaseListened: false,
      shouldLogFeedback: false,
      feedbackEventType: null,
    },
  );
  assert.deepEqual(
    buildQueueNextEffectPlan({
      currentId: 9,
      transitionPlan: getQueueTransitionPlan("listened"),
      item: { trackId: 12, releaseId: 24 },
      track: { listened: true },
    }),
    {
      markQueueItemPlayed: true,
      markTrackListened: false,
      markPendingTrackQueueItemsPlayed: false,
      refreshReleaseListened: false,
      shouldLogFeedback: false,
      feedbackEventType: null,
    },
  );
  assert.deepEqual(
    buildQueueNextEffectPlan({
      currentId: undefined,
      transitionPlan: getQueueTransitionPlan("next"),
      item: null,
    }),
    {
      markQueueItemPlayed: false,
      markTrackListened: false,
      markPendingTrackQueueItemsPlayed: false,
      refreshReleaseListened: false,
      shouldLogFeedback: false,
      feedbackEventType: null,
    },
  );
  assert.deepEqual(
    findPendingQueueDuplicateIds([
      { id: 1, trackId: 11, releaseId: 21, youtubeVideoId: "abc", priority: 0, bumpedAt: null, addedAt: new Date("2026-03-13T10:00:00Z") },
      { id: 2, trackId: 11, releaseId: 21, youtubeVideoId: "abc", priority: 2, bumpedAt: null, addedAt: new Date("2026-03-13T09:00:00Z") },
      { id: 7, trackId: 11, releaseId: 21, youtubeVideoId: "xyz", priority: 1, bumpedAt: null, addedAt: new Date("2026-03-13T09:30:00Z") },
      { id: 3, trackId: 12, releaseId: 24, youtubeVideoId: "def", priority: 0, bumpedAt: null, addedAt: new Date("2026-03-13T08:00:00Z") },
      { id: 4, trackId: null, releaseId: 30, youtubeVideoId: "release", priority: 0, bumpedAt: null, addedAt: new Date("2026-03-13T07:00:00Z") },
      { id: 5, trackId: 11, releaseId: 21, youtubeVideoId: "abc", priority: 1, bumpedAt: new Date("2026-03-13T11:00:00Z"), addedAt: new Date("2026-03-13T06:00:00Z") },
      { id: 6, trackId: null, releaseId: 30, youtubeVideoId: "release-alt", priority: 1, bumpedAt: null, addedAt: new Date("2026-03-13T11:30:00Z") },
    ]),
    {
      deleteIds: [5, 7, 1, 4],
      duplicateGroups: 2,
      scannedRows: 7,
    },
  );
  assert.deepEqual(
    planChosenYoutubeMatchNormalization([
      { id: 1, chosen: true, score: 2, fetchedAt: new Date("2026-03-13T08:00:00Z") },
      { id: 2, chosen: true, score: 5, fetchedAt: new Date("2026-03-13T09:00:00Z") },
      { id: 3, chosen: false, score: 10, fetchedAt: new Date("2026-03-13T10:00:00Z") },
    ]),
    {
      chosenId: 2,
      clearIds: [1],
    },
  );
  assert.deepEqual(planChosenYoutubeMatchNormalization([]), {
    chosenId: null,
    clearIds: [],
  });
  assert.deepEqual(
    planChosenYoutubeMatchSelection([
      { id: 1, chosen: true, score: 0.5, fetchedAt: new Date("2026-03-13T10:00:00Z") },
      { id: 2, chosen: false, score: 0.8, fetchedAt: new Date("2026-03-13T11:00:00Z") },
    ], 2),
    {
      chosenId: 2,
      clearIds: [1],
      matchedRequestedId: true,
    },
  );
  assert.deepEqual(
    planChosenYoutubeMatchSelection([
      { id: 1, chosen: true, score: 0.5, fetchedAt: new Date("2026-03-13T10:00:00Z") },
      { id: 2, chosen: false, score: 0.8, fetchedAt: new Date("2026-03-13T11:00:00Z") },
    ], 999),
    {
      chosenId: 1,
      clearIds: [],
      matchedRequestedId: false,
    },
  );
  assert.equal(parseQueueNextPostBody({ currentId: 1, action: "played", mode: "hybrid", order: "in_order" }).success, true);
  assert.equal(parseQueueNextPostBody({ currentId: "1", action: "played" }).success, false);
  assert.equal(isShuffleQueueOrder("shuffle"), true);
  assert.equal(isShuffleQueueOrder("in_order"), false);
  const selected: string[] = [];
  const pickedInOrder = await selectNextQueueItem({
    userId: "user-1",
    currentId: 7,
    mode: "release",
    order: "in_order",
    fetchInOrder: async () => {
      selected.push("in_order");
      return "A";
    },
    fetchShuffled: async () => {
      selected.push("shuffle");
      return "B";
    },
  });
  assert.equal(pickedInOrder, "A");
  const pickedShuffle = await selectNextQueueItem({
    userId: "user-1",
    currentId: 7,
    mode: "release",
    order: "shuffle",
    fetchInOrder: async () => {
      selected.push("in_order");
      return "A";
    },
    fetchShuffled: async () => {
      selected.push("shuffle");
      return "B";
    },
  });
  assert.equal(pickedShuffle, "B");
  assert.deepEqual(selected, ["in_order", "shuffle"]);
  assert.deepEqual(
    buildQueueFeedbackPayload("played", { trackId: 11, releaseId: 22, labelId: 33 }, "user-1"),
    {
      eventType: "played",
      source: "api_queue_next",
      trackId: 11,
      releaseId: 22,
      labelId: 33,
      userId: "user-1",
    },
  );
  assert.deepEqual(
    buildQueueFeedbackPayloadFromItem({
      eventType: "listened",
      queueItem: { trackId: 7, releaseId: 8, labelId: 9 },
      userId: "user-2",
    }),
    {
      eventType: "listened",
      source: "api_queue_next",
      trackId: 7,
      releaseId: 8,
      labelId: 9,
      userId: "user-2",
    },
  );
  assert.equal(buildQueueFeedbackPayload(null, { trackId: 1 }, "user-1"), null);
  const zeroThroughput = createZeroSyncThroughput(10);
  assert.equal(zeroThroughput.windowMinutes, 10);
  assert.equal(zeroThroughput.runs, 0);
  assert.equal(zeroThroughput.timeline.length, 0);
  const emptyNextResponse = createEmptySourceNextResponse("boom");
  assert.equal(emptyNextResponse.blocker, "Database unavailable.");
  assert.equal(emptyNextResponse.processingAttempt.error, "boom");
  assert.equal(emptyNextResponse.throughput.windowMinutes, 10);
  assert.equal(emptyNextResponse.throughputLong.windowMinutes, 60);
  const timelineMax = getTimelineMaxRuns([{ minuteOffset: 0, runs: 0, successfulRuns: 0, failedRuns: 0 }, { minuteOffset: 1, runs: 4, successfulRuns: 4, failedRuns: 0 }]);
  assert.equal(timelineMax, 4);
  assert.deepEqual(
    groupTimelineBuckets([
      { minuteOffset: 0, runs: 1, successfulRuns: 1, failedRuns: 0 },
      { minuteOffset: 1, runs: 2, successfulRuns: 2, failedRuns: 0 },
      { minuteOffset: 2, runs: 3, successfulRuns: 2, failedRuns: 1 },
      { minuteOffset: 3, runs: 4, successfulRuns: 4, failedRuns: 0 },
    ], 2),
    [
      { minuteOffset: 0, runs: 3, successfulRuns: 3, failedRuns: 0 },
      { minuteOffset: 2, runs: 7, successfulRuns: 6, failedRuns: 1 },
    ],
  );
  assert.deepEqual(getTimelineBarStyle({ minuteOffset: 1, runs: 4, successfulRuns: 4, failedRuns: 0 }, timelineMax), {
    heightPct: 100,
    className: "bg-emerald-400/80",
  });
  assert.deepEqual(getTimelineBarStyle({ minuteOffset: 1, runs: 0, successfulRuns: 0, failedRuns: 0 }, timelineMax), {
    heightPct: 12,
    className: "bg-zinc-500/30",
  });
  assert.deepEqual(getTimelineBarStyle({ minuteOffset: 1, runs: 1, successfulRuns: 0, failedRuns: 1 }, timelineMax), {
    heightPct: 25,
    className: "bg-rose-400/80",
  });

  // Sync run throughput aggregation coverage.
  const originalNow = Date.now;
  Date.now = () => 1_000_000;
  const stats = buildSyncRunStats(
    [
      { sourceId: 1, sourceName: "A", outcome: "ok", lockAcquired: true, durationMs: 1200, createdAt: 999_900 },
      { sourceId: 2, sourceName: "B", outcome: "error", lockAcquired: true, durationMs: 800, createdAt: 999_800 },
      { sourceId: 3, sourceName: "C", outcome: "ok", lockAcquired: true, durationMs: 500, createdAt: 300_000 },
    ],
    10,
  );
  Date.now = originalNow;
  assert.equal(stats.windowMinutes, 10);
  assert.equal(stats.runs, 2);
  assert.equal(stats.successfulRuns, 1);
  assert.equal(stats.failedRuns, 1);
  assert.equal(stats.averageDurationMs, 1000);
  assert.equal(stats.durationP50Ms, 800);
  assert.equal(stats.durationP90Ms, 1200);
  assert.equal(stats.lastSuccessAt, 999_900);
  assert.equal(stats.timeline.length, 10);
  const latestBucket = stats.timeline[stats.timeline.length - 1];
  assert.equal(latestBucket?.runs, 2);
  assert.equal(latestBucket?.successfulRuns, 1);
  assert.equal(latestBucket?.failedRuns, 1);
  Date.now = () => 1_000_000;
  const longStats = buildSyncRunStats(
    [
      { sourceId: 1, sourceName: "A", outcome: "ok", lockAcquired: true, durationMs: 1000, createdAt: 999_900 },
      { sourceId: 2, sourceName: "B", outcome: "ok", lockAcquired: true, durationMs: 500, createdAt: 970_000 },
      { sourceId: 3, sourceName: "C", outcome: "error", lockAcquired: true, durationMs: 400, createdAt: 960_000 },
    ],
    60,
  );
  assert.equal(longStats.windowMinutes, 60);
  assert.equal(longStats.runs, 3);
  assert.equal(longStats.timeline.length, 60);
  Date.now = originalNow;
  const sourceSuccess = buildLastSuccessBySource([
    { sourceId: 1, sourceName: "A", outcome: "ok", lockAcquired: true, durationMs: 300, createdAt: 999_950 },
    { sourceId: 1, sourceName: "A", outcome: "ok", lockAcquired: true, durationMs: 200, createdAt: 999_940 },
    { sourceId: 2, sourceName: "B", outcome: "error", lockAcquired: true, durationMs: 500, createdAt: 999_930 },
    { sourceId: 3, sourceName: "C", outcome: "ok", lockAcquired: true, durationMs: 250, createdAt: 999_920 },
  ]);
  assert.deepEqual(sourceSuccess, [
    { sourceId: 1, lastSuccessAt: 999_950 },
    { sourceId: 3, lastSuccessAt: 999_920 },
  ]);

  // Release listened rollup rule coverage.
  assert.equal(deriveReleaseListenedFromTracks([]), false);
  assert.equal(deriveReleaseListenedFromTracks([{ listened: true }]), true);
  assert.equal(deriveReleaseListenedFromTracks([{ listened: true }, { listened: false }]), false);
  assert.deepEqual(
    buildReleaseListenedUpdatePlan([10, 11, 12], [
      { releaseId: 10, listened: true },
      { releaseId: 10, listened: true },
      { releaseId: 11, listened: true },
      { releaseId: 11, listened: false },
    ]),
    {
      listenedIds: [10],
      unlistenedIds: [11, 12],
    },
  );
  assert.deepEqual(
    buildSavedWishlistSyncTargets(
      [
        { id: 101, discogsUrl: "https://www.discogs.com/release/55-Example", wishlist: false, labelId: 501 },
        { id: 102, discogsUrl: "https://www.discogs.com/releases/55-Duplicate", wishlist: true, labelId: 502 },
        { id: 103, discogsUrl: "https://www.discogs.com/release/66-Other", wishlist: false, labelId: 503 },
        { id: 104, discogsUrl: "https://www.discogs.com/release/77-Skip", wishlist: true, labelId: 504 },
      ],
      [101, 103, 104],
    ),
    [
      { externalDiscogsReleaseId: 55, localReleaseIds: [101, 102], primaryLocalReleaseId: 101, primaryLabelId: 501, alreadyWishlisted: false },
      { externalDiscogsReleaseId: 66, localReleaseIds: [103], primaryLocalReleaseId: 103, primaryLabelId: 503, alreadyWishlisted: false },
      { externalDiscogsReleaseId: 77, localReleaseIds: [104], primaryLocalReleaseId: 104, primaryLabelId: 504, alreadyWishlisted: true },
    ],
  );
  assert.equal(resolveReleaseWishlistFeedbackEvent({ currentWishlist: false, nextWishlist: true }), "record_wishlist_add");
  assert.equal(resolveReleaseWishlistFeedbackEvent({ currentWishlist: true, nextWishlist: false }), "record_wishlist_remove");
  assert.equal(resolveReleaseWishlistFeedbackEvent({ currentWishlist: true, nextWishlist: true }), null);
  assert.equal(shouldLogReleaseQueuedFeedback(true), true);
  assert.equal(shouldLogReleaseQueuedFeedback(false), false);
  assert.equal(
    shouldLogReleaseWishlistFeedback({
      feedbackEventType: "record_wishlist_add",
      hasLocalRows: false,
      localConfirmedAll: false,
      discogsSynced: false,
    }),
    false,
  );
  assert.equal(
    shouldLogReleaseWishlistFeedback({
      feedbackEventType: "record_wishlist_add",
      hasLocalRows: false,
      localConfirmedAll: false,
      discogsSynced: true,
    }),
    true,
  );
  assert.equal(
    shouldLogReleaseWishlistFeedback({
      feedbackEventType: "record_wishlist_remove",
      hasLocalRows: true,
      localConfirmedAll: true,
      discogsSynced: false,
    }),
    true,
  );
  assert.equal(
    resolveUserReleaseExternalDiscogsId({ id: toStoredDiscogsId("user-1", 88, "release"), discogsUrl: null }),
    88,
  );
  assert.deepEqual(
    buildLocalReleaseWishlistSetPlan(
      [
        { id: 201, discogsUrl: "https://www.discogs.com/release/55-Example", wishlist: false },
        { id: 202, discogsUrl: "https://www.discogs.com/releases/55-Duplicate", wishlist: true },
        { id: toStoredDiscogsId("user-1", 66, "release"), discogsUrl: null, wishlist: false },
      ],
      [55, 66],
      true,
    ),
    [201, toStoredDiscogsId("user-1", 66, "release")],
  );
  assert.deepEqual(
    buildLocalReleaseWishlistSyncPlan(
      [
        { id: 201, discogsUrl: "https://www.discogs.com/release/55-Example", wishlist: false },
        { id: 202, discogsUrl: "https://www.discogs.com/releases/55-Duplicate", wishlist: true },
        { id: toStoredDiscogsId("user-1", 66, "release"), discogsUrl: null, wishlist: false },
        { id: 204, discogsUrl: "https://www.discogs.com/release/77-Other", wishlist: true },
      ],
      [55, 66],
    ),
    {
      toSetReleaseIds: [201, toStoredDiscogsId("user-1", 66, "release")],
      toUnsetReleaseIds: [204],
    },
  );
  assert.equal(typeof setLocalReleaseWishlistForUser, "function");
  assert.equal(typeof applyLocalReleaseWishlistSyncPlanForUser, "function");
  assert.deepEqual(
    buildReleaseWishlistSyncTargetsForLocalReleaseIds(
      [
        { id: 201, discogsUrl: "https://www.discogs.com/release/55-Example", wishlist: false, labelId: 501 },
        { id: 202, discogsUrl: "https://www.discogs.com/releases/55-Duplicate", wishlist: true, labelId: 502 },
        { id: toStoredDiscogsId("user-1", 66, "release"), discogsUrl: null, wishlist: false, labelId: 503 },
        { id: 204, discogsUrl: "https://www.discogs.com/release/77-Other", wishlist: true, labelId: 504 },
      ],
      [201, 202, 204],
    ),
    [
      { externalDiscogsReleaseId: 55, localReleaseIds: [201, 202], primaryLocalReleaseId: 201, primaryLabelId: 501, alreadyWishlisted: false },
      { externalDiscogsReleaseId: 77, localReleaseIds: [204], primaryLocalReleaseId: 204, primaryLabelId: 504, alreadyWishlisted: true },
    ],
  );
  assert.deepEqual(
    selectConfirmedReleaseWishlistFeedbackTargets({
      targets: buildReleaseWishlistSyncTargetsForLocalReleaseIds(
        [
          { id: 301, discogsUrl: "https://www.discogs.com/release/88-New", wishlist: true, labelId: 601 },
          { id: 302, discogsUrl: "https://www.discogs.com/release/99-New", wishlist: true, labelId: 602 },
        ],
        [301, 302],
      ),
      confirmedReleaseIds: [301, 302],
    }),
    [
      { externalDiscogsReleaseId: 88, localReleaseIds: [301], primaryLocalReleaseId: 301, primaryLabelId: 601, alreadyWishlisted: true },
      { externalDiscogsReleaseId: 99, localReleaseIds: [302], primaryLocalReleaseId: 302, primaryLabelId: 602, alreadyWishlisted: true },
    ],
  );
  assert.deepEqual(
    selectConfirmedReleaseWishlistFeedbackTargets({
      targets: [
        { externalDiscogsReleaseId: 55, localReleaseIds: [201, 202], primaryLocalReleaseId: 201, primaryLabelId: 501, alreadyWishlisted: false },
        { externalDiscogsReleaseId: 66, localReleaseIds: [203], primaryLocalReleaseId: 203, primaryLabelId: 503, alreadyWishlisted: false },
        { externalDiscogsReleaseId: 77, localReleaseIds: [], primaryLocalReleaseId: null, primaryLabelId: null, alreadyWishlisted: false },
      ],
      confirmedReleaseIds: [201, 202, 204],
    }),
    [
      { externalDiscogsReleaseId: 55, localReleaseIds: [201, 202], primaryLocalReleaseId: 201, primaryLabelId: 501, alreadyWishlisted: false },
      { externalDiscogsReleaseId: 77, localReleaseIds: [], primaryLocalReleaseId: null, primaryLabelId: null, alreadyWishlisted: false },
    ],
  );
  assert.deepEqual(
    [...buildUserReleaseIdsByExternalDiscogsId([
      { id: 201, discogsUrl: "https://www.discogs.com/release/55-Example" },
      { id: 202, discogsUrl: "https://www.discogs.com/releases/55-Duplicate" },
      { id: toStoredDiscogsId("user-1", 66, "release"), discogsUrl: null },
      { id: 204, discogsUrl: "https://www.discogs.com/release/77-Other" },
    ]).entries()],
    [
      [55, [201, 202]],
      [66, [toStoredDiscogsId("user-1", 66, "release")]],
      [77, [204]],
    ],
  );
  assert.deepEqual(
    buildMissingWantTrackSeedPlan({
      missingWanted: [
        { releaseId: 55, title: "A", artist: "Artist A" },
        { releaseId: 66, title: "B", artist: "Artist B" },
        { releaseId: 77, title: "C", artist: "Artist C" },
      ],
      importedReleaseIdsByExternalId: new Map([
        [55, 501],
        [77, 503],
      ]),
      existingTrackReleaseIds: new Set([503]),
    }),
    [
      { externalDiscogsReleaseId: 55, persistedReleaseId: 501, title: "A", artist: "Artist A" },
    ],
  );
  assert.deepEqual(
    mergeSourceReleaseMappingState({
      existingReleaseOrder: 8,
      existingDiscoveredAt: new Date("2026-03-13T10:00:00Z"),
      nextReleaseOrder: 3,
      nextDiscoveredAt: new Date("2026-03-13T12:00:00Z"),
    }),
    {
      releaseOrder: 3,
      discoveredAt: new Date("2026-03-13T12:00:00Z"),
    },
  );

  console.log("regression-tests: ok");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
