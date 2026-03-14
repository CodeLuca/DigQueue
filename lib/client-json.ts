import { resolveClientFetcher, type ClientFetcher } from "@/lib/client-fetcher";

type JsonErrorBody = {
  ok?: boolean;
  error?: string;
};

export function extractClientErrorMessage(body: unknown, fallback: string) {
  return body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string"
    ? (body as { error: string }).error
    : fallback;
}

export async function fetchClientJson<TResponse>(
  input: string,
  init?: RequestInit,
  options?: { fetcher?: ClientFetcher },
): Promise<TResponse | null> {
  const response = await resolveClientFetcher(options?.fetcher)(input, init);
  const body = (await response.json().catch(() => null)) as TResponse | null;
  if (!response.ok) {
    return null;
  }
  return body;
}

export async function fetchClientJsonResponse<TResponse>(
  input: string,
  init?: RequestInit,
  options?: { fetcher?: ClientFetcher },
): Promise<{ response: Response; body: TResponse | null }> {
  const response = await resolveClientFetcher(options?.fetcher)(input, init);
  const body = (await response.json().catch(() => null)) as TResponse | null;
  return { response, body };
}

export async function requireClientJson<TResponse>(
  input: string,
  init: RequestInit | undefined,
  options?: { fetcher?: ClientFetcher; errorMessage?: string; unauthorizedMessage?: string },
): Promise<TResponse & JsonErrorBody> {
  const response = await resolveClientFetcher(options?.fetcher)(input, init);
  const body = (await response.json().catch(() => null)) as (TResponse & JsonErrorBody) | null;
  if (!response.ok || !body || body.ok === false) {
    if (response.status === 401 && options?.unauthorizedMessage) {
      throw new Error(options.unauthorizedMessage);
    }
    throw new Error(body?.error || options?.errorMessage || `Request failed (${response.status}).`);
  }
  return body;
}

export async function requireResponseClientJson<TResponse>(
  input: string,
  init: RequestInit | undefined,
  options?: { fetcher?: ClientFetcher; errorMessage?: string; unauthorizedMessage?: string },
): Promise<TResponse> {
  const response = await resolveClientFetcher(options?.fetcher)(input, init);
  const body = (await response.json().catch(() => null)) as TResponse | null;
  if (!response.ok || body === null) {
    if (response.status === 401 && options?.unauthorizedMessage) {
      throw new Error(options.unauthorizedMessage);
    }
    throw new Error(options?.errorMessage || `Request failed (${response.status}).`);
  }
  return body;
}

export async function fetchRequiredClientJson<TResponse>(
  input: string,
  init: RequestInit | undefined,
  options?: { fetcher?: ClientFetcher; errorMessage?: string; unauthorizedMessage?: string },
): Promise<TResponse> {
  const { response, body } = await fetchClientJsonResponse<TResponse & JsonErrorBody>(input, init, options);
  if (!response.ok || body === null) {
    if (response.status === 401 && options?.unauthorizedMessage) {
      throw new Error(options.unauthorizedMessage);
    }
    throw new Error(extractClientErrorMessage(body, options?.errorMessage || `Request failed (${response.status}).`));
  }
  return body;
}

export async function fetchOptionalOkClientJson<TResponse extends JsonErrorBody>(
  input: string,
  init: RequestInit | undefined,
  options?: { fetcher?: ClientFetcher },
): Promise<TResponse | null> {
  const body = await fetchClientJson<TResponse>(input, init, options);
  if (!body?.ok) return null;
  return body;
}

export function buildJsonRequestInit(method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

export function buildJsonPostInit(body?: unknown): RequestInit {
  return buildJsonRequestInit("POST", body);
}
