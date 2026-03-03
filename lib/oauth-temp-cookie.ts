type DiscogsOAuthPending = {
  state: string;
  requestToken: string;
  requestTokenSecret: string;
};

type YoutubeOAuthPending = {
  state: string;
  nextPath: string;
};

function encodePayload(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodePayload<T>(value: string): T | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function encodeDiscogsOAuthPending(value: DiscogsOAuthPending) {
  return encodePayload(value);
}

export function decodeDiscogsOAuthPending(raw: string): DiscogsOAuthPending | null {
  const parsed = decodePayload<Partial<DiscogsOAuthPending>>(raw);
  if (parsed?.state && parsed.requestToken && parsed.requestTokenSecret) {
    return {
      state: parsed.state,
      requestToken: parsed.requestToken,
      requestTokenSecret: parsed.requestTokenSecret,
    };
  }

  // Backward compatibility with previous colon-separated format.
  const [state, requestToken, requestTokenSecret] = raw.split(":");
  if (!state || !requestToken || !requestTokenSecret) return null;
  return { state, requestToken, requestTokenSecret };
}

export function encodeYoutubeOAuthPending(value: YoutubeOAuthPending) {
  return encodePayload(value);
}

export function decodeYoutubeOAuthPending(raw: string): YoutubeOAuthPending | null {
  const parsed = decodePayload<Partial<YoutubeOAuthPending>>(raw);
  if (parsed?.state && parsed.nextPath) {
    return { state: parsed.state, nextPath: parsed.nextPath };
  }

  // Backward compatibility with previous colon-separated format.
  const index = raw.indexOf(":");
  if (index <= 0) return null;
  const state = raw.slice(0, index);
  const nextPath = raw.slice(index + 1);
  if (!state || !nextPath) return null;
  return { state, nextPath };
}
