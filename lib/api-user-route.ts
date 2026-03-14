import { NextResponse } from "next/server";
import { guardMutationRateLimit } from "@/lib/api-guard";
import { errorJson } from "@/lib/api-response";
import { requireRouteUserId } from "@/lib/app-user";

type UserRouteRateLimitOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

type UserRouteOptions = {
  errorMessage: string;
  rateLimit?: UserRouteRateLimitOptions;
};

export async function runUserJsonRoute(
  handler: (userId: string) => Promise<Response | unknown>,
  options: UserRouteOptions,
) {
  try {
    const auth = await requireRouteUserId();
    if (auth.response) return auth.response;

    if (options.rateLimit) {
      const rateLimited = await guardMutationRateLimit(auth.userId, options.rateLimit);
      if (rateLimited) return rateLimited;
    }

    const result = await handler(auth.userId);
    if (result instanceof Response) return result;
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : options.errorMessage;
    return errorJson(message || options.errorMessage, { status: 500 });
  }
}
