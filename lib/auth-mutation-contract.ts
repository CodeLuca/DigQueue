export type AuthRedirectResponse = {
  redirectTo: string;
};

export type PasswordResetNoticeResponse = {
  notice: string;
};

export type IntegrationProvider = "discogs" | "youtube";

export type IntegrationDisconnectResponse = {
  provider: IntegrationProvider;
};

export function buildAuthRedirectResponse(redirectTo: string): AuthRedirectResponse {
  return { redirectTo };
}

export function normalizeAuthRedirectResponse(
  body: Partial<{
    redirectTo: string;
  }>,
  fallbackRedirect: string,
): AuthRedirectResponse {
  return {
    redirectTo: body.redirectTo || fallbackRedirect,
  };
}

export function buildPasswordResetNoticeResponse(notice: string): PasswordResetNoticeResponse {
  return { notice };
}

export function normalizePasswordResetNoticeResponse(
  body: Partial<{
    notice: string;
  }>,
  fallbackNotice: string,
): PasswordResetNoticeResponse {
  return {
    notice: body.notice || fallbackNotice,
  };
}

export function buildIntegrationDisconnectResponse(
  provider: IntegrationProvider,
): IntegrationDisconnectResponse {
  return { provider };
}

export function normalizeIntegrationDisconnectResponse(
  body: Partial<{
    provider: IntegrationProvider;
  }>,
  fallbackProvider: IntegrationProvider,
): IntegrationDisconnectResponse {
  return {
    provider: body.provider || fallbackProvider,
  };
}
