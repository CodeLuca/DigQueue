import { NextResponse } from "next/server";
import { parsePositiveIntRouteParam } from "@/lib/api-route-params";
import { errorJson } from "@/lib/api-response";

export async function handlePublicIntRoute<TResponse>(input: {
  params: Promise<{ id: string }>;
  key?: string;
  invalidMessage: string;
  fallbackErrorMessage: string;
  errorStatus?: number;
  load: (id: number) => Promise<TResponse>;
}) {
  const parsed = await parsePositiveIntRouteParam(
    input.params,
    input.key ?? "id",
    input.invalidMessage,
  );
  if (parsed.response) return parsed.response;

  try {
    const result = await input.load(parsed.value);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : input.fallbackErrorMessage;
    return errorJson(message, { status: input.errorStatus ?? 500 });
  }
}
