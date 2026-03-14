import type { ClientFetcher } from "@/lib/client-fetcher";
import { deleteClientMutation, postClientMutation } from "@/lib/client-mutations";

type ClientSourceMutationOptions = {
  fetcher?: ClientFetcher;
};

export async function postSourceClientMutation<TResponse>(
  path: string,
  body: unknown,
  fallbackMessage: string,
  options?: ClientSourceMutationOptions,
) {
  return postClientMutation<TResponse>(path, body, {
    ...options,
    errorMessage: fallbackMessage,
  });
}

export async function deleteSourceClientMutation<TResponse>(
  path: string,
  fallbackMessage: string,
  options?: ClientSourceMutationOptions,
) {
  return deleteClientMutation<TResponse>(path, {
    ...options,
    errorMessage: fallbackMessage,
  });
}
