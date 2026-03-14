import type { ClientFetcher } from "@/lib/client-fetcher";
import {
  buildJsonPostInit,
  fetchClientJson,
  fetchOptionalOkClientJson,
  fetchRequiredClientJson,
} from "@/lib/client-json";

type ClientQueryOptions = {
  fetcher?: ClientFetcher;
  errorMessage?: string;
  unauthorizedMessage?: string;
};

export async function getClientQuery<TResponse>(
  path: string,
  options?: { fetcher?: ClientFetcher; cache?: RequestCache },
) {
  return fetchClientJson<TResponse>(
    path,
    options?.cache ? { cache: options.cache } : undefined,
    options,
  );
}

export async function getRequiredClientQuery<TResponse>(
  path: string,
  options?: ClientQueryOptions,
) {
  return fetchRequiredClientJson<TResponse>(path, undefined, options);
}

export async function getOptionalOkClientQuery<TResponse extends { ok?: boolean }>(
  path: string,
  options?: { fetcher?: ClientFetcher; cache?: RequestCache },
) {
  return fetchOptionalOkClientJson<TResponse>(
    path,
    options?.cache ? { cache: options.cache } : undefined,
    options,
  );
}

export async function postClientQuery<TResponse>(
  path: string,
  body?: unknown,
  options?: { fetcher?: ClientFetcher },
) {
  return fetchClientJson<TResponse>(path, buildJsonPostInit(body), options);
}

export async function postOptionalOkClientQuery<TResponse extends { ok?: boolean }>(
  path: string,
  body?: unknown,
  options?: { fetcher?: ClientFetcher },
) {
  return fetchOptionalOkClientJson<TResponse>(path, buildJsonPostInit(body), options);
}
