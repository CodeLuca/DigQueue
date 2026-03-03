import assert from "node:assert/strict";
import { toDiscogsWebUrl } from "../lib/discogs-links";
import { normalizeNextPath } from "../lib/next-path";
import {
  decodeDiscogsOAuthPending,
  decodeYoutubeOAuthPending,
  encodeDiscogsOAuthPending,
  encodeYoutubeOAuthPending,
} from "../lib/oauth-temp-cookie";
import { validateDiscogsOAuthCallbackInput, validateYoutubeOAuthCallbackInput } from "../lib/oauth-callback-validation";
import { buildYouTubeHandoffTargets, isIOSLikeDevice } from "../lib/playback-mobile";
import {
  resolveQueueModeFromPost,
  resolveQueueOrderFromPost,
  shouldMarkCurrentQueueItemPlayed,
  shouldMarkCurrentTrackListened,
} from "../lib/queue-next-actions";
import { parseQueueNextGetParams } from "../lib/queue-next-request";
import { getQueueTransitionPlan } from "../lib/queue-transition-plan";
import { classifySourceFailure } from "../lib/source-failures";
import { buildSyncRunStats } from "../lib/sync-run-stats";
import { collectUniquePlayableVideoIds, normalizePlaylistExportInput } from "../lib/youtube-playlist-export";

function run() {
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
  assert.equal(stats.lastSuccessAt, 999_900);

  console.log("regression-tests: ok");
}

run();
