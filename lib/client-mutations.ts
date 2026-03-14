import type { ClientFetcher } from "@/lib/client-fetcher";
import { buildJsonPostInit, buildJsonRequestInit, requireClientJson } from "@/lib/client-json";

type ClientMutationOptions = {
  fetcher?: ClientFetcher;
  errorMessage?: string;
  unauthorizedMessage?: string;
};

export async function postClientMutation<TResponse>(
  path: string,
  body?: unknown,
  options?: ClientMutationOptions,
) {
  return requireClientJson<TResponse>(path, buildJsonPostInit(body), options);
}

export async function deleteClientMutation<TResponse>(
  path: string,
  options?: ClientMutationOptions,
) {
  return requireClientJson<TResponse>(path, buildJsonRequestInit("DELETE"), options);
}
