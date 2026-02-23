import { NextResponse } from "next/server";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

type GuardRateLimitOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

const LENIENT_LIMIT_MULTIPLIER = 20;
const MIN_MUTATION_LIMIT = 1000;

export async function guardMutationRateLimit(userId: string, options: GuardRateLimitOptions) {
  const relaxedOptions: GuardRateLimitOptions = {
    ...options,
    limit: Math.max(MIN_MUTATION_LIMIT, options.limit * LENIENT_LIMIT_MULTIPLIER),
  };

  try {
    await enforceRateLimit(userId, relaxedOptions);
    return null;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          error: "Too many requests. Slow down and try again.",
          bucket: relaxedOptions.bucket,
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
