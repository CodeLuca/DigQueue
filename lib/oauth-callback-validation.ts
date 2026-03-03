export function validateDiscogsOAuthCallbackInput(input: {
  returnedState: string;
  oauthToken: string;
  verifier: string;
  expectedState: string;
  requestToken: string;
  requestTokenSecret: string;
}) {
  const hasRequired =
    Boolean(input.returnedState) &&
    Boolean(input.oauthToken) &&
    Boolean(input.verifier) &&
    Boolean(input.expectedState) &&
    Boolean(input.requestToken) &&
    Boolean(input.requestTokenSecret);
  if (!hasRequired) {
    return { ok: false as const, reason: "invalid_callback" as const };
  }
  if (input.returnedState !== input.expectedState || input.oauthToken !== input.requestToken) {
    return { ok: false as const, reason: "state_mismatch" as const };
  }
  return { ok: true as const };
}

export function validateYoutubeOAuthCallbackInput(input: {
  returnedState: string;
  code: string;
  expectedState: string;
}) {
  if (!input.returnedState || !input.code || !input.expectedState || input.returnedState !== input.expectedState) {
    return { ok: false as const, reason: "invalid_callback" as const };
  }
  return { ok: true as const };
}
