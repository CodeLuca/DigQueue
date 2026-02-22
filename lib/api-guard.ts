import { NextResponse } from "next/server";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

type GuardRateLimitOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

export async function guardMutationRateLimit(userId: string, options: GuardRateLimitOptions) {
  try {
    await enforceRateLimit(userId, options);
    return null;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          error: "Too many requests. Slow down and try again.",
          bucket: options.bucket,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        {
          status: error.status,
          headers: {
            "Retry-After": String(error.retryAfterSeconds),
          },
        },
      );
    }
    throw error;
  }
}
