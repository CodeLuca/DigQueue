import { badRequestJson } from "@/lib/api-response";

type RouteParams = Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;

type ParsedRouteParamResult =
  | { value: number; response?: undefined }
  | { value?: undefined; response: Response };

export async function parsePositiveIntRouteParam(
  params: RouteParams,
  key: string,
  errorMessage: string,
): Promise<ParsedRouteParamResult> {
  const value = (await params)[key];
  const parsed =
    typeof value === "string" && value.trim().length > 0 ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { response: badRequestJson(errorMessage) };
  }
  return { value: parsed };
}
