import type { ZodType } from "zod";
import { guardMutationRateLimit } from "@/lib/api-guard";
import { validationErrorJson } from "@/lib/api-response";
import { requireRouteUserId } from "@/lib/app-user";

type MutationRateLimitOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

type MutationAuthResult =
  | { userId: string; response?: undefined }
  | { userId?: undefined; response: Response };

export async function requireMutationUser(
  options: MutationRateLimitOptions,
): Promise<MutationAuthResult> {
  const auth = await requireRouteUserId();
  if (auth.response) return { response: auth.response };
  const rateLimited = await guardMutationRateLimit(auth.userId, options);
  if (rateLimited) return { response: rateLimited };
  return { userId: auth.userId };
}

type ParsedMutationBodyResult<T> =
  | { data: T; response?: undefined }
  | { data?: undefined; response: Response };

export async function parseMutationBody<T>(
  request: Request,
  schema: ZodType<T>,
  options?: { fallbackBody?: unknown },
): Promise<ParsedMutationBodyResult<T>> {
  const body = await request.json().catch(() => options?.fallbackBody ?? null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { response: validationErrorJson(parsed.error) };
  }
  return { data: parsed.data };
}
