import assert from "node:assert/strict";
import { toDiscogsWebUrl } from "../lib/discogs-links";
import { sanitizeDiscogsConnectionErrorMessage } from "../lib/discogs-errors";
import { normalizeNextPath } from "../lib/next-path";
import { appendQueryParam, buildOAuthConnectedRedirectPath, buildOAuthErrorRedirectPath } from "../lib/oauth-redirects";
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
import { parseQueueNextGetParams } from "../lib/queue-next-request";
import { getQueueTransitionPlan } from "../lib/queue-transition-plan";
import { deriveReleaseListenedFromTracks } from "../lib/release-listened";
import { parsePositiveSourceIds } from "../lib/source-id-list";
import { classifySourceFailure, getFailureCategoryMeta } from "../lib/source-failures";
import { buildLastSuccessBySource, buildSyncRunStats } from "../lib/sync-run-stats";
import { collectUniquePlayableVideoIds, normalizePlaylistExportInput } from "../lib/youtube-playlist-export";

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
    toDiscogsWebUrl("https://api.discogs.com/releases/24761", ""),
    "https://www.discogs.com/release/24761",
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
    toDiscogsWebUrl("", ""),
    "https://www.discogs.com",
  );

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
  assert.equal(classifySourceFailure("failed query: relation missing"), "database");
  assert.equal(classifySourceFailure("YouTube provider timeout"), "provider");
  assert.equal(classifySourceFailure("Invalid tracklist payload"), "data");
  assert.equal(classifySourceFailure("totally unknown"), "unknown");
  assert.equal(getFailureCategoryMeta("auth").href, "/api/discogs/oauth/start?next=/?tab=step-2");
  assert.equal(getFailureCategoryMeta("rate_limit").label, "Rate Limit");
  assert.match(getFailureCategoryMeta("database").hint, /stale locks/i);
  assert.equal(getFailureCategoryMeta("unknown").label, "Unknown");
  assert.deepEqual(parsePositiveSourceIds("1,2,2, x, -1, 4"), [1, 2, 4]);
  assert.deepEqual(parsePositiveSourceIds("10,11,12", 2), [10, 11]);

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

  console.log("regression-tests: ok");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
