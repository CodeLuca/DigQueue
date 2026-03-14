import type { ZodType } from "zod";
import { parseMutationBody } from "@/lib/api-mutation";
import { badRequestJson, okJson } from "@/lib/api-response";

export async function handlePublicMutation<TInput, TOutput extends Record<string, unknown>>(
  request: Request,
  schema: ZodType<TInput>,
  action: (input: TInput) => Promise<TOutput>,
  fallbackErrorMessage: string,
) {
  const parsed = await parseMutationBody(request, schema);
  if (parsed.response) return parsed.response;

  try {
    const result = await action(parsed.data);
    return okJson(result);
  } catch (error) {
    return badRequestJson(error instanceof Error ? error.message : fallbackErrorMessage);
  }
}
