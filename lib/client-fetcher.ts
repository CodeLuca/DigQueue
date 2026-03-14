export type ClientFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export function resolveClientFetcher(fetcher?: ClientFetcher): ClientFetcher {
  return fetcher ?? ((input: string, init?: RequestInit) => fetch(input, init));
}
