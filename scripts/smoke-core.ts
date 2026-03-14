type ProbeResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const baseUrl = (process.env.SMOKE_BASE_URL || process.env.APP_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const cookieHeader = (process.env.SMOKE_COOKIE || "").trim();
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 10_000);

async function request(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(init?.headers || {});
    if (cookieHeader) headers.set("cookie", cookieHeader);
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) {
    throw new Error(detail);
  }
}

async function probeOAuthStart(provider: "discogs" | "youtube"): Promise<ProbeResult> {
  const loginPath = provider === "discogs" ? "/login?next=%2Fconnect-discogs" : "/login?next=%2Fsettings";
  const response = await request(`/api/${provider}/oauth/start?next=/settings`);
  const location = response.headers.get("location") || "";

  assert(response.status >= 300 && response.status < 400, `expected redirect, got ${response.status}`);
  if (!cookieHeader) {
    assert(location.includes(loginPath), `expected login redirect containing ${loginPath}, got ${location || "none"}`);
    return { name: `${provider} oauth start`, ok: true, detail: `redirects to login (${location})` };
  }

  assert(location.length > 0, "expected authenticated redirect target");
  assert(!location.includes(loginPath), `expected provider redirect, got login redirect ${location}`);
  return { name: `${provider} oauth start`, ok: true, detail: `redirect target ok (${location})` };
}

async function probeSourcesNext(): Promise<ProbeResult> {
  const response = await request("/api/sources/next");
  if (!cookieHeader) {
    assert(response.status === 401, `expected 401, got ${response.status}`);
    return { name: "sources-next", ok: true, detail: "unauthenticated request rejected with 401" };
  }
  assert(response.ok, `expected 200, got ${response.status}`);
  const body = (await response.json()) as { counts?: unknown; processingAttempt?: unknown; blocker?: unknown };
  assert(body && typeof body === "object", "expected JSON object");
  assert(body.counts && typeof body.counts === "object", "missing counts");
  assert(body.processingAttempt && typeof body.processingAttempt === "object", "missing processingAttempt");
  return { name: "sources-next", ok: true, detail: "json shape ok" };
}

async function probeQueueNextGet(): Promise<ProbeResult> {
  const response = await request("/api/queue/next?mode=hybrid&order=in_order");
  if (!cookieHeader) {
    assert(response.status === 401, `expected 401, got ${response.status}`);
    return { name: "queue-next GET", ok: true, detail: "unauthenticated request rejected with 401" };
  }
  assert(response.ok, `expected 200, got ${response.status}`);
  const body = (await response.json()) as unknown;
  assert(body === null || typeof body === "object", "expected null or object");
  return { name: "queue-next GET", ok: true, detail: body === null ? "returned null" : "returned item/json" };
}

async function probeQueueListGet(): Promise<ProbeResult> {
  const response = await request("/api/queue/list?limit=5");
  if (!cookieHeader) {
    assert(response.status === 401, `expected 401, got ${response.status}`);
    return { name: "queue-list GET", ok: true, detail: "unauthenticated request rejected with 401" };
  }
  assert(response.ok, `expected 200, got ${response.status}`);
  const body = (await response.json()) as { items?: unknown };
  assert(body && typeof body === "object", "expected JSON object");
  assert(Array.isArray(body.items), "missing items array");
  return { name: "queue-list GET", ok: true, detail: "json shape ok" };
}

async function probeProtectedJsonGet(input: {
  name: string;
  path: string;
  validateAuthenticated?: (body: unknown) => void;
}) {
  const response = await request(input.path);
  if (!cookieHeader) {
    assert(response.status === 401, `expected 401, got ${response.status}`);
    return { name: input.name, ok: true, detail: "unauthenticated request rejected with 401" };
  }
  assert(response.ok, `expected 200, got ${response.status}`);
  const body = (await response.json()) as unknown;
  input.validateAuthenticated?.(body);
  return { name: input.name, ok: true, detail: "json shape ok" };
}

async function probeProtectedJsonPost(input: {
  name: string;
  path: string;
  body: unknown;
  authenticatedStatus?: number;
  validateAuthenticated?: (body: unknown) => void;
}) {
  const response = await request(input.path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input.body),
  });
  if (!cookieHeader) {
    assert(response.status === 401, `expected 401, got ${response.status}`);
    return { name: input.name, ok: true, detail: "unauthenticated request rejected with 401" };
  }
  const expectedStatus = input.authenticatedStatus ?? 200;
  assert(response.status === expectedStatus, `expected ${expectedStatus}, got ${response.status}`);
  const body = (await response.json()) as unknown;
  input.validateAuthenticated?.(body);
  return {
    name: input.name,
    ok: true,
    detail: expectedStatus === 200 ? (body === null ? "returned null" : "returned item/json") : "authenticated validation boundary ok",
  };
}

async function probeValidationErrorPost(name: string, path: string, body: unknown): Promise<ProbeResult> {
  return probeProtectedJsonPost({
    name,
    path,
    body,
    authenticatedStatus: 400,
    validateAuthenticated: (responseBody) => {
      assert(responseBody && typeof responseBody === "object", "expected JSON object");
      assert("error" in responseBody, "missing error payload");
    },
  });
}

async function probePublicValidationErrorPost(name: string, path: string, body: unknown): Promise<ProbeResult> {
  const response = await request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert(response.status === 400, `expected 400, got ${response.status}`);
  const responseBody = (await response.json()) as unknown;
  assert(responseBody && typeof responseBody === "object", "expected JSON object");
  assert("error" in responseBody, "missing error payload");
  return { name, ok: true, detail: "public validation boundary ok" };
}

async function probeValidationErrorDelete(name: string, path: string): Promise<ProbeResult> {
  const response = await request(path, { method: "DELETE" });
  if (!cookieHeader) {
    assert(response.status === 401, `expected 401, got ${response.status}`);
    return { name, ok: true, detail: "unauthenticated request rejected with 401" };
  }
  assert(response.status === 400, `expected 400, got ${response.status}`);
  const body = (await response.json()) as unknown;
  assert(body && typeof body === "object", "expected JSON object");
  assert("error" in body, "missing error payload");
  return { name, ok: true, detail: "authenticated validation boundary ok" };
}

async function probeQueueNextPost(): Promise<ProbeResult> {
  return probeProtectedJsonPost({
    name: "queue-next POST",
    path: "/api/queue/next",
    body: { action: "next", mode: "hybrid", order: "in_order" },
    validateAuthenticated: (responseBody) => {
      assert(responseBody === null || typeof responseBody === "object", "expected null or object");
    },
  });
}

async function main() {
  const results: ProbeResult[] = [];
  console.log(`smoke-core: base URL ${baseUrl}`);
  console.log(
    cookieHeader
      ? "smoke-core: authenticated probes enabled."
      : "smoke-core: unauthenticated mode; authenticated probes will be skipped.",
  );

  for (const provider of ["discogs", "youtube"] as const) {
    results.push(await probeOAuthStart(provider));
  }

  results.push(await probeSourcesNext());
  results.push(await probeQueueNextGet());
  results.push(await probeQueueListGet());
  results.push(await probeProtectedJsonGet({
    name: "labels-next GET",
    path: "/api/labels/next",
    validateAuthenticated: (responseBody) => {
      assert(responseBody && typeof responseBody === "object", "expected JSON object");
      assert("counts" in responseBody, "missing counts payload");
    },
  }));
  results.push(await probeProtectedJsonGet({
    name: "wishlist-sync-status GET",
    path: "/api/wishlist/sync-status",
    validateAuthenticated: (responseBody) => {
      assert(responseBody && typeof responseBody === "object", "expected JSON object");
      assert("ok" in responseBody, "missing ok field");
    },
  }));
  results.push(await probeProtectedJsonGet({
    name: "settings-keys-test GET",
    path: "/api/settings/keys/test",
    validateAuthenticated: (responseBody) => {
      assert(responseBody && typeof responseBody === "object", "expected JSON object");
      assert("discogs" in responseBody, "missing discogs field");
      assert("youtube" in responseBody, "missing youtube field");
    },
  }));
  results.push(await probeQueueNextPost());
  results.push(await probePublicValidationErrorPost("auth-login POST", "/api/auth/login", {}));
  results.push(await probePublicValidationErrorPost("auth-register POST", "/api/auth/register", {}));
  results.push(await probePublicValidationErrorPost("auth-password-reset-request POST", "/api/auth/password-reset/request", {}));
  results.push(await probePublicValidationErrorPost("auth-password-reset-complete POST", "/api/auth/password-reset/complete", {}));
  results.push(await probeValidationErrorPost("queue-enqueue POST", "/api/queue/enqueue", {}));
  results.push(await probeValidationErrorPost("queue-scope POST", "/api/queue/scope", { trackIds: "bad" }));
  results.push(await probeValidationErrorPost("worker-process POST", "/api/worker/process", {}));
  results.push(await probeValidationErrorPost("tracks-todo POST", "/api/tracks/todo", { trackIds: [] }));
  results.push(await probeValidationErrorPost("youtube-search POST", "/api/youtube/search", {}));
  results.push(await probeValidationErrorPost("releases-reviewed POST", "/api/releases/reviewed", {}));
  results.push(await probeValidationErrorPost("releases-wishlist POST", "/api/releases/wishlist", {}));
  results.push(await probeValidationErrorPost("recommendations-feedback POST", "/api/recommendations/feedback", {}));
  results.push(await probeValidationErrorPost("labels-from-release POST", "/api/labels/from-release", {}));
  results.push(await probeValidationErrorPost("labels-active POST", "/api/labels/0/active", {}));
  results.push(await probeValidationErrorPost("labels-status POST", "/api/labels/0/status", {}));
  results.push(await probeValidationErrorDelete("queue-item DELETE", "/api/queue/item/0"));

  for (const result of results) {
    console.log(`${result.ok ? "ok" : "fail"}: ${result.name} - ${result.detail}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`smoke-core failed: ${message}`);
  process.exitCode = 1;
});
