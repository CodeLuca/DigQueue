import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export class RateLimitError extends Error {
  status: number;
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.status = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

export async function checkRateLimit(userId: string, options: RateLimitOptions) {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const resetAt = now + windowMs;
  const bucketKey = `${userId}:${options.bucket}`;

  const rows = await db.execute(sql`
    insert into api_rate_limits (bucket_key, user_id, endpoint, request_count, window_started_at, reset_at, updated_at)
    values (${bucketKey}, ${userId}::uuid, ${options.bucket}, 1, ${now}, ${resetAt}, ${now})
    on conflict (bucket_key)
    do update set
      request_count = case
        when api_rate_limits.reset_at <= ${now} then 1
        else api_rate_limits.request_count + 1
      end,
      window_started_at = case
        when api_rate_limits.reset_at <= ${now} then ${now}
        else api_rate_limits.window_started_at
      end,
      reset_at = case
        when api_rate_limits.reset_at <= ${now} then ${resetAt}
        else api_rate_limits.reset_at
      end,
      updated_at = ${now}
    returning request_count, reset_at
  `);

  const requestCount = Number(rows[0]?.request_count ?? 1);
  const currentResetAt = Number(rows[0]?.reset_at ?? resetAt);
  const retryAfterSeconds = Math.max(1, Math.ceil((currentResetAt - now) / 1000));

  return {
    allowed: requestCount <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - requestCount),
    retryAfterSeconds,
  };
}

export async function enforceRateLimit(userId: string, options: RateLimitOptions) {
  const result = await checkRateLimit(userId, options);
  if (!result.allowed) {
    throw new RateLimitError(`Rate limit exceeded for ${options.bucket}.`, result.retryAfterSeconds);
  }
  return result;
}
