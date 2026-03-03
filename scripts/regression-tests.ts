import assert from "node:assert/strict";
import { toDiscogsWebUrl } from "../lib/discogs-links";
import { normalizeNextPath } from "../lib/next-path";

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

  console.log("regression-tests: ok");
}

run();
