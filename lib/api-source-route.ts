import { parsePositiveIntRouteParam } from "@/lib/api-route-params";
import { requireMutationUser } from "@/lib/api-mutation";

type SourceRouteParams = Promise<{ id: string }>;

type SourceMutationRouteResult =
  | { userId: string; sourceId: number; response?: undefined }
  | { userId?: undefined; sourceId?: undefined; response: Response };

export async function requireSourceMutationRoute(
  params: SourceRouteParams,
  options: {
    bucket: string;
    limit: number;
    windowSeconds: number;
    invalidMessage?: string;
  },
): Promise<SourceMutationRouteResult> {
  const auth = await requireMutationUser({
    bucket: options.bucket,
    limit: options.limit,
    windowSeconds: options.windowSeconds,
  });
  if (auth.response) return { response: auth.response };

  const sourceId = await parsePositiveIntRouteParam(
    params,
    "id",
    options.invalidMessage ?? "Invalid source id.",
  );
  if (sourceId.response) return { response: sourceId.response };

  return {
    userId: auth.userId,
    sourceId: sourceId.value,
  };
}
